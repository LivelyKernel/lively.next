// Read retained function bindings in the renderer's Node context. No Debugger
// domain, breakpoint, exception pause, call-frame handle, or native continuation.
const { Session } = require('node:inspector');
let nextRequest = 0;

async function captureFunctionBindings (func, names, { globalObject = global, send = null } = {}) {
  if (typeof func !== 'function') throw new TypeError('Expected a function');
  if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) {
    throw new TypeError('Expected binding names');
  }
  const pending = new Set(names);
  const liveBindings = func[Symbol.for('lively-debug-bindings')];
  if (liveBindings && names.every(name => Object.prototype.hasOwnProperty.call(liveBindings, name))) return liveBindings;
  if (!pending.size) return {};
  const key = '__livelyFunctionScopes' + ++nextRequest;
  const state = globalObject[key] = { func, bindings: {}, source: {} };
  const session = send ? null : new Session();
  const post = (method, params = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(method + ' timed out')), 4000);
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
          arguments: [{ value: property.name }, argument, {value: pending.has(property.name)}]
        });
        pending.delete(property.name);
      }
    }
    if (pending.size) throw new Error('Missing retained bindings: ' + [...pending].join(', '));
    // Source recovery is supplementary; an unsupported source form must not
    // discard successfully recovered runtime bindings.
    try { await annotateFunctionSource(func, state.source, globalObject); } catch (_) {}
    // These are values, not writable handles to the original lexical bindings.
    return state.bindings;
  } finally {
    if (session) session.disconnect();
    delete globalObject[key];
  }
}

async function annotateFunctionSource(func, source, globalObject) {
  if (Object.prototype.hasOwnProperty.call(func, Symbol.for('lively-object-meta')) || !Object.isExtensible(func)) return;
  const moduleSource = source.__lvOriginalCode, recorder = source.__lvVarRecorder;
  if (!moduleSource || !recorder || !globalObject.System?.import) return;
  const owner = recorder[source.factoryName];
  const currentModule = recorder.__currentLivelyModule;
  const moduleMeta = owner?.[Symbol.for('lively-module-meta')] || (currentModule && {package: {}, pathInPackage: currentModule.id});
  const ownerMeta = owner?.[Symbol.for('lively-object-meta')];
  if (!moduleMeta) return;
  const { parse, parseFunction, escodegen, withMozillaAstDo } = await globalObject.System.import('lively.ast');
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

async function captureRendererFunctionBindings (renderer, func, names, cdpPort = 9222) {
  // Use NW.js's existing Blink inspector. Attaching node:inspector to this same
  // renderer replaces the DOM inspector and can crash with concurrent DevTools.
  const { CDPClient, defaultFetchJson } = require('./inspector-service.cjs');
  const targets = await defaultFetchJson('http://127.0.0.1:' + cdpPort + '/json/list');
  const target = targets.find(target => target.type === 'page' && target.url === renderer.location.href);
  if (!target || !target.webSocketDebuggerUrl) throw new Error('No inspector target for this renderer');
  const client = new CDPClient(target.webSocketDebuggerUrl);
  try {
    await client.open();
    return await captureFunctionBindings(func, names, {
      globalObject: renderer, send: (method, params) => client.send(method, params)
    });
  } finally { client.close(); }
}

module.exports = { captureFunctionBindings, captureRendererFunctionBindings };
