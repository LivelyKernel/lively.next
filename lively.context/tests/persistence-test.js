/* global describe, it */
import { expect } from 'mocha-es6';
import { serialize, deserialize } from '../../lively.serializer2/index.js';
import { run, Continuation } from '../lib/stackReification.js';
import { resumeInspectorContinuation } from '../lib/inspector-interpreter.js';
import { Interpreter } from '../lib/interpreter.js';

const fn = source => globalThis.Function('return (' + source + ')')();

describe('suspended continuation persistence', function () {
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
