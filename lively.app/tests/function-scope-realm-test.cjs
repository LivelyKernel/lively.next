const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Session } = require('node:inspector');
const { test, after } = require('node:test');

// Run the real startup installer and capture implementation. Only the CDP
// transport is replaced: Runtime commands go to an actual inspector VM context.
const desktop = path.join(__dirname, '../desktop');
const startup = fs.readFileSync(path.join(desktop, 'start-server.cjs'), 'utf8');
const definitions = startup.slice(startup.indexOf('function functionScopesEnabled'), startup.indexOf('// 5. Boot'));
const install = new Function('require', 'process', '__dirname', 'desktopDir', 'module', 'fs', 'path', definitions + '\nreturn installFunctionScopeReader;')(
  createRequire(path.join(desktop, 'start-server.cjs')), {env: {}}, desktop, desktop,
  {exports: {desktopOrigin: 'http://127.0.0.1:9017'}}, fs, path);
const transport = require('../desktop/inspector-service.cjs');
const originalTransport = {CDPClient: transport.CDPClient, defaultFetchJson: transport.defaultFetchJson};
const pages = new Map();
let sequence = 0;
transport.defaultFetchJson = async () => [...pages].map(([url, name]) => ({type: 'page', url, webSocketDebuggerUrl: name}));
transport.CDPClient = class VMClient {
  constructor (name) { this.name = name; }
  async open () {
    this.session = new Session();
    this.session.on('Runtime.executionContextCreated', ({params: {context}}) => {
      if (context.name === this.name) this.contextId = context.id;
    });
    this.session.connect();
  }
  send (method, params = {}) {
    if (method === 'Runtime.evaluate') {
      assert(this.contextId, 'Runtime.enable must discover the actual page context');
      params = {...params, contextId: this.contextId};
    }
    return new Promise((resolve, reject) => this.session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
  }
  close () { this.session.disconnect(); }
};
after(() => Object.assign(transport, originalTransport));

/** Create a trusted page with its own inspector execution context. */
function page () {
  const name = 'lively-function-scope-page-' + ++sequence;
  const url = 'http://127.0.0.1:9017/worlds/' + name;
  const context = vm.createContext({}, {name});
  pages.set(url, name);
  vm.runInContext(`
    globalThis.location = {href: ${JSON.stringify(url)}};
    globalThis.document = {readyState: 'complete'};
    globalThis.leaks = [];
    globalThis.realmOf = value => value.constructor.constructor('return typeof process')();
    globalThis.sample = (() => {
      const marker = {count: 0}, answer = 42, large = 12n, special = NaN;
      return {marker, fn: function read() { return [marker, answer, large, special]; }};
    })();
  `, context);
  install({window: vm.runInContext('globalThis', context), on () {}});
  assert.equal(vm.runInContext('typeof livelyDesktop.debugger.captureFunctionBindings', context), 'function', 'The real installer must install the trusted page bridge');
  return code => vm.runInContext(code, context);
}

const annotationFixture = `
  globalThis.visitorRealms = [];
  globalThis.importRealms = [];
  const functionNode = {type: 'FunctionExpression', start: 10, end: 90, params: [], body: {text: 'body'}};
  const astService = {
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

test('page names.some never receives a Node validation callback', async () => {
  const run = page();
  const result = await run(`(async () => {
    const some = Array.prototype.some;
    Array.prototype.some = function(callback, ...args) {
      leaks.push(realmOf(callback)); return some.call(this, callback, ...args);
    };
    try { return (await livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['answer'])).answer; }
    finally { Array.prototype.some = some; }
  })()`);
  assert.equal(result, 42, 'Real capture must still return the retained value');
  assert.equal(run("leaks.includes('object')"), false, 'Page array hooks must not reach process through a Node callback');
});

test('page names.every never receives a Node live-binding callback', async () => {
  const run = page();
  const result = await run(`(async () => {
    sample.fn[Symbol.for('lively-debug-bindings')] = {answer: 42};
    const every = Array.prototype.every;
    Array.prototype.every = function(callback, ...args) {
      leaks.push(realmOf(callback)); return every.call(this, callback, ...args);
    };
    try { return (await livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['answer'])).answer; }
    finally { Array.prototype.every = every; }
  })()`);
  assert.equal(result, 42, 'The live-binding fast path must preserve its value');
  assert.equal(run("leaks.includes('object')"), false, 'Live-binding validation must not leak a Node callback to page code');
});

test('predictable global setters cannot capture a Node state object', async () => {
  const run = page();
  await run(`(async () => {
    const seen = [];
    for (let i = 1; i < 50; i++) Object.defineProperty(globalThis, '__livelyFunctionScopes' + i, {
      configurable: true, set(value) { seen.push(value); }, get() { return seen[seen.length - 1]; }
    });
    try { await livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['answer']); }
    finally { for (const value of seen) leaks.push(realmOf(value)); }
  })()`);
  assert.equal(run("leaks.includes('object')"), false, 'No Node holder may be published to a page setter (process must remain unreachable)');
});

test('temporary holders contain only page data and are removed on success and failure', async () => {
  const run = page();
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
  assert.equal(run('holders.length'), 2, 'Each inspector request must install a page-realm holder');
  assert.equal(run("holders.every(holder => holder.realms.every(realm => realm === 'undefined'))"), true, 'Holder, binding map and source map must all have page constructors');
  assert.equal(run('holders.every(holder => !holder.enumerable && !Object.hasOwn(globalThis, holder.key))'), true, 'Non-enumerable holders must be deleted on both exits');
  assert.equal(run('holders[0].key !== holders[1].key && holders.every(holder => !/^__livelyFunctionScopes[0-9]+$/.test(holder.key))'), true, 'Concurrent-capable request keys must not use predictable counters');
});

test('source annotation visitors execute in the page realm', async () => {
  const run = page();
  run(annotationFixture);
  assert.equal(await run("livelyDesktop.debugger.captureFunctionBindings(annotated, ['answer']).then(values => values.answer)"), 42, 'Source annotation must not discard retained bindings');
  assert.equal(run('visitorRealms.length'), 1, 'The real source annotation path must visit the AST fixture');
  assert.equal(run('visitorRealms[0]'), 'undefined', 'The AST visitor must not expose the Node Function constructor');
});

test('source and fallback module metadata belong to the page', async () => {
  const run = page();
  run(annotationFixture);
  await run("livelyDesktop.debugger.captureFunctionBindings(annotated, ['answer'])");
  assert.equal(run("realmOf(annotated[Symbol.for('lively-object-meta')])"), 'undefined', 'Object metadata must not expose process through a Node object');
  assert.equal(run("realmOf(annotated[Symbol.for('lively-module-meta')])"), 'undefined', 'Fallback module metadata must belong to the page');
  assert.equal(run("realmOf(annotated[Symbol.for('lively-module-meta')].package)"), 'undefined', 'Nested fallback metadata must belong to the page');
  assert.equal(run("annotated[Symbol.for('lively-object-meta')].start"), 10, 'Unique source location must still be annotated');
  assert.equal(run("annotated[Symbol.for('lively-module-meta')].pathInPackage"), 'test/retained.js', 'Fallback module identity must be preserved');
});

test('source imports never receive Node Promise callbacks', async () => {
  const run = page();
  run(annotationFixture + `
    System.import = () => ({then(resolve) {
      importRealms.push(realmOf(resolve)); resolve(astService);
    }});
  `);
  await run("livelyDesktop.debugger.captureFunctionBindings(annotated, ['answer'])");
  assert.equal(run('importRealms.length'), 1, 'The annotation path must actually await the page import');
  assert.equal(run('importRealms[0]'), 'undefined', 'Awaiting page imports must not hand Node Promise callbacks to page code');
});

test('callable then bindings never receive Node Promise callbacks', async () => {
  const run = page();
  await run(`(async () => {
    const then = resolve => { leaks.push(realmOf(resolve)); resolve(37); };
    function read() { return then; }
    try { await livelyDesktop.debugger.captureFunctionBindings(read, ['then']); } catch (_) {}
  })()`);
  assert.equal(run('leaks.length > 0'), true, 'A callable then binding must exercise Promise assimilation');
  assert.equal(run("leaks.includes('object')"), false, 'Only page Promise callbacks may reach a callable then binding');
});

test('live-binding thenables never receive Node Promise callbacks', async () => {
  const run = page();
  await run(`(async () => {
    sample.fn[Symbol.for('lively-debug-bindings')] = {then(resolve) { leaks.push(realmOf(resolve)); resolve(37); }};
    try { await livelyDesktop.debugger.captureFunctionBindings(sample.fn, ['then']); } catch (_) {}
  })()`);
  assert.equal(run('leaks.length > 0'), true, 'The live-binding path must exercise Promise assimilation');
  assert.equal(run("leaks.includes('object')"), false, 'The live-binding fast path must not resolve a Node Promise with page data');
});

test('empty captures also expose only page-realm containers', async () => {
  const run = page();
  await run(`(async () => {
    const ownKeys = Reflect.ownKeys;
    Reflect.ownKeys = value => { leaks.push(realmOf(value)); return ownKeys(value); };
    try { await livelyDesktop.debugger.captureFunctionBindings(sample.fn, []); }
    finally { Reflect.ownKeys = ownKeys; }
  })()`);
  assert.equal(run('leaks.length > 0'), true, 'The real bridge must enumerate the empty capture');
  assert.equal(run("leaks.includes('object')"), false, 'The empty fast path must not hand a Node container to page builtins');
});

test('real capture keeps identity, primitives, concurrency and page errors', async () => {
  const run = page();
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
      missing instanceof Error && realmOf(missing) === 'undefined' && /Missing retained bindings/.test(missing.message) &&
      invalid instanceof Error && realmOf(invalid) === 'undefined' && /Expected binding names/.test(invalid.message) &&
      Object.keys(empty).length === 0 && !Object.getOwnPropertyNames(globalThis).some(key => key.startsWith('__livelyFunctionScopes'));
  })()`);
  assert.equal(result, true, 'Actual inspector capture must preserve values, page errors, concurrency and cleanup');
});
