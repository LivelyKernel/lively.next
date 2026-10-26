/* global describe, it, beforeEach, afterEach, $world */
import { expect } from 'mocha-es6';
import { morph, World, MorphicEnv } from '../index.js';
import { pt } from 'lively.graphics';
import { connect, disconnect } from 'lively.bindings';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { ChangeManager } from '../changes.js';
import { UndoManager, EditTransaction, EditTransactionKind, CompositeEditTransaction, DetachedLifetimeHandle, isReleasedDetachedMember } from '../undo.js';
import { MorphicRollbackError, MorphicTransactionUnsupportedError } from '../changes/index.js';

/** Preserve thrown identity in contract assertions. */
function failureOf (fn) {
  try { fn(); } catch (error) { return error; }
  throw new Error('Expected failure');
}

/** A domain fixture with no caller routing. */
function entry (apply = () => {}, reverseApply = () => {}) {
  const edit = new EditTransaction({ kind: EditTransactionKind.COMPONENT_COMMAND, label: 'domain edit', metadata: { payload: 'retained data' } });
  Object.assign(edit, { apply, reverseApply });
  return edit;
}

/** Private state is visible only through the domain's recovery receipt. */
function domain (mode = 'complete', phase = 'success', target = null) {
  const original = { id: 'same domain object' };
  let data = [original];
  const trace = [];
  const cause = new Error('domain/callback failure');
  const inverseError = new Error('inverse after restoring');
  const edit = entry(() => {
    trace.push('apply');
    if (phase === 'apply') throw cause;
    data = [];
    if (target) target.opacity = 0.5;
    if (phase === 'partial') throw cause;
    return edit;
  }, () => {
    trace.push('reverse');
    if (mode !== 'wrong-state') {
      data = [original];
      if (target) target.opacity = 1;
    }
    if (mode === 'restored-then-throws') throw inverseError;
    return edit;
  });
  edit.captureRecovery = ({ direction }) => {
    trace.push('capture:' + direction);
    const before = data.slice();
    const opacity = target?.opacity;
    return Object.freeze({
      restored: () => data.length === before.length && data.every((item, index) => item === before[index]),
      restore: () => {
        trace.push('restore');
        if (mode !== 'wrong-state') {
          data = before.slice();
          if (target && target.opacity !== opacity) target.opacity = opacity;
        }
        if (mode === 'restored-then-throws') throw inverseError;
      }
    });
  };
  return { edit, trace, cause, inverseError, original, data: () => data };
}

describe('morphic domain recovery and history lifecycle', function () {
  this.timeout(5000);
  let env, manager, undo, world;
  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    world = new World({ extent: pt(600, 400) });
    await env.setWorld(world);
    manager = env.changeManager; undo = env.undoManager;
  });
  afterEach(() => { undo.clearHistory?.(); MorphicEnv.popDefault().uninstall(); });

  for (const mode of ['complete', 'wrong-state', 'restored-then-throws']) {
    for (const phase of ['apply', 'rollback', 'partial']) {
      it(`domain receipt: ${mode}, ${phase}`, () => {
        const target = morph();
        const fixture = domain(mode, phase);
        let deliveries = 0;
        manager.addCommittedChangeListener(() => deliveries++);
        const error = failureOf(() => manager.transaction({ scope: target }, tx => {
          target.rotation = 1;
          tx.performEdit(fixture.edit);
          throw fixture.cause;
        }));
        const incomplete = mode === 'wrong-state' && phase !== 'apply';
        expect(error instanceof MorphicRollbackError).equals(incomplete);
        expect(incomplete ? error.cause : error).equals(fixture.cause);
        expect(target.rotation).equals(0);
        expect(fixture.data()).deep.equals(incomplete ? [] : [fixture.original]);
        if (incomplete) expect(error.unreversedOperations.some(operation => operation.edit === fixture.edit)).equals(true);
        if (mode === 'restored-then-throws' && phase !== 'apply') {
          expect(manager._lastRollbackDiagnostics.some(pair => pair.operation.edit === fixture.edit && pair.error === fixture.inverseError)).equals(true);
        }
        expect(fixture.trace[0]).equals('capture:forward');
        expect(fixture.trace[1]).equals('apply');
        expect([undo.undos.length, undo.redos.length, deliveries]).deep.equals([0, 0, 0]);
      });
    }
  }

  it('domain receipt: one success boundary and one history entry, including domain-only work', () => {
    const fixture = domain();
    let deliveries = 0;
    manager.addCommittedChangeListener(() => deliveries++);
    manager.transaction({}, tx => tx.performEdit(fixture.edit));
    expect(fixture.data()).deep.equals([]);
    expect([undo.undos.length, undo.redos.length, deliveries]).deep.equals([1, 0, 1]);
    undo.undo(); expect(fixture.data()).deep.equals([fixture.original]);
    undo.redo(); expect(fixture.data()).deep.equals([]);
    expect([undo.undos.length, undo.redos.length, deliveries]).deep.equals([1, 0, 3]);
  });

  it('domain receipt: recorded morph children replay once in the same source unit', () => {
    const target = morph();
    const fixture = domain('complete', 'success', target);
    let deliveries = 0;
    manager.addCommittedChangeListener(() => deliveries++);
    manager.transaction({ scope: target }, tx => {
      target.rotation = 1;
      tx.performEdit(fixture.edit);
      target.scale = 2;
    });
    expect(undo.undos.length).equals(1);
    for (let cycle = 0; cycle < 3; cycle++) {
      undo.undo();
      expect([target.rotation, target.opacity, target.scale]).deep.equals([0, 1, 1]);
      expect(fixture.data()).deep.equals([fixture.original]);
      undo.redo();
      expect([target.rotation, target.opacity, target.scale]).deep.equals([1, 0.5, 2]);
      expect(fixture.data()).deep.equals([]);
    }
    expect(fixture.trace.filter(item => item === 'apply').length).equals(4);
    expect(fixture.trace.filter(item => item === 'reverse').length).equals(3);
    expect([undo.undos.length, undo.redos.length, deliveries]).deep.equals([1, 0, 7]);
  });

  it('domain-only edits do not pass an absent morph to scoped listeners', () => {
    let deliveries = 0;
    manager.addCommittedChangeListener(() => deliveries++, { containsMorph: target => target.isMorph });
    manager.transaction({}, tx => tx.performEdit(domain().edit));
    expect(deliveries).equals(0);
    expect(undo.undos.length).equals(1);
  });

  it('counts and releases handles owned by a performed domain entry', () => {
    const fixture = domain(), releases = [];
    fixture.edit.retainDetached([morph({ submorphs: [morph()] })], { onRelease: info => releases.push(info.reason) });
    manager.transaction({}, tx => tx.performEdit(fixture.edit));
    expect(undo.historyStats().retainedDetachedNodes).equals(2);
    undo.clearHistory();
    expect(releases).deep.equals(['clear-history']);
    expect(undo.historyStats().retainedDetachedNodes).equals(0);
  });

  it('domain receipt: rejects missing and malformed receipts before apply, even if caught', () => {
    for (const malformed of [false, true]) {
      const target = morph();
      let applied = 0;
      const edit = entry(() => applied++);
      if (malformed) edit.captureRecovery = () => ({ restore () {}, restored () { return true; } });
      const error = failureOf(() => manager.transaction({ scope: target }, tx => {
        target.opacity = 0.5;
        try { tx.performEdit(edit); } catch (error) {}
      }));
      expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
      expect(error.kind).equals(malformed ? 'domain-recovery-receipt' : 'domain-without-recovery');
      expect([applied, target.opacity, undo.undos.length]).deep.equals([0, 1, 0]);
    }
  });

  it('domain receipt: restored is effect-free and restore is idempotent', () => {
    const fixture = domain();
    const receipt = fixture.edit.captureRecovery({ direction: 'forward' });
    expect(Object.isFrozen(receipt)).equals(true);
    fixture.edit.apply();
    expect(receipt.restored()).equals(false);
    expect(receipt.restored()).equals(false);
    expect(fixture.data()).deep.equals([]);
    receipt.restore(); const restored = fixture.data()[0];
    receipt.restore();
    expect(fixture.data()).deep.equals([fixture.original]);
    expect(fixture.data()[0]).equals(restored);
    expect(receipt.restored()).equals(true);
    expect(receipt.restored()).equals(true);
  });

  it('legacy addTransaction still accepts a domain without a receipt', () => {
    let value = 1;
    undo.addTransaction(entry(() => value = 1, () => value = 0));
    undo.undo(); expect(value).equals(0);
    undo.redo(); expect(value).equals(1);
  });

  it('aborts only the explicitly owned gesture without truncating unrelated redo', () => {
    const target = morph(); world.addMorph(target);
    manager.transaction({ scope: target }, () => { target.rotation = 1; });
    manager.transaction({ scope: target }, () => { target.scale = 2; });
    undo.undo();
    const previous = undo.undos.slice(); const redos = undo.redos.slice();
    const token = undo.undoStart(target, 'owned drag');
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(failureOf(() => undo.abortGroup({})).kind).equals('stale-group');
    expect(target.opacity).equals(0.5);
    undo.abortGroup(token);
    expect([target.opacity, target.rotation, target.scale]).deep.equals([1, 1, 1]);
    expect(undo.undoInProgress).equals(null);
    expect(undo.undos).deep.equals(previous);
    expect(undo.redos).deep.equals(redos);
    expect(failureOf(() => undo.abortGroup(token)).kind).equals('stale-group');
    undo.undo(); expect(target.rotation).equals(0);
  });

  it('drops and reports a failed abort without claiming restoration or losing prior history', () => {
    const target = morph();
    const prior = entry(); undo.addTransaction(prior);
    const token = undo.undoStart(target, 'broken gesture');
    let state = 1;
    const cause = new Error('partial inverse');
    undo.addTransaction(entry(() => {}, () => { state = 2; throw cause; }), { joinActive: true });
    expect(failureOf(() => undo.abortGroup(token))).equals(cause);
    expect(state).equals(2);
    expect(undo.undos).deep.equals([prior]);
    expect(undo.redos).to.be.empty;
    expect(undo.undoInProgress).equals(null);
    expect(undo.applyCount).equals(0);
  });

  it('releases without disposing until a caller supplies a per-node policy', () => {
    const root = morph({ submorphs: [morph()] });
    let releases = 0;
    const handle = new DetachedLifetimeHandle([root], { onRelease: () => releases++ });
    expect(handle.release('clear-history')).equals(true);
    expect(handle.release('reset')).equals(false);
    expect(releases).equals(1);
    expect(root.submorphs.length).equals(1);
    expect(handle.roots).to.be.empty;
  });

  it('disposes a non-leaf subtree per node in pre-order with idempotent receipts', () => {
    const grandchild = morph({ name: 'G' }); const child = morph({ name: 'C', submorphs: [grandchild] });
    const root = morph({ name: 'R', submorphs: [child] });
    const considered = [], disposed = [];
    const handle = new DetachedLifetimeHandle([root], { shouldDispose: node => { considered.push(node.name); return true; }, dispose: node => disposed.push(node.name) });
    handle.release(); handle.disposeReleased(); handle.release();
    expect(considered).deep.equals(['R', 'C', 'G']);
    expect(disposed).deep.equals(['R', 'C', 'G']);
    expect([child.owner, grandchild.owner]).deep.equals([root, child]);
  });

  it('never disposes a re-adopted descendant, or any attached root', () => {
    const grandchild = morph(); const child = morph({ submorphs: [grandchild] });
    const root = morph({ submorphs: [child] });
    const disposed = [];
    const handle = new DetachedLifetimeHandle([root], { shouldDispose: () => true, dispose: node => disposed.push(node) });
    world.addMorph(child);
    handle.release();
    expect(disposed).deep.equals([root]);
    const attached = new DetachedLifetimeHandle([child], { shouldDispose: () => true, dispose: node => disposed.push(node) });
    attached.release();
    expect(disposed).deep.equals([root]);
    expect(child.owner).equals(world); expect(grandchild.owner).equals(child);
  });

  it('accounts for overlapping live handles, and permits caller reconsideration after release', () => {
    const grandchild = morph({ name: 'G' }); const child = morph({ name: 'C', submorphs: [grandchild] });
    const root = morph({ name: 'R', submorphs: [child] });
    const disposed = [];
    const retainedChild = new DetachedLifetimeHandle([child]);
    const handle = new DetachedLifetimeHandle([root], { shouldDispose: () => true, dispose: node => disposed.push(node.name) });
    handle.release();
    expect(disposed).deep.equals(['R']);
    expect(isReleasedDetachedMember(child, root)).equals(false);
    retainedChild.release();
    expect(isReleasedDetachedMember(child, root)).equals(true);
    handle.disposeReleased();
    expect(disposed).deep.equals(['R', 'C', 'G']);
  });

  it('rechecks attachment after the caller predicate and continues after a disposal failure', () => {
    const child = morph({ name: 'C' }); const root = morph({ name: 'R', submorphs: [child] });
    const errors = [], disposed = [];
    new DetachedLifetimeHandle([root], { shouldDispose: () => true, dispose: node => { disposed.push(node.name); if (node === root) throw new Error('cleanup'); }, logError: error => errors.push(error) }).release();
    expect(disposed).deep.equals(['R', 'C']); expect(errors.length).equals(1);
    const adopted = morph(); let called = false;
    new DetachedLifetimeHandle([adopted], { shouldDispose: node => { world.addMorph(node); return true; }, dispose: () => called = true }).release();
    expect(called).equals(false); expect(adopted.owner).equals(world);
  });

  for (const reason of ['redo-truncation', 'reset', 'clear-history', 'domain-pruning', 'failed-entry']) {
    it(`releases per-entry handles on ${reason}`, () => {
      const releases = [], disposed = [], root = morph();
      const cause = new Error('failed undo');
      const edit = entry(() => {}, () => { if (reason === 'failed-entry') throw cause; });
      edit.retainDetached([root], { onRelease: info => releases.push(info.reason), shouldDispose: () => true, dispose: node => disposed.push(node) });
      undo.addTransaction(edit);
      if (reason === 'redo-truncation') { undo.undo(); undo.addTransaction(entry()); }
      if (reason === 'reset') undo.reset();
      if (reason === 'clear-history') undo.clearHistory();
      if (reason === 'domain-pruning') undo.removeTransactions(candidate => candidate === edit);
      if (reason === 'failed-entry') expect(failureOf(() => undo.undo())).equals(cause);
      expect(releases).deep.equals([reason]); expect(disposed).deep.equals([root]);
      undo.clearHistory(); expect(releases.length).equals(1);
    });
  }

  it('releases the replaced pending owner while publishing only its final owner', () => {
    const target = morph(), root = morph(), releases = [];
    const first = entry(); first.retainDetached([root], { onRelease: info => releases.push(info.reason) });
    const final = entry();
    manager.addCommittedChangeListener((set, context) => {
      const commitToken = manager.commitTokenFor(context);
      undo.replaceRecordedChanges(context.legacyChanges, first, { commitToken });
      undo.replaceRecordedChanges(context.legacyChanges, final, { commitToken });
      expect(undo.undos).to.be.empty;
    });
    target.opacity = 0.5;
    expect(undo.undos).deep.equals([final]); expect(releases).deep.equals(['replacement']);
  });

  it('prunes a disposed domain from closed and active groups without skipping other history', () => {
    const target = morph(), calls = [], released = [];
    const first = entry(() => calls.push('first+'), () => calls.push('first-'));
    const expired = entry(); expired.retainDetached([morph()], { onRelease: info => released.push(info.reason) });
    const last = entry(() => calls.push('last+'), () => calls.push('last-'));
    undo.addTransaction(first); undo.group();
    undo.undoStart(target, 'mixed');
    undo.addTransaction(expired, { joinActive: true }); undo.addTransaction(last, { joinActive: true });
    undo.removeTransactions(candidate => candidate === expired);
    undo.undoStop();
    undo.undo(); undo.undo(); undo.redo(); undo.redo();
    expect(calls).deep.equals(['last-', 'first-', 'first+', 'last+']);
    expect(released).deep.equals(['domain-pruning']);
  });

  it('keeps wrapper handles through partial pruning and releases them with the surviving history', () => {
    const removed = entry(), kept = entry(), releases = [];
    const wrapper = new CompositeEditTransaction([removed, kept]);
    const handle = wrapper.retainDetached([morph()], { onRelease: info => releases.push(info.reason) });
    undo.addTransaction(wrapper);
    undo.removeTransactions(candidate => candidate === removed);
    expect(handle.released).equals(false);
    expect(undo.historyStats().retainedDetachedNodes).equals(1);
    undo.clearHistory();
    expect(releases).deep.equals(['clear-history']);
  });

  it('keeps active recorder handles through chronological closure and reset', () => {
    const target = morph(), releases = [];
    const token = undo.undoStart(target, 'mixed ownership');
    token.retainDetached([morph()], { onRelease: info => releases.push(info.reason) });
    target.opacity = 0.8;
    manager.transaction({ scope: target }, () => { target.rotation = 1; });
    undo.undoStop();
    expect(undo.historyStats().retainedDetachedNodes >= 1).equals(true);
    undo.clearHistory();
    expect(releases).deep.equals(['clear-history']);
    const active = undo.undoStart(target, 'reset ownership');
    active.retainDetached([morph()], { onRelease: info => releases.push(info.reason) });
    undo.reset();
    expect(releases).deep.equals(['clear-history', 'reset']);
  });

  it('keeps the payload handles of both coalesced legacy recorders until their group releases', () => {
    const target = morph(), releases = [];
    undo.undoStart(target, 'first'); target.opacity = 0.8;
    const first = undo.undoStop();
    first.retainDetached([morph()], { onRelease: info => releases.push(info.reason) });
    undo.undoStart(target, 'second'); target.opacity = 0.5;
    const second = undo.undoStop();
    second.retainDetached([morph()], { onRelease: info => releases.push(info.reason) });
    undo.group(first);
    expect(undo.historyStats().retainedDetachedNodes).equals(2);
    undo.clearHistory();
    expect(releases).deep.equals(['clear-history', 'clear-history']);
  });

  it('releases the token payload when cancelling a truly empty group', () => {
    const target = morph(), releases = [];
    const token = undo.undoStart(target, 'empty');
    token.retainDetached([morph()], { onRelease: info => releases.push(info.reason) });
    expect(undo.cancelEmptyGroup()).equals(true);
    expect(releases).deep.equals(['empty-group']);
    expect(undo.historyStats().retainedDetachedNodes).equals(0);
  });

  it('reports history counts, detached membership and a labelled payload estimate, with notification', () => {
    const child = morph(), root = morph({ submorphs: [child] });
    const edit = entry(); edit.retainDetached([root]);
    let notifications = 0;
    const observer = { update (owner) { expect(owner).equals(undo); notifications++; } };
    connect(undo, 'historyChanged', observer, 'update');
    try {
      undo.addTransaction(edit);
      const stats = undo.historyStats();
      expect([stats.undoEntries, stats.redoEntries, stats.retainedDetachedRoots, stats.retainedDetachedNodes]).deep.equals([1, 0, 1, 2]);
      expect(stats.payloadIsEstimate).equals(true); expect(stats.estimatedPayloadBytes > 0).equals(true);
      undo.undo(); expect([undo.historyStats().undoEntries, undo.historyStats().redoEntries]).deep.equals([0, 1]);
      undo.clearHistory(); expect([undo.historyStats().retainedDetachedRoots, undo.historyStats().retainedDetachedNodes]).deep.equals([0, 0]);
      expect(notifications >= 3).equals(true);
    } finally { disconnect(undo, 'historyChanged', observer, 'update'); }
  });

  it('counts the detached top-owner graph retained through a descendant handle', () => {
    const child = morph(), sibling = morph(), root = morph({ submorphs: [child, sibling] });
    const edit = entry(); edit.retainDetached([child]);
    undo.addTransaction(edit);
    expect(root.owner).equals(null);
    expect([undo.historyStats().retainedDetachedRoots, undo.historyStats().retainedDetachedNodes]).deep.equals([1, 3]);
    world.addMorph(root);
    expect([undo.historyStats().retainedDetachedRoots, undo.historyStats().retainedDetachedNodes]).deep.equals([0, 0]);
  });

  it('clears an open group, stops its recorder and retains its applied state', () => {
    const target = morph(); undo.undoStart(target, 'open'); target.opacity = 0.5;
    expect(manager.changeRecordedListeners.length > 0).equals(true);
    undo.clearHistory();
    expect(target.opacity).equals(0.5);
    expect([undo.undos.length, undo.redos.length, manager.changeRecordedListeners.length]).deep.equals([0, 0, 0]);
    expect(undo.undoInProgress).equals(null);
    expect(undo.grouping.current).to.be.empty;
  });

  it('keeps explicit abandon signal/comment/remove order with the per-node helper', () => {
    const grandchild = morph({ name: 'G' }), child = morph({ name: 'C', submorphs: [grandchild] }), root = morph({ name: 'R', submorphs: [child] });
    const events = [], observers = [];
    const originalWorld = $world.emptyCommentsFor;
    const ide = $world.isIDEWorld;
    $world.emptyCommentsFor = node => events.push('comments:' + node.name);
    for (const node of [root, child, grandchild]) {
      const observer = { record () { events.push('signal:' + node.name); } }; observers.push([node, observer]);
      connect(node, 'onAbandon', observer, 'record');
    }
    root.remove = () => events.push('remove:R');
    try {
      root.abandon();
      const expected = ['signal:R', ...(ide ? ['comments:R'] : []), 'remove:R', 'signal:C', ...(ide ? ['comments:C'] : []), 'signal:G', ...(ide ? ['comments:G'] : [])];
      expect(events).deep.equals(expected);
      expect(child.owner).equals(root); expect(grandchild.owner).equals(child);
    } finally {
      $world.emptyCommentsFor = originalWorld;
      for (const [node, observer] of observers) disconnect(node, 'onAbandon', observer, 'record');
    }
  });

  it('installs only shared prototype guards regardless of live manager count', () => {
    const others = Array.from({ length: 10 }, () => new ChangeManager());
    const all = [manager, ...others], target = morph();
    const ordinary = ChangeManager.prototype._record;
    const failure = failureOf(() => manager.transaction({ scope: target }, () => {
      expect(ChangeManager.prototype._record).not.equals(ordinary);
      for (const current of all) expect(Object.getOwnPropertyDescriptor(current, '_record')).equals(undefined);
      const foreign = { id: 'foreign', _morphicState: { value: 0 } };
      const error = failureOf(() => others[0].addValueChange(foreign, 'value', 1));
      expect(error.kind).equals('cross-environment'); expect(foreign._morphicState.value).equals(0);
    }));
    expect(failure.kind).equals('cross-environment');
    expect(ChangeManager.prototype._record).equals(ordinary);
  });
});
