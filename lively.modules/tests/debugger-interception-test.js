/* global System, describe, beforeEach, afterEach, it */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { prepareSystem } from './helpers.js';
import module from '../src/module.js';
import { removeSystem, prepareSystem as reinitializeSystem } from '../src/system.js';
import { installModuleDebugger } from '../../lively.context/lib/module-debugger.js';
import { runWithCapturedBindings } from '../../lively.context/lib/stackReification.js';
import { getCurrentASTRegistry, setCurrentASTRegistry } from '../../lively.context/lib/rewriter.js';
import { UnwindException } from '../../lively.context/lib/exception.js';
import { collectGarbage } from '../../lively.context/tests/helpers.js';
import { serialize, deserialize, ObjectPool } from '../../lively.serializer2/index.js';

const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const ticks = async (done, count = 100) => { for (let i = 0; i < count && !done(); i++) await Promise.resolve(); };
const pause = 'export function task(pause) { if (pause) debugger; return 3; }';
const stop = ' export function stop() { debugger; }';
const failing = value => 'export const failure = ' + value + '; export function fail() { throw failure; }';

describe('module debugger interception', function () {
  this.timeout(30000);
  const dir = 'local://debugger-interception/', id = dir + 'task.js', stops = [];
  let S, warnings, warn;
  /** Writes `source` as module `name` of the intercepting system, optionally retaining closures or enabling debugging first. */
  const load = async (source, {retain, debug, name = id} = {}) => {
    if (retain) module(S, name).retainRuntimeClosures = true;
    if (debug) await module(S, name).setDebuggingEnabled(true);
    await resource(name).write(source);
    return S.import(name);
  };
  /** Resumes the oldest stop; a further stop stays queued, a result completes the native caller. */
  const proceed = async () => {
    const stop = stops.shift(), result = await stop.continuation.resume();
    if (result?.isContinuation) stops.push({...stop, continuation: result}); else stop.callbacks.onComplete(result);
    return result;
  };
  /** Expects one stop for `pending`, then `value` (deep equal for plain objects) from resuming it and from the native caller. */
  const expectStop = async (pending, value) => {
    await ticks(() => stops.length);
    expect(stops).length(1);
    for (const result of [await proceed(), await pending]) {
      if (value?.constructor === Object) expect(result).deep.equals(value); else expect(result).equals(value);
    }
  };
  const record = (continuation, callbacks) => stops.push({continuation, callbacks});
  beforeEach(() => {
    S = prepareSystem('debugger-interception', dir);
    S.debuggerInterception = true;
    installModuleDebugger(S, {open: record});
    warnings = []; warn = console.warn; console.warn = (...args) => warnings.push(args);
  });
  afterEach(async () => {
    console.warn = warn;
    for (const stop of stops.splice(0)) stop.callbacks.onCancel();
    removeSystem('debugger-interception');
    await resource(dir).remove();
  });

  it('has no eager context dependency, ignores debugger in strings and comments and loads such modules without the context', async () => {
    const imports = await module(System, System.decanonicalize('lively.modules/src/module.js')).imports();
    expect(imports.filter(entry => /lively\.context/.test(entry.fromModule)), 'no static import evaluates lively.context').length(0);
    const plainDir = 'local://lazy-debugger-boot/', plain = prepareSystem('lazy-debugger-boot', plainDir);
    plain.debuggerInterception = true;
    try {
      await resource(plainDir + 'plain.js').write('export function task() { /* debugger; */ return "debugger;"; }');
      expect((await plain.import(plainDir + 'plain.js')).task()).equals('debugger;');
      expect(module(plain, plainDir + 'plain.js').debuggingEnabled).equals(false);
      expect(Object.keys(plain.get('@lively-env').loadedModules).filter(id => /lively\.context/.test(id))).length(0);
      expect(plain.get('@lively-env').moduleDebugger, 'no debugger runtime is installed').equals(undefined);
    } finally { removeSystem('lazy-debugger-boot'); await resource(plainDir).remove(); }
  });

  it('does not enable interception just because a loading-screen world exists', async () => {
    const world = S.global.$world;
    delete S.debuggerInterception;
    S.global.$world = {isWorld: true};
    try {
      expect([(await load(pause)).task(false), module(S, id).debuggingEnabled]).deep.equals([3, false]);
    } finally { S.global.$world = world; }
  });

  it('initializes interception without importing its dependencies during module translation', async () => {
    const systemImport = S.import;
    delete S.get('@lively-env').moduleDebugger;
    S.import = function (name, ...args) {
      const message = 'Importing the debugger during translation can deadlock its dependencies';
      if (name === 'lively.context/lib/module-debugger.js') throw new Error(message);
      return systemImport.call(this, name, ...args);
    };
    let task;
    try { ({task} = await load(pause)); } finally { S.import = systemImport; }
    installModuleDebugger(S, {open: record});
    expect(task(false)).equals(3);
    await expectStop(task(true), 3);
  });

  it('keeps Mocha suite registration native when fixtures contain debugger statements', async () => {
    const file = resource('local://debugger-harness/test.js'), mod = module(System, file.url), automatic = System.debuggerInterception;
    await file.write("import { expect } from 'mocha-es6'; describe('fixture', function () { const { value } = {value: 3};" +
      " it('intentional stop', function () { debugger; expect(value).equals(3); }); });");
    System.debuggerInterception = true;
    try {
      await mod.load();
      expect([mod.debuggingEnabled, mod.recorder.mocha.suite.suites[0].tests.length]).deep.equals([false, 1]);
    } finally { System.debuggerInterception = automatic; await mod.unload(); await file.remove(); }
  });

  it('runs a native mixin and warns once even when the AST registry changes', async () => {
    const registry = getCurrentASTRegistry(), {Base, mixin} = await load('export class Base { value() { return 2; } }' +
      ' export const mixin = B => class extends B { value() { return super.value() + 1; } };' + stop);
    expect(module(S, id).debuggingEnabled).equals(true);
    try {
      expect([new (mixin(Base))().value(), new (mixin(Base))().value()]).deep.equals([3, 3]);
      setCurrentASTRegistry({});
      expect([new (mixin(Base))().value(), warnings.length]).deep.equals([3, 1]);
      expect(warnings[0][0]).includes('mixin').and.includes(id);
      expect(warnings[0][1]).instanceOf(Error);
    } finally { setCurrentASTRegistry(registry); }
  });

  it('preserves accessor key/value evaluation order across suspension', async () => {
    const {make} = await load('export async function make(log) { return {first: log.push("first"), get [await Promise.resolve({' +
      '[Symbol.toPrimitive]() { log.push("key"); return "value"; }})]() { return this.first; }, last: log.push("last")}; }',
    {retain: true, debug: true});
    // Exercise the Babel accessor construction, rather than interpreter suspension.
    await module(S, id).setDebuggingEnabled(false);
    const log = [], object = await make(log);
    expect(log, 'the computed accessor key is coerced once in the original order').deep.equals(['first', 'key', 'last']);
    expect(object.value, 'the accessor retains its dynamic receiver after await').equals(1);
  });

  it('reuses compiled getter functions across accesses while keeping receivers separate', async () => {
    const mod = module(S, id), original = mod.recordDebugMethod;
    let recorded = 0;
    mod.recordDebugMethod = function (...args) { recorded++; return original.apply(this, args); };
    const {first, second} = await load('export const first = {value: 1, get current() { return this.value; },' +
      ' set current(next) { this.value = next; }}; export const second = {value: 2, get current() { return this.value; }};',
    {retain: true, debug: true});
    const before = recorded;
    for (let i = 0; i < 100; i++) { first.current = i; expect([first.current, second.current]).deep.equals([i, 2]); }
    expect(recorded, 'getter/setter accesses create no new captured functions').equals(before);
  });

  it('loads JSX that merely mentions debugger without enabling interception', async () => {
    let babel = await System.import('@babel/standalone');
    while (!babel.availablePlugins && babel.default) babel = babel.default;
    const options = System.babelOptions, name = dir + 'view.jsx', jsx = babel.availablePlugins['transform-react-jsx'];
    System.babelOptions = {...options, presets: [...options.presets, {plugins: [[jsx, {pragma: '__lvVarRecorder.React.createElement'}]]}]};
    try {
      const {view} = await load('const React = {createElement: (tag, props, ...children) => ({tag, children})};' +
        ' export const view = <div>debugger</div>;', {name});
      expect([view.children, module(S, name).debuggingEnabled], 'JSX text renders and is no debugger statement')
        .deep.equals([['debugger'], false]);
    } finally { System.babelOptions = options; }
  });

  // Each case loads `source` (with `options`) and runs `script` with the module exports.
  for (const [title, source, script, options] of [
    ['opens from a plain method call and resumes its callers without repeating effects',
      'export class Task { constructor() { this.visits = 0; } outer() { this.visits++; const total = this.inner(3);' +
      ' this.result = total + 1; return this.result; } inner(value) { let amount = value * 2; debugger; return amount; } }',
    async ({Task}) => {
      const task = new Task(), pending = task.outer();
      expect(pending).instanceOf(Promise);
      expect([stops.length, stops[0].continuation.frames().length, task.visits, task.result]).deep.equals([1, 2, 1, undefined]);
      stops[0].continuation.currentFrame.getScope().set('amount', 8);
      await expectStop(pending, 9);
      expect([task.visits, task.result]).deep.equals([1, 9]);
    }],
    ['keeps ordinary synchronous return values, names and arity when no stop executes',
      'export function sum(a, b) { if (a < 0) debugger; return a + b; }', ({sum}) => expect([sum(2, 3), stops.length, sum.name, sum.length])
        .deep.equals([5, 0, 'sum', 2])],
    ['captures a returned runtime closure and its live binding cells, also explicitly through runWithCapturedBindings',
      'export function make(value) { function charge(quantity) { const result = value + quantity; debugger; return result + value; }' +
      ' return {charge, read: () => value}; }', async ({make}) => {
        const account = make(2), pending = account.charge(3), explicit = make(2);
        const stopped = await runWithCapturedBindings(explicit.charge, null, [3]);
        stops[0].continuation.currentFrame.getScope().findScope('value').scope.set('value', 7);
        expect([account.read(), stopped.currentFrame.lookup('value')]).deep.equals([7, 2]);
        await expectStop(pending, 12);
        stopped.currentFrame.getScope().findScope('value').scope.set('value', 7);
        expect([explicit.read(), stopped.resume()]).deep.equals([7, 12]);
      }],
    ['opens on exceptions only after the module toggle is enabled, including after await',
      'export const failure = new Error("expected failure"); export function task(pause) { if (pause) debugger; throw failure; }' +
      ' export async function later() { await Promise.resolve(); throw failure; }',
    async ({task, later, failure}) => {
      let rejection;
      expect(() => task(false)).throws(failure);
      try { await later(); } catch (error) { rejection = error; }
      expect([rejection, stops.length]).ordered.members([failure, 0]);
      await module(S, id).setDebuggingEnabled(true);
      const {entry} = await load('import {task} from "./task.js";' +
        ' export function entry(pause) { if (pause) debugger; return task(false); }', {name: dir + 'caller.js'});
      const pending = entry(false), {continuation} = stops[0];
      expect([continuation.frames().length, continuation.reason, continuation.exception]).ordered.members([2, 'exception', failure]);
      stops.shift().callbacks.onCancel();
      expect(await pending).equals(undefined);
      const awaiting = later();
      await ticks(() => stops.length, 30);
      expect(stops[0].continuation.exception).equals(failure);
      stops.shift().callbacks.onCancel();
      expect(await awaiting).equals(undefined);
    }],
    ['preserves the installed debugger when the loader adopts source modules', pause, async ({task}) => {
      const runtime = S.get('@lively-env').moduleDebugger;
      expect(task(false)).equals(3);
      // A fresh loader has no public fetch hook; translation uses lively.fetch.
      delete S.fetch;
      reinitializeSystem(S);
      expect(installModuleDebugger(S)).equals(runtime);
      await expectStop(task(true), 3);
    }],
    ['recompiles cached functions when the AST registry is replaced', pause, async ({task}) => {
      const registry = getCurrentASTRegistry();
      expect(task(false)).equals(3);
      setCurrentASTRegistry({});
      try { await expectStop(task(true), 3); } finally { setCurrentASTRegistry(registry); }
    }],
    ['does not recursively intercept helpers called while preparing a function', pause, async ({task}) => {
      const source = pause.replace('export ', '');
      const get = () => { expect(task(false)).equals(3); return source; };
      Object.defineProperty(task, Symbol.for('lively-debug-function-source'), {configurable: true, get});
      await expectStop(task(true), 3);
    }],
    ['returns undefined when a resumed function has no return statement', 'export function task() { debugger; let value = 2; value++; }',
      ({task}) => expectStop(task(), undefined)],
    ['opens after an await and returns the completed result to an awaiting native caller',
      'export async function task() { const value = await Promise.resolve(4); debugger; return value + 1; }',
      ({task}) => expectStop(task(), 5)],
    ['preserves lowered super calls and getters',
      'class Base { value() { return 2; } } export class Task extends Base { get total() { debugger; return super.value() + 1; } }',
      ({Task}) => expectStop(new Task().total, 3)],
    ['keeps native object super methods valid in an intercepted module', 'export const task = {__proto__: {value: 2},' +
      ' value() { return super.value + 1; }}; export function stop() { debugger; return task.value(); }',
    async ({task, stop}) => { expect(task.value()).equals(3); await expectStop(stop(), 3); }],
    ['retains functions under numeric property names',
      'export const methods = {0: function () { return 3; }, 1: function () { return 4; }, 2() { return 5; }};',
      ({methods}) => expect([methods[0](), methods[0].name, methods[1](), methods[2]()]).deep.equals([3, '0', 4, 5])],
    ['automatically intercepts a stop added through a module edit', 'export function task() { return 2; }', async () => {
      const mod = module(S, id);
      expect(mod.debuggingEnabled).equals(false);
      await mod.changeSource('export function task() { debugger; return 3; }', {doSave: false});
      expect(mod.debuggingEnabled).equals(true);
      await expectStop(S.get(id).task(), 3);
    }],
    ['resumes construction on the original instance',
      'export class Task { constructor(value) { this.visits = 1; debugger; this.value = value; } }',
      async ({Task}) => {
        const pending = new Task(3), instance = stops[0].continuation.currentFrame.getThis();
        expect(instance).instanceOf(Task);
        await expectStop(pending, instance);
        expect([instance.value, instance.visits]).deep.equals([3, 1]);
      }],
    ['preserves prototypes in constructors that can also be called as factories', 'export function Task(value, pause) {' +
      ' if (!(this instanceof Task)) return new Task(value, pause); this.initialize(value); if (pause) debugger; }' +
      ' Task.prototype.initialize = function(value) { this.value = value; };', async ({Task}) => {
      expect(Task(3, false)).instanceOf(Task);
      expect([Task(3, false).value, new Task(4, false).value]).deep.equals([3, 4]);
      const pending = Task(5, true), instance = stops[0].continuation.currentFrame.getThis();
      await expectStop(pending, instance);
      expect(instance).instanceOf(Task);
      expect(instance.value).equals(5);
    }],
    ['captures function constructors, including construction inside an intercepted caller',
      'export function Task(value) { this.visits = 1; debugger; this.value = value; this.target = new.target; }' +
      ' export function make() { debugger; const task = new Task(3); return task.target === Task ? task.value + 1 : -1; }',
    async ({Task, make}) => {
      const pending = new Task(2), instance = stops[0].continuation.currentFrame.getThis();
      await expectStop(pending, instance);
      expect(instance).instanceOf(Task);
      expect(instance.target).equals(Task);
      const caller = make();
      expect([stops.length, (await proceed()).isContinuation, stops[0].continuation.frames().length]).deep.equals([1, true, 2]);
      expect([await proceed(), await caller]).deep.equals([4, 4]);
    }],
    ['restores callback aliases and shared cells from an intercepted module in the existing pool',
      'export function make() { let value = 2; return {read: () => value, increment: () => ++value}; }', async () => {
        await module(S, id).setDebuggingEnabled(true);
        const callbacks = S.get(id).make(), pool = ObjectPool.withDefaultPlugins();
        const snapshot = serialize({...callbacks, alias: callbacks.increment}, {objPool: pool});
        const restored = deserialize(JSON.parse(JSON.stringify(snapshot)));
        expect(pool.ref(callbacks.increment).id).equals(snapshot.snapshot[snapshot.id].props.alias.value.id);
        expect(restored.increment).equals(restored.alias);
        expect([restored.read(), restored.increment(), restored.read(), stops.length]).deep.equals([2, 3, 3, 0]);
      }, {retain: true}],
    ['intercepts callbacks created after an await or debugger resume',
      'export async function make(rate, pause) { await Promise.resolve(); if (pause) debugger;' +
      ' return value => { debugger; return rate + value; }; }', async ({make}) => {
      for (const pause of [false, true]) {
        const result = make(2, pause);
        if (pause) { await ticks(() => stops.length, 20); expect(stops).length(1); await proceed(); }
        const charge = await result, pending = charge(3);
        expect(stops[0].continuation.currentFrame.func.runtimeObjectMeta.moduleSource).contains('export async function make');
        await expectStop(pending, 5);
        await module(S, id).setDebuggingEnabled(false);
        expect(charge(4)).equals(6);
        await module(S, id).setDebuggingEnabled(true);
      }
    }],
    ['toggles an existing module without saving its source, keeps instances, and honors the setting after edits',
      'export const effects = {initializations: 0}; effects.initializations++; export class Task { value() { return 2; } }',
      async ({Task, effects}) => {
        const instance = new Task(), mod = module(S, id), source = await resource(id).read();
        expect(mod.debuggingEnabled).equals(false);
        // SWC class metadata retains source locations without a declaration kind.
        delete Task[Symbol.for('lively-object-meta')].kind;
        await mod.setDebuggingEnabled(true);
        expect([effects.initializations, S.get(id).Task]).deep.equals([1, Task]);
        await mod.changeSource('export class Task { value() { debugger; return 3; } }', {doSave: false});
        await expectStop(instance.value(), 3);
        await mod.setDebuggingEnabled(false);
        expect([instance.value(), stops.length, await resource(id).read()]).deep.equals([3, 0, source]);
      }],
    ['intercepts object methods and nested arrows with their retained receiver', 'export const task = {value: 2, run() {' +
      ' const compute = () => { debugger; return this.value; }; return compute() + 1; },' +
      ' get total() { debugger; return this.value + 3; }};',
    async ({task}) => {
      const pending = task.run();
      expect(stops[0].continuation.frames()).length(2);
      await expectStop(pending, 3);
      await expectStop(task.total, 5);
    }],
    ['opens for an async generator next request and preserves the iterator result',
      'export async function* values() { await Promise.resolve(); debugger; yield 3; return 4; }', async ({values}) => {
        const iterator = values();
        await expectStop(iterator.next(), {value: 3, done: false});
        expect(await iterator.next()).deep.equals({value: 4, done: true});
      }],
    ['keeps a single pending invocation across multiple stops and settles cancellation',
      'export function task() { debugger; debugger; return 4; }',
      async ({task}) => {
        const pending = task();
        expect([(await proceed()).isContinuation, stops.length]).deep.equals([true, 1]);
        stops.shift().callbacks.onCancel();
        expect(await pending).equals(undefined);
      }],
    // Native boundaries
    ...[false, true].map(debugging => [`keeps object-super arrows native and drops them from snapshots with debugging ${debugging}`,
      'export const task = {__proto__: {value() { return 3; }}, arrow(offset) { return () => super.value() + offset; }};' + stop,
      ({task}) => {
        const callback = task.arrow(4), hook = callback[Symbol.for('lively-serialize-closure')];
        expect([module(S, id).debuggingEnabled, callback(), hook]).deep.equals([debugging, 7, undefined]);
        expect([deserialize(serialize({callback})).callback, warnings.length]).deep.equals([undefined, 0]);
      }, {retain: true, automatic: debugging}]),
    ['runs functions containing local class declarations natively',
      'export function task(value) { class Local { constructor(value) { this.value = value; } } return new Local(value).value; }' + stop,
      ({task}) => expect([task(4), task(5), warnings.length, warnings[0][0].includes('task') && warnings[0][0].includes(id)])
        .deep.equals([4, 5, 1, true])],
    ['runs object methods returning a class natively',
      'export const task = {make() { return class Local { value() { return 5; } }; }};' + stop,
      ({task}) => expect([new (task.make())().value(), new (task.make())().value(), warnings.length,
        warnings[0][0].includes('Local') && warnings[0][0].includes(id)]).deep.equals([5, 5, 1, true])],
    ['preserves native constructor targets and runtime errors after compilation fails',
      'export const failure = new Error("expected failure"); export function Task(value) { class Local { value() { return 1; } }' +
      ' this.value = value; this.target = new.target; this.local = Local; }' +
      ' export function fails() { class Local { value() { return 1; } } throw failure; }' + stop, ({Task, fails, failure}) => {
      function Derived () {}
      Derived.prototype = Object.create(Task.prototype);
      const instance = Reflect.construct(Task, [7], Derived);
      expect(instance).instanceOf(Derived);
      expect([instance.value, instance.target, typeof instance.local]).deep.equals([7, Derived, 'function']);
      expect(() => fails()).throws(failure);
      expect(warnings).length(2);
    }],
    // Retained closures and error propagation
    ['captures only lexical values actually used by retained arrows', 'export function make() { return {plain: function() { return 3; },' +
      ' empty: () => 3, receiver: () => this, args: () => arguments, nested: () => () => [this, arguments],' +
      ' regular: () => function() { return [this, arguments]; }}; }', ({make}) => {
      const receiver = {secret: 'unused-receiver'}, value = {secret: 'unused-argument'}, callbacks = make.call(receiver, value);
      const retains = name => [owns(callbacks[name], '_lexicalThis'), owns(callbacks[name], '_lexicalArguments')];
      expect(['plain', 'empty', 'regular', 'receiver', 'args'].map(retains)).deep.equals([[false, false], [false, false], [false, false],
        [true, false], [false, true]]);
      expect([callbacks.receiver(), callbacks.args()[0], callbacks.nested()()[0], callbacks.nested()()[1][0]])
        .ordered.members([receiver, value, receiver, value]);
      expect(Object.keys(callbacks.nested).filter(key => key.startsWith('_lexical')), 'captures are non-enumerable').deep.equals([]);
    }, {retain: true}],
    ['does not retain unused native receivers or arguments while a callback stays live', 'export function make() { return () => 3; }',
      async ({make}) => {
        const state = (() => {
          const receiver = {secret: 'receiver'}, argument = {secret: 'argument'};
          return {callback: make.call(receiver, argument), receiver: new WeakRef(receiver), argument: new WeakRef(argument)};
        })();
        await collectGarbage();
        expect([state.callback(), state.receiver.deref(), state.argument.deref()]).deep.equals([3, undefined, undefined]);
      }, {retain: true}],
    ['requires explicit runtime-closure retention even with automatic interception',
      'export function make(token) { return () => token; }' + stop,
      ({make}) => {
        const mod = module(S, id), callback = make({token: 'private-token'});
        delete mod._retainRuntimeClosures;
        expect([mod.debuggingEnabled, mod.retainRuntimeClosures, callback[Symbol.for('lively-serialize-closure')], callback().token],
          'a debugger statement enables no persistent captures').deep.equals([true, false, undefined, 'private-token']);
      }],
    ...[['string', '"plain failure"'], ['number', '23'], ['null', 'null'], ['undefined', 'undefined'],
      ['object', '{reason: "ordinary", message: "plain failure"}'],
      ['control-shaped object', '{reason: "await", toString() { return "Debugger"; }}'],
      ['frozen object', 'Object.freeze({message: "frozen"})']
    ].map(([name, value]) => ['propagates ' + name + ' throws without opening the debugger',
      failing(value), ({fail, failure}) => {
        let thrown = false, caught;
        try { fail()?.then?.(null, () => {}); } catch (error) { thrown = true; caught = error; }
        expect([thrown, caught === failure, stops.length], name + ': the original value propagates synchronously')
          .deep.equals([true, true, 0]);
      }, {retain: true, debug: true}]),
    ['preserves non-Error await rejections and catches, including null and undefined', 'export async function fail(value) {' +
      ' return await Promise.reject(value); } export async function caught(value) { try { await Promise.reject(value); }' +
      ' catch (error) { return {error}; } }', async ({fail, caught}) => {
      for (const value of [null, undefined, 23, 'failure', {reason: 'await'}]) {
        let outcome;
        fail(value).then(value => { outcome = {value}; }, error => { outcome = {error}; });
        await ticks(() => outcome || stops.length);
        expect([stops.length, outcome && owns(outcome, 'error')], 'the rejection propagates without opening the debugger')
          .deep.equals([0, true]);
        expect([outcome.error, (await caught(value)).error, stops.length]).ordered.members([value, value, 0]);
      }
    }, {retain: true, debug: true}],
    ['releases unwind attachments consumed by a compiled catch and at the debugger boundary', failing('new Error("expected")') +
      ' function inner() { throw failure; } export function caught() { try { inner(); } catch (error) { return error; } }',
    async ({caught, fail, failure}) => {
      const error = new Error('expected failure');
      new UnwindException(error);
      expect([Object.keys(error), JSON.stringify(error)], 'the attachment is non-enumerable and JSON-free').deep.equals([[], '{}']);
      expect([caught() === failure, owns(failure, 'unwindException'), JSON.stringify(failure)]).deep.equals([true, false, '{}']);
      const pending = fail();
      expect([stops.length, owns(failure, 'unwindException')], 'a handled error does not keep the captured stack').deep.equals([1, false]);
      stops.shift().callbacks.onCancel();
      await pending;
      expect(owns(failure, 'unwindException'), 'a cancelled error does not keep the captured stack').equals(false);
    }, {retain: true, debug: true}],
    ['releases unwind attachments before ordinary errors propagate', 'export const failure = new Error("expected");' +
      ' export function fail() { debugger; throw failure; }', async ({fail, failure}) => {
      const pending = fail(), {continuation, callbacks} = stops.shift();
      let thrown;
      try { continuation.resume(); } catch (error) { thrown = error; }
      // Automatic interception does not pause on exceptions; deliver the result at the native boundary.
      if (!thrown) try { installModuleDebugger(S).deliver(continuation.resume()); } catch (error) { thrown = error; }
      callbacks.onCancel();
      await pending;
      expect([thrown, owns(failure, 'unwindException')], 'the error keeps its identity without unwind frames')
        .ordered.members([failure, false]);
    }, {retain: true}]
  ]) {
    it(title, async () => {
      if (options?.automatic === false) S.debuggerInterception = false;
      await script(await load(source, options));
    });
  }
});
