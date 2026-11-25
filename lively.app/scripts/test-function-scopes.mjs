import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { Session } from 'node:inspector';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';

const require = createRequire(import.meta.url);
const appDir = path.join(import.meta.dirname, '..');
const { captureFunctionBindings, captureRendererFunctionBindings, installFunctionScopeReader } =
  require('../desktop/function-scopes.cjs');

// NW.js's chrome.debugger: getTargets lists the registered pages, and attaching
// to a page opens an in-process inspector session on that page's vm context.
// Like Chrome, it refuses a second attach to an attached target, answers
// through callbacks with chrome.runtime.lastError set on failure, and reports
// protocol errors as the JSON of the CDP error object.
const targets = new Map(); // page URL -> target id (the inspector context name)
const sessions = new Map(); // target id -> {session, contextId}
const calls = []; // [method, targetId, command]
let maxAttached = 0;
const chromeDebugger = {
  getTargets (callback) {
    calls.push(['getTargets']);
    const list = [...targets].map(([url, id]) => ({ type: 'page', url, id, attached: sessions.has(id) }));
    answer(callback, null, [{ type: 'background_page', url: 'chrome-extension://app/background.html', id: 'background' }, ...list]);
  },
  attach ({ targetId }, version, callback) {
    calls.push(['attach', targetId, version]);
    if (sessions.has(targetId)) return answer(callback, 'Another debugger is already attached to the target with id: ' + targetId + '.');
    if (![...targets.values()].includes(targetId)) return answer(callback, 'No target with given id ' + targetId);
    const attachment = { session: new Session() };
    attachment.session.on('Runtime.executionContextCreated', ({ params: { context } }) => {
      if (context.name === targetId) attachment.contextId = context.id;
    });
    attachment.session.connect();
    sessions.set(targetId, attachment);
    maxAttached = Math.max(maxAttached, sessions.size);
    answer(callback);
  },
  sendCommand ({ targetId }, method, params, callback) {
    calls.push(['sendCommand', targetId, method]);
    const attachment = sessions.get(targetId);
    if (!attachment) return answer(callback, 'Debugger is not attached to the target with id: ' + targetId + '.');
    if (method === 'Runtime.evaluate') {
      assert(attachment.contextId, 'Runtime.enable must discover the actual page context');
      params = { ...params, contextId: attachment.contextId };
    }
    attachment.session.post(method, params, (error, result) =>
      answer(callback, error && JSON.stringify({ code: -32000, message: error.message }), result));
  },
  detach ({ targetId }, callback) {
    calls.push(['detach', targetId]);
    const attachment = sessions.get(targetId);
    if (!attachment) return answer(callback, 'Debugger is not attached to the target with id: ' + targetId + '.');
    sessions.delete(targetId);
    attachment.session.disconnect();
    answer(callback);
  }
};
const chrome = globalThis.chrome = { debugger: { ...chromeDebugger }, runtime: { lastError: undefined } };
function answer (callback, error = null, result) {
  setImmediate(() => {
    chrome.runtime.lastError = error ? { message: error } : undefined;
    try { callback(result); } finally { chrome.runtime.lastError = undefined; }
  });
}
/** Run `fn` with `chrome.debugger[method]` replaced by `fake`. */
async function withDebuggerMethod (method, fake, fn) {
  chrome.debugger[method] = fake;
  try { return await fn(); } finally { chrome.debugger[method] = chromeDebugger[method]; }
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-function-scopes-'));
const baseURL = pathToFileURL(fixture + path.sep).href;
for (const entry of ['landing-page', 'loading-screen']) {
  fs.mkdirSync(path.join(fixture, 'lively.freezer', entry), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'lively.freezer', entry, 'index.html'), '');
}
const bootstrap = { desktopOrigin: 'http://127.0.0.1:9017', livelyNative: { baseURL } };
after(() => fs.rmSync(fixture, { recursive: true }));

let sequence = 0;
/** Load a page realm with its own inspector context and run the real installer on its window. */
function openPage (href = 'http://127.0.0.1:9017/worlds/page-' + (sequence + 1)) {
  const name = 'lively-function-scope-page-' + ++sequence;
  const context = vm.createContext({}, { name });
  const run = code => vm.runInContext(code, context);
  targets.set(href, name);
  run(`
    globalThis.location = {href: ${JSON.stringify(href)}};
    globalThis.document = {readyState: 'complete'};
    globalThis.leaks = [];
    globalThis.realmOf = value => value.constructor.constructor('return typeof process')();
    globalThis.sample = (() => {
      const marker = {count: 0}, answer = 42, large = 12n, special = NaN;
      return {marker, fn: function read() { return [marker, answer, large, special]; }};
    })();
  `);
  let loaded;
  const win = { window: run('globalThis'), on (event, callback) { assert.equal(event, 'loaded'); loaded = callback; } };
  installFunctionScopeReader(win, bootstrap);
  return { page: win.window, win, run, loaded: () => loaded() };
}

// Defines `annotated`, a module function whose source annotation imports the
// page's fake lively.ast.
const annotationFixture = `
  globalThis.visitorRealms = [];
  globalThis.importRealms = [];
  const functionNode = {type: 'FunctionExpression', start: 10, end: 90, params: [], body: {text: 'body'}};
  globalThis.astService = {
    parseFunction() { return functionNode; }, parse() { return functionNode; },
    escodegen: {generate(node) { return node.text || ''; }},
    withMozillaAstDo(ast, state, visitor) {
      visitorRealms.push(realmOf(visitor));
      visitor(() => {}, ast);
    }
  };
  globalThis.System = {import() { return Promise.resolve(astService); }};
  globalThis.annotated = (() => {
    const __lvOriginalCode = 'function factory() { return function read() { return answer; }; }';
    const __lvVarRecorder = {__currentLivelyModule: {id: 'test/retained.js'}};
    return (function factory() {
      const answer = 42;
      return function read() { return [answer, __lvOriginalCode, __lvVarRecorder]; };
    })();
  })();
`;

test('the in-process reader keeps identity and primitives through Runtime only', async () => {
  const marker = { count: 0 }, step = '1', large = 12n, special = NaN;
  const fn = function () { return [marker, step, large, special]; };
  const commands = [];
  const post = Session.prototype.post;
  Session.prototype.post = function (method, ...args) { commands.push(method); return post.call(this, method, ...args); };
  try {
    const values = await captureFunctionBindings(fn, ['marker', 'step', 'large', 'special']);
    assert.equal(values.marker, marker);
    assert.equal(values.step, '1');
    assert.equal(values.large, 12n);
    assert(Number.isNaN(values.special));
    values.marker.count = 2;
    assert.equal(marker.count, 2, 'Captured objects are the retained objects');
    values.step = 7;
    assert.equal(fn()[1], '1', 'Assigning a captured value leaves the lexical binding unchanged');
    await assert.rejects(captureFunctionBindings(fn, ['notRetained']), { message: 'Missing retained bindings: notRetained' });
    await assert.rejects(captureFunctionBindings(fn.bind(null), ['step']), { message: 'Function has no retained scopes' });
    await assert.rejects(captureFunctionBindings({}, []), { name: 'TypeError', message: 'Expected a function' });
    await assert.rejects(captureFunctionBindings(fn, 'step'), { name: 'TypeError', message: 'Expected binding names' });
    assert(commands.length && commands.every(method => method.startsWith('Runtime.')));
    assert(!Object.keys(global).some(name => name.startsWith('__livelyFunctionScopes')));
  } finally { Session.prototype.post = post; }
});

test('each inspector command fails after 4 seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const capture = captureFunctionBindings(() => {}, ['x'], { send: () => new Promise(() => {}) });
  t.mock.timers.tick(4000);
  await assert.rejects(capture, { message: 'Runtime.enable timed out' });
  assert(!Object.keys(global).some(name => name.startsWith('__livelyFunctionScopes')));
});

// Page code installs a hook that records the realm of what it receives, then
// captures through the bridge; no hook may receive a Node-realm value.
// [name, expected bridge result, records a realm, page code]
const realmProbes = [
  ['page names.some never receives a Node validation callback', 42, false, `
    const some = Array.prototype.some;
    Array.prototype.some = function(callback, ...args) { leaks.push(realmOf(callback)); return some.call(this, callback, ...args); };
    try { return (await capture(sample.fn, ['answer'])).answer; } finally { Array.prototype.some = some; }`],
  ['page names.every never receives a Node live-binding callback', 42, false, `
    sample.fn[Symbol.for('lively-debug-bindings')] = {answer: 42};
    const every = Array.prototype.every;
    Array.prototype.every = function(callback, ...args) { leaks.push(realmOf(callback)); return every.call(this, callback, ...args); };
    try { return (await capture(sample.fn, ['answer'])).answer; } finally { Array.prototype.every = every; }`],
  ['predictable global setters cannot capture a Node state object', undefined, false, `
    const seen = [];
    for (let i = 1; i < 50; i++) Object.defineProperty(globalThis, '__livelyFunctionScopes' + i, {
      configurable: true, set(value) { seen.push(value); }, get() { return seen[seen.length - 1]; }
    });
    try { await capture(sample.fn, ['answer']); } finally { for (const value of seen) leaks.push(realmOf(value)); }`],
  ['callable then bindings never receive Node Promise callbacks', undefined, true, `
    const then = resolve => { leaks.push(realmOf(resolve)); resolve(37); };
    function read() { return then; }
    try { await capture(read, ['then']); } catch (_) {}`],
  ['live-binding thenables never receive Node Promise callbacks', undefined, true, `
    sample.fn[Symbol.for('lively-debug-bindings')] = {then(resolve) { leaks.push(realmOf(resolve)); resolve(37); }};
    try { await capture(sample.fn, ['then']); } catch (_) {}`],
  ['empty captures also expose only page-realm containers', undefined, true, `
    const ownKeys = Reflect.ownKeys;
    Reflect.ownKeys = value => { leaks.push(realmOf(value)); return ownKeys(value); };
    try { await capture(sample.fn, []); } finally { Reflect.ownKeys = ownKeys; }`],
  ['source imports never receive Node Promise callbacks', undefined, true, annotationFixture + `
    System.import = () => ({then(resolve) { leaks.push(realmOf(resolve)); resolve(astService); }});
    await capture(annotated, ['answer']);`]
];
for (const [name, expected, records, code] of realmProbes) {
  test(name, async () => {
    const { run } = openPage();
    assert.equal(await run(`(async () => { const capture = livelyDesktop.debugger.captureFunctionBindings; ${code} })()`), expected);
    if (records) assert.equal(run('leaks.length > 0'), true, 'The probe must observe the capture');
    assert.equal(run("leaks.includes('object')"), false, 'Page hooks must not reach process through a Node value');
  });
}

test('temporary holders contain only page data and are removed on success and failure', async () => {
  const { run } = openPage();
  await run(`(async () => {
    globalThis.holders = [];
    const define = Object.defineProperty;
    Object.defineProperty = function(object, key, descriptor) {
      if (object === globalThis && String(key).startsWith('__livelyFunctionScopes')) {
        holders.push({key, enumerable: descriptor.enumerable, realms: [descriptor.value, descriptor.value.bindings, descriptor.value.source].map(realmOf)});
      }
      return define(object, key, descriptor);
    };
    try {
      await livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['answer']);
      try { await livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['missing']); } catch (_) {}
    } finally { Object.defineProperty = define; }
  })()`);
  assert.equal(run('holders.length'), 2, 'Each inspector request installs a page-realm holder');
  assert.equal(run("holders.every(holder => holder.realms.every(realm => realm === 'undefined'))"), true, 'Holder, binding map and source map have page constructors');
  assert.equal(run('holders.every(holder => !holder.enumerable && !Object.hasOwn(globalThis, holder.key))'), true, 'Non-enumerable holders are deleted on both exits');
  assert.equal(run('holders[0].key !== holders[1].key && holders.every(holder => !/^__livelyFunctionScopes[0-9]+$/.test(holder.key))'), true, 'Holder keys are random');
});

test('source annotation runs in the page realm and keeps the bindings', async () => {
  const { run } = openPage();
  run(annotationFixture);
  assert.equal(await run("livelyDesktop.debugger.captureFunctionBindings(annotated, ['answer']).then(values => values.answer)"), 42);
  assert.equal(run('JSON.stringify(visitorRealms)'), '["undefined"]', 'The AST visitor must not expose the Node Function constructor');
  for (const meta of ["annotated[Symbol.for('lively-object-meta')]", "annotated[Symbol.for('lively-module-meta')]", "annotated[Symbol.for('lively-module-meta')].package"]) {
    assert.equal(run(`realmOf(${meta})`), 'undefined', meta + ' must belong to the page');
  }
  assert.equal(run("annotated[Symbol.for('lively-object-meta')].start"), 10, 'The unique source location is annotated');
  assert.equal(run("annotated[Symbol.for('lively-module-meta')].pathInPackage"), 'test/retained.js', 'The fallback module identity is kept');
});

test('page capture keeps identity, primitives, concurrency and page errors', async () => {
  const { run } = openPage();
  const result = await run(`(async () => {
    const capture = livelyDesktop.debugger.captureFunctionBindings;
    const promise = capture(sample.fn, ['marker', 'answer', 'large', 'special']);
    const other = capture(sample.fn, ['marker']);
    const values = await promise, repeated = await other;
    values.marker.count = 2;
    let missing, invalid;
    try { await capture(sample.fn, ['missing']); } catch (error) { missing = error; }
    try { await capture(sample.fn, [42]); } catch (error) { invalid = error; }
    const empty = await capture(sample.fn, []);
    return promise instanceof Promise && Object.getPrototypeOf(values) === Object.prototype &&
      repeated.marker === sample.marker && values.marker === sample.marker && sample.marker.count === 2 &&
      values.answer === 42 && values.large === 12n && Number.isNaN(values.special) &&
      missing instanceof Error && realmOf(missing) === 'undefined' && missing.message === 'Missing retained bindings: missing' &&
      invalid instanceof Error && realmOf(invalid) === 'undefined' && invalid.message === 'Expected binding names' &&
      Object.keys(empty).length === 0 && !Object.getOwnPropertyNames(globalThis).some(key => key.startsWith('__livelyFunctionScopes'));
  })()`);
  assert.equal(result, true);
});

test('only desktop entry pages receive the bridge', async () => {
  const untrusted = ['https://example.com/', 'http://127.0.0.1:9018/worlds/', baseURL + 'private.html', 'https://127.0.0.1:9017/'];
  for (const href of untrusted) {
    assert.equal(openPage(href).page.livelyDesktop?.debugger?.captureFunctionBindings, undefined, 'Untrusted page received the bridge: ' + href);
  }
  const trusted = [baseURL + 'lively.freezer/landing-page/index.html', baseURL + 'lively.freezer/loading-screen/index.html?world=test',
    pathToFileURL(path.join(appDir, 'desktop', 'boot.html')).href, 'http://127.0.0.1:9017/worlds/load'];
  for (const href of trusted) {
    const { run } = openPage(href);
    assert.equal(await run("livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['answer']).then(values => values.answer)"), 42, href);
  }
  process.env.LIVELY_APP_FUNCTION_SCOPES = '0';
  try {
    assert.equal(openPage('http://127.0.0.1:9017/worlds/load').page.livelyDesktop, undefined, 'LIVELY_APP_FUNCTION_SCOPES=0 disables the bridge');
  } finally { delete process.env.LIVELY_APP_FUNCTION_SCOPES; }
});

test('bridge functions, promises, results and errors belong to the page realm', async () => {
  const { page, win, run } = openPage();
  const capture = page.livelyDesktop.debugger.captureFunctionBindings;
  assert.equal(Object.getPrototypeOf(capture).constructor.constructor, run('Function'), 'The bridge must not expose the Node Function constructor');
  assert.equal(capture.constructor.constructor('return typeof process')(), 'undefined');
  const pending = capture(page.sample.fn, ['answer']);
  assert.equal(Object.getPrototypeOf(pending), run('Promise.prototype'));
  assert.equal(Object.getPrototypeOf(await pending), run('Object.prototype'));
  page.sample.fn[Symbol.for('lively-debug-bindings')] = { answer: 42 };
  const copied = await capture(page.sample.fn, ['answer']);
  assert.equal(Object.getPrototypeOf(copied), run('Object.prototype'), 'A Node-realm binding container is copied into the page realm');
  assert.equal(copied.answer, 42);
  delete page.sample.fn[Symbol.for('lively-debug-bindings')];
  const pageError = error => Object.getPrototypeOf(error) === run('Error.prototype');
  targets.delete(page.location.href);
  await assert.rejects(capture(page.sample.fn, []), error => error.message === 'No inspector target for this renderer' && pageError(error));
  Object.defineProperty(win, 'window', { get () { throw new Error('window closed'); } });
  await assert.rejects(capture(page.sample.fn, []), pageError, 'Trust-check errors are re-created in the page realm');
});

test('a saved bridge rejects after navigation without contacting the inspector', async () => {
  const { page, loaded } = openPage();
  const capture = page.livelyDesktop.debugger.captureFunctionBindings;
  page.location = { href: 'https://example.com/' };
  const before = calls.length;
  await assert.rejects(capture(page.sample.fn, []), { message: 'Function scopes require a trusted desktop page' });
  assert.equal(calls.length, before);
  loaded();
  assert.equal(page.livelyDesktop.debugger.captureFunctionBindings, undefined, 'Loading an untrusted page removes the bridge');
});

test('renderer capture attaches to its page target, sends only Runtime commands and detaches', async () => {
  const { page } = openPage();
  const id = targets.get(page.location.href);
  calls.length = 0;
  const values = await captureRendererFunctionBindings(page, page.sample.fn, ['marker', 'answer']);
  assert.equal(values.marker, page.sample.marker, 'Objects keep their identity');
  assert.equal(values.answer, 42);
  assert.deepEqual(calls.slice(0, 2), [['getTargets'], ['attach', id, '1.3']]);
  assert.deepEqual(calls.at(-1), ['detach', id]);
  const commands = calls.slice(2, -1);
  assert(commands.length && commands.every(([method, target, command]) => method === 'sendCommand' && target === id && command.startsWith('Runtime.')));
  assert.equal(sessions.size, 0, 'The read leaves no attachment behind');
});

test('concurrent renderer captures attach one at a time', async () => {
  const first = openPage(), second = openPage();
  maxAttached = 0;
  calls.length = 0;
  const reads = [first, second, first].map(({ run }) =>
    run("livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['answer']).then(values => values.answer)"));
  assert.deepEqual(await Promise.all(reads), [42, 42, 42]);
  assert.equal(maxAttached, 1, 'Each read detaches before the next one attaches');
  const order = calls.filter(([method]) => method === 'attach' || method === 'detach').map(([method]) => method);
  assert.deepEqual(order, ['attach', 'detach', 'attach', 'detach', 'attach', 'detach']);
});

test('a failed command detaches and its CDP error message reaches the page', async () => {
  const { run } = openPage();
  const sendCommand = (target, method, params, callback) => method === 'Runtime.getProperties'
    ? answer(callback, JSON.stringify({ code: -32000, message: 'Could not find object with given id' }))
    : chromeDebugger.sendCommand(target, method, params, callback);
  await withDebuggerMethod('sendCommand', sendCommand, () => assert.rejects(
    run("livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['answer'])"),
    error => error.message === 'Could not find object with given id' && run('Error.prototype') === Object.getPrototypeOf(error)));
  assert.equal(sessions.size, 0, 'The failed read detached');
  assert.equal(await run("livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['answer']).then(values => values.answer)"), 42);
});

test('a command without an answer fails after 4 seconds, detaches and lets the next read attach', async t => {
  const { page } = openPage();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sent = Promise.withResolvers();
  const read = withDebuggerMethod('sendCommand', (target, method) => sent.resolve(method),
    () => captureRendererFunctionBindings(page, page.sample.fn, ['answer']));
  assert.equal(await sent.promise, 'Runtime.enable');
  t.mock.timers.tick(4000);
  await assert.rejects(read, { message: 'Runtime.enable timed out' });
  assert.equal(sessions.size, 0, 'The timed out read detached');
  assert(!Object.getOwnPropertyNames(page).some(key => key.startsWith('__livelyFunctionScopes')));
  t.mock.timers.reset();
  assert.equal((await captureRendererFunctionBindings(page, page.sample.fn, ['answer'])).answer, 42);
});

test('attach failures are reported and release the next read', async () => {
  const { page } = openPage();
  await withDebuggerMethod('attach', (target, version, callback) => answer(callback, 'Cannot attach to this target.'), () =>
    assert.rejects(captureRendererFunctionBindings(page, page.sample.fn, ['answer']), { message: 'Cannot attach to this target.' }));
  assert.equal((await captureRendererFunctionBindings(page, page.sample.fn, ['answer'])).answer, 42);
});

test('a renderer without a page target is not attached', async () => {
  const { page } = openPage();
  targets.delete(page.location.href);
  calls.length = 0;
  await assert.rejects(captureRendererFunctionBindings(page, page.sample.fn, ['answer']), { message: 'No inspector target for this renderer' });
  assert.deepEqual(calls, [['getTargets']]);
});

test('the manifest opens no remote debugging port and silences the debugger infobar', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  const flags = manifest['chromium-args'].split(/\s+/);
  assert(!flags.some(flag => flag.startsWith('--remote-debugging-')), manifest['chromium-args']);
  assert(flags.includes('--silent-debugger-extension-api'), manifest['chromium-args']);
});

test('the desktop build copies every sibling module start-server.cjs requires', () => {
  const build = fs.readFileSync(path.join(appDir, 'scripts', 'build.mjs'), 'utf8');
  const list = build.match(/for \(const f of \[([^\]]+)\]\) \{\s*fs\.copyFileSync\(path\.join\(APP_DIR, 'desktop', f\)/s);
  assert(list, 'Desktop script copy list not found in build.mjs');
  const copied = new Set([...list[1].matchAll(/'([^']+)'/g)].map(match => match[1]));
  for (const file of ['start-server.cjs', 'function-scopes.cjs']) {
    const source = fs.readFileSync(path.join(appDir, 'desktop', file), 'utf8');
    for (const [, sibling] of source.matchAll(/require\('\.\/([^']+)'\)/g)) {
      assert(copied.has(sibling), `build.mjs must copy desktop/${sibling}, which ${file} requires`);
    }
  }
  assert(copied.has('function-scopes.cjs'));
});
