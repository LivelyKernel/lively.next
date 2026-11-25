// Desktop [[Scopes]] reader: reads the values a function's closure scopes retain
// through the inspector's Runtime domain, and installs it on trusted desktop pages
// as `livelyDesktop.debugger.captureFunctionBindings(fn, names)`. Pages are read
// through NW.js's in-process `chrome.debugger` API, which opens no network
// endpoint. It uses no Debugger domain, breakpoint, exception pause, call-frame
// handle, or native continuation. LIVELY_APP_FUNCTION_SCOPES=0 disables the
// page bridge.
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { randomUUID } = require('node:crypto');
const { Session } = require('node:inspector');

const COMMAND_TIMEOUT = 4000;

/**
 * Read the retained bindings `names` of `func`. Without `send` this attaches an
 * in-process inspector session; with `send(method, params)` it uses that CDP
 * transport. The holder, binding map and source map the inspector writes into
 * belong to `globalObject`'s realm.
 */
async function captureFunctionBindings (func, names, { globalObject = global, send = null } = {}) {
  if (typeof func !== 'function') throw new TypeError('Expected a function');
  if (!Array.isArray(names)) throw new TypeError('Expected binding names');
  // Page arrays may override their methods/iterator. Never give them a Node callback.
  const requested = [];
  for (let index = 0, length = names.length; index < length; index++) {
    const name = names[index];
    if (typeof name !== 'string') throw new TypeError('Expected binding names');
    requested.push(name);
  }
  const pending = new Set(requested);
  const liveBindings = func[Symbol.for('lively-debug-bindings')];
  if (liveBindings) {
    let complete = true;
    for (const name of requested) {
      if (!Object.prototype.hasOwnProperty.call(liveBindings, name)) { complete = false; break; }
    }
    if (complete) return liveBindings;
  }
  if (!pending.size) return new globalObject.Object();
  const key = '__livelyFunctionScopes' + randomUUID();
  // The inspector needs a temporary root, but page hooks must see only page data.
  const state = globalObject.Function('key', 'func', `
    const state = {func, bindings: {}, source: {}};
    Object.defineProperty(globalThis, key, {value: state, configurable: true});
    return state;
  `)(key, func);
  const session = send ? null : new Session();
  const post = (method, params = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(method + ' timed out')), COMMAND_TIMEOUT);
    const finish = (error, result) => {
      clearTimeout(timer);
      if (error) return reject(error);
      if (result.exceptionDetails) return reject(new Error(result.exceptionDetails.text));
      resolve(result);
    };
    if (send) send(method, params).then(result => finish(null, result), error => finish(error));
    else session.post(method, params, finish);
  });
  try {
    if (session) session.connect();
    await post('Runtime.enable');
    const holder = (await post('Runtime.evaluate', { expression: 'globalThis[' + JSON.stringify(key) + ']' })).result;
    const holderProperties = await post('Runtime.getProperties', { objectId: holder.objectId, ownProperties: true });
    const fn = holderProperties.result.find(property => property.name === 'func').value;
    const properties = await post('Runtime.getProperties', { objectId: fn.objectId, ownProperties: true });
    const scopes = properties.internalProperties.find(property => property.name === '[[Scopes]]');
    if (!scopes) throw new Error('Function has no retained scopes');
    const list = await post('Runtime.getProperties', { objectId: scopes.value.objectId, ownProperties: true });
    for (const entry of list.result.filter(property => /^\d+$/.test(property.name))) {
      if (entry.value.description === 'Global') continue;
      if (!state.source.factoryName && /^Closure \(.+\)$/.test(entry.value.description))
        state.source.factoryName = entry.value.description.slice(9, -1);
      const scope = await post('Runtime.getProperties', { objectId: entry.value.objectId, ownProperties: true });
      for (const property of scope.result) {
        const sourceProperty = ['__lvVarRecorder', '__lvOriginalCode'].includes(property.name);
        if ((!pending.has(property.name) && !sourceProperty) || !property.value) continue;
        const value = property.value;
        const argument = value.objectId ? { objectId: value.objectId }
          : value.unserializableValue ? { unserializableValue: value.unserializableValue }
            : { value: value.value };
        await post('Runtime.callFunctionOn', {
          objectId: holder.objectId,
          functionDeclaration: 'function(name,value,binding){if(binding)Object.defineProperty(this.bindings,name,{value,writable:true,enumerable:true,configurable:true});if(name==="__lvOriginalCode"||name==="__lvVarRecorder")this.source[name]=value;}',
          arguments: [{ value: property.name }, argument, { value: pending.has(property.name) }]
        });
        pending.delete(property.name);
      }
    }
    if (pending.size) throw new Error('Missing retained bindings: ' + [...pending].join(', '));
    // Source recovery is supplementary; an unsupported source form must not
    // discard successfully recovered runtime bindings.
    try {
      await post('Runtime.callFunctionOn', {
        objectId: holder.objectId,
        functionDeclaration: String(annotateFunctionSource),
        awaitPromise: true
      });
    } catch (_) {}
    // These are values, not writable handles to the original lexical bindings.
    return state.bindings;
  } finally {
    if (session) session.disconnect();
    delete globalObject[key];
  }
}

// Evaluated by Runtime in the holder's realm, never invoked across realms from Node.
async function annotateFunctionSource () {
  const { func, source } = this;
  if (Object.prototype.hasOwnProperty.call(func, Symbol.for('lively-object-meta')) || !Object.isExtensible(func)) return;
  const moduleSource = source.__lvOriginalCode, recorder = source.__lvVarRecorder;
  if (!moduleSource || !recorder || !globalThis.System?.import) return;
  const owner = recorder[source.factoryName];
  const currentModule = recorder.__currentLivelyModule;
  const moduleMeta = owner?.[Symbol.for('lively-module-meta')] || (currentModule && {package: {}, pathInPackage: currentModule.id});
  const ownerMeta = owner?.[Symbol.for('lively-object-meta')];
  if (!moduleMeta) return;
  const { parse, parseFunction, escodegen, withMozillaAstDo } = await globalThis.System.import('lively.ast');
  const original = parseFunction(String(func)), matches = [];
  const body = escodegen.generate(original.body);
  const params = original.params.map(param => escodegen.generate(param)).join(',');
  withMozillaAstDo(parse(moduleSource), null, (next, node) => {
    if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type) &&
        (!ownerMeta || ownerMeta.moduleSource !== moduleSource || node.start >= ownerMeta.start && node.end <= ownerMeta.end) &&
        !!node.async === !!original.async && !!node.generator === !!original.generator &&
        node.params.map(param => escodegen.generate(param)).join(',') === params &&
        escodegen.generate(node.body) === body) matches.push(node);
    next();
  });
  // Only the function's own retained module and factory are eligible. Ambiguous
  // matches keep the captured function source instead of guessing a location.
  if (matches.length !== 1) return;
  Object.defineProperties(func, {
    [Symbol.for('lively-module-meta')]: {value: moduleMeta, configurable: true},
    [Symbol.for('lively-object-meta')]: {value: {start: matches[0].start, end: matches[0].end, moduleSource}, configurable: true}
  });
}

/**
 * Call `chrome.debugger[method](...args)`, NW.js's in-process inspector API.
 * Resolves to the callback's result; rejects with `chrome.runtime.lastError`,
 * whose protocol errors carry the JSON of the CDP error object.
 */
function chromeDebugger (method, ...args) {
  return new Promise((resolve, reject) => chrome.debugger[method](...args, result => {
    const error = chrome.runtime.lastError;
    if (!error) return resolve(result);
    let message = error.message;
    try { message = JSON.parse(message).message || message; } catch (_) {}
    reject(new Error(message));
  }));
}

/** `promise`, or a rejection with `label + ' timed out'` after COMMAND_TIMEOUT ms. */
function withDeadline (promise, label) {
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' timed out')), COMMAND_TIMEOUT);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

// An extension attaches to a target at most once, so renderer reads take turns.
let rendererTurn = Promise.resolve();

/**
 * Read retained bindings of a function living in the NW.js renderer `renderer`
 * (a page window). Attaches `chrome.debugger` to the page target showing
 * `renderer.location.href`, sends the Runtime commands through it and detaches
 * before the next read attaches. Target lookup, attach and detach each fail
 * after COMMAND_TIMEOUT ms. Attaching node:inspector to the renderer instead
 * would replace its DOM inspector and can crash with concurrent DevTools.
 */
function captureRendererFunctionBindings (renderer, func, names) {
  const read = rendererTurn.then(() => readRenderer(renderer, func, names));
  rendererTurn = read.catch(() => {});
  return read;
}

async function readRenderer (renderer, func, names) {
  const href = renderer.location.href;
  const targets = await withDeadline(chromeDebugger('getTargets'), 'chrome.debugger.getTargets');
  const page = targets.find(target => target.type === 'page' && target.url === href);
  if (!page) throw new Error('No inspector target for this renderer');
  const target = { targetId: page.id };
  const attached = chromeDebugger('attach', target, '1.3');
  try {
    await withDeadline(attached, 'chrome.debugger.attach');
  } catch (error) {
    // An attach that completes after its deadline must not hold the target.
    attached.then(() => chromeDebugger('detach', target)).catch(() => {});
    throw error;
  }
  try {
    const send = (method, params) => chromeDebugger('sendCommand', target, method, params).then(result => result || {});
    return await captureFunctionBindings(func, names, { globalObject: renderer, send });
  } finally {
    await withDeadline(chromeDebugger('detach', target), 'chrome.debugger.detach').catch(() => {});
  }
}

/**
 * Whether `page` is a desktop entry page: a page of the HTTP desktop origin, the
 * boot page, or the packaged landing page / loading screen. `bootstrap` is
 * start-server.cjs's exports (`desktopOrigin`, `livelyNative.baseURL`).
 */
function trustedFunctionScopePage (page, bootstrap) {
  try {
    const url = new URL(page.location.href);
    if (bootstrap.desktopOrigin && url.origin === bootstrap.desktopOrigin) return true;
    if (url.protocol !== 'file:') return false;
    const file = fs.realpathSync(fileURLToPath(url));
    const entries = [path.join(__dirname, 'boot.html'), path.join(__dirname, '..', 'boot.html')];
    const base = bootstrap.livelyNative?.baseURL;
    if (base) {
      for (const entry of ['landing-page', 'loading-screen']) {
        entries.push(fileURLToPath(base + 'lively.freezer/' + entry + '/index.html'));
      }
    }
    return entries.some(entry => fs.existsSync(entry) && fs.realpathSync(entry) === file);
  } catch (_) { return false; }
}

/**
 * Install `livelyDesktop.debugger.captureFunctionBindings` on every trusted page
 * the NW.js window `win` loads, and remove it from untrusted ones. Each call
 * re-checks that the window still shows the same trusted page.
 */
function installFunctionScopeReader (win, bootstrap) {
  if (process.env.LIVELY_APP_FUNCTION_SCOPES === '0') return;
  const install = () => {
    const page = win.window;
    if (!trustedFunctionScopePage(page, bootstrap)) {
      if (page.livelyDesktop?.debugger) delete page.livelyDesktop.debugger.captureFunctionBindings;
      return;
    }
    const desktop = page.livelyDesktop || (page.livelyDesktop = new page.Object());
    const debuggerBridge = desktop.debugger || (desktop.debugger = new page.Object());
    // Keep the backend functions in a closure: functions, promises, errors and
    // the binding container exposed to the page must belong to its own realm.
    debuggerBridge.captureFunctionBindings = page.Function('capture', 'trusted', `
      return async function captureFunctionBindings(func, names) {
        try {
          if (!trusted()) throw new Error('Function scopes require a trusted desktop page');
          const bindings = await capture(func, names);
          const result = {};
          for (const key of Reflect.ownKeys(bindings)) {
            Object.defineProperty(result, key, Object.getOwnPropertyDescriptor(bindings, key));
          }
          return result;
        } catch (error) { throw new Error(String(error.message || error)); }
      };
    `)((func, names) => captureRendererFunctionBindings(page, func, names),
      () => win.window === page && trustedFunctionScopePage(page, bootstrap));
  };
  win.on('loaded', install);
  // The boot page may have finished loading before this window was resolved.
  if (win.window.document?.readyState === 'complete') install();
}

module.exports = { captureFunctionBindings, captureRendererFunctionBindings, installFunctionScopeReader };
