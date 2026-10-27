const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = process.env.LIVELY_TEST_SOURCE_ROOT || path.join(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('DAV class runtime accepts nested/query GET and bodyless HEAD; writes go to DAV', async () => {
  const source = read('lively.server/plugins/dav.js');
  let reads = 0;
  const resource = () => ({join() { return {read: async () => { reads++; return 'class runtime'; }}; }});
  const handler = new Function('resource', 'System', 'process', 'return {' + source.slice(source.indexOf('  async handleRequest ('), source.indexOf('  async tryServeStaticFile (')) + '}')(
    resource, {baseURL: 'file:///runtime/'}, {env: {}});
  handler.server = {}; handler.fileHashes = {}; handler.options = {};
  for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PROPFIND']) {
    let body, status, calledDav = false;
    handler.callDAV = () => { calledDav = true; };
    await handler.handleRequest({url: '/nested/livelyClassesRuntime.js?v=2', method, headers: {}},
      {writeHead(code) { status = code; }, end(value) { body = value; }});
    if (['GET', 'HEAD'].includes(method)) {
      assert.equal(status, 200, method + ' must resolve the nested runtime URL');
      assert.equal(body, method === 'GET' ? 'class runtime' : undefined, method + ' response body');
    } else assert.equal(calledDav, true, method + ' must retain DAV semantics');
  }
  assert.equal(reads, 1, 'HEAD must not read the runtime file');
});

test('TestRunner passes configured open and evaluation timeouts to its real headless calls', async () => {
  let options, evalOptions;
  class Session {
    constructor(opts) { options = opts; }
    async open(_, ready) { await ready(this); }
    async runEval(code, opts) { if (code.includes('runTestsInPackage')) { evalOptions = opts; return '[]'; } return true; }
    async dispose() {}
  }
  const source = read('lively.server/plugins/test-runner.js').replace(/^import .*;\n/gm, '').replace('export default class', 'class');
  const Runner = new Function('HeadlessSession', 'promise', 'process', source + '\nreturn TestRunner;')(
    Session, {}, {env: {LIVELY_TEST_RUNNER_OPEN_TIMEOUT: '1234', LIVELY_TEST_RUNNER_EVAL_TIMEOUT: '5678'}});
  assert.equal(await new Runner().run('lively.context'), '[]');
  assert.equal(options?.aliveTimeout, 1234, 'Configured open timeout must reach HeadlessSession');
  assert.equal(evalOptions.timeout, 5678, 'Configured test evaluation timeout must reach runEval');
});

test('shell directory is requested only when the real chooser opens', async () => {
  let requests = 0, prompts = 0;
  const source = read('lively.ide/shell/editor-plugin.js').replace(/^import .*;\n/gm, '').replace('export default class', 'class');
  const Plugin = new Function('CodeMirrorEnabledEditorPlugin', 'defaultDirectory', 'arr', source + '\nreturn ShellEditorPlugin;')(
    class {}, async () => { requests++; return '/shell'; }, {uniq: values => [...new Set(values)]});
  await Promise.resolve();
  assert.equal(requests, 0, 'Import must not issue a shell-directory request');
  const plugin = new Plugin();
  assert.equal(requests, 0, 'Construction must not issue a shell-directory request');
  plugin.textMorph = {world: () => ({async editListPrompt(_, dirs) { prompts++; assert.equal(dirs[0], '/shell'); return {status: 'canceled', selections: []}; }}), getWindow() { return null; }};
  await plugin.changeCwdInteractively();
  assert.equal(requests, 1, 'Opening the chooser requests its default directory');
  assert.equal(prompts, 1);
});

test('mocha instantiate hook waits for the current SystemJS link record', async () => {
  const source = read('mocha-es6/mocha-es6.js');
  const code = source.slice(source.indexOf('function installSystemInstantiateHook()'), source.indexOf('function uninstallSystemInstantiateHook()'));
  let hook, executed;
  const record = {dependencies: ['mocha-es6/index.js'], execute() {}};
  const system = {REGISTER_INTERNAL: {records: {'fixture.js': {linkRecord: {instantiatePromise: Promise.resolve({linkRecord: record})}}}}};
  const install = new Function('modules', 'System', 'isMochaTestLoad', 'installMochaEs6ModuleExecute', code + ';return installSystemInstantiateHook;')(
    {isHookInstalled() { return false; }, installHook(_, callback) { hook = callback; }}, system,
    async (_, executable) => executable?.dependencies.includes('mocha-es6/index.js'), (_, executable) => { executed = executable; });
  install();
  await hook(async () => {}, {name: 'fixture.js'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(executed, record, 'Test execution must be installed on the resolved linkRecord');
});

test('native inspector UI fallback imports without a System loader', async () => {
  const source = read('lively.context/lib/inspector-runtime.js');
  const code = source.slice(source.indexOf('function importDebuggerUI ()'), source.indexOf('function debuggerWorld ()'));
  const importUI = new Function('systemObject', 'globalObject', 'URL', code + ';return importDebuggerUI;')(
    () => null, () => ({location: {origin: 'http://runtime.test'}}),
    function (file, origin) { assert.equal(file, '/lively.ide/js/debugger/ui.cp.js'); assert.equal(origin, 'http://runtime.test'); return {href: 'data:text/javascript,export const works = true;'}; });
  assert.equal((await importUI()).works, true, 'The fallback must perform a native dynamic import without System');
});

test('CI TestRunner requests GC for retention assertions', async () => {
  let options;
  class Session {
    constructor(opts) { options = opts; }
    async open() {}
    async runEval() { return '[]'; }
    async dispose() {}
  }
  const source = read('lively.server/plugins/test-runner.js').replace(/^import .*;\n/gm, '').replace('export default class', 'class');
  const Runner = new Function('HeadlessSession', 'promise', 'process', source + '\nreturn TestRunner;')(
    Session, {}, {env: {}});
  await new Runner().run('lively.context');
  assert.deepEqual(options.args, ['--js-flags=--expose-gc'], 'The CI test browser must expose GC so retention tests execute');
});

test('HeadlessSession forwards requested browser flags without exposing GC by default', async () => {
  const launches = [];
  const source = read('lively.headless/index.js').replace(/^import .*;\n/gm, '').replace('export class', 'class');
  const HeadlessSession = new Function('System', 'process', 'string', source + '\nreturn HeadlessSession;')(
    {decanonicalize: () => 'file:///runtime/lively.headless/',
      _nodeRequire: () => ({async launch(options) { launches.push(options); return {}; }})},
    {env: {}}, {newUUID: () => 'fixture-session'});
  await new HeadlessSession().ensureBrowser();
  assert.deepEqual(launches[0].args, ['--no-sandbox'], 'Ordinary headless sessions must retain their existing launch flags');
  await new HeadlessSession({args: ['--js-flags=--expose-gc']}).ensureBrowser();
  assert.deepEqual(launches[1].args, ['--no-sandbox', '--js-flags=--expose-gc'], 'Explicit test flags must reach the real Puppeteer launch');
});
