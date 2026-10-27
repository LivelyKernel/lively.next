/* global describe, it */
import { expect } from 'mocha-es6';
import { run, enableDebugSupport, disableDebugSupport } from '../lib/stackReification.js';
import { applySavedInspectorMethod, resumeInspectorContinuation } from '../lib/inspector-interpreter.js';
import { serialize, deserialize } from 'lively.serializer2';
const fn = source => globalThis.Function('return (' + source + ')')();
const nodes = ast => {
  const all = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type) all.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent') continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object' && value.type) visit(value);
    }
  };
  visit(ast); return all;
};

describe('debugger regression gaps', () => {
  it('remaps for-of iterator keys and continues with the third element after a saved edit', () => {
    const source = 'function* values() { for (const item of [1, 2, 3]) { debugger; yield item; } }';
    const receiver = {values: fn(source)};
    let stopped = run(fn('function task() { let total = 0; for (const value of this.values()) total += value; return total; }'), null, [], {this: receiver});
    stopped = resumeInspectorContinuation(stopped);
    expect(stopped.currentFrame.lookup('item')).equals(2, 'Stop in the second iteration');
    const frame = stopped.currentFrame, oldLoop = nodes(frame.getOriginalAst()).find(node => node.type === 'ForOfStatement');
    const iterator = frame.alreadyComputed['__forOf_' + oldLoop.astIndex];
    expect(!!iterator).equals(true, 'Retain the iterator before the edit');
    // A future nested function shifts traversal indices without changing any executed statement.
    receiver.values = fn(source.replace('yield item;', 'yield item; function future() { return 99; }'));
    for (const prefix of ['__yieldValue_', '__delegate_']) frame.alreadyComputed[prefix + oldLoop.astIndex] = {prefix};
    const updated = applySavedInspectorMethod(stopped);
    const newFrame = updated.currentFrame, newLoop = nodes(newFrame.getOriginalAst()).find(node => node.type === 'ForOfStatement');
    expect(newLoop.astIndex).not.equals(oldLoop.astIndex, 'The regression must actually shift the loop astIndex');
    expect(newFrame.alreadyComputed['__forOf_' + newLoop.astIndex]).equals(iterator, 'Iterator state follows the new loop index');
    for (const prefix of ['__yieldValue_', '__delegate_']) {
      expect(newFrame.alreadyComputed[prefix + newLoop.astIndex]?.prefix).equals(prefix, `${prefix} state follows the new index`);
      delete newFrame.alreadyComputed[prefix + newLoop.astIndex];
    }
    const third = resumeInspectorContinuation(updated);
    expect(third.currentFrame.lookup('item')).equals(3, 'next() must continue with the third element');
    expect(resumeInspectorContinuation(third)).equals(6, 'No iteration restarts or repeats');
  });

  it('filters settled native promises from every serialized frame cache', async () => {
    const stopped = await run(fn('async function task() { async function* values() { for (const quantity of [2, 3]) { await Promise.resolve(); debugger; yield quantity * 2; } } let total = 0; for await (const value of values()) total += value; return total; }'));
    let cacheCount = 0;
    for (const frame of stopped.frames()) {
      const fields = {};
      frame.__additionally_serialize__({}, null, null, (key, value) => { fields[key] = value; });
      cacheCount++;
      expect(Object.values(fields.alreadyComputed).some(value => value && typeof value.then === 'function')).equals(false,
        `Frame ${frame.func.name()} must not retain native promises, even with no pending await`);
    }
    expect(cacheCount).at.least(2, 'Exercise the settled generator and its caller');
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(stopped))));
    const second = await resumeInspectorContinuation(restored);
    expect(second.exception).equals(undefined, 'Deserialization errors must fail this regression');
    expect(second.currentFrame.lookup('quantity')).equals(3);
    expect(await resumeInspectorContinuation(second)).equals(10);
  });

  it('installs the Path compatibility global before enabling debug support', () => {
    const lang = globalThis.lively.lang, old = lang.Path;
    try {
      delete lang.Path;
      enableDebugSupport();
      expect(typeof lang.Path).equals('function', 'Enabling the debugger must supply the legacy Path global');
    } finally { disableDebugSupport(); lang.Path = old; }
  });
});
