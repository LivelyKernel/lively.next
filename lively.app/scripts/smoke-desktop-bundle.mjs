#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

const CDP_PORT = Number(process.env.LIVELY_APP_SMOKE_CDP_PORT || 9222);
const DEFAULT_TIMEOUT = 300000;
const WORLD_PATH = '/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=true';
const PROJECT_PATH = '/projects/load?name=__newProject__&askForWorldName=false&fastLoad=true';
const EXISTING_PROJECT_PATH = '/projects/load?name=smoke--project&askForWorldName=false&fastLoad=true';
const CORE_PACKAGES = [
  'lively.modules',
  'lively.resources',
  'lively.storage',
  'lively.freezer',
  'lively.morphic'
];
let appExitStatus = null;

function parseArgs () {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor (label, fn, timeoutMs = DEFAULT_TIMEOUT, intervalMs = 500) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    if (appExitStatus) {
      throw new Error(`App exited before ${label}: code=${appExitStatus.code}, signal=${appExitStatus.signal}`);
    }
    try {
      const result = await fn();
      if (result) return result;
    } catch (err) {
      lastError = err;
    }
    await sleep(intervalMs);
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms${lastError ? `; last error: ${lastError.message || lastError}` : ''}`);
}

function tailFile (file, max = 12000) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.length > max ? text.slice(text.length - max) : text;
  } catch (_) {
    return '';
  }
}

function readTextFile (file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (_) {
    return '';
  }
}

function hostPlatform () {
  if (process.platform === 'darwin') return 'osx';
  if (process.platform === 'win32') return 'win';
  return process.platform;
}

function headlessArgs (headless) {
  return headless ? ['--headless=new', '--disable-gpu'] : [];
}

function appCommand (bundleDir, platform, headless = false) {
  const chromiumArgs = headlessArgs(headless);
  if (platform === 'linux') {
    return { command: path.join(bundleDir, 'nw'), args: chromiumArgs.concat(bundleDir) };
  }
  if (platform === 'osx') {
    return { command: path.join(bundleDir, 'lively.next.app', 'Contents', 'MacOS', 'nwjs'), args: chromiumArgs };
  }
  if (platform === 'win') {
    return { command: path.join(bundleDir, 'lively.next.exe'), args: chromiumArgs.concat(bundleDir) };
  }
  throw new Error(`Unsupported smoke platform: ${platform}`);
}

function devAppCommand (rootDir) {
  return { command: 'bash', args: [path.join(rootDir, 'lively.app', 'start.sh')] };
}

function assertExecutableExists (command) {
  if (command === 'bash') return;
  if (!fs.existsSync(command)) throw new Error(`App launcher not found: ${command}`);
}

async function stopApp (child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 3000).unref();
  }
  await exited;
}

async function fetchJson (url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function waitForHttpOk (url, timeoutMs) {
  return waitFor(`HTTP ${url}`, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      response.body?.cancel?.();
      return response.status < 400;
    } finally {
      clearTimeout(timeout);
    }
  }, timeoutMs);
}

async function waitForBootLogReady (logFile, timeoutMs) {
  let seenPort = null;
  return waitFor('desktop server startup', () => {
    const log = readTextFile(logFile);
    seenPort = Number(log.match(/Starting lively\.server on 127\.0\.0\.1:(\d+)/)?.[1] || seenPort || 0) || null;
    if (/ERROR:|Server crashed|Boot failed/.test(log)) {
      throw new Error(`desktop boot failed:\n${log}`);
    }
    if (seenPort && log.includes('Server ready, loading lively')) return seenPort;
    return null;
  }, timeoutMs);
}

/** Require a real SWC translation after frozen bootstrap chunks have replayed. */
async function assertBrowserSwc (client) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const compiler = await System.import('lively.source-transform/swc/browser-transform.js');
      if (System.transpiler !== 'lively.transpiler.swc' || !compiler.isAvailable()) {
        throw new Error('Desktop bootstrap lost the initialized SWC compiler');
      }
      const modules = await System.import('lively.modules');
      const id = new URL('lively.lang/desktop-swc-probe.js', System.baseURL).href;
      let usedSwc = false;
      const log = console.log;
      console.log = (message, ...args) => {
        if (String(message).startsWith('[swc] ' + id + ' ')) usedSwc = true;
        log.call(console, message, ...args);
      };
      try {
        const code = await System.translate({
          name: id, source: 'export const answer = 42;', metadata: { module: modules.module(id) }
        });
        if (!usedSwc || !code.includes('System.register')) throw new Error('Desktop module translation fell back from SWC');
        new Function(code);
        return true;
      } finally { console.log = log; }
    })()`
  });
  if (result.exceptionDetails || result.result?.value !== true) {
    throw new Error('Desktop SWC compiler failed: ' + JSON.stringify(result.exceptionDetails || result.result));
  }
  console.log('Desktop app smoke passed: initialized SWC compiles a module without Babel fallback');
}

/** Select and edit a genuinely frozen module through the system browser. */
async function assertFrozenModuleResurrection (client) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const modules = await System.import('lively.modules');
      const mod = modules.module('lively.lang/string.js');
      const frozen = mod.getFrozenRecord();
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      check(mod._frozenModule && frozen && !frozen.isRevived,
        'Resurrection test must start with an unrevived frozen module');
      const { browse } = await System.import('lively.ide/js/browser/ui.cp.js');
      const browser = (await browse({ packageName: 'lively.lang', moduleName: 'string.js' })).viewModel;
      const original = browser.ui.sourceEditor.textString;
      try {
        check(browser.selectedModule.url === mod.id, 'Browser selected a different module');
        check(!mod._frozenModule && frozen.isRevived && frozen.recorder.__revived__,
          'Selecting the module did not await revival of its frozen record');
        check(original.includes('function capitalize (s) {'), 'Browser did not show original module source');
        for (const value of ['revived once', 'revived twice']) {
          browser.ui.sourceEditor.textString = original.replace('function capitalize (s) {',
            'function capitalize (s) {\\n  if (s === "desktop resurrection") return "' + value + '";');
          await browser.save();
          const evaluation = await browser.editorPlugin.runEval('capitalize("desktop resurrection")');
          check(!evaluation.isError && evaluation.value === value, 'Editor evaluation did not use the revived source: ' + JSON.stringify(evaluation));
          check((await System.import(mod.id)).capitalize('desktop resurrection') === value,
            'Live module exports did not update after saving');
          check(lively.frozenModules.exportsOf('lively.lang/index.js').string.capitalize('desktop resurrection') === value,
            'Bundled lively.lang consumer did not update after saving');
          check(lively.frozenModules.exportsOf('lively.lang/string.js').capitalize('desktop resurrection') === value,
            'Frozen module exports did not update after saving');
          check((await browser.systemInterface.moduleRead(mod.id)).includes(value),
            'Browser save did not persist the source');
        }
        await browser.browse({ packageName: 'lively.lang', moduleName: 'number.js' });
        await browser.browse({ packageName: 'lively.lang', moduleName: 'string.js' });
        check(browser.ui.sourceEditor.textString.includes('revived twice'), 'Reopening the module lost the saved source');
        return true;
      } finally {
        browser.ui.sourceEditor.textString = original;
        await browser.save();
        browser.view.getWindow().remove();
      }
    })()`
  });
  if (result.exceptionDetails || result.result?.value !== true) {
    throw new Error('Desktop frozen module resurrection failed: ' + JSON.stringify(result.exceptionDetails || result.result));
  }
  console.log('Desktop app smoke passed: selecting a frozen module revives it; repeated saves update editor evaluation, live exports and bundled consumers');
}

/** Browse project components without following installed dependency links. */
async function assertComponentModuleURLs (client) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const { ComponentBrowser } = await System.import('lively.ide/studio/component-browser.cp.js');
      const { part } = await System.import('lively.morphic');
      const { default: HTTPResource } = await System.import('lively.resources/src/http-resource.js');
      const { promise } = await System.import('lively.lang');
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const original = HTTPResource.prototype._propfind;
      const partsbinUpdated = $world._partsbinUpdated;
      // Fail before a bad scan enters Bun's cyclic workspace symlinks.
      HTTPResource.prototype._propfind = function (...args) {
        check(!this.url.includes('/node_modules/'), 'Component discovery traversed an installed dependency: ' + this.url);
        return original.apply(this, args);
      };
      $world._partsbinUpdated = true;
      const browser = part(ComponentBrowser, { name: 'desktop component URL smoke' });
      browser.openInWindow({ title: 'Browse Project Components' });
      try {
        const model = browser.viewModel;
        const columns = model.ui.componentFilesView;
        const tree = columns.treeData;
        await tree.collapse(tree.root, false);
        const project = tree.root.subNodes.find(node => node.pkg?.name === 'smoke--project');
        check(project, 'Component browser did not list the opened project');
        await columns.selectNode(project, false);
        const ui = project.subNodes.find(node => node.name === 'ui');
        check(ui, 'Component browser did not discover project source components');
        await columns.selectNode(ui, false);
        const file = ui.subNodes.find(node => node.name === 'url-probe.cp.js');
        check(file, 'Component browser did not list the source component module');
        await columns.selectNode(file, false);
        check(file.subNodes.some(node => node.componentObject.componentName === 'DesktopURLProbe'), 'Component browser did not discover the component export');
        const expected = new URL('local_projects/smoke--project/ui/url-probe.cp.js', System.baseURL).href;
        check(System.registry.has(expected), 'Component browser did not import the canonical project source');
        // Also exercise the global component search, whose scan has a separate entry point.
        tree.root.subNodes = [{ name: 'Popular' }, project];
        model.ui.searchInput.input = 'DesktopURLProbe';
        let searched;
        const updated = model.updateList;
        model.updateList = async function (matches, organize) {
          searched = matches;
          return updated.call(this, matches, organize);
        };
        await model.filterAllComponents();
        await promise.waitFor(30000, () => searched);
        check(Object.values(searched).flat().some(component => component.componentName === 'DesktopURLProbe'),
          'Component search did not find the project source component');
        const aliases = Object.keys(System['__lively.modules__loadedModules']).filter(id =>
          id.includes('/node_modules/') && !id.includes('/node_modules/.bun/') && (id.includes('/node_modules/lively.') || id.includes('/node_modules/lively-')));
        check(!aliases.length, 'Component browsing created duplicate workspace module URLs: ' + aliases.join(', '));
        return true;
      } finally {
        HTTPResource.prototype._propfind = original;
        $world._partsbinUpdated = partsbinUpdated;
        browser.getWindow().remove();
      }
    })()`
  });
  if (result.exceptionDetails || result.result?.value !== true) {
    throw new Error('Desktop component module URLs failed: ' + JSON.stringify(result.exceptionDetails || result.result));
  }
  console.log('Desktop app smoke passed: component browsing and search use project source URLs without traversing Bun links');
}

async function assertBrowserEnvironmentSwitching (client, port) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const { browse } = await System.import('lively.ide/js/browser/ui.cp.js');
      const { serverInterfaceFor } = await System.import('lively-system-interface');
      const browser = (await browse({ packageName: 'lively.lang', moduleName: 'index.js' })).viewModel;
      const remote = serverInterfaceFor('http://127.0.0.1:${port}/eval');
      const originalSource = browser.ui.sourceEditor.textString;
      try {
        for (const backend of [remote, 'local']) {
          await browser.setEvalBackend(backend);
          const packages = browser.ui.columnView.treeData.root.subNodes.filter(p => p.name === 'lively.lang');
          if (packages.length !== 1) throw new Error('Browser lists duplicate lively.lang packages');
          const expectedProtocol = backend === 'local' ? 'http:' : 'file:';
          if (!browser.selectedModule.url.startsWith(expectedProtocol)) throw new Error('Browser retained the previous backend module URL');
          if (browser.ui.sourceEditor.textString !== originalSource) throw new Error('Browser changed the displayed source across environments');
          const evaluated = await browser.editorPlugin.runEval('arr.range(1, 3)');
          if (evaluated.isError || JSON.stringify(evaluated.value) !== '[1,2,3]') throw new Error('Browser evaluation used the wrong module context: ' + evaluated.value);
        }
        await browser.browse({ packageName: 'lively.morphic', moduleName: 'world.js' });
        await browser.setEvalBackend(remote);
        if (!browser.ui.sourceEditor.readOnly || !browser.state.moduleEnvironmentError?.includes('client only')) throw new Error('Browser allowed a frontend module on the server');
        await browser.browse({ packageName: 'lively.server', moduleName: 'server.js' });
        await browser.setEvalBackend('local');
        if (!browser.ui.sourceEditor.readOnly || !browser.state.moduleEnvironmentError?.includes('server only')) throw new Error('Browser allowed a server module on the client');
        return true;
      } finally { browser.view.getWindow().remove(); }
    })()`
  });
  if (result.exceptionDetails || result.result?.value !== true) {
    throw new Error('Desktop system browser smoke failed: ' + JSON.stringify(result.exceptionDetails || result.result));
  }
  console.log('Desktop app smoke passed: browser switching preserves original source, module evaluation, and environment boundaries');
}

/** Exercise local programming and verify the saved work after an app restart. */
async function assertProjectProgramming (client, port, reopened = false) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const { browse } = await System.import('lively.ide/js/browser/ui.cp.js');
      const { serverInterfaceFor } = await System.import('lively-system-interface');
      const { resource } = await System.import('lively.resources');
      const { promise } = await System.import('lively.lang');
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const fullName = 'smoke--programming';
      if (!${reopened}) {
        localStorage.setItem('LIVELY_OFFLINE_MODE', '1');
        const { storeCurrentUser, storeCurrentUsersOrganizations } = await System.import('lively.user');
        storeCurrentUser({ login: 'smoke', name: 'Desktop smoke', email: 'smoke@example.invalid',
          avatar_url: 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%221%22%20height=%221%22/%3E' });
        storeCurrentUsersOrganizations([]);
        const { part } = await System.import('lively.morphic');
        const { ProjectCreationPrompt } = await System.import('lively.project/prompts.cp.js');
        const prompt = part(ProjectCreationPrompt);
        const created = $world.openPrompt(prompt);
        await promise.waitFor(60000, () => prompt.viewModel.ui.userSelector.selection);
        prompt.viewModel.ui.projectName.textString = 'programming';
        prompt.viewModel.checkValidity();
        await prompt.viewModel.resolve();
        $world.openedProject = await promise.timeout(120000, created);
        check($world.openedProject.fullName === fullName, 'Local project creation failed');
      }
      const browser = (await browse({ packageName: fullName, moduleName: 'index.js' })).viewModel;
      const remote = serverInterfaceFor('http://127.0.0.1:${port}/eval');
      const manifest = resource(System.baseURL).join('local_projects/' + fullName + '/package.json');
      try {
        if (!${reopened}) {
          await browser.setModuleEnvironment('client');
          browser.ui.sourceEditor.textString = [
            '/* global $world */',
            "import { Text } from 'lively.morphic';",
            "import { pt } from 'lively.graphics';",
            'export const answer = 41;',
            'export function showAnswer () {',
            "  const label = $world.get('desktop-programming-result') || new Text({name: 'desktop-programming-result'}).openInWorld(pt(300, 150));",
            '  label.textString = String(answer);',
            '  return label;',
            '}',
            'showAnswer();',
            'export function main () { showAnswer(); }'
          ].join('\\n');
          await browser.save();
          check($world.get('desktop-programming-result')?.textString === '41', 'Client save did not run the project code');
          browser.ui.sourceEditor.textString = browser.ui.sourceEditor.textString.replace('answer = 41', 'answer = 42');
          await browser.save();
          check($world.get('desktop-programming-result')?.textString === '42', 'Client edit did not update the visible result');
        }
        let evaluation = await browser.editorPlugin.runEval('answer');
        check(!evaluation.isError && evaluation.value === 42, 'Client evaluation did not use saved project code');
        check(browser.ui.sourceEditor.textString.includes('export const answer = 42'), 'Client browser did not reopen original source');
        check(browser.ui.moduleEnvironment.selection === 'client', 'Client module declaration was lost');
        await browser.setEvalBackend(remote);
        check(browser.ui.sourceEditor.readOnly && browser.state.moduleEnvironmentError?.includes('client only'), 'Server allowed the client entry module');
        if (!${reopened}) {
          const oldPrompt = $world.prompt;
          try {
            $world.prompt = async () => 'backend-tools';
            await browser.interactivelyAddNewModule(browser.selectedPackage.url + '/', 'js');
          } finally { $world.prompt = oldPrompt; }
          await browser.whenModuleUpdated();
          check(browser.selectedModule?.url.endsWith('/backend-tools.js'), 'New server module was not selected');
          await promise.waitFor(60000, () => !browser.state.moduleUpdateInProgress &&
            browser.editorPlugin.evalEnvironment.targetModule === browser.selectedModule.url);
          await browser.setModuleEnvironment('server');
          browser.ui.sourceEditor.textString = [
            '/* global URL */',
            "import { readFileSync } from 'node:fs';",
            'export const answer = 42;',
            'export function readProjectName () {',
            "  return JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).name;",
            '}'
          ].join('\\n');
          await browser.save();
          evaluation = await browser.editorPlugin.runEval('answer');
          check(!evaluation.isError && evaluation.value === 42, 'New server module did not save and evaluate: ' + (evaluation.value?.stack || evaluation.value));
          browser.ui.sourceEditor.textString = browser.ui.sourceEditor.textString.replace('answer = 42', 'answer = 43');
          await browser.save();
        } else {
          await browser.browse({ packageName: fullName, moduleName: 'backend-tools.js' });
        }
        evaluation = await browser.editorPlugin.runEval('answer');
        check(!evaluation.isError && evaluation.value === 43, 'Server edit did not update evaluation');
        check(browser.ui.sourceEditor.textString.includes('export const answer = 43'), 'Server browser did not reopen original source');
        evaluation = await browser.editorPlugin.runEval('readProjectName()');
        check(!evaluation.isError && evaluation.value === fullName, 'Server module could not read the project using Node');
        check(browser.ui.moduleEnvironment.selection === 'server', 'Server module declaration was lost');
        await browser.setEvalBackend('local');
        check(browser.ui.sourceEditor.readOnly && browser.state.moduleEnvironmentError?.includes('server only'), 'Client allowed the server module');
        const before = (await manifest.readJson()).lively.meta;
        check(JSON.stringify(before['index.js'].environments) === '["client"]' &&
          JSON.stringify(before['backend-tools.js'].environments) === '["server"]', 'Module settings did not reach package.json');
        if (!${reopened}) {
          check(await $world.openedProject.save({message: 'Save client and server programming work'}), 'Project save failed');
          check(JSON.stringify((await manifest.readJson()).lively.meta) === JSON.stringify(before), 'Project save discarded module environments');
        }
        for (const backend of [remote, 'local']) {
          await browser.setEvalBackend(backend);
          check(browser.ui.columnView.treeData.root.subNodes.filter(p => p.name === fullName).length === 1, 'Project was duplicated when switching backends');
        }
        return true;
      } finally { browser.view.getWindow().remove(); }
    })()`
  });
  if (result.exceptionDetails || result.result?.value !== true) {
    throw new Error('Desktop project programming failed: ' + JSON.stringify(result.exceptionDetails || result.result));
  }
  console.log('Desktop app smoke passed: ' + (reopened
    ? 'relaunch reopens saved client/server source, evaluation, visible output and module environments'
    : 'local project creation, client/server module creation, live editing, evaluation and project save'));
}

async function waitForPageTarget (dashboardUrl, timeoutMs) {
  return waitFor('NW.js dashboard DevTools page target', async () => {
    const targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const target = targets.find(target =>
      target.webSocketDebuggerUrl &&
      String(target.url || '').startsWith(dashboardUrl));
    if (!target) throw new Error(`Available DevTools targets: ${JSON.stringify(targets.map(({ type, url }) => ({ type, url })))}`);
    return target;
  }, timeoutMs);
}

/** Open a dashboard tile without replacing the frozen renderer's document. */
async function openDashboardProject (client, fullName) {
  const result = await waitFor('dashboard project tile', async () => {
    const result = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        localStorage.removeItem('LIVELY_OFFLINE_MODE');
        const preview = globalThis.$world?.get('a project browser')?.viewModel?.previews?.find(p => p._project._name === ${JSON.stringify(fullName)});
        const button = preview?.get('open button');
        const node = button && document.getElementById(button.id);
        if (!node) return null;
        const bounds = node.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return null;
        globalThis.__desktopDashboardDocument = document;
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      })()`
    });
    if (result.exceptionDetails) throw new Error('Dashboard project tile unavailable: ' + JSON.stringify(result.exceptionDetails));
    return result.result?.value ? result : null;
  }, 60000);
  const { x, y } = result.result.value;
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

class CDPClient {
  constructor (url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.exceptions = [];
    this.nonCanonicalModuleURLs = new Set();
    this.ws = new WebSocket(url);
  }

  async open () {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', event => reject(new Error(`CDP websocket error: ${event.message || 'unknown'}`)), { once: true });
    });
    this.ws.addEventListener('message', event => this._onMessage(event.data));
  }

  _onMessage (data) {
    const text = typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
    const message = JSON.parse(text);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message || 'CDP error'}${message.error.data ? `: ${message.error.data}` : ''}`));
      else resolve(message.result || {});
    } else if (message.method) {
      if (message.method === 'Network.requestWillBeSent') {
        const url = message.params.request.url;
        if (/\/node_modules\/lively[.-]/.test(url) && !url.includes('/node_modules/.bun/') && /\.(?:[cm]?js|jsx)(?:[?#]|$)/.test(url)) {
          this.nonCanonicalModuleURLs.add(url);
        }
      }
      if (message.method === 'Runtime.exceptionThrown') this.exceptions.push(message.params.exceptionDetails);
      if (message.method === 'Page.javascriptDialogOpening' && message.params.type === 'beforeunload') {
        this.send('Page.handleJavaScriptDialog', { accept: true })
          .catch(err => this.exceptions.push({ text: err.message }));
      }
      this.events.push(message);
      if (this.events.length > 200) this.events.shift();
    }
  }

  send (method, params = {}, options = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const timeoutMs = Number(options.timeoutMs || options.timeout || 0);
    return new Promise((resolve, reject) => {
      let timer = null;
      const finish = fn => value => {
        if (timer) clearTimeout(timer);
        fn(value);
      };
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.pending.set(id, {
        resolve: finish(resolve),
        reject: finish(reject)
      });
      try {
        this.ws.send(payload);
      } catch (err) {
        if (timer) clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  close () {
    try { this.ws.close(); } catch (_) {}
  }

  assertNoRendererErrors () {
    if (this.nonCanonicalModuleURLs.size) throw new Error('Noncanonical workspace module requests: ' + [...this.nonCanonicalModuleURLs].join(', '));
    if (this.exceptions.length) throw new Error('Uncaught desktop renderer errors: ' + JSON.stringify(this.exceptions));
  }
}

function summarizeCdpEvent (event) {
  const { method, params = {} } = event;
  if (method === 'Runtime.consoleAPICalled') {
    return {
      method,
      type: params.type,
      text: (params.args || []).map(arg => arg.value ?? arg.description ?? arg.type).join(' '),
      url: params.stackTrace?.callFrames?.[0]?.url,
      line: params.stackTrace?.callFrames?.[0]?.lineNumber
    };
  }
  if (method === 'Runtime.exceptionThrown') {
    return {
      method,
      text: params.exceptionDetails?.text,
      exception: params.exceptionDetails?.exception?.description || params.exceptionDetails?.exception?.value,
      url: params.exceptionDetails?.url,
      line: params.exceptionDetails?.lineNumber
    };
  }
  if (method === 'Log.entryAdded') {
    const entry = params.entry || {};
    return {
      method,
      level: entry.level,
      source: entry.source,
      text: entry.text,
      url: entry.url,
      line: entry.lineNumber
    };
  }
  return { method, params };
}

function recentCdpDiagnostics (client) {
  return client.events
    .filter(event => [
      'Runtime.consoleAPICalled',
      'Runtime.exceptionThrown',
      'Log.entryAdded',
      'Page.javascriptDialogOpening'
    ].includes(event.method))
    .slice(-80)
    .map(summarizeCdpEvent);
}

async function describePageState (client) {
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const world = globalThis.$world;
        return {
          href: location.href,
          readyState: document.readyState,
          title: document.title,
          hasWorld: Boolean(world),
          worldName: world && world.name,
          loadError: globalThis.__loadError__ && (__loadError__.stack || String(__loadError__)),
          projectEntryExecuted: Boolean(globalThis.__livelyProjectSmokeOpened),
          bodyText: document.body && document.body.innerText && document.body.innerText.slice(0, 1000)
        };
      })()`,
      returnByValue: true
    });
    return result.result && result.result.value;
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

async function assertRendererUsesHttpSystemURLs (client, port, timeoutMs, options = {}) {
  const expectedOrigin = `http://127.0.0.1:${port}`;
  const requirePopulatedSystemMap = Boolean(options.requirePopulatedSystemMap);
  const result = await waitFor('renderer System HTTP module resolution', async () => {
    const evaluation = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const expectedOrigin = ${JSON.stringify(expectedOrigin)};
        const corePackages = ${JSON.stringify(CORE_PACKAGES)};
        const requirePopulatedSystemMap = ${JSON.stringify(requirePopulatedSystemMap)};

        function packageURLsOf(registry) {
          const urls = [];
          const packageMap = registry && registry.packageMap;
          if (!packageMap) return urls;
          for (const [name, spec] of Object.entries(packageMap)) {
            const versions = spec && spec.versions || {};
            for (const [version, pkg] of Object.entries(versions)) {
              if (pkg && pkg.url) {
                urls.push({ name, version, url: String(pkg.url) });
              }
            }
          }
          return urls;
        }

        function fileURLConfigEntries(object, label) {
          const entries = [];
          for (const [key, value] of Object.entries(object || {})) {
            if (String(key).startsWith('file://')) {
              entries.push({ label, key, value: typeof value === 'string' ? value : undefined });
              continue;
            }
            if (typeof value === 'string' && value.startsWith('file://')) {
              entries.push({ label, key, value });
              continue;
            }
            if (value && typeof value === 'object') {
              for (const [nestedKey, nestedValue] of Object.entries(value.map || {})) {
                if (String(nestedKey).startsWith('file://') ||
                    typeof nestedValue === 'string' && nestedValue.startsWith('file://')) {
                  entries.push({
                    label,
                    key,
                    nestedKey,
                    nestedValue: typeof nestedValue === 'string' ? nestedValue : undefined
                  });
                }
              }
            }
          }
          return entries;
        }

        return Promise.resolve().then(async () => {
          const System = globalThis.System;
          if (!System || typeof System.normalize !== 'function') {
            return { ready: false, reason: 'System is not ready' };
          }

          const livelyEnv = System.get && System.get('@lively-env');
          const registry = livelyEnv && livelyEnv.packageRegistry || System['__lively.modules__packageRegistry'];
          if (!registry || !registry.packageMap) {
            return { ready: false, reason: 'package registry is not ready' };
          }
          const systemEnv = System.get && System.get('@system-env');

          const normalized = {};
          for (const name of corePackages) {
            try {
              normalized[name] = String(await System.normalize(name));
            } catch (err) {
              normalized[name] = 'ERROR: ' + (err && err.message || String(err));
            }
          }

          const packageURLs = packageURLsOf(registry);
          const filePackageURLs = packageURLs
            .filter(({ url }) => url.startsWith('file://'));
          const systemMapSize = Object.keys(System.map || {}).length;
          if (requirePopulatedSystemMap && !systemMapSize) {
            return {
              ready: false,
              reason: 'System.map is not populated yet',
              baseURL: String(System.baseURL || '')
            };
          }
          const fileSystemMapEntries = fileURLConfigEntries(System.map, 'System.map');
          const fileSystemPackageEntries = fileURLConfigEntries(System.packages, 'System.packages');
          const badNormalized = Object.entries(normalized)
            .filter(([, url]) => url.startsWith('file://'))
            .map(([name, url]) => ({ name, url }));

          return {
            ready: true,
            baseURL: String(System.baseURL || ''),
            expectedOrigin,
            systemEnv: systemEnv && {
              browser: Boolean(systemEnv.browser),
              nw: Boolean(systemEnv.nw),
              node: Boolean(systemEnv.node),
              nodeRequire: Boolean(systemEnv.nodeRequire),
              nodeBuiltins: Boolean(systemEnv.nodeBuiltins)
            },
            hasNodeRequire: Boolean(System._nodeRequire),
            systemMapSize,
            normalized,
            packageURLs,
            filePackageURLs,
            fileSystemMapEntries,
            fileSystemPackageEntries,
            badNormalized,
            badPackageURLs: filePackageURLs,
            badSystemConfigEntries: fileSystemMapEntries.concat(fileSystemPackageEntries)
          };
        });
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    const value = evaluation.result && evaluation.result.value;
    if (!value || !value.ready) return null;
    return value;
  }, timeoutMs);

  const errors = [];
  if (!String(result.baseURL || '').startsWith(expectedOrigin)) {
    errors.push(`System.baseURL is ${result.baseURL}, expected it to start with ${expectedOrigin}`);
  }
  if (result.systemEnv?.node || result.systemEnv?.nodeRequire || result.systemEnv?.nodeBuiltins || result.hasNodeRequire) {
    errors.push(`renderer System is still exposing Node resolution: ${JSON.stringify({
      systemEnv: result.systemEnv,
      hasNodeRequire: result.hasNodeRequire
    }, null, 2)}`);
  }
  if (requirePopulatedSystemMap && !result.systemMapSize) {
    errors.push('System.map was expected to be populated on this route, but it is still empty');
  }
  if (result.badNormalized.length) {
    errors.push(`System.normalize returned file:// URLs: ${JSON.stringify(result.badNormalized, null, 2)}`);
  }
  if (result.badPackageURLs.length) {
    errors.push(`package registry contains file:// URLs: ${JSON.stringify(result.badPackageURLs, null, 2)}`);
  }
  if (result.badSystemConfigEntries.length) {
    errors.push(`SystemJS config contains file:// mappings: ${JSON.stringify(result.badSystemConfigEntries.slice(0, 40), null, 2)}`);
  }
  if (errors.length) {
    throw new Error([
      'NW.js renderer System must resolve core modules through the HTTP server.',
      ...errors,
      `Observed state: ${JSON.stringify(result, null, 2)}`
    ].join('\n'));
  }
}

function seedProject (dataDir) {
  const runtimeRoot = path.join(dataDir, 'runtime-root');
  const projectDir = path.join(runtimeRoot, 'local_projects', 'smoke--project');
  fs.mkdirSync(path.join(projectDir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'ui'), { recursive: true });
  const git = (directory, args) => {
    const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || String(result.error));
    return result.stdout.trim();
  };
  const commitArgs = ['-c', 'user.name=smoke', '-c', 'user.email=smoke@example.invalid',
    'commit', '--quiet', '--allow-empty', '-m', 'desktop smoke fixture'];
  // Give the project's version preflight a local baseline, without a remote.
  git(runtimeRoot, ['init', '--quiet', '--initial-branch=main']);
  git(runtimeRoot, commitArgs);
  const boundLivelyVersion = git(runtimeRoot, ['rev-parse', 'HEAD']);
  git(runtimeRoot, ['update-ref', 'refs/remotes/origin/main', boundLivelyVersion]);
  const dependencies = { 'smoke-fixture-lib': 'file:./lib', 'is-number': '6.0.0', 'lively.morphic': '^0.1.0' };
  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
    name: 'smoke--project', version: '0.1.0', type: 'module', main: 'index.js',
    dependencies, author: { name: 'smoke' }, lively: { projectDependencies: [], boundLivelyVersion }
  }));
  fs.writeFileSync(path.join(projectDir, 'index.js'),
    'import isNumber from "is-number";\n' +
    'if (!isNumber(42)) throw new Error("Project dependency did not load");\n' +
    'import { Morph, part } from "lively.morphic";\n' +
    'import { LoadingScreen } from "lively.freezer/src/loading-screen.cp.js";\n' +
    'const screen = part(LoadingScreen);\n' +
    'if (!(screen instanceof Morph)) throw new Error("Loading screen uses a different Morph class");\n' +
    'screen.withAllSubmorphsDo(() => {});\n' +
    'globalThis.__livelyProjectSmokeOpened = true; export const value = 42;\n');
  fs.writeFileSync(path.join(projectDir, 'lib', 'package.json'), JSON.stringify({
    name: 'smoke-fixture-lib', version: '1.0.0', type: 'module', main: 'index.js'
  }));
  fs.writeFileSync(path.join(projectDir, 'lib', 'index.js'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(projectDir, 'ui', 'url-probe.cp.js'),
    'import { component, Label } from \"lively.morphic\";\n' +
    'export const DesktopURLProbe = component({ type: Label, name: \"desktop URL probe\", textString: \"canonical project source\" });\n');
  // Start from a legacy checkout: the app must create the first Bun lock and install.
  for (const name of ['index.css', 'fonts.css']) fs.writeFileSync(path.join(projectDir, name), '');
  fs.writeFileSync(path.join(projectDir, '.gitignore'), 'node_modules/\n.cachedImportMap.json\n');
  git(projectDir, ['init', '--quiet', '--initial-branch=main']);
  git(projectDir, ['add', '.']);
  git(projectDir, commitArgs);
  // An unopened project left by an older app must not replace shared core sources.
  const dormant = path.join(runtimeRoot, 'local_projects', 'smoke--dormant');
  fs.mkdirSync(dormant, { recursive: true });
  fs.writeFileSync(path.join(dormant, 'package.json'), JSON.stringify({
    name: 'smoke--dormant', version: '0.1.0', author: { name: 'smoke' }, lively: { projectDependencies: [] }
  }));
  let legacyParent = dormant;
  for (const name of ['lively.freezer', 'lively-system-interface', 'lively.ast', 'lively.lang', 'lively.morphic', 'lively.modules']) {
    legacyParent = path.join(legacyParent, 'node_modules', name);
    fs.mkdirSync(legacyParent, { recursive: true });
    fs.writeFileSync(path.join(legacyParent, 'package.json'), JSON.stringify({ name, version: '9.0.0', main: 'index.js' }));
    fs.writeFileSync(path.join(legacyParent, 'index.js'), 'throw new Error("An unopened project replaced the bundled core sources");');
  }
}

async function assertDesktopDebuggerSmoke (client, timeoutMs) {
  const result = await client.send('Runtime.evaluate', {
    expression: `(async () => {
      const { run, runWithCapturedBindings } = await System.import('lively.context/lib/stackReification.js');
      const { openForContinuation } = await System.import('lively.ide/js/debugger/ui.cp.js');
      const marker = { count: 0 };
      function smokeOuter() {
        function smokeInner() {
          var amount = '1';
          debugger;
          this.count += amount;
          return this;
        }
        return smokeInner.call(this);
      }
      const continuation = run(smokeOuter, null, [], { this: marker });
      if (!continuation.isContinuation || continuation.frames().length !== 2) throw new Error('Missing rewriter frames');
      if (continuation.currentFrame.getThis() !== marker) throw new Error('Lost receiver identity');
      const view = openForContinuation(continuation, $world);
      const model = view.viewModel;
      await model.selectFrame(continuation.currentFrame);
      if (!model.ui.sourcePane.textString.includes('debugger;')) throw new Error('Missing original frame source');
      if (!model.ui.sourcePane.markers.some(marker => marker.id === 'lively-debugger-current-line')) throw new Error('Missing current statement marker');
      let ticked = false;
      await new Promise(resolve => setTimeout(() => { ticked = true; resolve(); }, 30));
      model.ui.workspaceInput.textString = 'this';
      if (await model.evaluateWorkspace() !== marker) throw new Error('Workspace lost receiver');
      model.ui.workspaceInput.textString = 'amount = Number(amount)';
      if (await model.evaluateWorkspace() !== 1) throw new Error('Workspace failed to repair local');
      const stepped = await model.stepOver();
      if (!stepped || !stepped.isContinuation) throw new Error('Step Over failed to suspend');
      const resumed = await model.proceed();
      if (resumed !== marker || marker.count !== 1) throw new Error('Resume lost state or identity');
      if ($world.getWindows().some(win => win.targetMorph === view)) throw new Error('Proceed did not close debugger');
      const counter = { count: 0, step: '1', pause: true };
      counter.increment = globalThis.Function('return function old_increment() { let amount = this.step; if (this.pause) debugger; this.count += Number(amount); return this.count; }')();
      counter.increment.displayName = 'increment';
      const counterView = openForContinuation(run(counter.increment, null, [], { this: counter }), $world);
      const counterModel = counterView.viewModel;
      await counterModel.selectFrame(counterModel.continuation.currentFrame);
      if (!(await counterModel.stepOver())?.isContinuation || counter.count !== 0) throw new Error('Conditional Step Over completed the function');
      counter.increment = globalThis.Function('return function new_increment() { let amount = Number(this.step) * 2; if (this.pause) debugger; this.count += amount; return this.count; }')();
      counter.increment.displayName = 'increment';
      if (!(await counterModel.restartFrame())?.isContinuation) throw new Error('Restart failed');
      await counterModel.selectFrame(counterModel.continuation.currentFrame);
      if (counterModel.continuation.currentFrame.pc?.type !== 'VariableDeclaration') throw new Error('Restart lost its pc');
      if (!counterModel.ui.sourcePane.textString.includes('* 2')) throw new Error('Restart retained the old method');
      if (!(await counterModel.proceed())?.isContinuation) throw new Error('Restart did not reach debugger');
      await counterModel.selectFrame(counterModel.continuation.currentFrame);
      if (counterModel.continuation.currentFrame.lookup('amount') !== 2) throw new Error('Restart lost lexical local');
      counter.pause = false;
      if (!(await counterModel.stepOver())?.isContinuation || counter.count !== 0) throw new Error('Restart lost its captured branch decision');
      await counterModel.selectFrame(counterModel.continuation.currentFrame);
      if (await counterModel.proceed() !== 2 || counter.count !== 2) throw new Error('Restart lost receiver');
      const retained = { count: 0 };
      let incrementStep = '1';
      function retainedIncrement() { var amount = incrementStep; debugger; retained.count += amount; return retained.count; }
      const capture = () => livelyDesktop.debugger.captureFunctionBindings(retainedIncrement, ['retained', 'incrementStep']);
      const [values, repeated] = await Promise.all([capture(), capture()]);
      if (values.retained !== retained || repeated.retained !== retained) throw new Error('Scope reader lost object identity');
      values.incrementStep = 7;
      if (incrementStep !== '1') throw new Error('Snapshot changed the original binding');
      values.incrementStep = '1';
      const retainedContinuation = run(retainedIncrement, null, [], values);
      retainedContinuation.currentFrame.getScope().set('amount', 1);
      if (retainedContinuation.resume() !== 1 || retained.count !== 1) throw new Error('Retained closure resume failed');
      const autoCaptured = await runWithCapturedBindings(retainedIncrement);
      if (autoCaptured.currentFrame.lookup('retained') !== retained) throw new Error('Automatic capture lost identity');
      autoCaptured.currentFrame.getScope().set('amount', 1);
      if (await autoCaptured.resume() !== 2) throw new Error('Automatic binding capture failed');
      let externalAmount = 4;
      const closureReceiver = {argReads: 0, child: function child(value) { let local = externalAmount + value; return local; }};
      const closureTask = globalThis.Function('return function task() { debugger; return this.child(++this.argReads); }')();
      const closureView = openForContinuation(run(closureTask, null, [], {this: closureReceiver}), $world);
      const closureModel = closureView.viewModel;
      await closureModel.selectFrame(closureModel.continuation.currentFrame);
      await closureModel.stepOver();
      if (!(await closureModel.stepInto())?.isContinuation || closureModel.continuation.frames().length !== 2) throw new Error('Retained method Step Into failed');
      if (closureReceiver.argReads !== 1) throw new Error('Binding capture repeated argument side effects');
      if (await closureModel.proceed() !== 5) throw new Error('Retained method resume failed');
      externalAmount = 8;
      const freshClosureView = openForContinuation(run(closureTask, null, [], {this: closureReceiver}), $world);
      const freshClosureModel = freshClosureView.viewModel;
      await freshClosureModel.stepOver();
      await freshClosureModel.stepInto();
      if (await freshClosureModel.proceed() !== 10 || closureReceiver.argReads !== 2) throw new Error('Retained bindings were not refreshed for the next call');
      const { openLiveCounter } = await System.import('lively.ide/js/debugger/examples/live-counter.js');
      const tutorial = openLiveCounter($world);
      const scopeView = await tutorial.debugLesson('scopeLesson'), scopeModel = scopeView.viewModel;
      await scopeModel.selectFrame(scopeModel.continuation.currentFrame);
      scopeModel.ui.workspaceInput.textString = 'let scratch = amount * 2; scratch';
      if (await scopeModel.evaluateWorkspace() !== 4) throw new Error('Workspace declaration failed');
      scopeModel.ui.workspaceInput.textString = 'scratch += 1';
      if (await scopeModel.evaluateWorkspace() !== 5) throw new Error('Workspace temporary was lost');
      scopeModel.ui.workspaceInput.textString = 'amount = 4';
      if (await scopeModel.evaluateWorkspace() !== 4) throw new Error('Block repair failed');
      scopeModel.ui.workspaceInput.textString = 'read()';
      if (await scopeModel.evaluateWorkspace() !== 4) throw new Error('Closure did not share the block binding');
      scopeModel.ui.workspaceInput.textString = 'self.call({}) === this';
      if (await scopeModel.evaluateWorkspace() !== true) throw new Error('Block lost lexical self');
      const constantResult = await scopeModel.evaluateWorkspaceSource('receiver = {}');
      if (!constantResult.isError || !String(constantResult.value).includes('constant')) throw new Error('Workspace bypassed const enforcement');
      const scopedResult = await scopeModel.proceed();
      if (scopedResult.outer !== 1 || scopedResult.inner !== 4 || scopedResult.receiver !== tutorial) throw new Error('Block scope or receiver lost');
      const loopView = await tutorial.debugLesson('loopLesson');
      const loopModel = loopView.viewModel;
      await loopModel.selectFrame(loopModel.continuation.currentFrame);
      if (loopModel.continuation.currentFrame.lookup('i') !== 1) throw new Error('Loop scope was not captured');
      if (JSON.stringify(await loopModel.proceed()) !== '[0,1,2]' || tutorial.count !== 3) throw new Error('Per-iteration closure state failed');
      const asyncView = await tutorial.debugLesson('awaitLesson');
      const asyncModel = asyncView.viewModel;
      await asyncModel.selectFrame(asyncModel.continuation.currentFrame);
      if (asyncModel.continuation.currentFrame.lookup('amount') !== 1) throw new Error('Await lost its frame local');
      if (await asyncModel.proceed() !== 4 || tutorial.count !== 4) throw new Error('Await resume failed');
      tutorial.getWindow().close(false);
      const { runTestFiles } = await System.import('mocha-es6');
      if (await runTestFiles(['lively.ide/tests/js/debugger-ui-test.js', 'lively.ide/tests/js/debugger-runtime-closure-test.js', 'lively.ide/tests/js/debugger-order-desk-test.js', 'lively.context/tests/tutorial-test.js', 'lively.context/tests/persistence-test.js'])) throw new Error('Renderer tutorial regressions failed');
      return { frames: 2, count: marker.count, worldTimerWhileSuspended: ticked, nativeService: livelyDesktop.debugger.isAvailable() };
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, { timeoutMs });
  if (result.exceptionDetails) throw new Error('Nonpausing debugger smoke failed: ' + JSON.stringify(result.exceptionDetails));
  if (!result.result.value?.worldTimerWhileSuspended || result.result.value.nativeService) {
    throw new Error('Expected a responsive world with the native pause service disabled: ' + JSON.stringify(result.result));
  }
  console.log('Desktop debugger smoke passed: live edits, lexical closures, await, persistent workspace, renderer regressions, and Runtime-only binding capture');
}

async function main () {
  const args = parseArgs();
  const devRoot = args.devRoot ? path.resolve(args.devRoot) : null;
  const bundleDir = devRoot ? null : path.resolve(args.bundleDir || '');
  const platform = args.platform || hostPlatform();
  const timeoutMs = Number(args.timeout || process.env.LIVELY_APP_SMOKE_TIMEOUT || DEFAULT_TIMEOUT);
  const debuggerSmoke = args.debuggerSmoke === '1' || args.debuggerSmoke === 'true';
  const headless = args.headless === '1' || args.headless === 'true';
  if (!devRoot && (!bundleDir || bundleDir === process.cwd())) throw new Error('Pass --bundleDir=<desktop bundle dir> or --devRoot=<repo root>');
  if (devRoot && !fs.existsSync(path.join(devRoot, 'lively.app', 'start.sh'))) {
    throw new Error(`Dev root does not look like lively.next: ${devRoot}`);
  }

  const { command, args: commandArgs } = devRoot ? devAppCommand(devRoot) : appCommand(bundleDir, platform, headless);
  assertExecutableExists(command);

  // Exercise URL decoding, including Windows' RUNNER~1 temporary paths.
  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-app-smoke~-'));
  const dataDir = path.join(smokeRoot, 'data');
  const cacheDir = path.join(smokeRoot, 'cache');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  if (!devRoot) seedProject(dataDir);
  let programmingLock;
  let cachedBuild = 'previous build';
  const cacheProbe = devRoot ? null : createServer((req, res) => {
    res.writeHead(200, { 'access-control-allow-origin': '*', 'cache-control': 'max-age=31536000' });
    res.end(cachedBuild);
  });
  if (cacheProbe) {
    await new Promise(resolve => cacheProbe.listen(0, '127.0.0.1', resolve));
    cacheProbe.unref();
  }
  const logFile = devRoot
    ? path.join(devRoot, 'lively.app', 'boot.log')
    : path.join(dataDir, 'boot.log');
  for (const reopened of devRoot ? [false] : [false, true]) {
    appExitStatus = null;
    try { fs.rmSync(logFile, { force: true }); } catch (_) {}
    console.log(`Launching ${command}${devRoot ? ` in dev mode from ${devRoot}` : ''}`);
    const child = spawn(command, devRoot ? commandArgs : [`--user-data-dir=${path.join(smokeRoot, 'profile')}`, ...commandArgs], {
      cwd: devRoot || bundleDir,
      env: {
        ...process.env,
        LIVELY_APP_DATA_DIR: dataDir,
        LIVELY_APP_CACHE_DIR: cacheDir,
        LIVELY_APP_SMOKE: '1',
        LIVELY_APP_FUNCTION_SCOPES: debuggerSmoke ? '1' : process.env.LIVELY_APP_FUNCTION_SCOPES,
        LIVELY_APP_HEADLESS: headless ? '1' : ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.stdout.on('data', data => process.stdout.write(`[app stdout] ${data}`));
    child.stderr.on('data', data => process.stderr.write(`[app stderr] ${data}`));
    child.on('error', err => {
      appExitStatus = { code: 'spawn-error', signal: err.message || String(err) };
    });

    try {
      child.on('exit', (code, signal) => {
        appExitStatus = { code, signal };
        if (code !== null && code !== 0) console.error(`App exited with code ${code}, signal ${signal}`);
      });

      const port = await waitForBootLogReady(logFile, timeoutMs);
      console.log(`Desktop server reported ready on port ${port}`);
      await waitForHttpOk(`http://127.0.0.1:${port}/dashboard/`, 60000);
      console.log('Desktop server dashboard responded');

      const target = await waitForPageTarget(`http://127.0.0.1:${port}/dashboard/`, 60000);
      console.log(`Attached to desktop page ${target.url}`);
      const client = new CDPClient(target.webSocketDebuggerUrl);
      await client.open();
      try {
        await client.send('Runtime.enable');
        await client.send('Page.enable');
        await client.send('Log.enable').catch(() => {});
        await client.send('Network.enable');
        await waitFor('boot screen navigation to dashboard', async () => {
          const result = await client.send('Runtime.evaluate', {
            expression: `location.href.startsWith(${JSON.stringify(`http://127.0.0.1:${port}/dashboard/`)})`,
            returnByValue: true
          });
          return result.result && result.result.value === true;
        }, 60000);
        await waitFor('dashboard initialization', async () => {
          const result = await client.send('Runtime.evaluate', {
            expression: `Boolean(globalThis.$world && $world.get('a project browser') && !globalThis.__loadError__)`,
            returnByValue: true
          });
          return result.result && result.result.value === true;
        }, timeoutMs);
        if (cacheProbe) {
          const expression = `fetch('http://127.0.0.1:${cacheProbe.address().port}/').then(r => r.text())`;
          const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (result.exceptionDetails || result.result?.value !== (reopened ? 'current build' : 'previous build')) {
            throw new Error('Desktop retained an HTTP response from the previous app build: ' + JSON.stringify(result));
          }
          if (!reopened) {
            cachedBuild = 'current build';
            const cached = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (cached.result?.value !== 'previous build') throw new Error('Upgrade regression did not prime the browser HTTP cache');
          } else console.log('Desktop app smoke passed: app upgrade invalidates cached HTTP responses');
        }
        const registryResponse = await fetch(`http://127.0.0.1:${port}/package-registry.json`);
        const { packageMap } = await registryResponse.json();
        for (const name of ['lively.modules', 'lively.morphic', 'lively.server', 'lively.shell', 'lively.freezer']) {
          const entry = packageMap[name];
          const pkg = entry.versions[entry.latest];
          if (pkg.url !== name || Object.keys(entry.instances).length !== 1) {
            throw new Error(`Desktop package ${name} has duplicate or noncanonical URLs: ${Object.values(entry.instances).map(pkg => pkg.url).join(', ')}`);
          }
        }
        console.log('Desktop app smoke passed: dashboard initialized with canonical workspace packages');
        if (!devRoot) {
          const projects = await waitFor('dashboard project entries', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: "globalThis.$world.get('a project browser').viewModel.previews?.map(p => p._project._name).sort()",
              returnByValue: true
            });
            const names = result.result && result.result.value;
            return names && names.length ? names : null;
          }, timeoutMs);
          if (JSON.stringify(projects) !== JSON.stringify(reopened ? ['smoke--dormant', 'smoke--programming', 'smoke--project'] : ['smoke--dormant', 'smoke--project'])) {
            throw new Error('Dashboard lists dependencies as projects: ' + JSON.stringify(projects));
          }
          console.log('Desktop app smoke passed: dashboard lists local projects without installed dependencies');
        }
        if (reopened) {
          console.log('Desktop app smoke passed: relaunch preserves the project list after dependencies were installed');
          // Open the upgraded legacy project before any other project warms the live loader.
          await openDashboardProject(client, 'smoke--project');
          await waitFor('legacy project after app upgrade', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: `Boolean(globalThis.$world?._uiInitialized && $world.openedProject?.fullName === 'smoke--project' && globalThis.__livelyProjectSmokeOpened && globalThis.__desktopDashboardDocument === document && !globalThis.__loadError__)`,
              returnByValue: true
            });
            return result.result?.value === true;
          }, timeoutMs);
          client.assertNoRendererErrors();
          console.log('Desktop app smoke passed: upgraded legacy project opens from the cold dashboard');
          await assertBrowserSwc(client);
          await client.send('Page.navigate', { url: `http://127.0.0.1:${port}/dashboard/` });
          await openDashboardProject(client, 'smoke--programming');
          await waitFor('saved programming project after relaunch', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: `Boolean(globalThis.$world && $world._uiInitialized && $world.openedProject?.fullName === 'smoke--programming' && $world.get('desktop-programming-result')?.textString === '42' && globalThis.__desktopDashboardDocument === document && !globalThis.__loadError__)`,
              returnByValue: true
            });
            return result.result?.value === true;
          }, timeoutMs);
          await assertProjectProgramming(client, port, true);
          await assertBrowserSwc(client);
          if (fs.readFileSync(path.join(dataDir, 'runtime-root', 'local_projects', 'smoke--programming', 'bun.lock'), 'utf8') !== programmingLock) {
            throw new Error('Restarting the programming project changed its Bun lock');
          }
          client.assertNoRendererErrors();
          continue;
        }
        if (!devRoot) {
          await openDashboardProject(client, 'smoke--project');
          await waitFor('dashboard project tile opens the studio', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: `Boolean(globalThis.$world && $world._uiInitialized && $world.openedProject?.fullName === 'smoke--project' && globalThis.__livelyProjectSmokeOpened && globalThis.__desktopDashboardDocument === document && !globalThis.__loadError__)`,
              returnByValue: true
            });
            return result.result?.value === true;
          }, timeoutMs);
          console.log('Desktop app smoke passed: dashboard tile opens a project in the same document');
          await assertBrowserSwc(client);
          await assertComponentModuleURLs(client);
          await assertFrozenModuleResurrection(client);
          await assertBrowserSwc(client);
        }
        const worldUrl = `http://127.0.0.1:${port}${WORLD_PATH}`;
        console.log(`Navigating app window to ${worldUrl}`);
        await client.send('Page.navigate', { url: worldUrl });
        {
          await waitFor('world load in app window', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: `Boolean(globalThis.$world && $world.name === 'aLivelyWorld' && !lively.FreezerRuntime)`,
              returnByValue: true
            });
            return result.result && result.result.value === true;
          }, timeoutMs);
          await assertRendererUsesHttpSystemURLs(client, port, timeoutMs);
          console.log('Desktop app smoke passed: renderer System uses HTTP module URLs');
          await assertBrowserEnvironmentSwitching(client, port);
          await assertBrowserSwc(client);
          if (debuggerSmoke) await assertDesktopDebuggerSmoke(client, timeoutMs);

          const projectUrl = `http://127.0.0.1:${port}${devRoot ? PROJECT_PATH : EXISTING_PROJECT_PATH}`;
          console.log(`Navigating app window to ${projectUrl}`);
          await client.send('Page.navigate', { url: projectUrl });
          await waitFor('project route bootstrap', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: `Boolean(globalThis.System && System.get && System.get('@lively-env') && document.readyState !== 'loading')`,
              returnByValue: true
            });
            return result.result && result.result.value === true;
          }, timeoutMs);
          if (!devRoot) {
            await waitFor('existing project entry module and studio initialization', async () => {
              const result = await client.send('Runtime.evaluate', {
                expression: `Boolean(globalThis.$world && $world.name === 'smoke--project' &&
                  $world._uiInitialized && $world.openedProject && $world.openedProject.name === 'project' &&
                  globalThis.__livelyProjectSmokeOpened && !globalThis.__loadError__)`,
                returnByValue: true
              });
              return result.result && result.result.value === true;
            }, timeoutMs);
            const projectDir = path.join(dataDir, 'runtime-root', 'local_projects', 'smoke--project');
            const lockFile = path.join(projectDir, 'bun.lock');
            const lock = fs.readFileSync(lockFile, 'utf8');
            const config = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
            if (config.dependencies['lively.morphic'] || config.lively.localDependencies['lively.morphic'] !== '../../lively.morphic') {
              throw new Error('Legacy project did not link the bundled lively.morphic workspace');
            }
            console.log('Desktop app smoke passed: legacy project migrated, dependency and entry module loaded');
            await assertComponentModuleURLs(client);
            await client.send('Runtime.evaluate', { expression: 'globalThis.__livelyProjectSmokeOpened = false' });
            await client.send('Page.reload', { ignoreCache: true });
            await waitFor('locked project reopen and studio initialization', async () => {
              const result = await client.send('Runtime.evaluate', {
                expression: `Boolean(globalThis.$world && $world.name === 'smoke--project' &&
                  $world._uiInitialized && $world.openedProject && $world.openedProject.name === 'project' &&
                  globalThis.__livelyProjectSmokeOpened && !globalThis.__loadError__)`,
                returnByValue: true
              });
              return result.result && result.result.value === true;
            }, timeoutMs);
            if (fs.readFileSync(lockFile, 'utf8') !== lock) throw new Error('Opening a locked project changed its Bun lock');
            console.log('Desktop app smoke passed: project reopened with its original Bun lock');
          }
          await assertRendererUsesHttpSystemURLs(client, port, timeoutMs, { requirePopulatedSystemMap: true });
          console.log('Desktop app smoke passed: project route keeps System URLs on HTTP');
          if (!devRoot) {
            await assertProjectProgramming(client, port);
            await assertBrowserSwc(client);
            programmingLock = fs.readFileSync(path.join(dataDir, 'runtime-root', 'local_projects', 'smoke--programming', 'bun.lock'), 'utf8');
          }
        }
        client.assertNoRendererErrors();
        console.log('Desktop app smoke passed: server started and world loaded without uncaught renderer errors');
      } catch (err) {
        console.error(`\n--- page state ---\n${JSON.stringify(await describePageState(client), null, 2)}`);
        const diagnostics = recentCdpDiagnostics(client);
        if (diagnostics.length) console.error(`\n--- recent browser diagnostics ---\n${JSON.stringify(diagnostics, null, 2)}`);
        throw err;
      } finally {
        client.close();
      }
    } catch (err) {
      console.error(err.stack || err);
      console.error(`\n--- boot.log (${logFile}) ---\n${tailFile(logFile) || '(missing)'}`);
      throw err;
    } finally {
      await stopApp(child);
      if (!reopened && programmingLock) {
        fs.writeFileSync(path.join(dataDir, '.browser-cache-build'), 'previous build');
        // Simulate an app upgrade with a project link left in the previous payload.
        const runtime = path.join(dataDir, 'runtime-root');
        const oldFreezer = path.join(smokeRoot, 'previous-payload', 'lively.freezer');
        fs.mkdirSync(oldFreezer, { recursive: true });
        for (const file of ['package.json', 'index.js']) {
          fs.copyFileSync(path.join(runtime, 'lively.freezer', file), path.join(oldFreezer, file));
        }
        const link = path.join(runtime, 'local_projects', 'smoke--project', 'node_modules', 'lively.freezer');
        fs.unlinkSync(link);
        fs.symlinkSync(oldFreezer, link, process.platform === 'win32' ? 'junction' : 'dir');
        console.log('Desktop app smoke: relaunch with a dependency link left in an older app payload');
      }
    }
  }
  cacheProbe?.close();
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
