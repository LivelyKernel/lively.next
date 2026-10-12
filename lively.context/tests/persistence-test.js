/* global describe, it */
import { expect } from 'mocha-es6';
import { serialize, deserialize, ObjectPool, ExpressionSerializer } from '../../lively.serializer2/index.js';
import { run, Continuation } from '../lib/stackReification.js';
import { resumeInspectorContinuation } from '../lib/inspector-interpreter.js';
import { Interpreter } from '../lib/interpreter.js';

const fn = source => globalThis.Function('return (' + source + ')')();

function nativeCallbacks(receiver) {
  let value = 2;
  return {read: () => value, increment: () => ++value, write: next => receiver.value = next};
}

class SnapshotBase {
  value() { return this.amount; }
  get doubled() { return this.amount * 2; }
  static value() { return this.amount; }
}

class SnapshotChild extends SnapshotBase {
  create(offset) { return () => super.value() + offset; }
  callback = () => super.doubled;
  static create(offset) { return () => super.value() + offset; }
}

class SnapshotGrandchild extends SnapshotChild {
  value() { return 1000; }
  static value() { return 1000; }
}

describe('suspended continuation persistence', function () {
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
    const restored = deserialize(JSON.parse(JSON.stringify(serialize({receiver, callback, alias: callback, borrowedReceiver, borrowed}))));
    expect(restored.callback).equals(restored.alias);
    expect(restored.callback()).equals(5);
    expect(restored.borrowed.call({amount: 1000})).equals(9);
    restored.receiver.amount = 7;
    restored.borrowedReceiver.amount = 8;
    expect(restored.callback()).equals(9);
    expect(restored.borrowed()).equals(13);
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
      const restored = deserialize(JSON.parse(JSON.stringify(serialize({receiver, callback}))));
      expect(restored.receiver.callback()).equals(6);
      expect(restored.callback()).equals(9);
      restored.receiver.amount = 7;
      SnapshotGrandchild.amount = 8;
      expect(restored.receiver.callback()).equals(14);
      expect(restored.callback.call({amount: 1000})).equals(13);
    } finally { delete SnapshotGrandchild.amount; }
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
