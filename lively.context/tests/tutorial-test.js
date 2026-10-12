/* global describe, it */
import { expect } from 'mocha-es6';
import { run } from '../lib/stackReification.js';
import { restartInspectorFrame, resumeInspectorContinuation, stepInspectorContinuation,
  stepOutInspectorContinuation, returnFromInspectorFrame, applySavedInspectorMethod,
  runToInspectorPosition } from '../lib/inspector-interpreter.js';

const fn = source => globalThis.Function('return (' + source + ')')();

describe('Smalltalk debugger tutorial', function () {
  it('rewrites method closure bindings after removing native compiler annotations', function () {
    const source = 'function task() { const _debugCell = {get value() { return value; }}; let value = 2; const read = __lvVarRecorder.System.get("@lively-env").moduleEnv("example.js").recordDebugClosure(() => value, {value: _debugCell}, 0, 1, __lvOriginalCode, "read"); debugger; value = 4; return read(); }';
    const stopped = run(fn(source));
    expect(stopped.exception).equals(undefined);
    expect(stopped.currentFrame.lookup('read')()).equals(2);
    expect(resumeInspectorContinuation(stopped)).equals(4);
  });
  it('reports a missing callee without replacing the error with inspector internals', function () {
    const stopped = run(fn('function task() { debugger; return this.convert(2); }'), null, [], {this: {}});
    const failed = resumeInspectorContinuation(stopped);
    expect(failed.isContinuation).equals(true);
    expect(failed.exception).instanceOf(TypeError);
    expect(failed.exception.message).not.contains('toString');
    failed.currentFrame.getThis().convert = value => value * 3;
    expect(resumeInspectorContinuation(failed)).equals(6);
  });

  it('resumes for of without replaying iterator advancement and retains each iteration binding', function () {
    const log = [];
    const stopped = run(fn('function task() { let reads = []; for (const value of [1, 2, 3]) { log.push(value); reads.push(() => value); if (value === 2) debugger; } return reads.map(read => read()); }'), null, [], {log});
    expect(stopped.isContinuation).equals(true);
    expect(stopped.exception).equals(undefined);
    expect(stopped.currentFrame.lookup('value')).equals(2);
    expect(log).deep.equals([1, 2]);
    expect(resumeInspectorContinuation(stopped)).deep.equals([1, 2, 3]);
    expect(log).deep.equals([1, 2, 3]);
  });

  it('closes an iterator on a caught exception but keeps it open while suspended', function () {
    const source = {closes: 0, [Symbol.iterator]() {
      return {next: () => ({value: 1, done: false}), return: () => { this.closes++; return {}; }};
    }};
    for (const body of ['throw new Error("stop")', 'function fail() { throw new Error("stop"); } fail()']) {
      source.closes = 0;
      const result = run(fn('function task() { try { for (const value of source) { ' + body + '; } } catch (error) {} return source.closes; }'), null, [], {source});
      expect(result.returnValue).equals(1);
    }
    source.closes = 0;
    const stopped = run(fn('function task() { for (const value of source) { debugger; break; } return source.closes; }'), null, [], {source});
    expect(source.closes).equals(0);
    expect(resumeInspectorContinuation(stopped)).equals(1);
    source.closes = 0;
    const caught = run(fn('function task() { try { for (const value of source) { debugger; throw new Error("stop"); } } catch (error) {} return source.closes; }'), null, [], {source});
    expect(resumeInspectorContinuation(caught)).equals(1);
  });

  it('steps through object spread while retaining computed keys and copied values', function () {
    let reads = 0;
    const source = {get amount() { reads++; return 2; }};
    const stopped = run(fn('function task() { debugger; const result = {before: 1, ...source, ["after"]: 3}; return result; }'), null, [], {source});
    const next = stepInspectorContinuation(stopped);
    expect(resumeInspectorContinuation(next)).deep.equals({before: 1, amount: 2, after: 3});
    expect(reads).equals(1);
  });

  it('runs to an await statement without starting its operation', async function () {
    let calls = 0;
    const stopped = run(fn('async function task() {\n debugger;\n let first = await later();\n let second = await later();\n return first + second;\n}'), null, [], {later: () => { calls++; return Promise.resolve(3); }});
    const target = await runToInspectorPosition(stopped, 4);
    expect(target.isContinuation).equals(true);
    expect(target.currentFrame.getPC().loc.start.line).equals(4);
    expect(calls).equals(1);
    expect(await resumeInspectorContinuation(target)).equals(6);
    expect(calls).equals(2);
  });

  it('repairs an uncaught missing method and retries without repeating completed effects', function () {
    const receiver = { visits: 0 };
    const stopped = run(fn('function task() { this.visits++; return this.missing(2); }'), null, [], { this: receiver });
    expect(stopped.isContinuation).equals(true);
    expect(stopped.exception).instanceOf(TypeError);
    receiver.missing = value => value * 3;
    expect(resumeInspectorContinuation(stopped)).equals(6);
    expect(receiver.visits).equals(1);
  });

  it('keeps the active child when proceeding while inspecting a caller', function () {
    const receiver = {visits: 0};
    const stopped = run(fn('function task() { function child() { receiver.visits++; debugger; return 3; } return child() + 2; }'), null, [], {receiver});
    expect(stopped.frames()).length(2);
    expect(resumeInspectorContinuation(stopped, { startFrame: stopped.frames()[1] })).equals(5);
    expect(receiver.visits).equals(1);
  });

  it('returns an override value from a child to its suspended caller', function () {
    const stopped = run(fn('function task() { function child() { debugger; throw new Error("skip"); } return child() + 2; }'));
    const caller = returnFromInspectorFrame(stopped, 7);
    expect(resumeInspectorContinuation(caller)).equals(9);
  });

  it('preserves block shadowing and shared closure bindings after stepping', function () {
    const stopped = run(fn('function task() { let amount = 1; let read; { let amount = 2; read = function() { return amount; }; debugger; amount = 4; } return [amount, read()]; }'));
    expect(stopped.currentFrame.lookup('amount')).equals(2);
    stopped.currentFrame.getScope().findScope('amount').scope.set('amount', 3);
    expect(stopped.currentFrame.lookup('read')()).equals(3);
    expect(resumeInspectorContinuation(stepInspectorContinuation(stopped))).deep.equals([1, 4]);
  });

  it('enforces const writes while allowing object mutation', function () {
    const stopped = run(fn('function task() { const item = { count: 1 }; debugger; return item.count; }'));
    const scope = stopped.currentFrame.getScope().findScope('item').scope;
    expect(() => scope.set('item', {})).to.throw(TypeError);
    scope.get('item').count = 5;
    expect(resumeInspectorContinuation(stopped)).equals(5);
  });

  it('initializes a lexical declaration after suspension and preserves the temporal dead zone', function () {
    const stopped = run(fn('function task() { debugger; let amount = 2; return amount; }'));
    expect(() => stopped.currentFrame.lookup('amount')).to.throw(ReferenceError);
    expect(resumeInspectorContinuation(stopped)).equals(2);
  });

  it('restarts a block frame using original arguments and its outer environment', function () {
    const stopped = run(fn('function task(arg) { let outer = arg; { let inner = 2; debugger; } return outer; }'), null, [3]);
    const restarted = restartInspectorFrame(stopped);
    const paused = resumeInspectorContinuation(restarted);
    expect(paused.currentFrame.lookup('inner')).equals(2);
    expect(resumeInspectorContinuation(paused)).equals(3);
  });

  it('steps out of a child and stops before executing its caller', function () {
    const receiver = { count: 0 };
    const stopped = run(fn('function task() { function child() { debugger; return 3; } let value = child(); this.count += value; return this.count; }'), null, [], { this: receiver });
    const caller = stepOutInspectorContinuation(stopped);
    expect(caller.isContinuation).equals(true);
    expect(receiver.count).equals(0);
    expect(resumeInspectorContinuation(caller)).equals(3);
  });

  it('steps into an ordinary receiver method and retains the caller result', function () {
    const receiver = { child: fn('function child(value) { let doubled = value * 2; return doubled; }') };
    let stopped = run(fn('function task() { debugger; return this.child(3) + 1; }'), null, [], {this: receiver});
    stopped = stepInspectorContinuation(stopped);
    stopped = stepInspectorContinuation(stopped, {action: 'stepInto'});
    if (stopped.exception) throw stopped.exception;
    expect(stopped.frames()).length(2);
    expect(stopped.currentFrame.getThis()).equals(receiver);
    expect(resumeInspectorContinuation(stopped)).equals(7);
  });

  it('applies an edit to unexecuted code without replaying earlier side effects', function () {
    const receiver = {count: 0};
    receiver.task = fn('function task() { this.count++; let amount = 2; debugger; this.count += amount; return this.count; }');
    const stopped = run(receiver.task, null, [], {this: receiver});
    receiver.task = fn('function task() { this.count++; let amount = 2; debugger; this.count += amount * 3; return this.count; }');
    expect(resumeInspectorContinuation(applySavedInspectorMethod(stopped))).equals(7);
    expect(receiver.count).equals(7);
  });

  it('rejects changing executed code while preserving the original suspended frame', function () {
    const receiver = {count: 0};
    receiver.task = fn('function task() { this.count++; debugger; return this.count; }');
    const stopped = run(receiver.task, null, [], {this: receiver});
    receiver.task = fn('function task() { this.count += 2; debugger; return this.count; }');
    expect(() => applySavedInspectorMethod(stopped)).to.throw(/Restart Frame/);
    expect(resumeInspectorContinuation(stopped)).equals(1);
  });

  it('runs to a source line without executing that line', function () {
    const receiver = {count: 0};
    const stopped = run(fn('function task() {\n debugger;\n this.count++;\n this.count += 2;\n return this.count;\n}'), null, [], {this: receiver});
    const target = runToInspectorPosition(stopped, 4);
    expect(target.currentFrame.getPC().loc.start.line).equals(4);
    expect(receiver.count).equals(1);
    expect(resumeInspectorContinuation(target)).equals(3);
  });

  it('keeps per-iteration let bindings shared with the correct escaping closure', function () {
    const stopped = run(fn('function task() { let reads = []; for (let i = 0; i < 3; i++) { reads.push(function() { return i; }); if (i === 1) debugger; } return reads.map(function(read) { return read(); }); }'));
    expect(stopped.currentFrame.lookup('i')).equals(1);
    expect(resumeInspectorContinuation(stopped)).deep.equals([0, 1, 2]);
  });

  it('suspends before and after await while the surrounding timer keeps running', async function () {
    let ticks = 0;
    const later = () => new Promise(resolve => setTimeout(() => { ticks++; resolve(3); }, 5));
    const stopped = run(fn('async function task() { debugger; let amount = await later(); debugger; return amount + 2; }'), null, [], {later});
    const after = await resumeInspectorContinuation(stopped);
    expect(after.isContinuation).equals(true);
    expect(ticks).equals(1);
    expect(after.currentFrame.lookup('amount')).equals(3);
    expect(await resumeInspectorContinuation(after)).equals(5);
  });

  it('opens a recoverable exception when an awaited promise rejects', async function () {
    const failure = new Error('offline');
    const stopped = await run(fn('async function task() { const value = await later(); return value; }'), null, [], {later: () => Promise.reject(failure)});
    expect(stopped.isContinuation).equals(true);
    expect(stopped.exception).equals(failure);
    expect(returnFromInspectorFrame(stopped, 7)).equals(7);
  });

  it('keeps catch and finally dormant during await and debugger suspension', async function () {
    const receiver = {caught: 0, cleanups: 0};
    const task = fn('async function task() { try { await later(); debugger; } catch (error) { this.caught++; } finally { this.cleanups++; } return this.cleanups; }');
    const stopped = await run(task, null, [], {this: receiver, later: () => Promise.resolve(3)});
    expect(stopped.isContinuation).equals(true);
    expect(receiver.caught).equals(0);
    expect(receiver.cleanups).equals(0);
    expect(await resumeInspectorContinuation(stopped)).equals(1);
    expect(receiver.cleanups).equals(1);
  });

  it('initializes a new future local after applying a saved method', function () {
    const receiver = {};
    receiver.task = fn('function task() { debugger; return 1; }');
    const stopped = run(receiver.task, null, [], {this: receiver});
    receiver.task = fn('function task() { debugger; let amount = 3; return amount; }');
    expect(resumeInspectorContinuation(applySavedInspectorMethod(stopped))).equals(3);
  });

  it('returns from the final child statement when stepping over it', function () {
    let stopped = run(fn('function task() { function child() { debugger; return 3; } return child() + 2; }'));
    stopped = stepInspectorContinuation(stopped);
    const caller = stepInspectorContinuation(stopped);
    expect(caller.isContinuation).equals(true);
    expect(caller.frames()).length(1);
    expect(resumeInspectorContinuation(caller)).equals(5);
  });

  it('restarts a frame stopped in catch without retaining its old function locals', function () {
    const stopped = run(fn('function task(value) { let local = value; try { throw new Error("test"); } catch(error) { debugger; } return local; }'), null, [3]);
    const restarted = restartInspectorFrame(stopped);
    const caught = resumeInspectorContinuation(restarted);
    expect(caught.currentFrame.lookup('local')).equals(3);
    expect(resumeInspectorContinuation(caught)).equals(3);
  });

  it('honors a nested rewritten debugger when proceeding from its caller', function () {
    const first = run(fn('function task() { function child() { debugger; return 3; } debugger; return child() + 2; }'));
    const child = resumeInspectorContinuation(first);
    expect(child.isContinuation).equals(true);
    expect(child.frames()).length(2);
    expect(resumeInspectorContinuation(child)).equals(5);
  });

  it('honors a saved receiver method debugger while stepping over its call', function () {
    const receiver = {child: fn('function child() { debugger; return 3; }')};
    let stopped = run(fn('function task() { debugger; return this.child() + 2; }'), null, [], {this: receiver});
    stopped = stepInspectorContinuation(stopped);
    stopped = stepInspectorContinuation(stopped);
    expect(stopped.frames()).length(2);
    expect(resumeInspectorContinuation(stopped)).equals(5);
  });

  it('keeps lexical self and arguments in an arrow block despite call rebinding', function () {
    const receiver = {count: 4};
    const stopped = run(fn('function task(value) { const block = extra => { debugger; return this.count + arguments[0] + extra; }; return block.call({count: 99}, 2); }'), null, [3], {this: receiver});
    expect(stopped.currentFrame.getThis()).equals(receiver);
    expect(stopped.currentFrame.lookup('arguments')[0]).equals(3);
    expect(resumeInspectorContinuation(stopped)).equals(9);
  });

  it('steps into an expression arrow created after the original suspension', function () {
    const receiver = {count: 4};
    let stopped = run(fn('function task() { debugger; const block = extra => this.count + extra; return block.call({count: 99}, 2); }'), null, [], {this: receiver});
    stopped = stepInspectorContinuation(stopped);
    stopped = stepInspectorContinuation(stopped);
    stopped = stepInspectorContinuation(stopped, {action: 'stepInto'});
    expect(stopped.currentFrame.getThis()).equals(receiver);
    expect(resumeInspectorContinuation(stopped)).equals(6);
  });

  it('uses the debug Array.some replacement with undefined values and sparse holes', function () {
    const result = run(fn('function task() { return [[undefined].some(function() { return true; }), Array(1).some(function() { throw new Error("hole"); })]; }'));
    expect(result.returnValue).deep.equals([true, false]);
  });

  it('accepts editor formatting changes when applying unexecuted code', function () {
    const receiver = {count: 0};
    receiver.task = fn('function task() { this.count++; let amount = 2; debugger; return amount; }');
    const stopped = run(receiver.task, null, [], {this: receiver});
    receiver.task = fn('function task() {\n this.count++;\n let amount = 2;\n debugger;\n return amount * 3;\n}');
    expect(resumeInspectorContinuation(applySavedInspectorMethod(stopped))).equals(6);
    expect(receiver.count).equals(1);
  });

  it('runs an arrow entry point with explicitly supplied lexical receiver and arguments', function () {
    const receiver = {count: 4};
    const stopped = run(fn('value => { let local = value; debugger; return this.count + local + arguments[0]; }'), null, [2], {this: receiver, arguments: [3]});
    expect(stopped.currentFrame.getThis()).equals(receiver);
    expect(resumeInspectorContinuation(stopped)).equals(9);
  });

  it('applies saved source to an ordinary method reached through Step Into', function () {
    const receiver = {visits: 0, child: fn('function child() { this.visits++; let amount = 2; debugger; return amount; }')};
    let stopped = run(fn('function task() { debugger; return this.child(); }'), null, [], {this: receiver});
    stopped = stepInspectorContinuation(stopped);
    stopped = stepInspectorContinuation(stopped, {action: 'stepInto'});
    stopped = stepInspectorContinuation(stopped);
    stopped = stepInspectorContinuation(stopped);
    receiver.child = fn('function child() {\n this.visits++;\n let amount = 2;\n debugger;\n return amount * 3;\n}');
    expect(resumeInspectorContinuation(applySavedInspectorMethod(stopped))).equals(6);
    expect(receiver.visits).equals(1);
  });
});
