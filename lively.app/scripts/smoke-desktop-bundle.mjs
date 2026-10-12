#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';

const CDP_PORT = Number(process.env.LIVELY_APP_SMOKE_CDP_PORT || 9222);
const DEFAULT_TIMEOUT = 300000;
const WORLD_PATH = '/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=true';
const PROJECT_PATH = '/projects/load?name=__newProject__&askForWorldName=false&fastLoad=true';
const EXISTING_PROJECT_PATH = '/projects/load?name=smoke--project&askForWorldName=false&fastLoad=true';
const SAVED_WORLD = 'desktop-storage-smoke';
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

function appCommand (bundleDir, platform) {
  if (platform === 'linux') {
    return { command: path.join(bundleDir, 'nw'), args: ['--nwapp=' + bundleDir] };
  }
  if (platform === 'osx') {
    return { command: path.join(bundleDir, 'lively.next.app', 'Contents', 'MacOS', 'nwjs'), args: [] };
  }
  if (platform === 'win') {
    return { command: path.join(bundleDir, 'lively.next.exe'), args: ['--nwapp=' + bundleDir] };
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

async function waitForBootLogReady (logFile, timeoutMs, native = false) {
  let seenPort = null;
  return waitFor('desktop server startup', () => {
    const log = readTextFile(logFile);
    seenPort = Number(log.match(/Starting lively\.server on 127\.0\.0\.1:(\d+)/)?.[1] || seenPort || 0) || null;
    if (/ERROR:|Server crashed|Boot failed/.test(log)) {
      throw new Error(`desktop boot failed:\n${log}`);
    }
    if (native && log.includes('Native interface ready, loading lively')) return 9011;
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

/** Use the toolbar entry point, which loads PartsBin before opening the browser. */
async function assertPartsbinComponentBrowser (client, reopened) {
  const button = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const button = $world.get('lively top bar').get('open component browser');
      const bounds = document.getElementById(button.id).getBoundingClientRect();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    })()`
  });
  if (button.exceptionDetails) throw new Error('Component browser toolbar button missing: ' + JSON.stringify(button));
  const { x, y } = button.result.value;
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await waitFor('component browser opened from toolbar', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: `Boolean($world._componentBrowser?.world() && $world._componentBrowser.viewModel._promise &&
        $world._componentBrowser.viewModel.ui.componentFilesView.viewModel.lists[0]?.items.some(item => item.value?.pkg?.name === 'LivelyKernel--partsbin'))`, returnByValue: true
    });
    return result.result?.value === true;
  }, 60000);
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      const { resource } = await System.import('lively.resources');
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const browser = $world._componentBrowser;
      try {
        const columns = browser.viewModel.ui.componentFilesView;
        const tree = columns.treeData;
        const partsbin = tree.root.subNodes.find(node => node.pkg?.name === 'LivelyKernel--partsbin');
        check(partsbin, 'Component browser did not list PartsBin');
        await columns.selectNode(partsbin, false);
        const ui = partsbin.subNodes.find(node => node.name === 'ui');
        check(ui, 'PartsBin UI directory missing');
        await columns.selectNode(ui, false);
        const file = ui.subNodes.find(node => node.name === 'temperature-converter.cp.js');
        check(file, 'PartsBin component source missing');
        await columns.selectNode(file, false);
        check(file.subNodes.some(node => node.componentObject.componentName === 'ThermometerConverter'),
          'PartsBin component export did not load');
        const source = resource(new URL('local_projects/LivelyKernel--partsbin/ui/temperature-converter.cp.js', System.baseURL).href);
        const text = await source.read();
        const marker = '// desktop retained PartsBin edit';
        if (${reopened}) check(text.includes(marker), 'Relaunch overwrote PartsBin source edits');
        else await source.write(text + '\\n' + marker + '\\n');
        return true;
      } finally {
        browser.getWindow().close();
      }
    })()`
  });
  if (result.exceptionDetails || result.result?.value !== true) throw new Error('Desktop PartsBin browser failed: ' + JSON.stringify(result));
  console.log('Desktop app smoke passed: toolbar opens PartsBin components' + (reopened ? ' with retained source edits after relaunch' : ''));
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
          const expectedProtocol = globalThis.livelyNative || backend !== 'local' ? 'file:' : 'http:';
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

async function saveSmokeWorld (client) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      const { Morph, Image } = await System.import('lively.morphic');
      const { interactivelySaveWorld } = await System.import('lively.morphic/world-loading.js');
      $world.name = ${JSON.stringify(SAVED_WORLD)};
      $world.metadata ||= {};
      delete $world.metadata.commit;
      $world.addMorph(new Morph({ name: 'desktop-persistent-marker' }));
      const asset = 'lively.morphic/assets/lively-web-logo-small.svg';
      $world.addMorph(new Image({ name: 'desktop-persistent-image', imageUrl: System.baseURL + asset }));
      if (globalThis.livelyNative) $world.addMorph(new Image({
        name: 'desktop-legacy-image', imageUrl: livelyNative.legacyOrigin + '/' + asset
      }));
      const commit = await interactivelySaveWorld($world, {
        showSaveDialog: false, confirmOverwrite: false, moduleManager: await System.import('lively.modules')
      });
      if (!commit?._id) throw new Error('World save did not return a commit');
      return true;
    })()`
  });
  if (result.exceptionDetails || result.result?.value !== true) throw new Error('World save failed: ' + JSON.stringify(result));
}

async function reopenSmokeWorld (client, url, timeoutMs) {
  await client.send('Page.navigate', { url });
  await waitFor('saved world reopen', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: `Boolean(globalThis.$world?.name === ${JSON.stringify(SAVED_WORLD)} && $world.get('desktop-persistent-marker') && !globalThis.__loadError__)`,
      returnByValue: true
    });
    return result.result?.value === true;
  }, timeoutMs);
  const images = await client.send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      for (const name of ['desktop-persistent-image', 'desktop-legacy-image']) {
        const morph = $world.get(name);
        if (!morph) { if (name === 'desktop-legacy-image') continue; throw new Error('Saved image missing'); }
        const image = document.createElement('img');
        image.src = morph.getURLForImgNode();
        if (!image.src.startsWith(System.baseURL)) throw new Error(name + ' retained its old runtime URL: ' + image.src);
        await image.decode();
      }
      return true;
    })()`
  });
  if (images.exceptionDetails || images.result?.value !== true) throw new Error('Saved image failed: ' + JSON.stringify(images));
  console.log('Desktop app smoke passed: saved world and its images reopen through ObjectDB');
}

async function assertNativeAssets (client) {
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      const { resourceClass } = await livelyNative.fileExtension();
      const file = new resourceClass(livelyNative.baseURL + 'desktop-smoke-worker.js');
      let worker;
      const stylesheet = document.createElement('link');
      try {
        await file.write('self.onmessage = event => self.postMessage(event.data + 1);');
        const image = new Image();
        image.src = livelyNative.baseURL + 'lively.morphic/assets/lively-web-logo-small.svg';
        await image.decode();
        const { Image: MorphicImage } = await System.import('lively.morphic');
        for (const origin of [livelyNative.legacyOrigin, 'http://localhost:9011']) {
          const legacy = new MorphicImage({ imageUrl: origin + '/lively.morphic/assets/lively-web-logo-small.svg' });
          image.src = legacy.getURLForImgNode();
          await image.decode();
        }
        const remote = 'http://localhost:9999/remote.svg';
        if (livelyNative.assetURL(remote) !== remote) throw new Error('Native mode redirected a remote asset');
        await new FontFace('DesktopAssetProbe', 'url("' + livelyNative.baseURL + 'lively.morphic/assets/fonts/IBMPlexSans-Regular.woff2")').load();
        await new Promise((resolve, reject) => {
          stylesheet.rel = 'stylesheet';
          stylesheet.href = livelyNative.baseURL + 'lively.morphic/assets/morphic.css';
          stylesheet.onload = resolve;
          stylesheet.onerror = () => reject(new Error('Native stylesheet failed to load'));
          document.head.appendChild(stylesheet);
        });
        worker = new Worker(file.url);
        const answer = new Promise((resolve, reject) => {
          worker.onmessage = event => resolve(event.data);
          worker.onerror = event => reject(new Error(event.message));
        });
        worker.postMessage(41);
        const { promise } = await System.import('lively.lang');
        if (await promise.timeout(10000, answer) !== 42) throw new Error('Native worker returned the wrong result');
        return true;
      } finally { worker?.terminate(); stylesheet.remove(); await file.remove(); }
    })()`
  });
  if (result.exceptionDetails || result.result?.value !== true) throw new Error('Native assets failed: ' + JSON.stringify(result));
  console.log('Desktop app smoke passed: browser images, fonts, styles and workers load directly from the native filesystem');
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
          check(await $world.openedProject.generateBuildScripts() === 0, 'Project build script setup failed');
          const { runCommand } = await System.import('lively.shell/client-command.js');
          const { default: ShellClientResource } = await System.import('lively.shell/client-resource.js');
          const cwd = await remote.coreInterface.runEvalAndStringify('System._nodeRequire("node:url").fileURLToPath(new URL("local_projects/' + fullName + '", System.baseURL))');
          // Declare the new imports through the existing explicit update API.
          await remote.coreInterface.runEvalAndStringify(
            '(async () => { const { installProjectDependencies } = await System.nativeImport(new URL("lively.project/package-install.mjs", System.baseURL).href); await installProjectDependencies(' + JSON.stringify(cwd) + ', { update: true }); return true; })()',
            { promiseTimeout: 120000 });
          const build = runCommand('bash tools/build.sh', { cwd, env: { NODE_OPTIONS: '--max-old-space-size=2048' }, l2lClient: ShellClientResource.defaultL2lClient });
          // The full project bundle approaches five minutes on the macOS runner.
          try { await promise.timeout(600000, build.whenDone()); }
          catch (error) { throw new Error('Project build failed: ' + error.message + '; pid=' + build.pid + '\\n' + build.output.slice(0, 5000) + build.output.slice(-3000)); }
          check(build.exitCode === 0, 'Project build failed: ' + build.output.slice(0, 5000) + build.output.slice(-3000));
          check(await resource(System.baseURL).join('local_projects/' + fullName + '/build/index.html').exists(), 'Project build did not produce index.html');
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

/** Keep both entry pages painted even before the bootstrap bundle loads. */
async function assertStartupBackground (client, urls, dataDir) {
  await client.send('Network.enable');
  await client.send('Network.setBlockedURLs', { urls: ['*deps.js'] });
  try {
    for (const [index, url] of urls.entries()) {
      await client.send('Page.navigate', { url });
      await waitFor('static startup triangle background', async () => {
        const result = await client.send('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => {
            if (location.href !== ${JSON.stringify(url)} || document.readyState === 'loading') return false;
            const background = document.getElementById('loading-screen');
            if (!background || background.querySelectorAll('svg polygon').length !== 3) return false;
            const bounds = background.getBoundingClientRect();
            const style = getComputedStyle(background);
            return bounds.width === innerWidth && bounds.height === innerHeight &&
              style.backgroundImage.includes('linear-gradient') && style.pointerEvents === 'none' && !globalThis.$world;
          })()`
        });
        return result.result?.value === true;
      }, 10000);
      const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(dataDir, `startup-background-${index}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  } finally {
    await client.send('Network.setBlockedURLs', { urls: [] });
    await client.send('Page.navigate', { url: urls[0] });
  }
  console.log('Desktop app smoke passed: dashboard and loading page show orange triangles before the bootstrap bundle loads');
}

/** Compare startup artwork with the actual dashboard after ShapeMorpher.fit. */
async function assertDashboardBackground (client) {
  try {
    for (const viewport of [null, { width: 960, height: 600 }, { width: 600, height: 960 }]) {
      if (viewport) await client.send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
      await waitFor('startup artwork matching dashboard layout', async () => {
        const result = await client.send('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => {
            const background = $world.get('background');
            if (background.owner.width !== innerWidth || background.owner.height !== innerHeight) return false;
            const scene = document.querySelector('#loading-screen svg');
            const matrix = scene.getScreenCTM();
            const polygons = [...scene.querySelectorAll('polygon')];
            for (const [index, triangle] of background.submorphs.entries()) {
              for (const [vertex, { position }] of triangle.vertices.entries()) {
                const actual = triangle.getGlobalTransform().transformPoint(position);
                const initial = polygons[index].points.getItem(vertex).matrixTransform(matrix);
                if (Math.hypot(actual.x - initial.x, actual.y - initial.y) > 0.15) {
                  throw new Error('Startup triangle ' + index + ' shifts at ' + innerWidth + 'x' + innerHeight);
                }
              }
              const path = document.getElementById(triangle.id).querySelector('path');
              if (getComputedStyle(polygons[index]).fill !== getComputedStyle(path).fill ||
                  Number(getComputedStyle(polygons[index]).opacity) !== triangle.opacity) {
                throw new Error('Startup triangle color differs from dashboard');
              }
            }
            const gradient = scene.querySelector('foreignObject div');
            if (!gradient || getComputedStyle(gradient).backgroundImage !==
                getComputedStyle(document.getElementById(background.id)).backgroundImage) {
              throw new Error('Startup gradient differs from dashboard');
            }
            return true;
          })()`
        });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result?.value === true;
      }, 10000, 100);
    }
  } finally {
    await client.send('Emulation.clearDeviceMetricsOverride');
    // Start the Open workflow with a fresh dashboard at the original size.
    await client.send('Runtime.evaluate', { expression: 'globalThis.__desktopViewportDocument = document' });
    await client.send('Page.reload');
    await waitFor('dashboard after viewport checks', async () => {
      const result = await client.send('Runtime.evaluate', {
        expression: `Boolean(!globalThis.__desktopViewportDocument && globalThis.$world?.get('a project browser')?.opacity > 0.9 && !globalThis.__loadError__)`,
        returnByValue: true
      });
      return result.result?.value === true;
    });
  }
  console.log('Desktop app smoke passed: startup triangles and gradient match the rendered dashboard in landscape and portrait');
}

/** Exercise the frame used by both the dashboard and same-document worlds. */
async function assertDesktopTitlebar (client, dataDir, world = false) {
  await waitFor('transparent desktop title bar', async () => {
    const state = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const frame = document.getElementById('lively-desktop-titlebar');
        const style = frame && getComputedStyle(frame);
        const title = frame?.querySelector('.window-title');
        const frameBounds = frame?.getBoundingClientRect();
        const titleBounds = title?.getBoundingClientRect();
        const titleStyle = title && getComputedStyle(title);
        const range = document.createRange();
        if (title) range.selectNodeContents(title);
        const textBounds = range.getBoundingClientRect();
        const controls = frame && [...frame.querySelectorAll('button')];
        const bar = globalThis.$world?.get('lively top bar');
        const node = bar && document.getElementById(bar.id);
        const dashboardControls = globalThis.$world?.get('top side');
        const mac = navigator.platform.startsWith('Mac');
        const windowControls = frame && [...frame.querySelectorAll('.window-controls button')];
        const colors = frame?.hasAttribute('data-inactive')
          ? Array(3).fill('rgb(184, 184, 184)') : ['rgb(255, 95, 87)', 'rgb(254, 188, 46)', 'rgb(40, 200, 64)'];
        const trafficLights = !mac || (windowControls.map(button => button.dataset.action).join(',') === 'close,minimize,maximize' &&
          windowControls.every((button, index) => {
            const circle = getComputedStyle(button, '::before');
            return circle.width === '12px' && circle.height === '12px' && circle.borderRadius === '50%' && circle.backgroundColor === colors[index];
          }));
        return Boolean(frame && typeof livelyDesktop.windowAction === 'function' &&
          title?.textContent === 'lively.next - ' + globalThis.$world?.name && trafficLights &&
          titleBounds.left + titleBounds.width / 2 === frameBounds.left + frameBounds.width / 2 &&
          textBounds.top >= frameBounds.top && textBounds.bottom <= frameBounds.bottom &&
          titleStyle.textOverflow === 'ellipsis' && titleStyle.overflow === 'hidden' &&
          (!mac || (document.title === '\u200b' && nw.Window.get().title === '\u200b')) &&
          (!globalThis.nw || nw.App.manifest.window.frame === false) &&
          style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.webkitAppRegion === 'drag' &&
          frame.getBoundingClientRect().height === livelyDesktop.titlebarHeight &&
          controls.every(button => button.getAttribute('aria-label') && getComputedStyle(button).webkitAppRegion === 'no-drag') &&
          (navigator.platform.startsWith('Mac') || livelyDesktop.menu?.items?.length === 5) &&
          (${world} || dashboardControls?.globalBounds().top() >= livelyDesktop.titlebarHeight) &&
          (!${world} || (node && node.getBoundingClientRect().top === 0 &&
            bar.layout.padding.top() === livelyDesktop.titlebarHeight &&
            getComputedStyle(node).backgroundImage.includes('linear-gradient') &&
            bar.submorphs.filter(m => m.isLayoutable).every(m => m.top >= livelyDesktop.titlebarHeight))));
      })()`
    });
    if (state.exceptionDetails || state.result?.value !== true) {
      throw new Error('Transparent desktop title bar failed: ' + JSON.stringify(state));
    }
    return true;
  }, 15000);
  const lights = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `navigator.platform.startsWith('Mac') && [...document.querySelectorAll('#lively-desktop-titlebar button')].map(button => {
      const bounds = button.getBoundingClientRect();
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    })`
  });
  for (const position of lights.result.value || []) {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...position });
    const hover = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const button = document.querySelector('#lively-desktop-titlebar button:hover');
        const opacity = button && Number(getComputedStyle(button.firstChild).opacity);
        return button && getComputedStyle(button).backgroundColor === 'rgba(0, 0, 0, 0)' && opacity > 0 && opacity < .75;
      })()`
    });
    if (hover.result?.value !== true) throw new Error('macOS controls have an opaque or excessive hover effect: ' + JSON.stringify(hover));
  }
  if (lights.result.value) await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 200, y: 16 });
  const screenshot = await client.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(dataDir, world ? 'world-titlebar.png' : 'dashboard-titlebar.png'), Buffer.from(screenshot.data, 'base64'));
  console.log('Desktop app smoke passed: transparent ' + (world ? 'world title bar shares the toolbar gradient' : 'dashboard title bar preserves window controls and Go menu'));
}

/** Windows/Linux check requiring a window manager; plain Xvfb cannot maximize. */
async function assertDesktopWindowControls (client) {
  const action = name => client.send('Runtime.evaluate', {
    expression: `livelyDesktop.windowAction(${JSON.stringify(name)})`
  });
  const state = (expected, label) => waitFor('desktop window ' + expected, async () => {
    const result = await client.send('Runtime.evaluate', {
      awaitPromise: true, returnByValue: true,
      expression: `new Promise(resolve => chrome.windows.getCurrent(win => resolve(
        win.state === ${JSON.stringify(expected)} &&
        document.querySelector('#lively-desktop-titlebar [data-action=maximize]')?.title === ${JSON.stringify(label)} &&
        typeof livelyDesktop.windowAction === 'function')))`
    });
    return result.result?.value === true;
  }, 30000);
  await action('restore');
  await state('normal', 'Maximize window');
  await action('maximize');
  await state('maximized', 'Restore window');
  await client.send('Page.reload');
  await state('maximized', 'Restore window');
  await waitFor('dashboard after window-control checks', async () => {
    const result = await client.send('Runtime.evaluate', {
      expression: `Boolean(globalThis.$world?.get('a project browser')?.opacity > 0.9)`, returnByValue: true
    });
    return result.result?.value === true;
  });
  await action('restore');
  await state('normal', 'Maximize window');
  console.log('Desktop app smoke passed: maximize survives reload and restore returns the original window');
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
        node.scrollIntoView({ block: 'center', inline: 'nearest' });
        const bounds = node.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return null;
        const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        if (!node.contains(document.elementFromPoint(x, y))) return null;
        globalThis.__desktopDashboardDocument = document;
        return { x, y };
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
    this.forbiddenOrigins = new Set();
    this.localNetworkRequests = new Set();
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
      if (['Network.requestWillBeSent', 'Network.webSocketCreated'].includes(message.method)) {
        const url = message.params.request?.url || message.params.url;
        if (this.forbiddenOrigins.has(new URL(url.replace(/^ws/, 'http')).origin)) this.localNetworkRequests.add(url);
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

  send (method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }

  close () {
    try { this.ws.close(); } catch (_) {}
  }

  assertNoRendererErrors () {
    if (this.localNetworkRequests.size) throw new Error('Native renderer requested the local HTTP backend: ' + [...this.localNetworkRequests].join(', '));
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
  if (options.native) {
    const result = await client.send('Runtime.evaluate', {
      awaitPromise: true, returnByValue: true,
      expression: `(async () => {
        const env = System.get('@system-env');
        if (env.node || env.nodeRequire || System._nodeRequire) throw new Error('Renderer acquired Node resolution');
        if (System.baseURL !== livelyNative.baseURL) throw new Error('Native renderer has the wrong root: ' + System.baseURL);
        for (const name of ${JSON.stringify(CORE_PACKAGES)}) {
          if (!(await System.normalize(name)).startsWith(livelyNative.baseURL)) throw new Error('Nonlocal native module: ' + name);
        }
        return true;
      })()`
    });
    if (result.exceptionDetails || result.result?.value !== true) throw new Error('Native module resolution failed: ' + JSON.stringify(result));
    return;
  }
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
    name: 'upstream--dormant', version: '0.1.0', author: { name: 'smoke' }, lively: { projectDependencies: [] }
  }));
  fs.writeFileSync(path.join(dormant, '.livelyForkInformation'), JSON.stringify({ owner: 'smoke', name: 'dormant' }));
  const invalid = path.join(runtimeRoot, 'local_projects', 'smoke--invalid');
  fs.mkdirSync(invalid, { recursive: true });
  fs.writeFileSync(path.join(invalid, 'package.json'), JSON.stringify({ name: 'smoke--invalid', version: '0.0.0' }));
  let legacyParent = dormant;
  for (const name of ['lively.freezer', 'lively-system-interface', 'lively.ast', 'lively.lang', 'lively.morphic', 'lively.modules']) {
    legacyParent = path.join(legacyParent, 'node_modules', name);
    fs.mkdirSync(legacyParent, { recursive: true });
    fs.writeFileSync(path.join(legacyParent, 'package.json'), JSON.stringify({ name, version: '9.0.0', main: 'index.js' }));
    fs.writeFileSync(path.join(legacyParent, 'index.js'), 'throw new Error("An unopened project replaced the bundled core sources");');
  }
}

async function main () {
  const args = parseArgs();
  const native = args.mode !== 'http';
  const startupOnly = args.startupOnly === 'true';
  const componentsOnly = args.componentsOnly === 'true';
  const checkSavedWorld = args.checkSavedWorld === 'true';
  if (args.mode && !['native', 'http'].includes(args.mode)) throw new Error('Unknown desktop mode: ' + args.mode);
  const devRoot = args.devRoot ? path.resolve(args.devRoot) : null;
  const bundleDir = devRoot ? null : path.resolve(args.bundleDir || '');
  const platform = args.platform || hostPlatform();
  const timeoutMs = Number(args.timeout || process.env.LIVELY_APP_SMOKE_TIMEOUT || DEFAULT_TIMEOUT);
  if (!devRoot && (!bundleDir || bundleDir === process.cwd())) throw new Error('Pass --bundleDir=<desktop bundle dir> or --devRoot=<repo root>');
  if (devRoot && !fs.existsSync(path.join(devRoot, 'lively.app', 'start.sh'))) {
    throw new Error(`Dev root does not look like lively.next: ${devRoot}`);
  }

  const { command, args: commandArgs } = devRoot ? devAppCommand(devRoot) : appCommand(bundleDir, platform);
  assertExecutableExists(command);

  // Exercise URL decoding, including Windows' RUNNER~1 temporary paths.
  const smokeRoot = args.dataDir ? path.dirname(path.resolve(args.dataDir)) : fs.mkdtempSync(path.join(os.tmpdir(), 'lively-app-smoke~ spaces-'));
  const dataDir = args.dataDir ? path.resolve(args.dataDir) : path.join(smokeRoot, 'data');
  const cacheDir = path.join(smokeRoot, 'cache');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  if (!devRoot && !args.dataDir) seedProject(dataDir);
  let programmingLock;
  let cachedBuild = 'previous build';
  const cacheProbe = devRoot || native || startupOnly || componentsOnly || checkSavedWorld ? null : createServer((req, res) => {
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
  let previousPort, portGuard;
  for (const reopened of devRoot || checkSavedWorld ? [false] : [false, true]) {
    appExitStatus = null;
    if (reopened && cacheProbe) {
      // The HTTP port can change after relaunch; saved assets must follow it.
      portGuard = createServer((_req, res) => { res.writeHead(410); res.end(); });
      portGuard.unref();
      await waitFor('reserve previous HTTP port', async () => {
        const listening = once(portGuard, 'listening');
        portGuard.listen(previousPort, '127.0.0.1');
        await listening;
        return true;
      }, 10000);
      console.log('Desktop app smoke: reserved previous HTTP port ' + previousPort);
    }
    try { fs.rmSync(logFile, { force: true }); } catch (_) {}
    console.log(`Smoke data: ${dataDir}`);
    console.log(`Launching ${command}${devRoot ? ` in dev mode from ${devRoot}` : ''}`);
    const child = spawn(command, devRoot ? commandArgs : [`--user-data-dir=${path.join(smokeRoot, 'profile')}`, ...commandArgs], {
      cwd: devRoot || bundleDir,
      env: {
        ...process.env,
        LIVELY_APP_DATA_DIR: dataDir,
        LIVELY_APP_CACHE_DIR: cacheDir,
        LIVELY_APP_SMOKE: '1',
        // Leave the variable unset unless requested, exercising normal startup.
        LIVELY_DESKTOP_MODE: args.mode
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

      const launchStarted = Date.now();
      const port = await waitForBootLogReady(logFile, timeoutMs, native);
      if (native && readTextFile(logFile).includes('Starting lively.server on')) {
        throw new Error('Native desktop mode started an HTTP server');
      }
      if (reopened && cacheProbe && port === previousPort) throw new Error('HTTP relaunch did not change its port');
      if (!reopened) previousPort = port;
      const rootURL = pathToFileURL(fs.realpathSync(path.join(dataDir, 'runtime-root')) + path.sep).href;
      const routeURL = route => {
        if (!native) return `http://127.0.0.1:${port}${route}`;
        if (route === '/dashboard/') return rootURL + 'lively.freezer/landing-page/index.html';
        const url = new URL(route, 'http://desktop/');
        url.searchParams.set('route', route.startsWith('/projects/') ? 'projects' : 'worlds');
        return rootURL + 'lively.freezer/loading-screen/index.html' + url.search;
      };
      const dashboardURL = routeURL('/dashboard/');
      if (!native) await waitForHttpOk(dashboardURL, 60000);
      const target = await waitForPageTarget(dashboardURL, 60000);
      console.log(`Attached to desktop page ${target.url}`);
      const client = new CDPClient(target.webSocketDebuggerUrl);
      if (native) {
        const endpointFile = path.join(dataDir, 'local-endpoint.json');
        client.forbiddenOrigins = new Set(['http://127.0.0.1:9011', 'http://localhost:9011',
          ...(fs.existsSync(endpointFile) ? [JSON.parse(fs.readFileSync(endpointFile)).origin] : [])]);
      }
      await client.open();
      try {
        if (!reopened) await assertStartupBackground(client, [dashboardURL, routeURL(WORLD_PATH)], dataDir);
        await client.send('Runtime.enable');
        await client.send('Page.enable');
        await client.send('Log.enable').catch(() => {});
        await client.send('Network.enable');
        await waitFor('boot screen navigation to dashboard', async () => {
          const result = await client.send('Runtime.evaluate', {
            expression: `location.href.startsWith(${JSON.stringify(dashboardURL)})`,
            returnByValue: true
          });
          return result.result && result.result.value === true;
        }, 60000);
        if (startupOnly) await client.send('Runtime.evaluate', { expression: `
          globalThis.__desktopFrames = { last: performance.now(), longest: 0 };
          requestAnimationFrame(function sample (time) {
            const frames = globalThis.__desktopFrames;
            frames.longest = Math.max(frames.longest, time - frames.last);
            frames.last = time;
            requestAnimationFrame(sample);
          });
        ` });
        await waitFor('dashboard initialization', async () => {
          const result = await client.send('Runtime.evaluate', {
            expression: `Boolean(globalThis.$world && $world.get('a project browser')?.opacity > 0.9 && !globalThis.__loadError__)`,
            returnByValue: true
          });
          return result.result && result.result.value === true;
        }, timeoutMs);
        const dashboardReady = Date.now();
        console.log(JSON.stringify({ mode: native ? 'native' : 'http', reopened, dashboardMs: dashboardReady - launchStarted }));
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
        if (!devRoot && !checkSavedWorld) {
          const projects = await waitFor('visible dashboard project entries', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: `(() => {
                const previews = $world.get('a project browser').viewModel.previews;
                if (!previews?.length || !previews.every(p => {
                  const node = document.getElementById(p.get('open button')?.id);
                  return node && node.getBoundingClientRect().width > 0;
                })) return null;
                return previews.map(p => p._project._name).sort();
              })()`, returnByValue: true
            });
            return result.result?.value;
          }, timeoutMs, 100);
          if (JSON.stringify(projects) !== JSON.stringify(reopened && !componentsOnly && !startupOnly
            ? ['smoke--dormant', 'smoke--programming', 'smoke--project'] : ['smoke--dormant', 'smoke--project'])) {
            throw new Error('Dashboard lists dependencies as projects: ' + JSON.stringify(projects));
          }
          console.log(JSON.stringify({ mode: native ? 'native' : 'http', reopened,
            projectTilesMs: Date.now() - launchStarted, projectListWaitMs: Date.now() - dashboardReady,
            ...(native ? { backendReady: readTextFile(logFile).includes('Native backend ready') } : {}) }));
          if (native) {
            const result = await client.send('Runtime.evaluate', {
              awaitPromise: true, returnByValue: true,
              expression: `(async () => {
                const { resourceClass } = await livelyNative.fileExtension();
                const read = resourceClass.prototype.read;
                resourceClass.prototype.read = function (...args) {
                  if (this.url === livelyNative.baseURL + 'package-registry.json') {
                    throw new Error('Project listing waited for the backend package registry');
                  }
                  return read.apply(this, args);
                };
                try {
                  const { Project } = lively.FreezerRuntime.exportsOf('lively.project/project.js');
                  return (await Project.listAvailableProjects(true)).map(p => p._name).sort();
                } finally { resourceClass.prototype.read = read; }
              })()`
            });
            if (result.exceptionDetails || JSON.stringify(result.result?.value) !== JSON.stringify(projects)) {
              throw new Error('Native project listing depends on the backend registry: ' + JSON.stringify(result));
            }
          }
          console.log('Desktop app smoke passed: dashboard preserves fork names and hides invalid projects and installed dependencies' +
            (native ? ', without waiting for the backend registry' : ''));
        }
        await assertDashboardBackground(client);
        const registryResult = native && await client.send('Runtime.evaluate', {
          expression: 'livelyNative.fileExtension().then(({resourceClass}) => new resourceClass(livelyNative.baseURL + \'package-registry.json\').readJson())', awaitPromise: true, returnByValue: true
        });
        if (registryResult?.exceptionDetails) throw new Error('Native registry failed: ' + JSON.stringify(registryResult));
        const registry = native ? registryResult.result.value
          : await (await fetch(`http://127.0.0.1:${port}/package-registry.json`)).json();
        const { packageMap } = registry;
        for (const name of ['lively.modules', 'lively.morphic', 'lively.server', 'lively.shell', 'lively.freezer']) {
          const entry = packageMap[name];
          const pkg = entry.versions[entry.latest];
          if ((pkg.url !== name && pkg.url !== rootURL + name) || Object.keys(entry.instances).length !== 1) {
            throw new Error(`Desktop package ${name} has duplicate or noncanonical URLs: ${Object.values(entry.instances).map(pkg => pkg.url).join(', ')}`);
          }
        }
        console.log('Desktop app smoke passed: dashboard initialized with canonical workspace packages');
        await assertDesktopTitlebar(client, dataDir);
        const readyEvent = readTextFile(logFile).match(/^\[([^\]]+)\] (?:Native backend ready|Server ready, loading lively)/m);
        if (!readyEvent) throw new Error('Backend readiness event missing from boot log');
        console.log(JSON.stringify({ mode: native ? 'native' : 'http', reopened, backendReadyMs: Date.parse(readyEvent[1]) - launchStarted }));
        if (startupOnly) {
          const frames = await client.send('Runtime.evaluate', { expression: '__desktopFrames.longest', returnByValue: true });
          console.log(JSON.stringify({ mode: native ? 'native' : 'http', reopened, longestDashboardFrameMs: Math.round(frames.result.value) }));
        }
        if (native && platform !== 'osx' && args.windowControls === 'true') await assertDesktopWindowControls(client);
        if (startupOnly || checkSavedWorld) {
          if (checkSavedWorld) await reopenSmokeWorld(client, routeURL('/worlds/load?name=' + SAVED_WORLD + '&fastLoad=true'), timeoutMs);
          else {
            await client.send('Page.navigate', { url: routeURL(WORLD_PATH) });
            await waitFor('startup world readiness', async () => {
              const state = await client.send('Runtime.evaluate', {
                expression: 'Boolean(globalThis.$world?.name === "aLivelyWorld" && $world._uiInitialized && $world.opacity > 0.9 && !lively.FreezerRuntime && !globalThis.__loadError__)', returnByValue: true
              });
              return state.result?.value === true;
            }, timeoutMs);
            console.log(JSON.stringify({ mode: native ? 'native' : 'http', reopened, worldMs: Date.now() - launchStarted }));
          }
          if (native) await assertNativeAssets(client);
          await assertDesktopTitlebar(client, dataDir, true);
          client.assertNoRendererErrors();
          continue;
        }
        if (componentsOnly) {
          await openDashboardProject(client, 'smoke--project');
          await waitFor('project before component browser', async () => {
            const result = await client.send('Runtime.evaluate', {
              expression: `Boolean($world?._uiInitialized && $world.openedProject?.fullName === 'smoke--project' && globalThis.__desktopDashboardDocument === document)`, returnByValue: true
            });
            return result.result?.value === true;
          }, timeoutMs);
          await assertPartsbinComponentBrowser(client, reopened);
          await assertDesktopTitlebar(client, dataDir, true);
          client.assertNoRendererErrors();
          continue;
        }
        if (reopened) {
          console.log('Desktop app smoke passed: relaunch preserves the project list after dependencies were installed');
          await reopenSmokeWorld(client, routeURL('/worlds/load?name=' + SAVED_WORLD + '&fastLoad=true'), timeoutMs);
          await client.send('Page.navigate', { url: routeURL('/dashboard/') });
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
          await assertDesktopTitlebar(client, dataDir, true);
          await assertBrowserSwc(client);
          await assertPartsbinComponentBrowser(client, true);
          await client.send('Page.navigate', { url: routeURL('/dashboard/') });
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
          await assertDesktopTitlebar(client, dataDir, true);
          await assertBrowserSwc(client);
          await assertComponentModuleURLs(client);
          await assertPartsbinComponentBrowser(client, false);
          await assertFrozenModuleResurrection(client);
          await assertBrowserSwc(client);
        }
        const worldUrl = routeURL(WORLD_PATH);
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
          await assertRendererUsesHttpSystemURLs(client, port, timeoutMs, { native });
          if (native) await assertNativeAssets(client);
          console.log('Desktop app smoke passed: renderer System preserves browser module resolution');
          console.log(JSON.stringify({ mode: native ? 'native' : 'http', reopened, worldMs: Date.now() - launchStarted }));
          await assertBrowserEnvironmentSwitching(client, port);
          await assertBrowserSwc(client);
          await saveSmokeWorld(client);
          await reopenSmokeWorld(client, routeURL('/worlds/load?name=' + SAVED_WORLD + '&fastLoad=true'), timeoutMs);

          const projectUrl = routeURL(devRoot ? PROJECT_PATH : EXISTING_PROJECT_PATH);
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
          await assertRendererUsesHttpSystemURLs(client, port, timeoutMs, { requirePopulatedSystemMap: true, native });
          console.log('Desktop app smoke passed: project route preserves browser module resolution');
          if (!devRoot) {
            await assertProjectProgramming(client, port);
            await assertBrowserSwc(client);
            programmingLock = fs.readFileSync(path.join(dataDir, 'runtime-root', 'local_projects', 'smoke--programming', 'bun.lock'), 'utf8');
          }
        }
        client.assertNoRendererErrors();
        console.log('Desktop app smoke passed: backend started and world loaded without uncaught renderer errors');
      } catch (err) {
        console.error(`\n--- page state ---\n${JSON.stringify(await describePageState(client), null, 2)}`);
        const diagnostics = recentCdpDiagnostics(client);
        if (diagnostics.length) console.error(`\n--- recent browser diagnostics ---\n${JSON.stringify(diagnostics, null, 2)}`);
        throw err;
      } finally {
        if (child.exitCode === null) {
          const closed = new Promise(resolve => child.once('exit', resolve));
          await client.send('Runtime.evaluate', { expression: 'const button = document.querySelector("#lively-desktop-titlebar [data-action=close]"); if (button) button.click(); else nw.Window.get().close()' });
          let timer;
          const code = await Promise.race([closed, new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), 15000); })]);
          clearTimeout(timer);
          if (code !== 0) throw new Error('Desktop close-button shutdown failed: ' + code);
        }
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
  portGuard?.close();
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
