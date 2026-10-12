/* global describe, it */
import { expect } from 'mocha-es6';
import { run } from '../lib/stackReification.js';
import { serialize, deserialize } from '../../lively.serializer2/index.js';
import { resumeInspectorContinuation, stepInspectorContinuation, stepOutInspectorContinuation, returnFromInspectorFrame, applySavedInspectorMethod } from '../lib/inspector-interpreter.js';

const fn = source => globalThis.Function('return (' + source + ')')();

describe('generator and async iterator continuations', function () {
  it('creates generators lazily and sends values back into yield', function () {
    const effects = [];
    const iterator = run(fn('function* values() { effects.push("start"); const sent = yield 2; return sent + 3; }'), null, [], {effects}).returnValue;
    expect(effects).deep.equals([]);
    expect(iterator.next(99)).deep.equals({value: 2, done: false});
    expect(iterator.next(4)).deep.equals({value: 7, done: true});
    expect(iterator.next()).deep.equals({value: undefined, done: true});
    expect(effects).deep.equals(['start']);
  });

  it('resumes a debugger inside a generator into its caller without replaying effects', function () {
    const effects = [];
    const stopped = run(fn('function task() { function* values() { effects.push(1); debugger; yield 2; effects.push(3); return 4; } const iterator = values(); const first = iterator.next(); return [first, iterator.next()]; }'), null, [], {effects});
    expect(stopped.isContinuation).equals(true);
    expect(stopped.exception).equals(undefined);
    expect(stopped.currentFrame.func.name()).equals('values');
    expect(resumeInspectorContinuation(stopped)).deep.equals([{value: 2, done: false}, {value: 4, done: true}]);
    expect(effects).deep.equals([1, 3]);
  });

  it('steps across a yield and out into the iterator caller', function () {
    const stopped = run(fn('function task() { function* values() { debugger; yield 2; return 4; } const iterator = values(); const first = iterator.next(); return first.value + iterator.next().value; }'));
    const atYield = stepInspectorContinuation(stopped);
    expect(atYield.currentFrame.getPC().type).equals('ExpressionStatement');
    const caller = stepOutInspectorContinuation(atYield);
    expect(caller.currentFrame.func.name()).equals('task');
    expect(resumeInspectorContinuation(caller)).equals(6);
  });

  it('steps over a yield and can return an override result to next', function () {
    const task = fn('function task() { function* values() { debugger; yield 2; return 4; } const iterator = values(); const first = iterator.next(); return first.value + iterator.next().value; }');
    let stopped = run(task);
    stopped = stepInspectorContinuation(stopped);
    const caller = stepInspectorContinuation(stopped);
    expect(caller.currentFrame.func.name()).equals('task');
    expect(resumeInspectorContinuation(caller)).equals(6);
    stopped = run(fn('function task() { function* values() { debugger; yield 2; } return values().next(); }'));
    expect(resumeInspectorContinuation(returnFromInspectorFrame(stopped, 7))).deep.equals({value: 7, done: true});
  });

  it('handles throw and return, including yielding during finally', function () {
    const iterator = run(fn('function* values() { try { yield 1; } catch (error) { yield error.message; } finally { yield "cleanup"; } return 9; }')).returnValue;
    expect(iterator.next()).deep.equals({value: 1, done: false});
    expect(iterator.throw(new Error('repair'))).deep.equals({value: 'repair', done: false});
    expect(iterator.return(7)).deep.equals({value: 'cleanup', done: false});
    expect(iterator.next()).deep.equals({value: 7, done: true});
    expect(iterator.throw.bind(iterator, new Error('closed'))).to.throw('closed');
  });

  it('delegates yield star and preserves its completion value', function () {
    const iterator = run(fn('function* values() { function* child() { const value = yield 2; return value + 1; } return yield* child(); }')).returnValue;
    expect(iterator.next()).deep.equals({value: 2, done: false});
    expect(iterator.next(4)).deep.equals({value: 5, done: true});
  });

  it('retains intermediate expression values and loop bindings across yields', function () {
    const effects = [];
    const iterator = run(fn('function* values() { for (let i = 0; i < 2; i++) { const value = effects.push(i) + (yield i); yield value; } }'), null, [], {effects}).returnValue;
    expect(iterator.next()).deep.equals({value: 0, done: false});
    expect(iterator.next(10)).deep.equals({value: 11, done: false});
    expect(iterator.next()).deep.equals({value: 1, done: false});
    expect(iterator.next(10)).deep.equals({value: 12, done: false});
    expect(iterator.next()).deep.equals({value: undefined, done: true});
    expect(effects).deep.equals([0, 1]);
  });

  it('resumes for await without replaying next and retains iteration closures', async function () {
    const source = {reads: 0, closes: 0, [Symbol.asyncIterator]() { return this; }, next() { this.reads++; return Promise.resolve(this.reads <= 3 ? {value: this.reads, done: false} : {done: true}); }, return() { this.closes++; return Promise.resolve({done: true}); }};
    const stopped = await run(fn('async function task() { const reads = []; for await (const value of source) { reads.push(() => value); if (value === 2) debugger; } return reads.map(read => read()); }'), null, [], {source});
    expect(stopped.isContinuation).equals(true);
    expect(stopped.exception).equals(undefined);
    expect(source.reads).equals(2);
    expect(source.closes).equals(0);
    expect(await resumeInspectorContinuation(stopped)).deep.equals([1, 2, 3]);
    expect(source.reads).equals(4);
    expect(source.closes).equals(0);
  });

  it('awaits synchronous iterable values and closes an async iterator on break', async function () {
    const result = await run(fn('async function task() { let total = 0; for await (const value of [Promise.resolve(1), Promise.resolve(2)]) total += value; return total; }'));
    expect(result.returnValue).equals(3);
    const source = {closed: false, [Symbol.asyncIterator]() { return this; }, next() { return Promise.resolve({value: 2, done: false}); }, async return() { await Promise.resolve(); this.closed = true; return {done: true}; }};
    const closed = await run(fn('async function task() { for await (const value of source) { break; } return source.closed; }'), null, [], {source});
    expect(closed.returnValue).equals(true);
  });

  it('catches a rejected async iterator result', async function () {
    const source = {[Symbol.asyncIterator]() { return this; }, next() { return Promise.reject(new Error('iteration failed')); }};
    const result = await run(fn('async function task() { try { for await (const value of source) {} } catch (error) { return error.message; } }'), null, [], {source});
    expect(result.returnValue).equals('iteration failed');
  });

  it('uses async generators with await and for await through debugger stops', async function () {
    const effects = [];
    const stopped = await run(fn('async function task() { async function* values() { effects.push(1); yield await Promise.resolve(2); debugger; yield 3; } let total = 0; for await (const value of values()) total += value; return total; }'), null, [], {effects});
    expect(stopped.isContinuation).equals(true);
    expect(stopped.exception).equals(undefined);
    expect(stopped.currentFrame.func.name()).equals('values');
    expect(await resumeInspectorContinuation(stopped)).equals(5);
    expect(effects).deep.equals([1]);
  });

  it('restores a yielded generator and resumes its retained frame', function () {
    const iterator = run(fn('function* values() { let value = 2; yield value; value += 3; return value; }')).returnValue;
    expect(iterator.next()).deep.equals({value: 2, done: false});
    const restored = deserialize(serialize(iterator));
    expect(restored.next()).deep.equals({value: 5, done: true});
  });

  it('restores a debugger inside a generator and resumes its caller', function () {
    const stopped = run(fn('function task() { function* values() { debugger; yield 2; return 4; } const iterator = values(); const first = iterator.next(); return first.value + iterator.next().value; }'));
    const restored = deserialize(serialize(stopped));
    expect(resumeInspectorContinuation(restored)).equals(6);
  });

  it('awaits iterator cleanup before delivering a body error to catch', async function () {
    const source = {closed: false, [Symbol.asyncIterator]() { return this; }, next() { return Promise.resolve({value: 2, done: false}); }, async return() { await Promise.resolve(); this.closed = true; return {done: true}; }};
    const result = await run(fn('async function task() { try { for await (const value of source) { throw new Error("stop"); } } catch (error) { return [error.message, source.closed]; } }'), null, [], {source});
    expect(result.returnValue).deep.equals(['stop', true]);
  });

  it('queues async generator requests and awaits yielded values', async function () {
    const iterator = run(fn('async function* values() { yield Promise.resolve(2); yield await Promise.resolve(3); return 4; }')).returnValue;
    expect(await Promise.all([iterator.next(), iterator.next(), iterator.next()])).deep.equals([
      {value: 2, done: false}, {value: 3, done: false}, {value: 4, done: true}
    ]);
  });

  it('forwards delegated throw and return operations to the child generator', function () {
    const iterator = run(fn('function* values() { function* child() { try { yield 1; } catch (error) { yield error.message; } finally { yield 3; } } return yield* child(); }')).returnValue;
    expect(iterator.next()).deep.equals({value: 1, done: false});
    expect(iterator.throw(new Error('caught'))).deep.equals({value: 'caught', done: false});
    expect(iterator.return(7)).deep.equals({value: 3, done: false});
    expect(iterator.next()).deep.equals({value: 7, done: true});
  });

  it('debugs a generator consumed by a synchronous for of loop', function () {
    const stopped = run(fn('function task() { function* values() { yield 1; debugger; yield 2; } let total = 0; for (const value of values()) total += value; return total; }'));
    expect(stopped.exception).equals(undefined);
    expect(resumeInspectorContinuation(stopped)).equals(3);
  });

  it('restores a pending return after a yield in finally', function () {
    const iterator = run(fn('function* values() { try { yield 1; } finally { yield 2; } }')).returnValue;
    iterator.next();
    expect(iterator.return(7)).deep.equals({value: 2, done: false});
    expect(deserialize(serialize(iterator)).next()).deep.equals({value: 7, done: true});
  });

  it('awaits delegated async yields and catches rejected yielded promises', async function () {
    const iterator = run(fn('async function* values() { try { yield Promise.reject(new Error("failed")); } catch (error) { yield error.message; } return yield* [Promise.resolve(2), 3]; }')).returnValue;
    expect(await iterator.next()).deep.equals({value: 'failed', done: false});
    expect(await iterator.next()).deep.equals({value: 2, done: false});
    expect(await iterator.next()).deep.equals({value: 3, done: false});
    expect(await iterator.next()).deep.equals({value: undefined, done: true});
  });

  it('closes on uncaught errors and returns from delegates without a return method', function () {
    const failed = run(fn('function* values() { yield 1; throw new Error("closed"); }')).returnValue;
    failed.next();
    expect(() => failed.next()).to.throw('closed');
    expect(failed.next()).deep.equals({value: undefined, done: true});
    const iterator = run(fn('function* values() { yield* [1, 2]; }')).returnValue;
    iterator.next();
    expect(iterator.return(7)).deep.equals({value: 7, done: true});
  });

  it('keeps iterator state when applying a future generator edit', function () {
    const source = 'function* values() { for (const quantity of [2, 3]) { let amount = quantity; debugger; yield amount; } }';
    const receiver = {values: fn(source)};
    const stopped = run(fn('function task() { let total = 0; for (const value of this.values()) total += value; return total; }'), null, [], {this: receiver});
    receiver.values = fn(source.replace('yield amount;', 'yield amount * 2;'));
    const second = resumeInspectorContinuation(applySavedInspectorMethod(stopped));
    expect(second.currentFrame.lookup('quantity')).equals(3);
    expect(resumeInspectorContinuation(second)).equals(10);
  });
});
