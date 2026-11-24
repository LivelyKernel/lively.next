/* global System, describe, beforeEach, afterEach, it */
import { expect } from 'mocha-es6';
import { parseFunction } from 'lively.ast';
import { resource } from 'lively.resources';
import { serialize, deserialize } from '../../lively.serializer2/index.js';
import { prepareSystem } from '../../lively.modules/tests/helpers.js';
import module from '../../lively.modules/src/module.js';
import { removeSystem } from '../../lively.modules/src/system.js';
import { asRewrittenClosure, run, stackCaptureMode } from '../lib/stackReification.js';
import { Function as InterpretedFunction, Scope } from '../lib/interpreter.js';
import { __createClosure, originalFunctions, UnwindException } from '../lib/exception.js';
import { getCurrentASTRegistry, setCurrentASTRegistry } from '../lib/rewriter.js';
import { installModuleDebugger } from '../lib/module-debugger.js';

const fn = source => globalThis.Function('return (' + source + ')')();
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

describe('debugger retention and robustness', function () {
  this.timeout(30000);
  let S, stops;
  const dir = 'local://debugger-retention/';
  const id = dir + 'task.js';
  const load = async (source, {retain = true, debug = false, name = id} = {}) => {
    const mod = module(S, name);
    mod.retainRuntimeClosures = retain;
    if (debug) await mod.setDebuggingEnabled(true);
    await resource(name).write(source);
    return S.import(name);
  };
  beforeEach(() => {
    S = prepareSystem('debugger-retention', dir);
    S.debuggerInterception = true;
    stops = [];
    installModuleDebugger(S, {open: (continuation, callbacks) => { stops.push({continuation, callbacks}); }});
  });
  afterEach(async () => {
    for (const stop of stops.splice(0)) stop.callbacks.onCancel();
    removeSystem('debugger-retention');
    await resource(dir).remove();
  });

  it('captures only lexical values actually used by retained arrows', async () => {
    const {make} = await load('export function make() { return {plain: function() { return 3; }, empty: () => 3, receiver: () => this, args: () => arguments, nested: () => () => [this, arguments], regular: () => function() { return [this, arguments]; }}; }');
    const receiver = {secret: 'unused-receiver'}, value = {secret: 'unused-argument'};
    const callbacks = make.call(receiver, value);
    for (const name of ['plain', 'empty', 'regular']) {
      expect(owns(callbacks[name], '_lexicalThis'), name + ': must not retain unused this').equals(false);
      expect(owns(callbacks[name], '_lexicalArguments'), name + ': must not retain unused arguments').equals(false);
    }
    expect(owns(callbacks.receiver, '_lexicalArguments'), 'this-only arrow must not retain arguments').equals(false);
    expect(owns(callbacks.args, '_lexicalThis'), 'arguments-only arrow must not retain this').equals(false);
    expect(callbacks.receiver()).equals(receiver);
    expect(callbacks.args()[0]).equals(value);
    expect(callbacks.nested()()[0]).equals(receiver);
    expect(callbacks.nested()()[1][0]).equals(value);
    for (const key of ['_lexicalThis', '_lexicalArguments'])
      expect(Object.keys(callbacks.nested), key + ': capture must be non-enumerable').not.includes(key);
  });

  it('does not pin created arrow closures through the AST registry', () => {
    const registry = getCurrentASTRegistry(), ast = parseFunction('() => 3');
    setCurrentASTRegistry({'retention-test': [ast]});
    try {
      const callback = __createClosure('retention-test', 0, null, () => 3, {});
      expect(originalFunctions.get(ast), 'registered AST must not own the created closure').not.equals(callback);
      expect(owns(callback, '_lexicalThis'), 'empty lexical metadata must retain nothing').equals(false);
      expect(owns(callback, '_lexicalArguments'), 'empty lexical metadata must retain nothing').equals(false);
    } finally { setCurrentASTRegistry(registry); }
  });

  it('omits unused receivers from interpreted callback snapshots', () => {
    const interpreted = new InterpretedFunction(parseFunction('() => 3'), new Scope({}));
    interpreted.lexicalThis = {secret: 'receiver-must-not-be-saved'};
    const snapshot = serialize(interpreted.asFunction());
    expect(JSON.stringify(snapshot), 'unused receiver must be absent from the snapshot').not.includes('receiver-must-not-be-saved');
    expect(deserialize(JSON.parse(JSON.stringify(snapshot)))()).equals(3);
  });

  it('keeps needed lexical receivers in callback snapshots', () => {
    const interpreted = new InterpretedFunction(parseFunction('() => () => this.value'), new Scope({}));
    interpreted.lexicalThis = {value: 7};
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(interpreted.asFunction()))));
    expect(restored()(), 'nested lexical receiver must survive serialization').equals(7);
  });

  it('does not capture unused lexical values when rewriting arrows', () => {
    const unused = {secret: true};
    const rewritten = stackCaptureMode(fn('() => 3'), {this: unused, arguments: [unused]}, getCurrentASTRegistry());
    expect(owns(rewritten, '_lexicalThis'), 'rewritten arrow must not retain unused this').equals(false);
    expect(owns(rewritten, '_lexicalArguments'), 'rewritten arrow must not retain unused arguments').equals(false);
    expect(rewritten()).equals(3);
  });

  it('interns rewritten code across transient closures without sharing captures', () => {
    const registry = getCurrentASTRegistry();
    let firstAst, length;
    for (let i = 0; i < 100; i++) {
      const closure = asRewrittenClosure(fn('function read() { return value; }'), {value: i}, registry);
      expect(closure.getRewrittenFunc()(), 'cached code must use this invocation binding').equals(i);
      if (!i) { firstAst = closure.originalAst; length = registry['[runtime]'].length; }
      expect(closure.originalAst, 'equivalent runtime code must reuse its parsed AST').equals(firstAst);
      expect(registry['[runtime]'].length, 'repeated code must not grow the AST registry').equals(length);
    }
    const distinct = asRewrittenClosure(fn('function read() { return value; }'), {value: 7, other: 1}, registry);
    expect(distinct.getRewrittenFunc()()).equals(7);
  });

  it('reuses compiled getter functions across accesses while keeping receivers separate', async () => {
    const mod = module(S, id), original = mod.recordDebugMethod;
    let recorded = 0;
    mod.recordDebugMethod = function (...args) { recorded++; return original.apply(this, args); };
    const {first, second} = await load('export const first = {value: 1, get current() { return this.value; }, set current(next) { this.value = next; }}; export const second = {value: 2, get current() { return this.value; }};', {debug: true});
    const before = recorded;
    for (let i = 0; i < 100; i++) { first.current = i; expect(first.current).equals(i); expect(second.current).equals(2); }
    expect(recorded, 'getter/setter accesses must not create new captured functions').equals(before);
  });

  it('preserves accessor key/value evaluation order across suspension', async () => {
    const {make} = await load('export async function make(log) { return {first: log.push("first"), get [await Promise.resolve({[Symbol.toPrimitive]() { log.push("key"); return "value"; }})]() { return this.first; }, last: log.push("last")}; }', {debug: true});
    // Exercise the Babel accessor construction, rather than interpreter suspension.
    await module(S, id).setDebuggingEnabled(false);
    const log = [], object = await make(log);
    expect(log, 'computed accessor key must be coerced once in the original evaluation order').deep.equals(['first', 'key', 'last']);
    expect(object.value, 'accessor must retain its dynamic receiver after await').equals(1);
  });

  it('does not retain unused native receivers or arguments while a callback stays live', async function () {
    expect(globalThis.gc, 'retention tests require the GC-enabled headless TestRunner').a('function');
    const {make} = await load('export function make() { return () => 3; }');
    const create = () => {
      const receiver = {secret: 'receiver'}, argument = {secret: 'argument'};
      return {callback: make.call(receiver, argument), receiver: new WeakRef(receiver), argument: new WeakRef(argument)};
    };
    const state = create();
    for (let i = 0; i < 5; i++) { await new Promise(resolve => setTimeout(resolve, 0)); globalThis.gc(); }
    expect(state.callback()).equals(3);
    expect(state.receiver.deref(), 'unused receiver must be collectable while callback is live').equals(undefined);
    expect(state.argument.deref(), 'unused arguments must be collectable while callback is live').equals(undefined);
  });

  it('releases registry-held closures and their receivers after collection', async function () {
    expect(globalThis.gc, 'retention tests require the GC-enabled headless TestRunner').a('function');
    const registry = getCurrentASTRegistry(), ast = parseFunction('() => this.value');
    setCurrentASTRegistry({'retention-gc': [ast]});
    let weak;
    try {
      const create = () => {
        const receiver = {value: 7};
        const callback = __createClosure('retention-gc', 0, null, () => 7, {this: receiver});
        return [new WeakRef(callback), new WeakRef(receiver)];
      };
      weak = create();
      for (let i = 0; i < 5; i++) { await new Promise(resolve => setTimeout(resolve, 0)); globalThis.gc(); }
      expect(weak[0].deref(), 'AST registry must not retain a finished closure').equals(undefined);
      expect(weak[1].deref(), 'AST registry must not retain the closure receiver').equals(undefined);
    } finally { setCurrentASTRegistry(registry); }
  });

  it('reclaims transient runtime AST slots and reuses them without losing live code', async function () {
    expect(globalThis.gc, 'retention tests require the GC-enabled headless TestRunner').a('function');
    const previous = getCurrentASTRegistry(), registry = {};
    setCurrentASTRegistry(registry);
    try {
      const live = stackCaptureMode(fn('function live() { return 7; }'), {}, registry);
      const compile = start => {
        for (let i = start; i < start + 300; i++) stackCaptureMode(fn('function transient() { return ' + i + '; }'), {}, registry);
      };
      compile(0);
      const size = registry['[runtime]'].length;
      for (let i = 0; i < 5; i++) { await new Promise(resolve => setTimeout(resolve, 0)); globalThis.gc(); }
      expect(registry['[runtime]'].filter(Boolean).length, 'dead runtime ASTs must not stay in the registry').lessThan(10);
      compile(300);
      expect(registry['[runtime]'].length, 'new code must reuse dead registry slots').at.most(size + 2);
      expect(live(), 'live rewritten code must keep its AST slots').equals(7);
    } finally { setCurrentASTRegistry(previous); }
  });

  it('requires explicit runtime-closure retention even with automatic interception', async () => {
    const {make} = await load('export function make(token) { return () => token; } export function stop() { debugger; }', {retain: false});
    const mod = module(S, id);
    delete mod._retainRuntimeClosures;
    expect(mod.debuggingEnabled).equals(true);
    expect(mod.retainRuntimeClosures, 'temporary debugger statement must not enable persistent captures').equals(false);
    const callback = make({token: 'private-token'});
    expect(callback[Symbol.for('lively-serialize-closure')], 'debugger-only closure must not install a capture serializer').equals(undefined);
    expect(callback().token).equals('private-token');
  });

  for (const [name, source] of [['string', '"plain failure"'], ['number', '23'], ['null', 'null'], ['undefined', 'undefined'], ['object', '{reason: "ordinary", message: "plain failure"}'], ['control-shaped object', '{reason: "await", toString() { return "Debugger"; }}'], ['frozen object', 'Object.freeze({message: "frozen"})']]) {
    it('propagates ' + name + ' throws without opening the debugger', async () => {
      const {fail, failure} = await load('export const failure = ' + source + '; export function fail() { throw failure; }', {debug: true});
      let thrown = false, caught, result;
      try { result = fail(); } catch (error) { thrown = true; caught = error; }
      if (result?.then) result.catch(() => {});
      expect(thrown, name + ': throw must propagate synchronously').equals(true);
      expect(caught, name + ': original thrown value must be preserved').equals(failure);
      expect(stops, name + ': non-Error throws must not open a debugger').length(0);
    });
  }

  it('preserves non-Error await rejections and catches, including null and undefined', async () => {
    const {fail, caught} = await load('export async function fail(value) { return await Promise.reject(value); } export async function caught(value) { try { await Promise.reject(value); } catch (error) { return {error}; } }', {debug: true});
    for (const value of [null, undefined, 23, 'failure', {reason: 'await'}]) {
      let outcome;
      const pending = fail(value);
      pending.then(value => { outcome = {value}; }, error => { outcome = {error}; });
      for (let i = 0; i < 100 && !outcome && !stops.length; i++) await Promise.resolve();
      expect(stops, 'non-Error await rejection must propagate without opening the debugger').length(0);
      expect(outcome && owns(outcome, 'error'), 'non-Error rejection must reject the async call').equals(true);
      expect(outcome.error, 'await must preserve the original rejection value').equals(value);
      expect((await caught(value)).error, 'resumed catch must receive the original rejection').equals(value);
      expect(stops, 'non-Error rejections must not open a debugger').length(0);
    }
  });

  it('releases unwind attachments consumed by a compiled catch', async () => {
    const {caught, failure} = await load('export const failure = new Error("expected"); function inner() { throw failure; } export function caught() { try { inner(); } catch (error) { return error; } }', {debug: true});
    expect(caught()).equals(failure);
    expect(owns(failure, 'unwindException'), 'caught errors must release their captured stack').equals(false);
    expect(JSON.stringify(failure), 'caught errors must stay JSON-serializable').equals('{}');
  });

  it('keeps unwind attachments out of JSON and releases them at the debugger boundary', async () => {
    const error = new Error('expected failure');
    new UnwindException(error);
    expect(Object.keys(error), 'error unwind attachment must be non-enumerable').not.includes('unwindException');
    expect(JSON.stringify(error), 'errors must remain JSON-serializable').equals('{}');
    delete error.unwindException;
    const {fail, failure} = await load('export const failure = new Error("expected"); export function fail() { throw failure; }', {debug: true});
    const pending = fail();
    expect(stops).length(1);
    expect(owns(failure, 'unwindException'), 'handled error must not keep the captured stack').equals(false);
    stops.shift().callbacks.onCancel();
    await pending;
    expect(owns(failure, 'unwindException'), 'cancelled error must not keep the captured stack').equals(false);
  });

  it('releases unwind attachments before ordinary errors propagate', async () => {
    const {fail, failure} = await load('export const failure = new Error("expected"); export function fail() { debugger; throw failure; }');
    const pending = fail();
    const stop = stops.shift();
    let caught;
    try { stop.continuation.resume(); } catch (error) { caught = error; }
    // Automatic interception does not pause on exceptions; deliver the result at the native boundary.
    if (!caught) {
      try { installModuleDebugger(S).deliver(stop.continuation.resume()); } catch (error) { caught = error; }
    }
    stop.callbacks.onCancel();
    await pending;
    expect(caught, 'ordinary thrown Error must preserve identity').equals(failure);
    expect(owns(failure, 'unwindException'), 'propagated error must not retain unwind frames').equals(false);
  });

  it('loads JSX that merely mentions debugger without enabling interception', async () => {
    let babel = await System.import('@babel/standalone');
    while (!babel.availablePlugins && babel.default) babel = babel.default;
    const options = System.babelOptions;
    System.babelOptions = {...options, presets: [...options.presets, {plugins: [[babel.availablePlugins['transform-react-jsx'], {pragma: '__lvVarRecorder.React.createElement'}]]}]};
    try {
      const {view} = await load('const React = {createElement: (tag, props, ...children) => ({tag, children})}; export const view = <div>debugger</div>;', {retain: false, name: dir + 'view.jsx'});
      expect(view.children, 'JSX text must still render').deep.equals(['debugger']);
      expect(module(S, dir + 'view.jsx').debuggingEnabled, 'JSX text is not a debugger statement').equals(false);
    } finally { System.babelOptions = options; }
  });
});
