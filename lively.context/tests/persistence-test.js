/* global System, describe, before, after, it */
import { expect } from 'mocha-es6';
import { parseFunction } from 'lively.ast';
import { resource } from 'lively.resources';
import { serialize, deserialize, ObjectPool, ExpressionSerializer } from 'lively.serializer2';
import { run, Continuation, asRewrittenClosure, stackCaptureMode } from '../lib/stackReification.js';
import { getCurrentASTRegistry, setCurrentASTRegistry } from '../lib/rewriter.js';
import { Interpreter, Function as InterpretedFunction, Scope } from '../lib/interpreter.js';
import { installModuleDebugger } from '../lib/module-debugger.js';
import { collectGarbage } from './helpers.js';

const fn = source => globalThis.Function('return (' + source + ')')();
const roundTrip = (value, options) => deserialize(JSON.parse(JSON.stringify(serialize(value, options))));
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
/** An interpreted callback for `source` with the given lexical receiver and arguments. */
function interpreted (source, lexical) {
  const func = new InterpretedFunction(parseFunction(source, {sourceType: 'script', locations: true, addSource: true, addAstIndex: true}),
    new Scope({}));
  return Object.assign(func, lexical).asFunction();
}
/** Saves and loads `state` three times, checking each generation. */
function generations (state, check) {
  for (let generation = 1; generation <= 3; generation++) check(state = roundTrip(state), generation);
  return state;
}

describe('suspended continuation and closure persistence', function () {
  this.timeout(30000);
  let fixture, nativeCallbacks, SnapshotChild, SnapshotGrandchild, localClassFactories;
  before(async () => {
    fixture = System.get('@lively-env').moduleEnv(System.decanonicalize('lively.context/tests/fixtures/persistence-callbacks.js'));
    fixture.retainRuntimeClosures = true;
    ({nativeCallbacks, SnapshotChild, SnapshotGrandchild, localClassFactories} = await fixture.load());
  });
  after(() => fixture.unload());

  it('keeps native callback aliases, shared cells and receivers in the same pool, as a root and through three generations', () => {
    const receiver = {value: 0}, callbacks = nativeCallbacks(receiver), pool = ObjectPool.withDefaultPlugins();
    const snapshot = serialize({receiver, ...callbacks, alias: callbacks.increment}, {objPool: pool});
    expect(pool.ref(callbacks.increment).id).equals(snapshot.snapshot[snapshot.id].props.alias.value.id);
    let state = deserialize(JSON.parse(JSON.stringify(snapshot)));
    for (let generation = 1; generation <= 3; generation++, state = roundTrip(state)) {
      expect(state.increment).equals(state.alias);
      expect([state.read(), state.increment(), state.read()]).deep.equals([generation + 1, generation + 2, generation + 2]);
      state.write(generation);
      expect(state.receiver.value).equals(generation);
    }
    expect(receiver.value).equals(0);
    const root = roundTrip(nativeCallbacks({value: 0}).increment);
    expect([root(), root()]).deep.equals([3, 4]);
  });

  it('keeps the lexical receiver and arguments interpreted callbacks reference through three generations', () => {
    for (const source of ['() => arguments[0]', '() => () => arguments[0]', '(value = arguments[0]) => value', '() => () => this']) {
      const value = {amount: 7}, read = callback => typeof callback() === 'function' ? callback()() : callback();
      const state = generations({value, callback: interpreted(source, {lexicalArguments: [value], lexicalThis: value})}, state => {
        expect(read(state.callback), source).equals(state.value);
        state.value.amount++;
      });
      expect([state.value.amount, value.amount]).deep.equals([10, 7]);
    }
  });

  it('omits receivers and arguments that interpreted callbacks use only through local bindings or regular nested functions', () => {
    const lexicalArguments = fn('function captured() { "use strict"; return arguments; }')({secret: 'unused-argument'});
    for (const [source, args, expected] of [
      ['arguments => arguments[0]', [[9]], 9], ['({arguments}) => arguments[0]', [{arguments: [9]}], 9],
      ['() => (arguments => arguments[0])([9])', [], 9], ['() => (function() { return arguments[0]; })(9)', [], 9],
      ['() => (function() { return (() => arguments[0])(); })(9)', [], 9], ['() => ({arguments: 9}).arguments', [], 9],
      ['() => { /* arguments */ return "arguments"; }', [], 'arguments'], ['() => 3', [], 3], ['() => () => 3', [], 3]
    ]) {
      let callback = interpreted(source, {lexicalArguments, lexicalThis: {secret: 'unused-receiver'}});
      for (let generation = 1; generation <= 3; generation++) {
        const snapshot = JSON.stringify(serialize(callback));
        expect(snapshot, source).not.match(/unused-|[lL]exicalArguments/);
        callback = deserialize(JSON.parse(snapshot));
        const result = callback(...args);
        expect(typeof result === 'function' ? result() : result, source).equals(expected);
      }
    }
  });

  it('normalizes strict native arguments while keeping shared argument values and receivers', () => {
    const receiver = new SnapshotChild(), value = {amount: 7}, callbacks = receiver.argumentCallbacks(value);
    expect(() => callbacks.read._lexicalArguments.callee).to.throw(TypeError);
    const initial = {receiver, value, ...callbacks};
    receiver.state = value.state = initial;
    const state = generations(initial, (state, generation) => {
      expect([state.value.state, state.receiver.state]).ordered.members([state, state]);
      for (const result of [state.read.call({}), state.nested()()]) {
        expect(result.slice(0, 2)).ordered.members([state.receiver, state.value]);
      }
      expect(state.args()).equals(state.argsAlias());
      expect(state.args()[0]).equals(state.value);
      const replacement = {amount: generation};
      state.args()[0] = replacement;
      expect([state.read()[1], state.nested()()[1]]).ordered.members([replacement, replacement]);
      state.argsAlias()[0] = state.value;
      state.value.amount++;
    });
    expect([state.value.amount, value.amount]).deep.equals([10, 7]);
  });

  it('refreshes native argument captures when saving again with the same object pool', () => {
    const receiver = new SnapshotChild(), callbacks = receiver.argumentCallbacks({amount: 7}), objPool = ObjectPool.withDefaultPlugins();
    const state = {receiver, ...callbacks};
    expect(roundTrip(state, {objPool}).read()[1].amount).equals(7);
    state.value = callbacks.args()[0] = {amount: 8};
    state._rev = 1;
    const second = roundTrip(state, {objPool});
    expect([second.read()[1], second.nested()()[1], second.value.amount]).ordered.members([second.value, second.value, 8]);
    expect(second.args()).equals(second.argsAlias());
  });

  it('restores class super callbacks with their declaring class and lexical receiver, also from fields and static methods', () => {
    const receiver = new SnapshotGrandchild(), child = new SnapshotChild(), borrowedReceiver = {amount: 4};
    receiver.amount = 3;
    child.amount = 3;
    SnapshotGrandchild.amount = 4;
    const callback = receiver.create(2), borrowed = SnapshotChild.prototype.create.call(borrowedReceiver, 5);
    const field = SnapshotGrandchild.create(5);
    try {
      expect([callback(), borrowed(), child.callback(), field()]).deep.equals([5, 9, 6, 9]);
      const cell = callback[Symbol.for('lively-debug-bindings')][Symbol.for('lively-debug-binding-cells')].__lively_class__;
      const expressions = new ExpressionSerializer();
      expect(expressions.deserializeExpr(expressions.embedValue(cell)).value).equals(SnapshotChild);
      generations({receiver, callback, alias: callback, borrowedReceiver, borrowed, child, field}, (state, generation) => {
        expect(state.callback).equals(state.alias);
        state.receiver.amount = state.child.amount = generation + 3;
        state.borrowedReceiver.amount = SnapshotGrandchild.amount = generation + 4;
        expect([state.callback(), state.borrowed.call({amount: 1000}), state.child.callback(), state.field.call({amount: 1000})])
          .deep.equals([generation + 5, generation + 9, (generation + 3) * 2, generation + 9]);
      });
      expect(receiver.amount).equals(3);
    } finally { delete SnapshotGrandchild.amount; }
  });

  it('rejects anonymous, factory and impostor declaring classes without an exact module reference at save', () => {
    for (const factory of localClassFactories) {
      const receiver = new (factory())();
      receiver.amount = 3;
      const callback = receiver.create();
      expect(callback()).equals(3);
      expect(callback[Symbol.for('lively-serialize-closure')]).a('function');
      expect(() => serialize(callback)).to.throw(/declaring class.*no stable module reference/);
    }
    const impostor = globalThis.Function('return class SnapshotChild {}')();
    Object.defineProperty(impostor, Symbol.for('lively-module-meta'), {value: SnapshotChild[Symbol.for('lively-module-meta')]});
    const callback = fixture.recordDebugClosure(() => 3, {}, 0, 7, '() => 3', 'callback', undefined, undefined, impostor);
    expect(() => serialize(callback)).to.throw(/declaring class.*no stable module reference/);
  });

  it('shares full module source across saved callbacks without changing historical source after edits', async () => {
    const id = 'local://closure-persistence/source.js', file = resource(id), mod = System.get('@lively-env').moduleEnv(id);
    mod.retainRuntimeClosures = true;
    const padding = 'preserved module source '.repeat(1600);
    const original = 'export function make(value) { return () => value + 1; }\n/*' + padding + '*/';
    const edited = 'const prefix = 0;\nexport function make(value) { return () => value + 2; }\n/*' + padding + '*/';
    try {
      await file.write(original);
      const {make} = await System.import(id), sizes = [];
      for (const count of [10, 50]) {
        const callbacks = Array.from({length: count}, (_, index) => make(index)), snapshot = JSON.stringify(serialize({callbacks}));
        sizes.push(snapshot.length);
        expect(deserialize(JSON.parse(snapshot)).callbacks.map(callback => callback())).deep.equals(callbacks.map((_, index) => index + 1));
      }
      expect((sizes[1] - sizes[0]) / 40).lessThan(original.length / 4);
      const old = make(1);
      await mod.changeSource(edited, {doSave: false});
      generations({old, current: mod.recorder.make(1)}, state => {
        expect([state.old(), state.current()]).deep.equals([2, 3]);
        for (const [callback, source, body] of [[state.old, original, '() => value + 1'], [state.current, edited, '() => value + 2']]) {
          const meta = callback.interpretedFunction.runtimeObjectMeta;
          expect(meta.moduleSource).equals(source);
          expect(meta.moduleSource.slice(meta.start, meta.end)).equals(body);
        }
      });
    } finally { await mod.unload(); await file.remove(); }
  });

  it('checkpoints an async child independently of its completed synchronous caller', async () => {
    const file = resource('local://async-child-checkpoint/task.js'), mod = System.get('@lively-env').moduleEnv(file.url);
    const runtime = installModuleDebugger(System), open = runtime.open, automatic = System.debuggerInterception, stops = [];
    mod.retainRuntimeClosures = true;
    runtime.open = (continuation, callbacks) => { stops.push({continuation, callbacks}); };
    System.debuggerInterception = true;
    try {
      await file.write('export let release; export async function child() { debugger;' +
        ' let value = await new Promise(resolve => release = resolve); debugger; return value + 1; }' +
        ' export function task() { return {pending: child(), returned: true}; }');
      const result = (await System.import(file.url)).task();
      expect(result instanceof Promise, 'synchronous caller finishes immediately').equals(false);
      expect(result.returned).equals(true);
      expect(result.pending).instanceOf(Promise);
      expect(stops).length(1);
      const {continuation, callbacks} = stops.shift();
      expect(continuation.frames(), 'async boundary excludes the completed caller').length(1);
      let checkpoint;
      continuation.onSuspend = pending => { checkpoint = serialize(pending); };
      const waiting = continuation.resume(), restored = deserialize(checkpoint);
      expect(restored.frames()).length(1);
      restored.supplyAwaitResult(5);
      expect(restored.resume().resume()).equals(6);
      mod.recorder.release(5);
      callbacks.onComplete((await waiting).resume());
      expect(await result.pending).equals(6);
    } finally {
      runtime.open = open;
      System.debuggerInterception = automatic;
      await mod.unload();
      await file.remove();
    }
  });

  it('saves a pending await as a checkpoint and accepts its result without issuing the operation twice', () => {
    const receiver = {calls: 0, later () { this.calls++; return new Promise(() => {}); }};
    const stopped = run(fn('async function task() { debugger; let value = await this.later(); return value + this.calls; }'), null, [],
      {this: receiver});
    let pending;
    try { new Interpreter({captureErrors: true}).runFromPC(stopped.currentFrame); } catch (error) {
      pending = Continuation.fromUnwindException(error);
    }
    expect(pending.reason).equals('await');
    const restored = deserialize(serialize(pending));
    expect([restored.reason, restored.error, restored.currentFrame.getThis().calls]).deep.equals(['await', undefined, 1]);
    restored.supplyAwaitResult(5);
    expect(restored.resume()).equals(6);
  });

  it('restores receivers, shared closure cells and computed effects through the existing serializer', () => {
    const receiver = {visits: 0, total: 0};
    const stopped = run(fn('function task() { this.visits++; let value = 2; const receiver = this; let read = () => value; debugger;' +
      ' receiver.total = read(); return receiver.total; }'), null, [], {this: receiver});
    const restored = deserialize(serialize({receiver, stopped})), frame = restored.stopped.currentFrame;
    expect(frame.getThis()).equals(restored.receiver);
    expect(restored.receiver.visits).equals(1);
    frame.getScope().findScope('value').scope.set('value', 7);
    expect(frame.lookup('read')()).equals(7);
    expect(() => frame.getScope().findScope('receiver').scope.set('receiver', {})).to.throw(TypeError);
    expect(restored.stopped.resume()).equals(7);
    expect(restored.receiver).deep.equals({visits: 1, total: 7});
  });

  it('captures only used lexical values in rewritten closures and keeps created closures collectable', async () => {
    const unused = {secret: true}, rewritten = stackCaptureMode(fn('() => 3'), {this: unused, arguments: [unused]});
    const make = stackCaptureMode(fn('function make() { return [() => 3, () => this.value]; }'));
    for (const callback of [rewritten, make.call({})[0]]) {
      expect([owns(callback, '_lexicalThis'), owns(callback, '_lexicalArguments')], 'unused lexical values are not retained')
        .deep.equals([false, false]);
      expect(callback()).equals(3);
    }
    const weak = (() => {
      const receiver = {value: 7}, callback = make.call(receiver)[1];
      expect(callback()).equals(7);
      return [new WeakRef(callback), new WeakRef(receiver)];
    })();
    await collectGarbage();
    expect(weak.map(ref => ref.deref()), 'the AST registry retains neither the finished closure nor its receiver')
      .deep.equals([undefined, undefined]);
  });

  it('interns rewritten code across transient closures without sharing captures', () => {
    const registry = getCurrentASTRegistry();
    let firstAst, length;
    for (let i = 0; i < 100; i++) {
      const closure = asRewrittenClosure(fn('function read() { return value; }'), {value: i}, registry);
      expect(closure.getRewrittenFunc()(), 'cached code uses this invocation binding').equals(i);
      if (!i) { firstAst = closure.originalAst; length = registry['[runtime]'].length; }
      expect(closure.originalAst, 'equivalent runtime code reuses its parsed AST').equals(firstAst);
      expect(registry['[runtime]'].length, 'repeated code does not grow the AST registry').equals(length);
    }
    expect(asRewrittenClosure(fn('function read() { return value; }'), {value: 7, other: 1}, registry).getRewrittenFunc()()).equals(7);
  });

  it('reclaims transient runtime AST slots and reuses them without losing live code', async () => {
    const previous = getCurrentASTRegistry(), registry = {};
    setCurrentASTRegistry(registry);
    try {
      const live = stackCaptureMode(fn('function live() { return 7; }'), {}, registry);
      const compile = start => {
        for (let i = start; i < start + 300; i++) stackCaptureMode(fn('function transient() { return ' + i + '; }'), {}, registry);
      };
      compile(0);
      const size = registry['[runtime]'].length;
      await collectGarbage();
      expect(registry['[runtime]'].filter(Boolean).length, 'dead runtime ASTs leave the registry').lessThan(10);
      compile(300);
      expect(registry['[runtime]'].length, 'new code reuses dead registry slots').at.most(size + 2);
      expect(live(), 'live rewritten code keeps its AST slots').equals(7);
    } finally { setCurrentASTRegistry(previous); }
  });
});
