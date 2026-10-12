"format esm";
/*global describe, it, beforeEach*/
import { expect } from 'mocha-es6';
import { InspectorRegistry } from '../lib/inspector-runtime.js';
import { run } from '../lib/stackReification.js';
import {
  materializeInspectorContinuation,
  restartInspectorFrame,
  resumeInspectorContinuation,
  stepOutInspectorContinuation,
  stepInspectorContinuation
} from '../lib/inspector-interpreter.js';

const SOURCE = [
  'function smokeInner(arg) {',
  '  const local = 2;',
  '  halt("x");',
  '  const after = local + arg;',
  '  return after;',
  '}'
].join('\n');

const NESTED_SOURCE = [
  'function smokeOuter(marker) {',
  '  function smokeInner(arg) {',
  '    const localObject = { marker: arg };',
  '    halt("x");',
  '    return localObject;',
  '  }',
  '  return smokeInner(marker);',
  '}',
  'smokeOuter(marker);'
].join('\n');

const ASYNC_WRAPPER_SOURCE = [
  'Promise.resolve().then(async () => {',
  '  try {',
  '    smokeOuter(marker);',
  '  } catch (err) {',
  '    return err;',
  '  }',
  '  return marker;',
  '});'
].join('\n');

describe('rewritten debugger actions', function () {
  function capturedCounter () {
    const receiver = { count: 0, step: '1', pause: true, updateCount () {} };
    const increment = globalThis.Function('return function increment() { var amount = this.step; if (this.pause) debugger; this.count += Number(amount); this.updateCount(); return this.count; }')();
    return { receiver, continuation: run(increment, null, [], { this: receiver }) };
  }

  it('steps past a conditional debugger without completing the function', function () {
    const { receiver, continuation } = capturedCounter();
    const stepped = stepInspectorContinuation(continuation);
    expect(stepped.isContinuation).equals(true);
    expect(stepped.currentFrame.getPC().type).equals('ExpressionStatement');
    expect(receiver.count).equals(0);
    expect(resumeInspectorContinuation(stepped)).equals(1);
  });

  it('keeps the captured else branch when its condition changes while suspended', function () {
    const receiver = { condition: false, count: 0 };
    const fn = globalThis.Function('return function compute() { if (this.condition) this.count = 99; else { debugger; this.count += 1; } return this.count; }')();
    const continuation = run(fn, null, [], { this: receiver });
    receiver.condition = true;
    const stepped = stepInspectorContinuation(continuation);
    expect(stepped.isContinuation).equals(true);
    expect(receiver.count).equals(0);
    expect(resumeInspectorContinuation(stepped)).equals(1);
  });

  it('keeps a branch entered by the interpreter after restarting a frame', function () {
    const { receiver, continuation } = capturedCounter();
    const restarted = restartInspectorFrame(continuation);
    const stopped = resumeInspectorContinuation(restarted);
    receiver.pause = false;
    const stepped = stepInspectorContinuation(stopped);
    expect(stepped.isContinuation).equals(true);
    expect(receiver.count).equals(0);
    expect(resumeInspectorContinuation(stepped)).equals(1);
  });

  it('keeps evaluation errors during stepping in a recoverable continuation', function () {
    const fn = globalThis.Function('return function compute() { debugger; unavailableDebuggerBinding(); }')();
    const stepped = stepInspectorContinuation(run(fn));
    const failed = stepInspectorContinuation(stepped);
    expect(failed.isContinuation).equals(true);
    expect(failed.exception).instanceOf(ReferenceError);
  });

  it('restarts and resumes a rewritten frame without losing its pc or receiver', function () {
    const { receiver, continuation } = capturedCounter();
    const restarted = restartInspectorFrame(continuation);
    expect(restarted.isContinuation).equals(true);
    expect(restarted.currentFrame.getPC().type).equals('VariableDeclaration');
    expect(restarted.currentFrame.getThis()).equals(receiver);
    const stopped = resumeInspectorContinuation(restarted);
    expect(stopped.isContinuation).equals(true);
    expect(resumeInspectorContinuation(stopped)).equals(1);
  });

  it('restarts a method containing the let declaration produced by the Object Editor', function () {
    const receiver = { step: '1', count: 0 };
    const increment = globalThis.Function('return function increment() { let amount = Number(this.step); debugger; this.count += amount; return this.count; }')();
    const continuation = run(increment, null, [], { this: receiver, Number });
    const restarted = restartInspectorFrame(continuation);
    expect(restarted.isContinuation).equals(true);
    expect(restarted.currentFrame.getPC().type).equals('VariableDeclaration');
    const stopped = resumeInspectorContinuation(restarted);
    expect(stopped.isContinuation).equals(true);
    expect(resumeInspectorContinuation(stopped)).equals(1);
  });

  it('restarts the saved replacement method on the same receiver with original arguments', function () {
    const receiver = { count: 0 };
    const original = globalThis.Function('return function old_increment(delta) { let amount = delta; debugger; this.count += amount; return this.count; }')();
    original.displayName = 'increment';
    receiver.increment = original;
    const continuation = run(original, null, [2], { this: receiver });
    receiver.increment = globalThis.Function('return function new_increment(delta) { let amount = delta * 3; debugger; this.count += amount; return this.count; }')();
    receiver.increment.displayName = 'increment';
    const restarted = restartInspectorFrame(continuation);
    expect(restarted.currentFrame.func.getSource()).includes('delta * 3');
    expect(restarted.currentFrame.getThis()).equals(receiver);
    const stopped = resumeInspectorContinuation(restarted);
    expect(stopped.currentFrame.lookup('amount')).equals(6);
    expect(resumeInspectorContinuation(stopped)).equals(6);
    expect(receiver.count).equals(6);
  });
});

describe('inspector interpreter continuation', function () {
  let registry;

  beforeEach(function () {
    registry = new InspectorRegistry();
  });

  function createContinuation () {
    const context = registry.createContext({
      id: 'capture-1',
      reason: 'halt',
      frames: [{
        frameId: 'frame-0',
        functionName: 'halt',
        source: {
          scriptId: 'runtime',
          sourceText: 'const HALT_UNWIND_TAG = "x"; class InspectorHaltUnwind {} function halt() {}'
        },
        location: { scriptId: 'runtime', lineNumber: 0, columnNumber: 68 },
        scopes: [{ scopeId: 'runtime-local', type: 'local', bindings: {} }]
      }, {
        frameId: 'frame-1',
        functionName: 'smokeInner',
        source: { scriptId: 'script-1', sourceText: SOURCE },
        location: { scriptId: 'script-1', lineNumber: 2, columnNumber: 2 },
        arguments: [5],
        thisValue: { receiver: true },
        scopes: [{
          scopeId: 'local',
          type: 'local',
          bindings: {
            arg: 5,
            local: 2,
            halt () { throw new Error('halt should have been skipped'); }
          }
        }]
      }]
    });
    return registry.continuationFor(context.id);
  }

  function createNestedContinuation ({ includeAsyncWrapper = false } = {}) {
    const marker = { label: 'actual-marker' };
    const localObject = { marker };
    const frames = [{
      frameId: 'frame-0',
      functionName: 'halt',
      source: {
        scriptId: 'runtime',
        sourceText: 'const HALT_UNWIND_TAG = "x"; class InspectorHaltUnwind {} function halt() {}'
      },
      location: { scriptId: 'runtime', lineNumber: 0, columnNumber: 68 },
      scopes: [{ scopeId: 'runtime-local', type: 'local', bindings: {} }]
    }, {
      frameId: 'frame-1',
      functionName: 'smokeInner',
      source: { scriptId: 'script-nested', sourceText: NESTED_SOURCE },
      location: { scriptId: 'script-nested', lineNumber: 3, columnNumber: 4 },
      arguments: [marker],
      scopes: [{
        scopeId: 'inner-local',
        type: 'local',
        bindings: {
          arg: marker,
          localObject,
          halt () { throw new Error('halt should have been skipped'); }
        }
      }]
    }, {
      frameId: 'frame-2',
      functionName: 'smokeOuter',
      source: { scriptId: 'script-nested', sourceText: NESTED_SOURCE },
      location: { scriptId: 'script-nested', lineNumber: 6, columnNumber: 9 },
      arguments: [marker],
      scopes: [{
        scopeId: 'outer-local',
        type: 'local',
        bindings: {
          marker,
          smokeInner () { throw new Error('smokeInner should not be called again'); }
        }
      }]
    }];
    if (includeAsyncWrapper) {
      frames.push({
        frameId: 'frame-3',
        functionName: '',
        source: { scriptId: 'script-wrapper', sourceText: ASYNC_WRAPPER_SOURCE },
        location: { scriptId: 'script-wrapper', lineNumber: 2, columnNumber: 4 },
        scopes: [{
          scopeId: 'wrapper-local',
          type: 'local',
          bindings: {
            marker,
            smokeOuter () { throw new Error('smokeOuter should not be called again'); }
          }
        }]
      });
    }
    const context = registry.createContext({
      id: 'capture-nested',
      reason: 'halt',
      frames
    });
    return { continuation: registry.continuationFor(context.id), localObject, marker };
  }

  it('materializes inspector frames as executable interpreter frames', function () {
    const continuation = materializeInspectorContinuation(createContinuation());
    const frame = continuation.currentFrame;

    expect(frame.lookup('local')).equals(2);
    expect(frame.getThis()).deep.equals({ receiver: true });
    expect(frame.getArguments()).deep.equals([5]);
    expect(frame.getPC().type).equals('ExpressionStatement');
    expect(frame.getPC().source).equals('halt("x");');
    expect(frame.isAlreadyComputed(frame.getPC())).equals(true);
  });

  it('steps over the halted statement to the next source line', function () {
    const next = stepInspectorContinuation(createContinuation(), { action: 'stepOver' });
    const frame = next.currentFrame;

    expect(next.isContinuation).equals(true);
    expect(frame.getPC().source).equals('const after = local + arg;');
    expect(frame.lookup('local')).equals(2);
  });

  it('resumes from the halted statement through the interpreter', function () {
    const result = resumeInspectorContinuation(createContinuation());

    expect(result).equals(7);
  });

  it('resumes caller frames by plugging the callee result into the pending call', function () {
    const { continuation, localObject } = createNestedContinuation();
    const result = resumeInspectorContinuation(continuation);

    expect(result).equals(localObject);
  });

  it('normalizes async arrow wrapper frames for interpreter resume', function () {
    const { continuation, marker } = createNestedContinuation({ includeAsyncWrapper: true });
    const result = resumeInspectorContinuation(continuation);

    expect(result).equals(marker);
  });

  it('steps out to the caller frame with the callee result recorded', function () {
    const { continuation, localObject } = createNestedContinuation();
    const steppedOut = stepOutInspectorContinuation(continuation);
    const frame = steppedOut.currentFrame;

    expect(steppedOut.isContinuation).equals(true);
    expect(frame.functionName).equals('smokeOuter');
    expect(frame.getPC().source).equals('smokeInner(marker)');
    expect(resumeInspectorContinuation(steppedOut)).equals(localObject);
  });

  it('restarts a captured frame at the first statement', function () {
    const next = restartInspectorFrame(createContinuation());
    const frame = next.currentFrame;

    expect(frame.getPC().source).equals('const local = 2;');
  });

  it('restarts an already materialized interpreter frame', function () {
    const stepped = stepInspectorContinuation(createContinuation(), { action: 'stepOver' });
    const restarted = restartInspectorFrame(stepped);
    const frame = restarted.currentFrame;

    expect(frame.getPC().source).equals('const local = 2;');
    expect(frame.lookup('arg')).equals(5);
  });
});
