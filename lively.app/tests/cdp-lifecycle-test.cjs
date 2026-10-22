const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const vm = require('node:vm');
const { CDPClient, InspectorService, defaultFetchJson } = require('../desktop/inspector-service.cjs');
const { captureRendererFunctionBindings } = require('../desktop/function-scopes.cjs');

test('CDP websocket connection timeout', async () => {
  class StalledSocket extends EventTarget {
    constructor() { super(); StalledSocket.last = this; }
    close() { this.closed = true; }
  }
  const client = new CDPClient('ws://unreachable', {WebSocketImpl: StalledSocket, connectTimeout: 20});
  await assert.rejects(Promise.race([client.open(), new Promise((_, reject) => setTimeout(() => reject(new Error('test deadline: connect did not time out')), 150))]), /CDP.*timed out/, 'A connecting socket must have a bounded lifetime');
  assert.equal(StalledSocket.last.closed, true, 'Timeout closes the connecting socket');
});
test('CDP target discovery timeout', async () => {
  const stalledServer = http.createServer(() => {});
  await new Promise(resolve => stalledServer.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(Promise.race([defaultFetchJson(`http://127.0.0.1:${stalledServer.address().port}`, {timeout: 20}), new Promise((_, reject) => setTimeout(() => reject(new Error('test deadline: discovery did not abort')), 150))]), error => ['TimeoutError', 'AbortError'].includes(error.name) || /^http.*timed out/.test(error.message), 'Target discovery also has a timeout');
  } finally { stalledServer.closeAllConnections(); await new Promise(resolve => stalledServer.close(resolve)); }
});
test('Renderer CDP port configuration', async () => {
  let requests = 0;
  const server = http.createServer((req, res) => { requests++; assert.equal(req.url, '/json/list'); res.end('[]'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const oldPort = process.env.LIVELY_APP_CDP_PORT;
  process.env.LIVELY_APP_CDP_PORT = String(server.address().port);
  try {
    await assert.rejects(captureRendererFunctionBindings({location: {href: 'http://renderer/'}}, () => {}, []), /No inspector target/, 'Renderer capture uses the configured port');
    assert.equal(requests, 1, 'Configured server received target discovery');
  } finally {
    if (oldPort === undefined) delete process.env.LIVELY_APP_CDP_PORT; else process.env.LIVELY_APP_CDP_PORT = oldPort;
    await new Promise(resolve => server.close(resolve));
  }
});
test('Inspector exception mode', async () => {
  const calls = [];
  const service = new InspectorService({client: {onEvent() {}, async send(method, params) { calls.push({method, params}); return {}; }}});
  await service.start();
  assert.equal(calls.find(call => call.method === 'Debugger.setPauseOnExceptions').params.state, 'uncaught', 'Opt-in diagnostics must not pause every caught exception');
});
test('Inspector pending capture bound', async () => {
  const service = new InspectorService({client: {}});
  const page = vm.createContext({});
  service.client.send = async (_, {expression}) => { vm.runInContext(expression, page); return {}; };
  for (let i = 0; i < 105; i++) await service.deliverCapture({captureId: String(i)});
  assert.equal(page.__LIVELY_PENDING_DEBUGGER_CAPTURES__.length, 100, 'Pending native captures must be bounded');
  assert.equal(page.__LIVELY_PENDING_DEBUGGER_CAPTURES__[0].captureId, '5', 'Keep the newest diagnostic captures');
});
