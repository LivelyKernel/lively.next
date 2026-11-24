/* global describe, it, beforeEach, afterEach, System, WeakRef */
import { expect } from 'mocha-es6';
import { module } from 'lively.modules';
import { morph, MorphicEnv } from '../index.js';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { DetachedLifetimeHandle } from '../undo.js';
import { MorphicHistoryOwnershipError } from '../changes/errors.js';

/** Preserve the exact thrown value for synchronous rejection assertions. */
function failureOf (fn) {
  try { fn(); } catch (error) { return error; }
  throw new Error('Expected the operation to reject');
}

/** Inspect the registry without making it a public lifetime API. */
function registry () {
  return module(System.decanonicalize('lively.morphic/changes/lifetime.js')).recorder.liveHandles;
}

describe('morphic context lifetime cleanup', function () {
  this.timeout(10000);
  let env, manager, undo;
  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    manager = env.changeManager;
    undo = env.undoManager;
  });
  afterEach(() => { undo.clearHistory(); MorphicEnv.popDefault().uninstall(); });

  it('bounds the registry after 200 non-undoable transactions', () => {
    const handles = registry(), before = handles.size, target = morph();
    for (let i = 0; i < 200; i++) manager.transaction({ scope: target, undoable: false }, () => { target.rotation = i / 1000; });
    expect(handles.size - before, 'non-undoable contexts must not accumulate live handle references').lessThan(10);
  });

  it('bounds the registry after 100 undo/redo cycles', () => {
    const target = morph();
    manager.transaction({ scope: target }, () => { target.rotation = 0.5; });
    undo.undoStop();
    const handles = registry(), before = handles.size;
    for (let i = 0; i < 100; i++) { undo.undo(); undo.redo(); }
    expect(handles.size - before, 'replay must reuse its context without registering throwaway handles').lessThan(10);
    expect(target.rotation, 'replay endpoints must stay exact').equals(0.5);
  });

  it('releases the handles of 100 undoable transactions on clearHistory', () => {
    const handles = registry(), before = handles.size, target = morph();
    for (let i = 0; i < 100; i++) manager.transaction({ scope: target }, () => { target.rotation = i / 1000; });
    undo.clearHistory();
    expect(handles.size - before, 'clearing history must release its retained roots').lessThan(10);
  });

  it('registers only handles with roots and unregisters an emptied handle', () => {
    const handles = registry(), before = handles.size;
    const handle = new DetachedLifetimeHandle();
    try {
      expect(handles.size, 'empty handles must not enter the live registry').equals(before);
      handle.update([morph()]);
      expect(handles.size, 'a rooted handle must retain membership exactly once').equals(before + 1);
      handle.update(handle.roots);
      expect(handles.size, 'updating an existing handle must not duplicate registration').equals(before + 1);
      handle.update([]);
      expect(handles.size, 'an emptied handle must leave the live registry').equals(before);
    } finally { handle.release(); }
  });

  it('prunes dead weak references while registering rooted handles', () => {
    const handles = registry(), dead = { deref: () => undefined };
    handles.add(dead);
    try {
      const count = handles.size + 1;
      for (let i = 0; i < count; i++) new DetachedLifetimeHandle([morph()]).release();
      expect(handles.has(dead), 'registration must sweep dead references without waiting for disposal').equals(false);
    } finally { handles.delete(dead); }
  });

  it('releases an unclaimed rooted context after a non-undoable commit', () => {
    const owner = morph({ submorphs: [{}] }), child = owner.submorphs[0];
    let context;
    manager.addCommittedChangeListener((set, runtime) => { context = runtime; });
    manager.transaction({ scope: owner, undoable: false }, () => child.remove());
    expect(child.owner, 'the non-undoable edit must still take effect').equals(null);
    expect(context.lifetimeHandles.every(handle => handle.released), 'no history entry claimed this context').equals(true);
    expect(undo.undos.length, 'non-undoable work must not acquire history ownership').equals(0);
  });

  it('releases an unclaimed context after a failed transaction', () => {
    const target = morph(), original = manager.operationContext, cause = new Error('failed scope');
    let context;
    manager.operationContext = function (options) { return context = original.call(this, options); };
    const error = failureOf(() => manager.transaction({ scope: target }, () => { target.opacity = 0.5; throw cause; }));
    expect(error, 'cleanup must preserve the original failure').equals(cause);
    expect(context.lifetimeHandles.every(handle => handle.released), 'failed scopes must release unclaimed handles').equals(true);
  });

  it('reuses the supplied operation context for replay', () => {
    const target = morph();
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    const entry = undo.undos[0], original = manager.operationContext;
    let allocations = 0;
    manager.operationContext = function (options) { allocations++; return original.call(this, options); };
    undo.undo(); undo.redo();
    expect(allocations, 'undo/redo must not allocate a context which is immediately replaced').equals(0);
    expect(entry.context.lifetimeHandles.some(handle => !handle.released), 'replay must preserve the history-owned lease').equals(true);
  });

  it('keeps immediate rollback diagnostics weakly and clears them on reset', () => {
    const target = morph(), cause = new Error('setter failed');
    target.makeDirty = () => { throw cause; };
    expect(failureOf(() => manager.transaction({ scope: target }, () => { target.opacity = 0.5; })), 'rollback must retain the original failure').equals(cause);
    expect(manager._lastRollbackDiagnostics[0].error, 'same-turn diagnostics must remain available').equals(cause);
    expect(manager._rollbackDiagnostics instanceof WeakRef, 'the manager must not strongly pin recovery operations and their errors').equals(true);
    manager.reset();
    expect(manager._lastRollbackDiagnostics, 'reset must discard diagnostics from the prior session').equals(undefined);
  });

  it('rejects a replay-time undoStop before discarding a live group', () => {
    const target = morph();
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    const entry = undo.undos[0];
    const group = undo.undoStart(target, 'earlier gesture');
    target.rotation = 0.25;
    let error;
    target.onChange = change => {
      if (change.prop === 'opacity') {
        try { undo.undoStop(); } catch (caught) { error = caught; }
      }
    };
    manager.applyChangeSet(entry.changeSet, { context: entry.context, direction: 'undo' });
    expect(error, 'a group close during replay must reject rather than silently drop history').to.be.instanceOf(MorphicHistoryOwnershipError);
    expect(error.kind, 'the rejection must identify replay ownership').equals('replay');
    expect(undo.undoInProgress, 'rejection must keep the original recording token').equals(group);
    expect(group.recorder.changes.some(change => change.prop === 'rotation'), 'earlier successful gesture work must survive').equals(true);
    target.onChange = () => {};
    undo.undoStop();
    undo.undo();
    expect(target.rotation, 'the preserved gesture must remain undoable').equals(0);
  });
});

describe('synchronous value change metadata', function () {
  let env;
  beforeEach(async () => { env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv())); });
  afterEach(() => MorphicEnv.popDefault().uninstall());

  it('sinks a rejected thenable and restores metadata before throwing', async () => {
    const target = morph(), manager = env.changeManager, cause = new Error('thenable rejection');
    let subscriptions = 0;
    const thenable = { then (resolve, reject) { subscriptions++; reject(cause); } };
    const error = failureOf(() => target.withMetaDo({ reconcileChanges: true }, () => thenable));
    expect(error.message, 'thenables must be rejected synchronously').equals('withMetaDo callbacks must be synchronous');
    await Promise.resolve(); await Promise.resolve();
    expect(subscriptions, 'the rejected thenable must have a rejection sink').equals(1);
    expect(manager.metaStack, 'metadata scopes must close before asynchronous work runs').deep.equals([]);
    expect(manager.defaultMeta, 'metadata must not escape the synchronous scope').deep.equals({});
  });

  it('does not leak an unhandled rejection from a rejected Promise callback', async () => {
    const target = morph(), unhandled = [], cause = new Error('promise rejection');
    const capture = event => { event.preventDefault(); unhandled.push(event.reason); };
    window.addEventListener('unhandledrejection', capture);
    try {
      failureOf(() => target.withMetaDo({}, () => Promise.reject(cause)));
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(unhandled, 'synchronously rejected callbacks must consume their Promise rejection').deep.equals([]);
    } finally { window.removeEventListener('unhandledrejection', capture); }
  });

  it('propagates the exact callback error and restores outer metadata', () => {
    const target = morph(), manager = env.changeManager, cause = new Error('callback failure');
    target.withMetaDo({ outer: true }, () => {
      expect(failureOf(() => target.withMetaDo({ inner: true }, () => { throw cause; })), 'callback exceptions must propagate unchanged').equals(cause);
      expect(manager.defaultMeta, 'failed nested metadata must restore its outer scope').deep.equals({ outer: true });
    });
    expect(manager.defaultMeta, 'the outer scope must close normally').deep.equals({});
  });
});
