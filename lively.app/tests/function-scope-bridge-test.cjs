const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

// Exercise the actual startup installer without starting NW.js or its backend.
const source = fs.readFileSync(path.join(__dirname, '../desktop/start-server.cjs'), 'utf8');
const definitions = source.slice(source.indexOf('function functionScopesEnabled'), source.indexOf('// 5. Boot'));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-function-bridge-'));
const baseURL = pathToFileURL(fixture + path.sep).href;
for (const entry of ['landing-page', 'loading-screen']) {
  fs.mkdirSync(path.join(fixture, 'lively.freezer', entry), {recursive: true});
  fs.writeFileSync(path.join(fixture, 'lively.freezer', entry, 'index.html'), '');
}
let calls = 0, failCapture = false;
const bootstrap = {exports: {livelyNative: {baseURL}, desktopOrigin: 'http://127.0.0.1:9017'}};
const installer = new Function('require', 'process', '__dirname', 'desktopDir', 'module', 'fs', 'path', definitions + '\nreturn installFunctionScopeReader;')(
  name => name === './function-scopes.cjs' ? {captureRendererFunctionBindings: async () => {
    calls++;
    if (failCapture) throw new Error('backend failure');
    return {answer: 42};
  }} : require(name), {env: {}}, path.join(__dirname, '../desktop'), path.join(__dirname, '../desktop'), bootstrap, fs, path);
/** Install the real bridge in a distinct page realm without launching NW.js. */
function pageAt (href) {
  const context = vm.createContext({URL});
  const page = vm.runInContext('globalThis', context);
  page.location = new URL(href);
  page.document = {readyState: 'complete'};
  let loaded;
  const win = {window: page, on(name, callback) { assert.equal(name, 'loaded'); loaded = callback; }};
  installer(win);
  return {page, win, context, loaded};
}
let failures = 0;
/** Report all boundary failures rather than stopping at the first assertion. */
async function check (name, test) {
  try { await test(); console.log('PASS ' + name); }
  catch (error) { failures++; console.error('FAIL ' + name + ': ' + error.stack); }
}
(async () => {
  await check('untrusted pages receive no function-scope bridge', () => {
    for (const url of ['https://example.com/', 'http://127.0.0.1:9018/worlds/', baseURL + 'private.html', 'https://127.0.0.1:9017/']) {
      const {page} = pageAt(url);
      assert.equal(page.livelyDesktop?.debugger?.captureFunctionBindings, undefined, 'untrusted URL must receive no privileged bridge: ' + url);
    }
  });
  await check('trusted packaged and HTTP pages retain capture access', async () => {
    for (const url of [baseURL + 'lively.freezer/landing-page/index.html', baseURL + 'lively.freezer/loading-screen/index.html?world=test', 'http://127.0.0.1:9017/worlds/load']) {
      const {page} = pageAt(url);
      assert.equal(typeof page.livelyDesktop?.debugger?.captureFunctionBindings, 'function', 'trusted URL must receive the bridge: ' + url);
      assert.equal((await page.livelyDesktop.debugger.captureFunctionBindings(() => 1, ['answer'])).answer, 42);
    }
  });
  await check('bridge functions and results have only page-realm constructors', async () => {
    const {page, context} = pageAt('http://127.0.0.1:9017/worlds/load');
    const capture = page.livelyDesktop.debugger.captureFunctionBindings;
    const pageFunction = vm.runInContext('Function', context);
    assert.equal(Object.getPrototypeOf(capture).constructor.constructor, pageFunction, 'bridge must not expose the Node Function constructor');
    assert.equal(capture.constructor.constructor('return typeof process')(), 'undefined', 'bridge constructor must execute in the page realm');
    const pending = capture(() => 1, ['answer']);
    assert.equal(Object.getPrototypeOf(pending), vm.runInContext('Promise.prototype', context), 'bridge Promise must belong to the page');
    const result = await pending;
    assert.equal(Object.getPrototypeOf(result), vm.runInContext('Object.prototype', context), 'binding container must belong to the page');
  });
  await check('backend errors expose only page-realm constructors', async () => {
    const {page, context} = pageAt('http://127.0.0.1:9017/worlds/load');
    failCapture = true;
    try {
      await assert.rejects(page.livelyDesktop.debugger.captureFunctionBindings(() => 1, []), error => {
        assert.equal(error.message, 'backend failure');
        assert.equal(Object.getPrototypeOf(error), vm.runInContext('Error.prototype', context), 'backend errors must be re-created in the page realm');
        return true;
      });
    } finally { failCapture = false; }
  });
  await check('window access failures cannot expose a Node error constructor', async () => {
    const {page, win, context} = pageAt('http://127.0.0.1:9017/worlds/load');
    const capture = page.livelyDesktop.debugger.captureFunctionBindings;
    Object.defineProperty(win, 'window', {get() { throw new Error('window closed'); }});
    await assert.rejects(capture(() => 1, []), error => {
      assert.equal(Object.getPrototypeOf(error), vm.runInContext('Error.prototype', context), 'trust-check errors must also belong to the page realm');
      return true;
    });
  });
  await check('saved bridge rejects after navigation before contacting the backend', async () => {
    const {page, loaded} = pageAt('http://127.0.0.1:9017/worlds/load');
    const capture = page.livelyDesktop.debugger.captureFunctionBindings;
    page.location = new URL('https://example.com/');
    const before = calls;
    await assert.rejects(capture(() => 1, []), /trusted/, 'saved bridge must reject after navigating away');
    assert.equal(calls, before, 'untrusted navigation must not reach the backend');
    loaded();
    assert.equal(page.livelyDesktop.debugger.captureFunctionBindings, undefined, 'navigation must remove the old privileged bridge');
  });
  fs.rmSync(fixture, {recursive: true});
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
