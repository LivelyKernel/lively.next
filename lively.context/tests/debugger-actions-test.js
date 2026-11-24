"format esm";
/*global describe, it*/
import { expect } from 'mocha-es6';
import { run } from '../lib/stackReification.js';

describe('rewritten debugger actions', function () {
  function capturedCounter () {
    const receiver = { count: 0, step: '1', pause: true, updateCount () {} };
    const increment = globalThis.Function('return function increment() { var amount = this.step; if (this.pause) debugger; this.count += Number(amount); this.updateCount(); return this.count; }')();
    return { receiver, continuation: run(increment, null, [], { this: receiver }) };
  }

  it('steps past a conditional debugger without completing the function', function () {
    const { receiver, continuation } = capturedCounter();
    const stepped = continuation.stepOver();
    expect(stepped.isContinuation).equals(true);
    expect(stepped.currentFrame.getPC().type).equals('ExpressionStatement');
    expect(receiver.count).equals(0);
    expect(stepped.resume()).equals(1);
  });

  it('keeps the captured else branch when its condition changes while suspended', function () {
    const receiver = { condition: false, count: 0 };
    const fn = globalThis.Function('return function compute() { if (this.condition) this.count = 99; else { debugger; this.count += 1; } return this.count; }')();
    const continuation = run(fn, null, [], { this: receiver });
    receiver.condition = true;
    const stepped = continuation.stepOver();
    expect(stepped.isContinuation).equals(true);
    expect(receiver.count).equals(0);
    expect(stepped.resume()).equals(1);
  });

  it('keeps a branch entered by the interpreter after restarting a frame', function () {
    const { receiver, continuation } = capturedCounter();
    const restarted = continuation.restartFrame();
    const stopped = restarted.resume();
    receiver.pause = false;
    const stepped = stopped.stepOver();
    expect(stepped.isContinuation).equals(true);
    expect(receiver.count).equals(0);
    expect(stepped.resume()).equals(1);
  });

  it('keeps evaluation errors during stepping in a recoverable continuation', function () {
    const fn = globalThis.Function('return function compute() { debugger; unavailableDebuggerBinding(); }')();
    const stepped = run(fn).stepOver();
    const failed = stepped.stepOver();
    expect(failed.isContinuation).equals(true);
    expect(failed.exception).instanceOf(ReferenceError);
  });

  it('restarts and resumes a rewritten frame without losing its pc or receiver', function () {
    const { receiver, continuation } = capturedCounter();
    const restarted = continuation.restartFrame();
    expect(restarted.isContinuation).equals(true);
    expect(restarted.currentFrame.getPC().type).equals('VariableDeclaration');
    expect(restarted.currentFrame.getThis()).equals(receiver);
    const stopped = restarted.resume();
    expect(stopped.isContinuation).equals(true);
    expect(stopped.resume()).equals(1);
  });

  it('restarts a method containing the let declaration produced by the Object Editor', function () {
    const receiver = { step: '1', count: 0 };
    const increment = globalThis.Function('return function increment() { let amount = Number(this.step); debugger; this.count += amount; return this.count; }')();
    const continuation = run(increment, null, [], { this: receiver, Number });
    const restarted = continuation.restartFrame();
    expect(restarted.isContinuation).equals(true);
    expect(restarted.currentFrame.getPC().type).equals('VariableDeclaration');
    const stopped = restarted.resume();
    expect(stopped.isContinuation).equals(true);
    expect(stopped.resume()).equals(1);
  });

  it('restarts the saved replacement method on the same receiver with original arguments', function () {
    const receiver = { count: 0 };
    const original = globalThis.Function('return function old_increment(delta) { let amount = delta; debugger; this.count += amount; return this.count; }')();
    original.displayName = 'increment';
    receiver.increment = original;
    const continuation = run(original, null, [2], { this: receiver });
    receiver.increment = globalThis.Function('return function new_increment(delta) { let amount = delta * 3; debugger; this.count += amount; return this.count; }')();
    receiver.increment.displayName = 'increment';
    const restarted = continuation.restartFrame();
    expect(restarted.currentFrame.func.getSource()).includes('delta * 3');
    expect(restarted.currentFrame.getThis()).equals(receiver);
    const stopped = restarted.resume();
    expect(stopped.currentFrame.lookup('amount')).equals(6);
    expect(stopped.resume()).equals(6);
    expect(receiver.count).equals(6);
  });
});
