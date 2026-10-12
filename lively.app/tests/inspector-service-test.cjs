const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  InspectorService,
  bindingNamesFromProperties,
  pageTarget
} = require('../desktop/inspector-service.cjs');

class FakeCDPClient {
  constructor ({ armed = { captureId: 'capture-test', reason: 'halt' }, properties = {} } = {}) {
    this.armed = armed;
    this.properties = properties;
    this.calls = [];
    this.eventHandler = null;
  }

  onEvent (handler) {
    this.eventHandler = handler;
  }

  async send (method, params = {}) {
    this.calls.push({ method, params });
    if (method === 'Debugger.evaluateOnCallFrame') {
      if (String(params.expression).includes('consumeArmedHalt')) {
        return { result: { value: this.armed } };
      }
      return { result: { value: true } };
    }
    if (method === 'Runtime.getProperties') {
      return { result: this.properties[params.objectId] || [] };
    }
    if (method === 'Runtime.callFunctionOn') {
      if (params.functionDeclaration.includes('IsHaltUnwind')) {
        return { result: { value: params.objectId === 'halt-unwind' } };
      }
      return { result: { value: true } };
    }
    if (method === 'Runtime.evaluate') {
      if (String(params.expression).includes('breakpointTrap')) {
        return { result: { type: 'function', objectId: 'breakpoint-trap' } };
      }
      return { result: { value: true } };
    }
    if (method === 'Debugger.setBreakpointOnFunctionCall') {
      return { breakpointId: 'breakpoint-on-trap' };
    }
    return {};
  }
}

function pausedPayload (overrides = {}) {
  return {
    reason: 'other',
    callFrames: [{
      callFrameId: 'call-frame-0',
      functionName: 'inner',
      url: 'http://127.0.0.1:9011/foo.js',
      location: { scriptId: 'script-1', lineNumber: 10, columnNumber: 4 },
      this: { type: 'object', objectId: 'this-0', description: 'Object' },
      scopeChain: [
        { type: 'local', name: 'Local', object: { objectId: 'scope-local' } },
        { type: 'closure', name: 'Closure', object: { objectId: 'scope-closure' } }
      ]
    }],
    ...overrides
  };
}

async function testBindingNameFiltering () {
  const names = bindingNamesFromProperties([
    { name: 'object', value: { type: 'object', objectId: 'object-1' } },
    { name: 'token', value: { type: 'string', value: 'SHOULD_NOT_LEAVE_CDP' } },
    { name: '__proto__', value: { type: 'object' } },
    { name: 'getterOnly', get: { type: 'function' } }
  ]);

  assert.deepStrictEqual(names, ['object', 'token']);
}

async function testTargetSelection () {
  const target = pageTarget([
    { type: 'page', url: 'devtools://devtools', webSocketDebuggerUrl: 'ignored' },
    { type: 'worker', url: 'http://example.test', webSocketDebuggerUrl: 'ignored' },
    { type: 'page', url: 'http://127.0.0.1:9011/dashboard/', webSocketDebuggerUrl: 'ws://target' }
  ]);

  assert.strictEqual(target.webSocketDebuggerUrl, 'ws://target');
}

async function testStartMarksRendererServiceAttached () {
  const client = new FakeCDPClient();
  const service = new InspectorService({ client });
  await service.start();

  assert(client.calls.some(call => call.method === 'Runtime.enable'));
  assert(client.calls.some(call => call.method === 'Debugger.enable'));
  assert(client.calls.some(call =>
    call.method === 'Runtime.evaluate' &&
    call.params.expression.includes('breakpointTrap')));
  assert(client.calls.some(call =>
    call.method === 'Debugger.setBreakpointOnFunctionCall' &&
    call.params.objectId === 'breakpoint-trap'));
  assert(client.calls.some(call =>
    call.method === 'Runtime.evaluate' &&
    call.params.expression.includes('inspectorServiceAttached = true')));
}

async function testCaptureStoresValuesInRenderer () {
  const client = new FakeCDPClient({
    properties: {
      'scope-local': [
        { name: 'object', value: { type: 'object', objectId: 'object-1', description: 'Object' } },
        { name: 'token', value: { type: 'string', value: 'SHOULD_NOT_LEAVE_CDP' } }
      ],
      'scope-closure': [
        { name: 'outer', value: { type: 'number', value: 23 } }
      ]
    }
  });
  const service = new InspectorService({ client });
  const descriptor = await service.capturePaused(pausedPayload());

  assert.strictEqual(descriptor.captureId, 'capture-test');
  assert.strictEqual(descriptor.reason, 'halt');
  assert.deepStrictEqual(descriptor.frames[0].scopes[0].bindingNames, ['object', 'token']);
  assert.deepStrictEqual(descriptor.frames[0].scopes[1].bindingNames, ['outer']);

  const getPropertiesCalls = client.calls.filter(call => call.method === 'Runtime.getProperties');
  assert.strictEqual(getPropertiesCalls.length, 2);

  const ensureRuntime = client.calls.find(call =>
    call.method === 'Runtime.evaluate' &&
    call.params.expression.includes('installInspectorRuntime'));
  assert(ensureRuntime);
  assert.strictEqual(ensureRuntime.params.awaitPromise, true);

  const argumentStore = client.calls.find(call =>
    call.method === 'Debugger.evaluateOnCallFrame' &&
    call.params.expression.includes('Array.prototype.slice.call(arguments)'));
  assert(argumentStore);
  assert(!argumentStore.params.expression.includes('SHOULD_NOT_LEAVE_CDP'));

  const storeCalls = client.calls.filter(call => call.method === 'Runtime.callFunctionOn');
  assert(storeCalls.some(call => call.params.objectId === 'this-0'));
  assert(storeCalls.some(call => call.params.objectId === 'scope-local'));
  assert(storeCalls.some(call => call.params.objectId === 'scope-closure'));
  for (const call of storeCalls) {
    assert.doesNotThrow(() => new Function('return (' + call.params.functionDeclaration + ')')());
  }

  const localStore = storeCalls.find(call => call.params.objectId === 'scope-local');
  assert.deepStrictEqual(localStore.params.arguments[0].value.bindingNames, ['object', 'token']);
  assert(!JSON.stringify(localStore.params.arguments[0].value).includes('SHOULD_NOT_LEAVE_CDP'));
  assert(!JSON.stringify(descriptor).includes('SHOULD_NOT_LEAVE_CDP'));
}

async function testExceptionCaptureStoresExceptionObject () {
  const client = new FakeCDPClient({
    armed: null,
    properties: {
      'scope-local': [{ name: 'error', value: { type: 'object', objectId: 'error-binding' } }],
      'scope-closure': []
    }
  });
  const service = new InspectorService({ client });
  const descriptor = await service.capturePaused(pausedPayload({
    reason: 'exception',
    data: { type: 'object', objectId: 'exception-1', description: 'Error: boom' }
  }));

  assert.strictEqual(descriptor.reason, 'exception');
  const frameStoreIndex = client.calls.findIndex(call =>
    call.method === 'Runtime.callFunctionOn' &&
    call.params.objectId === 'this-0');
  const exceptionStoreIndex = client.calls.findIndex(call =>
    call.method === 'Runtime.callFunctionOn' &&
    call.params.objectId === 'exception-1' &&
    call.params.functionDeclaration.includes('storeException'));
  assert(frameStoreIndex > -1);
  assert(exceptionStoreIndex > frameStoreIndex);
  assert(client.calls.some(call =>
    call.method === 'Runtime.evaluate' &&
    call.params.expression.includes('installInspectorRuntime')));
}

async function testTaggedHaltUnwindIsIgnored () {
  const client = new FakeCDPClient({ armed: null });
  const service = new InspectorService({ client });
  const descriptor = await service.capturePaused(pausedPayload({
    reason: 'exception',
    data: { type: 'object', objectId: 'halt-unwind', description: '[LivelyInspectorHalt halt]' }
  }));

  assert.strictEqual(descriptor, null);
  const unwindCheck = client.calls.find(call =>
    call.method === 'Runtime.callFunctionOn' &&
    call.params.objectId === 'halt-unwind');
  assert.doesNotThrow(() => new Function('return (' + unwindCheck.params.functionDeclaration + ')')());
  assert(!client.calls.some(call =>
    call.method === 'Runtime.getProperties' ||
    (call.method === 'Runtime.callFunctionOn' && call.params.objectId === 'scope-local')));
}

async function testHandlePausedResumesAndDeliversDescriptor () {
  const client = new FakeCDPClient({
    properties: { 'scope-local': [], 'scope-closure': [] }
  });
  const service = new InspectorService({ client });
  await service.handlePaused(pausedPayload());

  assert(client.calls.some(call => call.method === 'Debugger.resume'));
  const deliver = client.calls.find(call =>
    call.method === 'Runtime.evaluate' &&
    call.params.expression.includes('deliverCapture'));
  assert(deliver.params.expression.includes('capture-test'));
  assert(deliver.params.expression.includes('deliverCapture'));
}

async function testDesktopBuildCopiesNodeMainSiblingRequires () {
  const startServerSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'start-server.cjs'), 'utf8');
  const buildSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build.mjs'), 'utf8');

  const copiedFilesMatch = buildSource.match(/for \(const f of \[([^\]]+)\]\) \{\s*fs\.copyFileSync\(path\.join\(APP_DIR, 'desktop', f\)/s);
  assert(copiedFilesMatch, 'could not find desktop script copy list in build.mjs');

  const copiedFiles = new Set([...copiedFilesMatch[1].matchAll(/'([^']+)'/g)].map(match => match[1]));
  const siblingRequires = [...startServerSource.matchAll(/require\('\.\/([^']+)'\)/g)].map(match => match[1]);

  for (const file of siblingRequires) {
    assert(copiedFiles.has(file), `build.mjs must copy desktop/${file} because start-server.cjs requires it`);
  }
  for (const file of ['inspector-service.cjs', 'inspector-service-runner.cjs']) {
    assert(copiedFiles.has(file), `build.mjs must copy desktop/${file} for the debugger service`);
  }
}

async function run () {
  await testBindingNameFiltering();
  await testTargetSelection();
  await testStartMarksRendererServiceAttached();
  await testCaptureStoresValuesInRenderer();
  await testExceptionCaptureStoresExceptionObject();
  await testTaggedHaltUnwindIsIgnored();
  await testHandlePausedResumesAndDeliversDescriptor();
  await testDesktopBuildCopiesNodeMainSiblingRequires();
  console.log('inspector service tests ok');
}

if (require.main === module) {
  run().catch(err => {
    console.error(err && err.stack || err);
    process.exit(1);
  });
}

module.exports = { run };
