const assert = require('assert');
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
      return { result: { value: true } };
    }
    if (method === 'Runtime.evaluate') {
      return { result: { value: true } };
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
}

async function testHandlePausedResumesAndDeliversDescriptor () {
  const client = new FakeCDPClient({
    properties: { 'scope-local': [], 'scope-closure': [] }
  });
  const service = new InspectorService({ client });
  await service.handlePaused(pausedPayload());

  assert(client.calls.some(call => call.method === 'Debugger.resume'));
  const deliver = client.calls.find(call => call.method === 'Runtime.evaluate');
  assert(deliver.params.expression.includes('capture-test'));
  assert(deliver.params.expression.includes('deliverCapture'));
}

async function run () {
  await testBindingNameFiltering();
  await testTargetSelection();
  await testCaptureStoresValuesInRenderer();
  await testExceptionCaptureStoresExceptionObject();
  await testHandlePausedResumesAndDeliversDescriptor();
  console.log('inspector service tests ok');
}

if (require.main === module) {
  run().catch(err => {
    console.error(err && err.stack || err);
    process.exit(1);
  });
}

module.exports = { run };
