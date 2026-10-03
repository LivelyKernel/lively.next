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
  if (!pending.size) return {};
  const key = '__livelyFunctionScopes' + ++nextRequest;
  const state = globalObject[key] = { func, bindings: {} };
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
      const scope = await post('Runtime.getProperties', { objectId: entry.value.objectId, ownProperties: true });
      for (const property of scope.result) {
        if (!pending.has(property.name) || !property.value) continue;
        const value = property.value;
        const argument = value.objectId ? { objectId: value.objectId }
          : value.unserializableValue ? { unserializableValue: value.unserializableValue }
            : { value: value.value };
        await post('Runtime.callFunctionOn', {
          objectId: holder.objectId,
          functionDeclaration: 'function(name,value){Object.defineProperty(this.bindings,name,{value,writable:true,enumerable:true,configurable:true});}',
          arguments: [{ value: property.name }, argument]
        });
        pending.delete(property.name);
      }
      if (!pending.size) break;
    }
    if (pending.size) throw new Error('Missing retained bindings: ' + [...pending].join(', '));
    // These are values, not writable handles to the original lexical bindings.
    return state.bindings;
  } finally {
    if (session) session.disconnect();
    delete globalObject[key];
  }
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
