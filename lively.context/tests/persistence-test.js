/* global System, describe, before, after, it */
import { expect } from 'mocha-es6';
import { resource } from '../../lively.resources/index.js';
import { serialize, deserialize, ObjectPool, ExpressionSerializer } from '../../lively.serializer2/index.js';
import { run, Continuation } from '../lib/stackReification.js';
import { resumeInspectorContinuation } from '../lib/inspector-interpreter.js';
import { Interpreter } from '../lib/interpreter.js';
import { declaringClassCell } from '../lib/exception.js';

const fn = source => globalThis.Function('return (' + source + ')')();
const roundTrip = value => deserialize(JSON.parse(JSON.stringify(serialize(value))));

describe('suspended continuation persistence', function () {
  let nativeCallbacks, SnapshotChild, SnapshotGrandchild, localClassFactories, fixture;
  before(async () => {
    fixture = System.get('@lively-env').moduleEnv(System.decanonicalize('lively.context/tests/fixtures/persistence-callbacks.js'));
    fixture.retainRuntimeClosures = true;
    ({nativeCallbacks, SnapshotChild, SnapshotGrandchild, localClassFactories} = await fixture.load());
  });
  after(() => fixture.unload());

  it('restores native callbacks in the same object pool with shared cells and receivers', function () {
    const receiver = {value: 0};
    const callbacks = nativeCallbacks(receiver);
    const pool = ObjectPool.withDefaultPlugins();
    const snapshot = serialize({receiver, ...callbacks, alias: callbacks.increment}, {objPool: pool});
    const restored = deserialize(JSON.parse(JSON.stringify(snapshot)));
    expect(restored.increment).equals(restored.alias);
    expect(restored.read()).equals(2);
    expect(restored.increment()).equals(3);
    expect(restored.read()).equals(3);
    restored.write(7);
    expect(restored.receiver.value).equals(7);
    expect(receiver.value).equals(0);
    expect(pool.ref(callbacks.increment).id).equals(snapshot.snapshot[snapshot.id].props.alias.value.id);
  });

  it('restores a native callback saved as the snapshot root', function () {
    const callback = nativeCallbacks({value: 0}).increment;
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(callback))));
    expect(restored()).equals(3);
    expect(restored()).equals(4);
  });

  it('keeps callback aliases, shared cells and receivers through three save/load generations', function () {
    const receiver = {value: 0};
    const callbacks = nativeCallbacks(receiver);
    let state = {receiver, ...callbacks, alias: callbacks.increment};
    for (let generation = 1; generation <= 3; generation++) {
      state = roundTrip(state);
      expect(state.increment).equals(state.alias);
      expect(state.read()).equals(generation + 1);
      expect(state.increment()).equals(generation + 2);
      expect(state.read()).equals(generation + 2);
      state.write(generation);
      expect(state.receiver.value).equals(generation);
    }
    expect(receiver.value).equals(0);
  });

  it('restores a class super callback with its declaring class and lexical receiver', function () {
    const receiver = new SnapshotGrandchild();
    receiver.amount = 3;
    const callback = receiver.create(2);
    const borrowedReceiver = {amount: 4};
    const borrowed = SnapshotChild.prototype.create.call(borrowedReceiver, 5);
    expect(callback()).equals(5);
    expect(borrowed()).equals(9);
    const cell = callback[Symbol.for('lively-debug-bindings')][Symbol.for('lively-debug-binding-cells')].__lively_class__;
    const expressions = new ExpressionSerializer();
    expect(expressions.deserializeExpr(expressions.embedValue(cell)).value).equals(SnapshotChild);
    let restored = {receiver, callback, alias: callback, borrowedReceiver, borrowed};
    for (let generation = 1; generation <= 3; generation++) {
      restored = roundTrip(restored);
      expect(restored.callback).equals(restored.alias);
      restored.receiver.amount = generation + 3;
      restored.borrowedReceiver.amount = generation + 4;
      expect(restored.callback()).equals(generation + 5);
      expect(restored.borrowed.call({amount: 1000})).equals(generation + 9);
    }
    expect(receiver.amount).equals(3);
  });

  it('restores super callbacks created in class fields and static methods', function () {
    const receiver = new SnapshotChild();
    receiver.amount = 3;
    SnapshotGrandchild.amount = 4;
    try {
      const callback = SnapshotGrandchild.create(5);
      expect(receiver.callback()).equals(6);
      expect(callback()).equals(9);
      let restored = {receiver, callback};
      for (let generation = 1; generation <= 3; generation++) {
        restored = roundTrip(restored);
        restored.receiver.amount = generation + 3;
        SnapshotGrandchild.amount = generation + 4;
        expect(restored.receiver.callback()).equals((generation + 3) * 2);
        expect(restored.callback.call({amount: 1000})).equals(generation + 9);
      }
    } finally { delete SnapshotGrandchild.amount; }
  });

  it('rejects anonymous and factory declaring classes without an exact module reference at save', function () {
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
    expect(() => serialize(declaringClassCell(impostor))).to.throw(/declaring class.*no stable module reference/);
  });

  it('shares full module source across saved callbacks without changing historical source after edits', async function () {
    const id = 'local://closure-persistence/source.js';
    const file = resource(id);
    const mod = System.get('@lively-env').moduleEnv(id);
    mod.retainRuntimeClosures = true;
    const padding = 'preserved module source '.repeat(1600);
    const original = 'export function make(value) { return () => value + 1; }\n/*' + padding + '*/';
    const edited = 'const prefix = 0;\nexport function make(value) { return () => value + 2; }\n/*' + padding + '*/';
    try {
      await file.write(original);
      const {make} = await System.import(id);
      const ten = JSON.stringify(serialize(Array.from({length: 10}, () => make(1))));
      const fifty = JSON.stringify(serialize(Array.from({length: 50}, () => make(1))));
      expect((fifty.length - ten.length) / 40).lessThan(original.length / 4);
      const old = make(1);
      await mod.changeSource(edited, {doSave: false});
      const makeCurrent = mod.recorder.make;
      let state = {old, current: makeCurrent(1)};
      for (let generation = 1; generation <= 3; generation++) {
        state = roundTrip(state);
        expect(state.old()).equals(2);
        expect(state.current()).equals(3);
        const oldMeta = state.old.interpretedFunction.runtimeObjectMeta;
        const currentMeta = state.current.interpretedFunction.runtimeObjectMeta;
        expect(oldMeta.moduleSource).equals(original);
        expect(currentMeta.moduleSource).equals(edited);
        expect(oldMeta.moduleSource.slice(oldMeta.start, oldMeta.end)).equals('() => value + 1');
        expect(currentMeta.moduleSource.slice(currentMeta.start, currentMeta.end)).equals('() => value + 2');
      }
    } finally { await mod.unload(); await file.remove(); }
  });

  it('exposes the pending child stack while Proceed waits for an external result', function () {
    const receiver = {calls: 0, child: fn('async function child() { this.calls++; let value = await new Promise(() => {}); debugger; return value; }')};
    const stopped = run(fn('function task() { debugger; return this.child() + 1; }'), null, [], {this: receiver});
    let checkpoint;
    stopped.onSuspend = pending => { checkpoint = serialize(pending); };
    resumeInspectorContinuation(stopped);
    const restored = deserialize(checkpoint);
    expect(restored.frames()).length(2);
    expect(restored.currentFrame.getThis().calls).equals(1);
    restored.supplyAwaitResult(5);
    const atDebugger = resumeInspectorContinuation(restored);
    expect(resumeInspectorContinuation(atDebugger)).equals(6);
  });
  it('restores an array iteration without repeating reads or completed iterations', function () {
    const receiver = {log: []};
    const stopped = run(fn('function task() { for (let value of [1, 2, 3]) { this.log.push(value); if (value === 2) debugger; } return this.log; }'), null, [], {this: receiver});
    const restored = deserialize(serialize(stopped));
    const result = resumeInspectorContinuation(restored);
    expect(result).deep.equals([1, 2, 3]);
  });

  it('saves a pending await as a checkpoint and accepts its result without issuing the operation twice', function () {
    const receiver = {calls: 0, later() { this.calls++; return new Promise(() => {}); }};
    const stopped = run(fn('async function task() { debugger; let value = await this.later(); return value + this.calls; }'), null, [], {this: receiver});
    let pending;
    try { new Interpreter({captureErrors: true}).runFromPC(stopped.currentFrame); }
    catch (error) { pending = Continuation.fromUnwindException(error); }
    expect(pending.reason).equals('await');
    const restored = deserialize(serialize(pending));
    expect(restored.reason).equals('await');
    expect(restored.error).equals(undefined);
    expect(restored.currentFrame.getThis().calls).equals(1);
    restored.supplyAwaitResult(5);
    expect(resumeInspectorContinuation(restored)).equals(6);
  });
  it('restores receivers, shared closure cells and computed effects through the existing serializer', function () {
    const receiver = {visits: 0, total: 0};
    const stopped = run(fn('function task() { this.visits++; let value = 2; const receiver = this; let read = () => value; debugger; receiver.total = read(); return receiver.total; }'), null, [], {this: receiver});
    const restored = deserialize(serialize({receiver, stopped}));
    expect(restored.stopped.currentFrame.getThis()).equals(restored.receiver);
    expect(restored.receiver.visits).equals(1);
    const frame = restored.stopped.currentFrame;
    frame.getScope().findScope('value').scope.set('value', 7);
    expect(frame.lookup('read')()).equals(7);
    expect(() => frame.getScope().findScope('receiver').scope.set('receiver', {})).to.throw(TypeError);
    expect(resumeInspectorContinuation(restored.stopped)).equals(7);
    expect(restored.receiver.total).equals(7);
    expect(restored.receiver.visits).equals(1);
  });

  it('restores both frames and a pending caller result without repeating the child', function () {
    const stopped = run(fn('function task() { let value = 2; function child() { value++; debugger; return value; } return child() + 1; }'));
    const restored = deserialize(serialize(stopped));
    expect(restored.frames()).length(2);
    expect(resumeInspectorContinuation(restored)).equals(4);
  });
});
