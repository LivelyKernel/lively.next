#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const CDP_PORT = Number(process.env.LIVELY_APP_SMOKE_CDP_PORT || 9222);
const DEFAULT_TIMEOUT = 300000;
const DEBUGGER_SMOKE_REASON = 'desktop debugger smoke';
const DEBUGGER_SOURCE_MAP_SMOKE_REASON = 'desktop debugger source map smoke';
const DEBUGGER_CURRENT_LINE_MARKER_ID = 'lively-debugger-current-line';
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
        check(browser.ui.moduleEnvironment.selectedItem === 'client', 'Client module declaration was lost');
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
        check(browser.ui.moduleEnvironment.selectedItem === 'server', 'Server module declaration was lost');
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
        localStorage.setItem('LIVELY_OFFLINE_MODE', '1');
        const preview = $world.get('a project browser').viewModel.previews.find(p => p._project._name === ${JSON.stringify(fullName)});
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
  // Start from a legacy checkout: the app must create the first Bun lock and install.
  for (const name of ['index.css', 'fonts.css']) fs.writeFileSync(path.join(projectDir, name), '');
  fs.writeFileSync(path.join(projectDir, '.gitignore'), 'node_modules/\n.cachedImportMap.json\n');
  git(projectDir, ['init', '--quiet', '--initial-branch=main']);
  git(projectDir, ['add', '.']);
  git(projectDir, commitArgs);
}

async function waitForDesktopDebuggerBridge (client, timeoutMs) {
  await waitFor('desktop debugger bridge attachment', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const bridge = globalThis.livelyDesktop && globalThis.livelyDesktop.debugger;
        return Boolean(bridge && typeof bridge.isAvailable === 'function' && bridge.isAvailable());
      })()`,
      returnByValue: true
    }, { timeoutMs: 10000 });
    return result.result && result.result.value === true;
  }, timeoutMs);
}

function debuggerSmokeExpression () {
  return `(() => Promise.resolve().then(async () => {
    async function importLivelyContext() {
      return Function('url', 'return import(url)')(
        new URL('/lively.context/lib/inspector-runtime.js', location.origin).href);
    }
    function describeError(err) {
      if (!err) return null;
      return {
        name: err.name || '',
        message: err.message || String(err),
        stack: err.stack || '',
        originalErr: err.originalErr ? describeError(err.originalErr) : null
      };
    }
    try {
      const mod = await importLivelyContext();
      const { halt, isInspectorHaltUnwind, installInspectorRuntime } = mod;
      installInspectorRuntime();

      const marker = {
        label: 'desktop-debugger-smoke-marker',
        value: 23,
        nested: { identity: 'actual-object' }
      };

      globalThis.__LIVELY_DEBUGGER_SMOKE_MARKER__ = marker;
      globalThis.__LIVELY_DEBUGGER_SMOKE_AFTER_HALT__ = false;

      try {
        function smokeOuter() {
          const closedOver = { marker, closed: true };
          function smokeInner(arg) {
            const localObject = { marker, arg, closedOver };
            halt(${JSON.stringify(DEBUGGER_SMOKE_REASON)});
            globalThis.__LIVELY_DEBUGGER_SMOKE_AFTER_HALT__ = true;
            return localObject;
          }
          return smokeInner(marker);
        }
        smokeOuter();
      } catch (err) {
        if (!isInspectorHaltUnwind(err)) {
          return {
            unwound: false,
            markerValue: marker.value,
            afterHaltRan: globalThis.__LIVELY_DEBUGGER_SMOKE_AFTER_HALT__,
            error: describeError(err)
          };
        }
        return {
          unwound: true,
          markerValue: marker.value,
          afterHaltRan: globalThis.__LIVELY_DEBUGGER_SMOKE_AFTER_HALT__
        };
      }

      return {
        unwound: false,
        markerValue: marker.value,
        afterHaltRan: globalThis.__LIVELY_DEBUGGER_SMOKE_AFTER_HALT__
      };
    } catch (err) {
      return {
        unwound: false,
        setupError: describeError(err)
      };
    }
  }))()`;
}

function debuggerSourceMapSmokeExpression () {
  return `(() => Promise.resolve().then(async () => {
    async function importLivelyContext() {
      return Function('url', 'return import(url)')(
        new URL('/lively.context/lib/inspector-runtime.js', location.origin).href);
    }
    function describeError(err) {
      if (!err) return null;
      return {
        name: err.name || '',
        message: err.message || String(err),
        stack: err.stack || '',
        originalErr: err.originalErr ? describeError(err.originalErr) : null
      };
    }
    try {
      const mod = await importLivelyContext();
      const { halt, isInspectorHaltUnwind, installInspectorRuntime } = mod;
      installInspectorRuntime();

      const marker = {
        label: 'desktop-debugger-source-map-marker',
        value: 29,
        nested: { identity: 'actual-source-map-object' }
      };

      globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_MARKER__ = marker;
      globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_AFTER_HALT__ = false;
      globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_HALT__ = halt;
      globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_REASON__ = ${JSON.stringify(DEBUGGER_SOURCE_MAP_SMOKE_REASON)};

      try {
        const originalSource = [
          'const marker = globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_MARKER__;',
          'const halt = globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_HALT__;',
          'const reason = globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_REASON__;',
          'const closedOver = { marker, closed: true, originalOnly: "source-map-original-token" };',
          'const localObject = { marker, arg: marker, closedOver };',
          'halt(reason); // source-map-original-halt-line',
          'globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_AFTER_HALT__ = true;',
          'localObject;'
        ].join('\\n');
        const generatedSource = [
          'const marker = globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_MARKER__;',
          'const halt = globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_HALT__;',
          'const reason = globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_REASON__;',
          'const closedOver = { marker, closed: true, generatedOnly: "source-map-generated-token" };',
          'const localObject = { marker, arg: marker, closedOver };',
          'halt(reason);',
          'globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_AFTER_HALT__ = true;',
          'localObject;'
        ].join('\\n');
        const sourceMap = {
          version: 3,
          file: '/debugger-source-map-generated.js',
          sources: ['/debugger-source-map-original.js'],
          sourcesContent: [originalSource],
          names: [],
          mappings: ';;;;;AAKA'
        };
        function base64Unicode(text) {
          return btoa(unescape(encodeURIComponent(text)));
        }
        eval([
          generatedSource,
          '//# sourceURL=' + new URL('/debugger-source-map-generated.js', location.origin).href,
          '//# sourceMappingURL=data:application/json;base64,' + base64Unicode(JSON.stringify(sourceMap))
        ].join('\\n'));
      } catch (err) {
        if (!isInspectorHaltUnwind(err)) {
          return {
            unwound: false,
            markerValue: marker.value,
            afterHaltRan: globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_AFTER_HALT__,
            error: describeError(err)
          };
        }
        return {
          unwound: true,
          markerValue: marker.value,
          afterHaltRan: globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_AFTER_HALT__
        };
      }

      return {
        unwound: false,
        markerValue: marker.value,
        afterHaltRan: globalThis.__LIVELY_DEBUGGER_SOURCE_MAP_AFTER_HALT__
      };
    } catch (err) {
      return {
        unwound: false,
        setupError: describeError(err)
      };
    }
  }))()`;
}

function debuggerSourceMapSmokeStateExpression () {
  return `(() => {
    const currentLineMarkerId = ${JSON.stringify(DEBUGGER_CURRENT_LINE_MARKER_ID)};
    const system = globalThis.System;
    const env = system && system.get && system.get('@lively-env');
    const registry = env && env.debuggerContexts;
    const contexts = registry && registry.contexts || {};
    const context = Object.values(contexts).find(ctx => ctx && ctx.reason === ${JSON.stringify(DEBUGGER_SOURCE_MAP_SMOKE_REASON)}) || null;
    const windows = globalThis.$world && typeof $world.getWindows === 'function' ? $world.getWindows() : [];
    function windowTarget(win) {
      return win && (win.targetMorph || win.owner || win.contentMorph) || null;
    }
    const debuggerWindow = windows.find(win => {
      const target = windowTarget(win);
      return win && (
        win.title === 'Lively Debugger' ||
        win.name === 'Lively Debugger' ||
        target && target.name === 'lively debugger'
      );
    });
    const debuggerMorph = windowTarget(debuggerWindow);
    const sourcePane = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('source pane');
    const locationLabel = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('location label');
    const sourceText = sourcePane && sourcePane.textString || '';
    const markers = sourcePane && sourcePane.markers || [];
    const selection = sourcePane && sourcePane.selection;
    const start = selection && (selection.start || selection.range && selection.range.start);
    return {
      hasRegistry: Boolean(registry),
      hasContext: Boolean(context),
      contextId: context && context.id,
      reason: context && context.reason,
      frameCount: context ? Object.keys(context.frames || {}).length : 0,
      scopeCount: context ? Object.keys(context.scopes || {}).length : 0,
      hasDebuggerWindow: Boolean(debuggerWindow),
      hasSourcePane: Boolean(sourcePane),
      sourceTextLength: sourceText.length,
      sourceHasLocalObject: sourceText.includes('localObject'),
      sourceHasHaltCall: sourceText.includes('halt('),
      sourceHasOriginalOnlyToken: sourceText.includes('source-map-original-token'),
      sourceHasGeneratedOnlyToken: sourceText.includes('source-map-generated-token'),
      sourceSelectedRow: start && Number.isFinite(start.row) ? start.row : null,
      hasCurrentLineMarker: markers.some(marker => marker && marker.id === currentLineMarkerId),
      locationLabelText: locationLabel && locationLabel.textString || '',
      debuggerWindowTitle: debuggerWindow && (debuggerWindow.title || debuggerWindow.name),
      windowTitles: windows.map(win => win && (win.title || win.name || '')).filter(Boolean)
    };
  })()`;
}

function debuggerSmokeStateExpression () {
  return `(() => Promise.resolve().then(async () => {
    const currentLineMarkerId = ${JSON.stringify(DEBUGGER_CURRENT_LINE_MARKER_ID)};
    const system = globalThis.System;
    const env = system && system.get && system.get('@lively-env');
    const registry = env && env.debuggerContexts;
    const contexts = registry && registry.contexts || {};
    const context = Object.values(contexts).find(ctx => ctx && ctx.reason === ${JSON.stringify(DEBUGGER_SMOKE_REASON)}) || null;
    const marker = globalThis.__LIVELY_DEBUGGER_SMOKE_MARKER__;
    const windows = globalThis.$world && typeof $world.getWindows === 'function' ? $world.getWindows() : [];
    function windowTarget(win) {
      return win && (win.targetMorph || win.owner || win.contentMorph) || null;
    }
    const debuggerWindow = windows.find(win => {
      const target = windowTarget(win);
      return win && (
        win.title === 'Lively Debugger' ||
        win.name === 'Lively Debugger' ||
        target && target.name === 'lively debugger'
      );
    });
    const debuggerMorph = windowTarget(debuggerWindow);
    const sourcePane = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('source pane');
    const locationLabel = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('location label');
    const statusMorph = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('status');
    const stepIntoButton = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('step into button');
    const workspaceInput = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('workspace input');
    const workspaceResult = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('workspace result');

    function summarizeBinding (value) {
      if (value === marker) return { actualMarker: true, value: value.value, label: value.label };
      if (value && typeof value === 'object') {
        if (value.marker === marker) return { containsActualMarker: true, keys: Object.keys(value) };
        return {
          type: Object.prototype.toString.call(value),
          keys: Object.keys(value).slice(0, 10),
          value: value.value,
          label: value.label
        };
      }
      return { primitive: value };
    }

    function selectionRowOf (textMorph) {
      const selection = textMorph && textMorph.selection;
      if (!selection) return null;
      const start = selection.start || selection.range && selection.range.start;
      return start && Number.isFinite(start.row) ? start.row : null;
    }

    const inspectedBindings = [];
    let hasActualMarker = false;
    let hasActualMarkerCarrier = false;

    if (context) {
      for (const scope of Object.values(context.scopes || {})) {
        for (const [name, value] of Object.entries(scope.bindings || {})) {
          if (['marker', 'arg', 'localObject', 'closedOver'].includes(name)) {
            const summary = summarizeBinding(value);
            inspectedBindings.push({
              frameId: scope.frameId,
              scopeId: scope.scopeId,
              scopeType: scope.type,
              name,
              summary
            });
            if (value === marker) hasActualMarker = true;
            if (value && typeof value === 'object' && value.marker === marker) hasActualMarkerCarrier = true;
          }
        }
      }
    }

    let workspaceActionResult = null;
    let workspaceActionText = null;
    let workspaceActionError = null;
    if (debuggerMorph && debuggerMorph.viewModel && typeof debuggerMorph.viewModel.evaluateWorkspace === 'function' && workspaceInput) {
      try {
        workspaceInput.textString = 'localObject.marker === marker && localObject.closedOver === closedOver';
        workspaceActionResult = await debuggerMorph.viewModel.evaluateWorkspace();
        workspaceActionText = workspaceResult && workspaceResult.textString || '';
      } catch (err) {
        workspaceActionError = err && (err.stack || err.message) || String(err);
      }
    }

    let stepActionStatus = null;
    let stepActionError = null;
    if (stepIntoButton && stepIntoButton.viewModel && typeof stepIntoButton.viewModel.trigger === 'function') {
      try {
        stepIntoButton.viewModel.trigger();
        stepActionStatus = statusMorph && statusMorph.textString || '';
      } catch (err) {
        stepActionError = err && (err.stack || err.message) || String(err);
      }
    }

    const sourceText = sourcePane && sourcePane.textString || '';
    const markers = sourcePane && sourcePane.markers || [];

    return {
      hasRegistry: Boolean(registry),
      hasContext: Boolean(context),
      contextId: context && context.id,
      reason: context && context.reason,
      frameCount: context ? Object.keys(context.frames || {}).length : 0,
      scopeCount: context ? Object.keys(context.scopes || {}).length : 0,
      hasActualMarker,
      hasActualMarkerCarrier,
      inspectedBindings,
      hasDebuggerWindow: Boolean(debuggerWindow),
      hasSourcePane: Boolean(sourcePane),
      sourceTextLength: sourceText.length,
      sourceHasSmokeInner: sourceText.includes('smokeInner'),
      sourceHasHaltCall: sourceText.includes('halt('),
      sourceSelectedRow: selectionRowOf(sourcePane),
      hasCurrentLineMarker: markers.some(marker => marker && marker.id === currentLineMarkerId),
      locationLabelText: locationLabel && locationLabel.textString || '',
      hasWorkspaceInput: Boolean(workspaceInput),
      workspaceActionResult,
      workspaceActionText,
      workspaceActionError,
      stepActionStatus,
      stepActionError,
      debuggerWindowTitle: debuggerWindow && (debuggerWindow.title || debuggerWindow.name),
      windowTitles: windows.map(win => win && (win.title || win.name || '')).filter(Boolean)
    };
  }))()`;
}

function debuggerProceedTriggerExpression () {
  return `(() => {
    const windows = globalThis.$world && typeof $world.getWindows === 'function' ? $world.getWindows() : [];
    function windowTarget(win) {
      return win && (win.targetMorph || win.owner || win.contentMorph) || null;
    }
    const debuggerWindow = windows.find(win => {
      const target = windowTarget(win);
      return win && (
        win.title === 'Lively Debugger' ||
        win.name === 'Lively Debugger' ||
        target && target.name === 'lively debugger'
      );
    });
    const debuggerMorph = windowTarget(debuggerWindow);
    const proceedButton = debuggerMorph && debuggerMorph.getSubmorphNamed && debuggerMorph.getSubmorphNamed('proceed button');
    if (!proceedButton || !proceedButton.viewModel || typeof proceedButton.viewModel.trigger !== 'function') {
      return { triggered: false };
    }
    proceedButton.viewModel.trigger();
    return { triggered: true };
  })()`;
}

function debuggerCloseTriggerExpression () {
  return `(() => {
    const windows = globalThis.$world && typeof $world.getWindows === 'function' ? $world.getWindows() : [];
    function windowTarget(win) {
      return win && (win.targetMorph || win.owner || win.contentMorph) || null;
    }
    const debuggerWindow = windows.find(win => {
      const target = windowTarget(win);
      return win && (
        win.title === 'Lively Debugger' ||
        win.name === 'Lively Debugger' ||
        target && target.name === 'lively debugger'
      );
    });
    const debuggerMorph = windowTarget(debuggerWindow);
    if (debuggerMorph && debuggerMorph.viewModel && typeof debuggerMorph.viewModel.closeDebugger === 'function') {
      debuggerMorph.viewModel.closeDebugger();
      return { triggered: true };
    }
    return { triggered: false };
  })()`;
}

function debuggerProceedStateExpression () {
  return `(() => {
    const system = globalThis.System;
    const env = system && system.get && system.get('@lively-env');
    const registry = env && env.debuggerContexts;
    const contexts = registry && registry.contexts || {};
    const context = Object.values(contexts).find(ctx => ctx && ctx.reason === ${JSON.stringify(DEBUGGER_SMOKE_REASON)}) || null;
    const windows = globalThis.$world && typeof $world.getWindows === 'function' ? $world.getWindows() : [];
    function windowTarget(win) {
      return win && (win.targetMorph || win.owner || win.contentMorph) || null;
    }
    const debuggerWindow = windows.find(win => {
      const target = windowTarget(win);
      return win && (
        win.title === 'Lively Debugger' ||
        win.name === 'Lively Debugger' ||
        target && target.name === 'lively debugger'
      );
    });
    return {
      hasContext: Boolean(context),
      hasDebuggerWindow: Boolean(debuggerWindow),
      windowTitles: windows.map(win => win && (win.title || win.name || '')).filter(Boolean)
    };
  })()`;
}

function debuggerClosedStateExpression (reason) {
  return `(() => {
    const system = globalThis.System;
    const env = system && system.get && system.get('@lively-env');
    const registry = env && env.debuggerContexts;
    const contexts = registry && registry.contexts || {};
    const context = Object.values(contexts).find(ctx => ctx && ctx.reason === ${JSON.stringify(reason)}) || null;
    const windows = globalThis.$world && typeof $world.getWindows === 'function' ? $world.getWindows() : [];
    function windowTarget(win) {
      return win && (win.targetMorph || win.owner || win.contentMorph) || null;
    }
    const debuggerWindow = windows.find(win => {
      const target = windowTarget(win);
      return win && (
        win.title === 'Lively Debugger' ||
        win.name === 'Lively Debugger' ||
        target && target.name === 'lively debugger'
      );
    });
    return {
      hasContext: Boolean(context),
      hasDebuggerWindow: Boolean(debuggerWindow),
      windowTitles: windows.map(win => win && (win.title || win.name || '')).filter(Boolean)
    };
  })()`;
}

async function assertDesktopDebuggerSourceMapSmoke (client, timeoutMs) {
  const trigger = await client.send('Runtime.evaluate', {
    expression: debuggerSourceMapSmokeExpression(),
    awaitPromise: true,
    returnByValue: true
  }, { timeoutMs: Math.min(timeoutMs, 30000) });

  const triggerValue = trigger.result && trigger.result.value;
  if (!triggerValue || triggerValue.unwound !== true || triggerValue.afterHaltRan) {
    throw new Error([
      'Desktop debugger source-map smoke did not unwind at halt().',
      `Observed trigger result: ${JSON.stringify(triggerValue, null, 2)}`,
      `Raw CDP trigger result: ${JSON.stringify(trigger, null, 2)}`
    ].join('\n'));
  }

  let lastState = null;
  const state = await waitFor('desktop debugger source-map capture and UI', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: debuggerSourceMapSmokeStateExpression(),
      returnByValue: true
    }, { timeoutMs: 10000 });
    const value = result.result && result.result.value;
    lastState = value || null;
    if (!value || !value.hasContext || !value.hasDebuggerWindow) return null;
    if (!value.hasSourcePane || !value.sourceTextLength || value.sourceSelectedRow === null || !value.hasCurrentLineMarker) return null;
    return value;
  }, timeoutMs).catch(err => {
    throw new Error([
      err.message || String(err),
      `Last observed source-map debugger smoke state: ${JSON.stringify(lastState, null, 2)}`
    ].join('\n'));
  });

  const errors = [];
  if (!state.frameCount) errors.push('source-map capture did not record any stack frames');
  if (!state.scopeCount) errors.push('source-map capture did not record any scopes');
  if (!state.sourceHasLocalObject || !state.sourceHasHaltCall) {
    errors.push('source-map debugger source pane did not show the paused source code');
  }
  if (!state.sourceHasOriginalOnlyToken || state.sourceHasGeneratedOnlyToken) {
    errors.push('source-map debugger source pane did not apply the captured source map to show original source');
  }
  if (!state.locationLabelText || !state.locationLabelText.includes('/debugger-source-map-original.js:6:')) {
    errors.push('source-map debugger did not show the mapped original source location');
  }
  if (errors.length) {
    throw new Error([
      'Desktop debugger source-map smoke failed.',
      ...errors,
      `Observed state: ${JSON.stringify(state, null, 2)}`
    ].join('\n'));
  }

  const closeTrigger = await client.send('Runtime.evaluate', {
    expression: debuggerCloseTriggerExpression(),
    returnByValue: true
  }, { timeoutMs: 10000 });
  const closeValue = closeTrigger.result && closeTrigger.result.value;
  if (!closeValue || !closeValue.triggered) {
    throw new Error([
      'Desktop debugger source-map smoke failed.',
      'debugger close could not be triggered',
      `Observed close trigger: ${JSON.stringify(closeValue, null, 2)}`
    ].join('\n'));
  }

  let lastClosedState = null;
  await waitFor('desktop debugger source-map close release', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: debuggerClosedStateExpression(DEBUGGER_SOURCE_MAP_SMOKE_REASON),
      returnByValue: true
    }, { timeoutMs: 10000 });
    const value = result.result && result.result.value;
    lastClosedState = value || null;
    if (!value || value.hasContext || value.hasDebuggerWindow) return null;
    return value;
  }, timeoutMs).catch(err => {
    throw new Error([
      err.message || String(err),
      `Last observed source-map debugger close state: ${JSON.stringify(lastClosedState, null, 2)}`
    ].join('\n'));
  });

  console.log('Desktop app smoke passed: debugger applies inline source maps to captured source');
}

async function assertDesktopDebuggerSmoke (client, timeoutMs) {
  await waitForDesktopDebuggerBridge(client, timeoutMs);
  await waitFor('final lively world load before debugger smoke', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: `Boolean(globalThis.$world &&
        $world.name &&
        $world.name !== 'lively.next' &&
        typeof $world.getWindows === 'function')`,
      returnByValue: true
    }, { timeoutMs: 10000 });
    return result.result && result.result.value === true;
  }, timeoutMs);

  await assertDesktopDebuggerSourceMapSmoke(client, timeoutMs);

  const trigger = await client.send('Runtime.evaluate', {
    expression: debuggerSmokeExpression(),
    awaitPromise: true,
    returnByValue: true
  }, { timeoutMs: Math.min(timeoutMs, 30000) });

  const triggerValue = trigger.result && trigger.result.value;
  if (!triggerValue || triggerValue.unwound !== true || triggerValue.afterHaltRan) {
    throw new Error([
      'Desktop debugger smoke did not unwind at halt().',
      `Observed trigger result: ${JSON.stringify(triggerValue, null, 2)}`,
      `Raw CDP trigger result: ${JSON.stringify(trigger, null, 2)}`
    ].join('\n'));
  }

  let lastDebuggerSmokeState = null;
  const state = await waitFor('desktop debugger capture and UI', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: debuggerSmokeStateExpression(),
      awaitPromise: true,
      returnByValue: true
    }, { timeoutMs: 10000 });
    const value = result.result && result.result.value;
    lastDebuggerSmokeState = value || null;
    if (!value || !value.hasContext || !value.hasDebuggerWindow) return null;
    if (!value.hasSourcePane || !value.sourceTextLength || value.sourceSelectedRow === null || !value.hasCurrentLineMarker) return null;
    return value;
  }, timeoutMs).catch(err => {
    throw new Error([
      err.message || String(err),
      `Last observed debugger smoke state: ${JSON.stringify(lastDebuggerSmokeState, null, 2)}`
    ].join('\n'));
  });

  const errors = [];
  if (!state.frameCount) errors.push('capture did not record any stack frames');
  if (!state.scopeCount) errors.push('capture did not record any scopes');
  if (!state.hasActualMarker && !state.hasActualMarkerCarrier) {
    errors.push('capture did not expose the in-process marker object through a scope binding');
  }
  if (!state.sourceHasSmokeInner || !state.sourceHasHaltCall) {
    errors.push('debugger source pane did not show the paused source code');
  }
  if (!state.locationLabelText || !state.locationLabelText.includes(':')) {
    errors.push('debugger did not show the paused source location');
  }
  if (!state.hasWorkspaceInput) {
    errors.push('debugger did not show a workspace input');
  }
  if (state.workspaceActionError) {
    errors.push('workspace evaluation threw while reading selected-scope values');
  }
  if (state.workspaceActionResult !== true || !String(state.workspaceActionText).includes('true')) {
    errors.push('workspace evaluation did not run in the selected frame scope');
  }
  if (state.stepActionError) {
    errors.push('step into button threw while stepping through the interpreter');
  }
  if (!state.stepActionStatus || !state.stepActionStatus.includes('stopped')) {
    errors.push('step into button did not produce a stopped interpreter continuation');
  }
  if (errors.length) {
    throw new Error([
      'Desktop debugger smoke failed.',
      ...errors,
      `Observed state: ${JSON.stringify(state, null, 2)}`
    ].join('\n'));
  }

  const proceedTrigger = await client.send('Runtime.evaluate', {
    expression: debuggerProceedTriggerExpression(),
    returnByValue: true
  }, { timeoutMs: 10000 });
  const proceedTriggerValue = proceedTrigger.result && proceedTrigger.result.value;
  if (!proceedTriggerValue || !proceedTriggerValue.triggered) {
    throw new Error([
      'Desktop debugger smoke failed.',
      'proceed button could not be triggered',
      `Observed proceed trigger: ${JSON.stringify(proceedTriggerValue, null, 2)}`
    ].join('\n'));
  }

  let lastProceedState = null;
  await waitFor('desktop debugger proceed release', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: debuggerProceedStateExpression(),
      returnByValue: true
    }, { timeoutMs: 10000 });
    const value = result.result && result.result.value;
    lastProceedState = value || null;
    if (!value || value.hasContext || value.hasDebuggerWindow) return null;
    return value;
  }, timeoutMs).catch(err => {
    throw new Error([
      err.message || String(err),
      `Last observed debugger proceed state: ${JSON.stringify(lastProceedState, null, 2)}`
    ].join('\n'));
  });

  console.log('Desktop app smoke passed: lively.context debugger captures stack values and opens UI');
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
        const registryResponse = await fetch(`http://127.0.0.1:${port}/package-registry.json`);
        const { packageMap } = await registryResponse.json();
        for (const name of ['lively.morphic', 'lively.server', 'lively.shell']) {
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
          if (JSON.stringify(projects) !== JSON.stringify(reopened ? ['smoke--programming', 'smoke--project'] : ['smoke--project'])) {
            throw new Error('Dashboard lists dependencies as projects: ' + JSON.stringify(projects));
          }
          console.log('Desktop app smoke passed: dashboard lists only the local project');
        }
        if (reopened) {
          console.log('Desktop app smoke passed: relaunch preserves the project list after dependencies were installed');
          await openDashboardProject(client, 'smoke--programming');
          await waitFor('saved programming project after relaunch', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: `Boolean(globalThis.$world && $world._uiInitialized && $world.openedProject?.fullName === 'smoke--programming' && $world.get('desktop-programming-result')?.textString === '42' && globalThis.__desktopDashboardDocument === document && !globalThis.__loadError__)`,
              returnByValue: true
            });
            return result.result?.value === true;
          }, timeoutMs);
          await assertProjectProgramming(client, port, true);
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
    }
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
