#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const CDP_PORT = Number(process.env.LIVELY_APP_SMOKE_CDP_PORT || 9222);
const DEFAULT_TIMEOUT = 300000;
const DEBUGGER_SMOKE_REASON = 'desktop debugger smoke';
const DEBUGGER_CURRENT_LINE_MARKER_ID = 'lively-debugger-current-line';
const WORLD_PATH = '/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=true';
const PROJECT_PATH = '/projects/load?name=__newProject__&askForWorldName=false&fastLoad=true';
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

function stopApp (child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 3000).unref();
  }
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

async function waitForPageTarget (timeoutMs) {
  return waitFor('NW.js DevTools page target', async () => {
    const targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    return targets.find(target =>
      target.type === 'page' &&
      target.webSocketDebuggerUrl &&
      !String(target.url || '').startsWith('devtools://'));
  }, timeoutMs);
}

class CDPClient {
  constructor (url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
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

function debuggerSmokeStateExpression () {
  return `(() => {
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
      stepActionStatus,
      stepActionError,
      debuggerWindowTitle: debuggerWindow && (debuggerWindow.title || debuggerWindow.name),
      windowTitles: windows.map(win => win && (win.title || win.name || '')).filter(Boolean)
    };
  })()`;
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

  const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-app-smoke-'));
  const dataDir = path.join(smokeRoot, 'data');
  const cacheDir = path.join(smokeRoot, 'cache');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  const logFile = devRoot
    ? path.join(devRoot, 'lively.app', 'boot.log')
    : path.join(dataDir, 'boot.log');
  try { fs.rmSync(logFile, { force: true }); } catch (_) {}

  console.log(`Launching ${command}${devRoot ? ` in dev mode from ${devRoot}` : ''}`);
  const child = spawn(command, commandArgs, {
    cwd: devRoot || bundleDir,
    env: {
      ...process.env,
      LIVELY_APP_DATA_DIR: dataDir,
      LIVELY_APP_CACHE_DIR: cacheDir,
      LIVELY_APP_SMOKE: '1',
      LIVELY_APP_HEADLESS: headless ? '1' : '',
      LIVELY_APP_BOOT_URL: WORLD_PATH
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
    await waitForHttpOk(`http://127.0.0.1:${port}${WORLD_PATH}`, 60000);
    console.log('Desktop server world route responded');

    const target = await waitForPageTarget(60000);
    const client = new CDPClient(target.webSocketDebuggerUrl);
    await client.open();
    try {
      await client.send('Runtime.enable');
      await client.send('Page.enable');
      await client.send('Log.enable').catch(() => {});
      const worldUrl = `http://127.0.0.1:${port}${WORLD_PATH}`;
      console.log(`Navigating app window to ${worldUrl}`);
      await client.send('Page.navigate', { url: worldUrl });
      try {
        await waitFor('world load in app window', async () => {
          const result = await client.send('Runtime.evaluate', {
            expression: `Boolean(globalThis.$world && $world.name === 'lively.next')`,
            returnByValue: true
          });
          return result.result && result.result.value === true;
        }, timeoutMs);
        await assertRendererUsesHttpSystemURLs(client, port, timeoutMs);
        console.log('Desktop app smoke passed: renderer System uses HTTP module URLs');
        if (debuggerSmoke) await assertDesktopDebuggerSmoke(client, timeoutMs);

        const projectUrl = `http://127.0.0.1:${port}${PROJECT_PATH}`;
        console.log(`Navigating app window to ${projectUrl}`);
        await client.send('Page.navigate', { url: projectUrl });
        await waitFor('create project route bootstrap', async () => {
          const result = await client.send('Runtime.evaluate', {
            expression: `Boolean(globalThis.System && System.get && System.get('@lively-env') && document.readyState !== 'loading')`,
            returnByValue: true
          });
          return result.result && result.result.value === true;
        }, timeoutMs);
        await assertRendererUsesHttpSystemURLs(client, port, timeoutMs, { requirePopulatedSystemMap: true });
        console.log('Desktop app smoke passed: create project route keeps System URLs on HTTP');
      } catch (err) {
        console.error(`\n--- page state ---\n${JSON.stringify(await describePageState(client), null, 2)}`);
        const diagnostics = recentCdpDiagnostics(client);
        if (diagnostics.length) console.error(`\n--- recent browser diagnostics ---\n${JSON.stringify(diagnostics, null, 2)}`);
        throw err;
      }
      console.log('Desktop app smoke passed: server started and world loaded');
    } finally {
      client.close();
    }
  } catch (err) {
    console.error(err.stack || err);
    console.error(`\n--- boot.log (${logFile}) ---\n${tailFile(logFile) || '(missing)'}`);
    throw err;
  } finally {
    stopApp(child);
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
