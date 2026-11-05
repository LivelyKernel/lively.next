/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, Text, World, MorphicEnv } from '../index.js';
import { pt } from 'lively.graphics';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { UndoManager, EditTransaction, EditTransactionKind } from '../undo.js';
import { GroupChange, MethodCallChange } from '../changes.js';
import { SetMorphProperty } from '../changes/index.js';

/** Preserve the exact structured failure for the preflight assertions. */
function failureOf (fn) {
  try { fn(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

/** Use an indivisible domain entry, without component or IDE machinery. */
function entry (apply, reverseApply) {
  const result = new EditTransaction({ kind: EditTransactionKind.COMPONENT_COMMAND, label: 'owned edit' });
  result.apply = apply;
  result.reverseApply = reverseApply;
  return result;
}

/** Count ownership allocations without changing committed-listener registration. */
function countOwnershipWork (fn) {
  const counts = {};
  const originals = {};
  for (const name of ['_commitToken', '_stageCommit', '_publishCommit']) {
    originals[name] = UndoManager[name];
    counts[name] = 0;
    UndoManager[name] = function (...args) { counts[name]++; return originals[name].apply(this, args); };
  }
  try { fn(counts); } finally {
    for (const name of Object.keys(originals)) UndoManager[name] = originals[name];
  }
}

describe('morphic history ownership', function () {
  this.timeout(5000);
  let env, manager, undo;
  let previousWorld;
  beforeEach(async () => {
    previousWorld = globalThis.$world;
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    await env.setWorld(new World({ extent: pt(600, 400) }));
    manager = env.changeManager;
    undo = env.undoManager;
  });
  afterEach(() => {
    try { MorphicEnv.popDefault().uninstall(); }
    finally { globalThis.$world = previousWorld; }
  });

  it('lazy delivery: does no ownership work for an unused context', () => {
    const target = morph();
    let context;
    manager.addCommittedChangeListener((set, commit) => { context = commit; });
    countOwnershipWork(counts => {
      target.opacity = 0.5;
      expect(counts).deep.equals({ _commitToken: 0, _stageCommit: 0, _publishCommit: 0 });
    });
    expect(Object.isFrozen(context)).equals(true);
    expect(Object.getPrototypeOf(context)).equals(Object.prototype);
    expect(Object.keys(context)).deep.equals(['legacyChanges', 'committedChange', 'resolveMorph']);
    expect('commitToken' in context).equals(false);
    expect(manager._activeCommitDeliveries).to.be.empty;
    expect(manager._usedCommitDeliveries).to.be.empty;
    expect(context.resolveMorph(target.id)).equals(target);
  });

  it('lazy delivery: a read-only token does not stage or publish history', () => {
    const target = morph();
    let context, token, repeated;
    manager.addCommittedChangeListener((set, commit) => {
      context = commit; token = manager.commitTokenFor(commit); repeated = manager.commitTokenFor(commit);
    });
    countOwnershipWork(counts => {
      target.opacity = 0.5;
      expect(counts).deep.equals({ _commitToken: 1, _stageCommit: 0, _publishCommit: 0 });
      expect(token).equals(repeated);
      expect(failureOf(() => manager.commitTokenFor(context)).kind).equals('published');
      expect(failureOf(() => undo.replaceRecordedChanges(context.legacyChanges, entry(() => {}, () => {}), { commitToken: token })).kind).equals('published');
      expect(counts._stageCommit).equals(0);
    });
    expect(undo.undos).to.be.empty;
  });

  it('lazy delivery: rejects a saved token after publishing the final owner', () => {
    const target = morph();
    const domain = entry(() => {}, () => {});
    let context, token;
    manager.addCommittedChangeListener((set, commit) => {
      context = commit; token = manager.commitTokenFor(commit);
      undo.replaceRecordedChanges(commit.legacyChanges, domain, { commitToken: token });
    });
    target.opacity = 0.5;
    const history = undo.undos.slice();
    expect(history).deep.equals([domain]);
    expect(failureOf(() => undo.replaceRecordedChanges(context.legacyChanges, entry(() => {}, () => {}), { commitToken: token })).kind).equals('published');
    expect(undo.undos).deep.equals(history);
  });

  it('lazy delivery: rejects a first late token read without creating pending history', () => {
    const target = morph();
    let context;
    manager.addCommittedChangeListener((set, commit) => { context = commit; });
    countOwnershipWork(counts => {
      target.opacity = 0.5;
      expect(failureOf(() => manager.commitTokenFor(context)).kind).equals('published');
      expect(counts).deep.equals({ _commitToken: 0, _stageCommit: 0, _publishCommit: 0 });
    });
    expect(undo.undos).to.be.empty;
  });

  it('lazy delivery: keeps outer-first-use chronology after a reentrant delivery', () => {
    const target = morph();
    const outer = entry(() => { target.opacity = 0.5; }, () => { target.opacity = 1; });
    const inner = entry(() => { target.rotation = 0.25; }, () => { target.rotation = 0; });
    let entered = false;
    const listener = manager.addCommittedChangeListener((set, context) => {
      if (entered) {
        undo.replaceRecordedChanges(context.legacyChanges, inner, { commitToken: manager.commitTokenFor(context) });
        return;
      }
      entered = true;
      target.rotation = 0.25;
      expect(undo.undos).deep.equals([inner]);
      undo.replaceRecordedChanges(context.legacyChanges, entry(() => {}, () => {}), { commitToken: manager.commitTokenFor(context) });
      undo.replaceRecordedChanges(context.legacyChanges, outer, { commitToken: manager.commitTokenFor(context) });
      expect(undo.undos).deep.equals([inner]);
    });
    target.opacity = 0.5;
    expect(undo.undos).deep.equals([outer, inner]);
    manager.removeCommittedChangeListener(listener);
    undo.undo(); expect([target.opacity, target.rotation]).deep.equals([0.5, 0]);
    undo.undo(); expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    undo.redo(); undo.redo();
    expect([target.opacity, target.rotation]).deep.equals([0.5, 0.25]);
  });

  it('lazy delivery: closes an unused lifetime after failed listener reporting', () => {
    const target = morph();
    let context;
    manager.addCommittedChangeListener((set, commit) => { context = commit; throw null; });
    countOwnershipWork(counts => {
      expect(failureOf(() => { target.opacity = 0.5; }) instanceof TypeError).equals(true);
      expect(failureOf(() => manager.commitTokenFor(context)).kind).equals('published');
      expect(counts).deep.equals({ _commitToken: 0, _stageCommit: 0, _publishCommit: 0 });
    });
    expect(undo.undos).to.be.empty;
    expect(manager._activeCommitDeliveries).to.be.empty;
    expect(manager._usedCommitDeliveries).to.be.empty;
  });

  it('manager token API: accepts an active outer context during an inner delivery', () => {
    const target = morph();
    const outer = entry(() => { target.opacity = 0.5; }, () => { target.opacity = 1; });
    const inner = entry(() => { target.rotation = 0.25; }, () => { target.rotation = 0; });
    let outerContext;
    const listener = manager.addCommittedChangeListener((set, context) => {
      if (!outerContext) {
        outerContext = context;
        target.rotation = 0.25;
      } else {
        undo.replaceRecordedChanges(outerContext.legacyChanges, outer, { commitToken: manager.commitTokenFor(outerContext) });
        undo.replaceRecordedChanges(context.legacyChanges, inner, { commitToken: manager.commitTokenFor(context) });
      }
    });
    target.opacity = 0.5;
    expect(undo.undos).deep.equals([outer, inner]);
    expect(manager._activeCommitDeliveries).to.be.empty;
    expect(manager._usedCommitDeliveries).to.be.empty;
    manager.removeCommittedChangeListener(listener);
    undo.undo(); undo.undo(); expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    undo.redo(); undo.redo(); expect([target.opacity, target.rotation]).deep.equals([0.5, 0.25]);
  });

  it('manager token API: rejects foreign and saved compensation tokens before mutation', () => {
    const target = morph();
    let saved, token, context;
    manager.addCommittedChangeListener((set, commit) => {
      if (set.origin !== 'user') return;
      saved = set; context = commit; token = manager.commitTokenFor(commit);
      expect(failureOf(() => manager.commitTokenFor({ ...commit })).kind).equals('published');
      expect(failureOf(() => manager.compensate(set, { context: commit, commitToken: {} })).kind).equals('published');
      expect(target.opacity).equals(0.5);
    });
    target.opacity = 0.5;
    expect(failureOf(() => manager.compensate(saved, { context, commitToken: token })).kind).equals('published');
    expect(target.opacity).equals(0.5);
    expect(manager.compensate(saved, { context }).state).equals('compensated');
    expect(target.opacity).equals(1);
  });

  /** A and C surround the observable unrelated B event. */
  function recordABC () {
    const target = morph();
    undo.undoStart(target, 'A B C');
    target.opacity = 0.8;
    target.rotation = 0.25;
    target.opacity = 0.4;
    return { target, records: undo.undoInProgress.recorder.changes.slice() };
  }

  it('preserves the original chronological observer values', () => {
    const { target } = recordABC();
    const values = [];
    target.onChange = change => { if (change.prop === 'rotation') values.push(target.opacity); };
    undo.undoStop(); undo.undo(); undo.redo();
    expect(values).deep.equals([0.8, 0.8]);
  });

  it('replaces one contiguous slot with exact chronological observer values', () => {
    const { target, records } = recordABC();
    const values = [];
    target.onChange = change => { if (change.prop === 'rotation') values.push(target.opacity); };
    const replacement = entry(() => { target.rotation = 0.25; }, () => { target.rotation = 0; });
    expect(undo.replaceRecordedChanges([records[1]], replacement)).equals(replacement);
    undo.undoStop(); undo.undo(); undo.redo();
    expect(values).deep.equals([0.8, 0.8]);
  });

  it('rejects a noncontiguous run before discarding any identities', () => {
    const { records } = recordABC();
    const active = undo.undoInProgress;
    const original = active.recorder.changes;
    const replacement = entry(() => {}, () => {});
    const error = failureOf(() => undo.replaceRecordedChanges([records[0], records[2]], replacement));
    expect(error.name).equals('MorphicHistoryOwnershipError');
    expect(error.kind).equals('noncontiguous');
    expect(error.ownedIdentities).deep.equals([records[0], records[2]]);
    expect(error.interleavedEntries).deep.equals([records[1]]);
    expect(active.recorder.changes).equals(original);
    expect(active.recorder.changes).deep.equals(records);
    expect(active.joinedTransactions).to.be.empty;
    expect(undo.undos).to.be.empty;
  });

  it('keeps unrelated work between two separate contiguous replacements', () => {
    const { target, records } = recordABC();
    const values = [];
    target.onChange = change => { if (change.prop === 'rotation') values.push(target.opacity); };
    undo.replaceRecordedChanges([records[0]], entry(() => { target.opacity = 0.8; }, () => { target.opacity = 1; }));
    undo.replaceRecordedChanges([records[2]], entry(() => { target.opacity = 0.4; }, () => { target.opacity = 0.8; }));
    undo.undoStop(); undo.undo(); undo.redo();
    expect(values).deep.equals([0.8, 0.8]);
  });

  it('preflights every identity without a partial discard', () => {
    const { records } = recordABC();
    const original = undo.undoInProgress.recorder.changes;
    const missing = {};
    const error = failureOf(() => undo.replaceRecordedChanges([records[0], missing], entry(() => {}, () => {})));
    expect(error.name).equals('MorphicHistoryOwnershipError');
    expect(error.kind).equals('missing');
    expect(error.missingIdentities).deep.equals([missing]);
    expect(undo.undoInProgress.recorder.changes).equals(original);
  });

  it('preserves nested transparent wrappers without duplicate inverses', () => {
    const target = morph();
    undo.undoStart(target, 'nested');
    const outer = manager.groupChangesWhile(target, null, () => {
      target.rotation = 0.1;
      manager.groupChangesWhile(target, null, () => { target.opacity = 0.5; target.scale = 2; });
    });
    const owned = outer.changes[1].changes[0];
    let inverses = 0;
    undo.replaceRecordedChanges([owned], entry(() => { target.opacity = 0.5; }, () => { inverses++; target.opacity = 1; }));
    undo.undoStop(); undo.undo();
    expect([target.rotation, target.opacity, target.scale]).deep.equals([0, 1, 1]);
    expect(inverses).equals(1);
    undo.redo();
    expect([target.rotation, target.opacity, target.scale]).deep.equals([0.1, 0.5, 2]);
  });

  it('rejects partial ownership of an opaque method wrapper', () => {
    const target = morph();
    undo.undoStart(target, 'opaque');
    const wrapper = new MethodCallChange(target, 'opaque', [], () => {}, {});
    manager.groupChangesWhile(target, wrapper, () => { target.opacity = 0.5; target.rotation = 1; });
    const original = undo.undoInProgress.recorder.changes;
    const error = failureOf(() => undo.replaceRecordedChanges([wrapper.changes[0]], entry(() => {}, () => {})));
    expect(error.kind).equals('partial-wrapper');
    expect(undo.undoInProgress.recorder.changes).equals(original);
  });

  it('rejects an overlap with another domain before removing anything', () => {
    const { records } = recordABC();
    const owned = entry(() => {}, () => {});
    undo.replaceRecordedChanges(records.slice(0, 2), owned);
    const original = undo.undoInProgress.recorder.changes;
    const error = failureOf(() => undo.replaceRecordedChanges(records.slice(1), entry(() => {}, () => {})));
    expect(error.kind).equals('partial-overlap');
    expect(undo.undoInProgress.recorder.changes).equals(original);
    expect(undo.undoInProgress.joinedTransactions).deep.equals([owned]);
  });

  it('publishes only the final pending owner and returns its history receipt', () => {
    const target = morph();
    const domain = entry(() => { target.opacity = 0.5; }, () => { target.opacity = 1; });
    const listener = manager.addCommittedChangeListener((set, context) => {
      expect(undo.undos).to.be.empty;
      undo.replaceRecordedChanges(context.legacyChanges, domain, { commitToken: manager.commitTokenFor(context) });
      expect(undo.undos).to.be.empty;
    });
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(result.history).deep.equals({ undoManager: undo, entry: domain });
    expect(undo.undos).deep.equals([domain]);
    manager.removeCommittedChangeListener(listener);
    undo.undo(); expect(target.opacity).equals(1);
  });

  it('transfers pending text-local ownership to a world manager exactly once', () => {
    const target = new Text({ readOnly: false, textString: 'abc', fixedWidth: true, fixedHeight: true });
    const local = new UndoManager();
    let context, domain, token;
    local.undoStart(target, 'local');
    undo.undoStart(target, 'world');
    manager.addCommittedChangeListener((set, commit) => {
      context = commit;
      if (set.origin !== 'user') return;
      token = manager.commitTokenFor(commit);
      domain = entry(() => {}, () => {});
      undo.replaceRecordedChanges(commit.legacyChanges, domain, { commitToken: manager.commitTokenFor(commit) });
    });
    const result = manager.transaction({ scope: target, undoManager: local }, () => { target.insertText('X', { row: 0, column: 1 }); });
    expect(result.history).deep.equals({ undoManager: undo, entry: domain });
    expect(domain.textReplay).to.have.length(1);
    expect(domain.textReplay[0].targetId).equals(target.id);
    expect(local.undoInProgress).equals(null);
    expect(local.undos).to.be.empty;
    expect(undo.undoInProgress.joinedTransactions).deep.equals([domain]);
    undo.undoStop();
    expect(undo.undos).to.have.length(1);
    const error = failureOf(() => local.replaceRecordedChanges(context.legacyChanges, entry(() => {}, () => {}), { commitToken: token }));
    expect(error.kind).equals('published');
    expect(undo.undos).to.have.length(1);
    expect(local.undos).to.be.empty;
  });

  it('preflights both managers before a pending ownership transfer', () => {
    const target = morph();
    const alternate = new UndoManager(change => change.prop === 'opacity');
    undo.undoStart(target, 'source');
    alternate.undoStart(target, 'destination');
    let caught;
    manager.addCommittedChangeListener((set, context) => {
      const source = undo.undoInProgress.recorder.changes;
      const destination = alternate.undoInProgress.recorder.changes;
      caught = failureOf(() => alternate.replaceRecordedChanges(context.legacyChanges, entry(() => {}, () => {}), { commitToken: manager.commitTokenFor(context) }));
      expect(undo.undoInProgress.recorder.changes).equals(source);
      expect(alternate.undoInProgress.recorder.changes).equals(destination);
    });
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; target.rotation = 1; });
    expect(caught.kind).equals('missing');
    expect(undo.undoInProgress.joinedTransactions).to.have.length(1);
    alternate.undoStop();
  });

  it('cancels only a truly empty group, keeping legacy and joined gesture work', () => {
    const target = morph();
    undo.undoStart(target, 'empty');
    expect(undo.cancelEmptyGroup()).equals(true);
    expect(undo.undoInProgress).equals(null);
    expect(undo.cancelEmptyGroup()).equals(false);
    undo.undoStart(target, 'legacy');
    target.opacity = 0.5;
    expect(undo.cancelEmptyGroup()).equals(false);
    undo.undoStop();
    undo.undoStart(target, 'joined');
    manager.transaction({ scope: target }, () => { target.rotation = 1; });
    expect(undo.cancelEmptyGroup()).equals(false);
    undo.undoStop();
    expect(undo.undos).to.have.length(2);
  });

  it('treats empty transparent wrapper records as an empty group', () => {
    const target = morph();
    undo.undoStart(target, 'empty wrapper');
    manager.groupChangesWhile(target, new GroupChange(target), () => {});
    expect(undo.cancelEmptyGroup()).equals(true);
    expect(undo.undos).to.be.empty;
  });

  it('compensates a pending committed set once without history or feedback', () => {
    const target = morph();
    undo.undoStart(target, 'rejected first event');
    let deliveries = 0, inverses = 0;
    target.onChange = change => { if (change.prop === 'opacity' && change.value === 1) inverses++; };
    manager.addCommittedChangeListener((set, context) => {
      deliveries++;
      expect(manager.compensate(set, { context, commitToken: manager.commitTokenFor(context) }).state).equals('compensated');
      expect(manager.compensate(set, { context, commitToken: manager.commitTokenFor(context) }).state).equals('already-compensated');
    });
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(target.opacity).equals(1);
    expect(inverses).equals(1);
    expect(deliveries).equals(1);
    expect(result.history).equals(null);
    expect(undo.undos).to.be.empty;
    expect(undo.undoInProgress).equals(null);
  });

  it('removes the owned published entry when explicitly compensated', () => {
    const target = morph();
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    const context = result.history.entry.context;
    expect(manager.compensate(result.changeSet, { context }).state).equals('compensated');
    expect(target.opacity).equals(1);
    expect(undo.undos).to.be.empty;
    expect(manager.compensate(result.changeSet, { context }).state).equals('already-compensated');
  });

  it('compensates a legacy leaf once and suppresses its pending original delivery', () => {
    const target = morph();
    undo.undoStart(target, 'legacy rejected');
    let deliveries = 0, leaf, context;
    const observed = [];
    target.onChange = change => { if (change.prop === 'opacity') observed.push(change.value); };
    manager.addCommittedChangeListener((set, commit) => {
      deliveries++;
      context = commit;
      leaf = commit.committedChange;
      manager.compensate(leaf, { context, commitToken: manager.commitTokenFor(context) });
    });
    target.opacity = 0.5;
    expect(target.opacity).equals(1);
    expect(observed).deep.equals([1]);
    expect(deliveries).equals(1);
    expect(undo.undoInProgress).equals(null);
    expect(manager.compensate(leaf, { context }).state).equals('already-compensated');
  });

  it('compensates a typed legacy fallback without a committed consumer', () => {
    const target = morph();
    undo.undoStart(target, 'legacy fallback');
    target.opacity = 0.5;
    const change = undo.undoInProgress.recorder.changes[0];
    expect(manager.compensate(change).state).equals('compensated');
    expect(manager.compensate(change).state).equals('already-compensated');
    expect(target.opacity).equals(1);
    expect(undo.undoInProgress).equals(null);
  });

  it('compensates a saved legacy receipt without creating late pending ownership', () => {
    const target = morph();
    let context, changeSet;
    manager.addCommittedChangeListener((set, commit) => { changeSet = set; context = commit; });
    undo.undoStart(target, 'saved legacy receipt');
    target.opacity = 0.5;
    undo.undoStop();
    expect(manager.compensate(changeSet, { context }).state).equals('compensated');
    expect(target.opacity).equals(1);
    expect(undo.undos).to.be.empty;
    expect(failureOf(() => manager.commitTokenFor(context)).kind).equals('published');
    expect(manager.compensate(changeSet, { context }).state).equals('already-compensated');
  });

  it('rejects a mixed compensation state without mutating or discarding history', () => {
    const target = morph();
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; target.rotation = 1; });
    target.opacity = 1;
    const history = undo.undos.slice();
    const error = failureOf(() => manager.compensate(result.changeSet, { context: result.history.entry.context }));
    expect(error.name).equals('MorphicCompensationConflictError');
    expect(target.opacity).equals(1);
    expect(target.rotation).equals(1);
    expect(undo.undos).deep.equals(history);
  });

  it('recognizes fully restored endpoints without applying another inverse', () => {
    const target = morph();
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    const context = result.history.entry.context;
    manager.applyChangeSet(result.changeSet, { context, direction: 'undo', notify: false });
    let inverses = 0;
    target.onChange = () => inverses++;
    manager.compensate(result.changeSet, { context });
    expect(inverses).equals(0);
    expect(undo.undos).to.be.empty;
  });

  it('keeps successful earlier gesture work when the next event is compensated', () => {
    const target = morph();
    undo.undoStart(target, 'gesture');
    manager.transaction({ scope: target }, () => { target.opacity = 0.8; });
    manager.addCommittedChangeListener((set, context) => { if (set.origin === 'user') manager.compensate(set, { context, commitToken: manager.commitTokenFor(context) }); });
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(target.opacity).equals(0.8);
    expect(undo.cancelEmptyGroup()).equals(false);
    undo.undoStop();
    undo.undo(); expect(target.opacity).equals(1);
    undo.redo(); expect(target.opacity).equals(0.8);
  });

  it('stages a legacy commit without an active recorder until the final consumer', () => {
    const target = morph();
    const domain = entry(() => { target.opacity = 0.5; }, () => { target.opacity = 1; });
    manager.addCommittedChangeListener((set, context) => {
      undo.replaceRecordedChanges(context.legacyChanges, domain, { commitToken: manager.commitTokenFor(context) });
      expect(undo.undos).to.be.empty;
    });
    target.opacity = 0.5;
    expect(undo.undos).deep.equals([domain]);
  });

  it('keeps the pending original before reentrant committed-consumer history', () => {
    const target = morph();
    let original = true;
    manager.addCommittedChangeListener(() => {
      if (!original) return;
      original = false;
      manager.transaction({ scope: target }, () => { target.rotation = 0.25; });
    });
    const first = manager.transaction({ scope: target }, () => { target.opacity = 0.8; });
    expect(undo.undos[0]).equals(first.history.entry);
    undo.undo(); expect([target.opacity, target.rotation]).deep.equals([0.8, 0]);
    undo.undo(); expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    undo.redo(); undo.redo();
    expect([target.opacity, target.rotation]).deep.equals([0.8, 0.25]);
  });

  it('compensates a semantic text view through its exact attachment receipt', () => {
    const target = new Text({ readOnly: false, textString: 'abcd', fixedWidth: true, fixedHeight: true });
    const embedded = morph();
    const parent = morph({ submorphs: [morph(), embedded, morph()] });
    const siblings = parent.submorphs.slice();
    let view, context;
    manager.addCommittedChangeListener((set, commit) => { view = set; context = commit; });
    manager.transaction({ scope: [target, parent] }, () => { target.textAndAttributes = ['A', null, embedded, null]; });
    expect(view.operations[0].metadata.textReplacement).equals(true);
    expect(embedded.owner).equals(target);
    for (const wrong of [undefined, { ...context }]) {
      expect(failureOf(() => manager.compensate(view, { context: wrong })).name).equals('MorphicSemanticViewReplayError');
      expect(embedded.owner).equals(target);
    }
    expect(manager.compensate(view, { context }).state).equals('compensated');
    expect(target.textString).equals('abcd');
    expect(parent.submorphs).deep.equals(siblings);
    expect(embedded.owner).equals(parent);
    expect(undo.undos).to.be.empty;
    expect(manager.compensate(view, { context }).state).equals('already-compensated');
  });

  it('compensates an insertion instead of mistaking its empty before range for restored text', () => {
    const target = new Text({ readOnly: false, textString: 'abcd', fixedWidth: true, fixedHeight: true });
    const result = manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 1 }, false));
    expect(target.textString).equals('aXbcd');
    manager.compensate(result.changeSet, { context: result.history.entry.context });
    expect(target.textString).equals('abcd');
    expect(undo.undos).to.be.empty;
  });

  it('preserves earlier coalesced gesture work when compensating its published tail', () => {
    const target = morph();
    undo.undoStart(target, 'gesture tail');
    manager.transaction({ scope: target }, () => { target.opacity = 0.8; });
    const tail = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    manager.compensate(tail.changeSet, { context: tail.history.entry.context });
    expect(target.opacity).equals(0.8);
    undo.undoStop();
    undo.undo(); expect(target.opacity).equals(1);
    undo.redo(); expect(target.opacity).equals(0.8);
  });

  it('releases a replaced pending lifetime handle without retaining duplicate ownership', () => {
    const target = morph();
    let released = 0;
    const domain = entry(() => {}, () => {});
    manager.addCommittedChangeListener((set, context) => {
      const first = entry(() => {}, () => {});
      first.dispose = () => released++;
      undo.replaceRecordedChanges(context.legacyChanges, first, { commitToken: manager.commitTokenFor(context) });
      undo.replaceRecordedChanges(context.legacyChanges, domain, { commitToken: manager.commitTokenFor(context) });
    });
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(released).equals(1);
    expect(undo.undos).deep.equals([domain]);
  });

  it('removes a compensated closed legacy record while preserving its unrelated history', () => {
    const target = morph();
    undo.undoStart(target, 'closed mixed legacy');
    target.opacity = 0.5;
    const change = undo.undoInProgress.recorder.changes[0];
    target.rotation = 1;
    undo.undoStop();
    manager.compensate(change);
    expect([target.opacity, target.rotation]).deep.equals([1, 1]);
    expect(undo.undos).to.have.length(1);
    expect(undo.grouping.current[0]).equals(undo.undos[0]);
    undo.undo(); expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    undo.redo(); expect([target.opacity, target.rotation]).deep.equals([1, 1]);
    expect(manager.compensate(change).state).equals('already-compensated');
  });

  it('rejects an opaque legacy effect whose before state cannot be proved', () => {
    const target = morph();
    let inverted = false;
    const opaque = new MethodCallChange(target, 'opaque', [], () => { inverted = true; }, {});
    expect(failureOf(() => manager.compensate(opaque)).name).equals('MorphicCompensationConflictError');
    expect(inverted).equals(false);
  });

  it('replaces a pending explicit operation with no legacy leaves exactly once', () => {
    const recorderTarget = morph();
    const target = { id: 'plain-model', value: 0 };
    let inverses = 0;
    const domain = entry(() => { target.value = 1; }, () => { inverses++; target.value = 0; });
    undo.undoStart(recorderTarget, 'plain operation in a gesture');
    recorderTarget.rotation = 0.25;
    manager.addCommittedChangeListener((set, context) => {
      expect(context.legacyChanges).to.be.empty;
      undo.replaceRecordedChanges([], entry(() => {}, () => {}), { commitToken: manager.commitTokenFor(context) });
      undo.replaceRecordedChanges([], domain, { commitToken: manager.commitTokenFor(context) });
    });
    manager.transaction({ scope: target }, tx => tx.perform(new SetMorphProperty({ targetId: target.id, property: 'value', before: 0, after: 1 })));
    undo.undoStop();
    manager.committedChangeListeners.slice().forEach(listener => manager.removeCommittedChangeListener(listener));
    undo.undo();
    expect(target.value).equals(0);
    expect(recorderTarget.rotation).equals(0);
    expect(inverses).equals(1);
  });

  it('reports an incomplete compensation with the original cause and exact inverse diagnostic', () => {
    const target = morph();
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    const setProperty = target.setProperty;
    target.setProperty = function (property, value) {
      if (property === 'opacity' && value === 1) throw 0;
      return setProperty.call(this, property, value);
    };
    const cause = new Error('projection rejection');
    const error = failureOf(() => manager.compensate(result.changeSet, { context: result.history.entry.context, cause }));
    expect(error.name).equals('MorphicRollbackError');
    expect(error.cause).equals(cause);
    expect(error.rollbackErrors).to.have.length(1);
    expect(error.rollbackErrors[0].error).equals(0);
    expect(error.unreversedOperations).deep.equals(result.changeSet.operations);
    expect(target.opacity).equals(0.5);
    expect(undo.undos).deep.equals([result.history.entry]);
  });

  it('closes legacy pending ownership even when listener error reporting throws', () => {
    const target = morph();
    let context;
    const domain = entry(() => { target.opacity = 0.5; }, () => { target.opacity = 1; });
    undo.undoStart(target, 'listener failure');
    manager.addCommittedChangeListener((set, commit) => {
      context = commit;
      undo.replaceRecordedChanges(commit.legacyChanges, domain, { commitToken: manager.commitTokenFor(commit) });
      throw null;
    });
    expect(failureOf(() => { target.opacity = 0.5; }) instanceof TypeError).equals(true);
    expect(target.opacity).equals(0.5);
    expect(failureOf(() => undo.replaceRecordedChanges(context.legacyChanges, entry(() => {}, () => {}), { commitToken: manager.commitTokenFor(context) })).kind).equals('published');
    expect(undo.undoInProgress.joinedTransactions).deep.equals([domain]);
  });

  it('publishes atomic ownership and cleans legacy records after failed listener reporting', () => {
    const target = morph();
    let context;
    const domain = entry(() => { target.opacity = 0.5; }, () => { target.opacity = 1; });
    undo.undoStart(target, 'atomic listener failure');
    manager.addCommittedChangeListener((set, commit) => {
      context = commit;
      undo.replaceRecordedChanges(commit.legacyChanges, domain, { commitToken: manager.commitTokenFor(commit) });
      throw undefined;
    });
    expect(failureOf(() => manager.transaction({ scope: target }, () => { target.opacity = 0.5; })) instanceof TypeError).equals(true);
    expect(target.opacity).equals(0.5);
    expect(undo.undoInProgress.recorder.changes).to.be.empty;
    expect(undo.undoInProgress.joinedTransactions).deep.equals([domain]);
    expect(failureOf(() => undo.replaceRecordedChanges(context.legacyChanges, entry(() => {}, () => {}), { commitToken: manager.commitTokenFor(context) })).kind).equals('published');
  });

  it('does not create history by replacing a non-undoable pending commit', () => {
    const target = morph();
    let error;
    manager.addCommittedChangeListener((set, context) => {
      error = failureOf(() => undo.replaceRecordedChanges(context.legacyChanges, entry(() => {}, () => {}), { commitToken: manager.commitTokenFor(context) }));
      expect(undo.undos).to.be.empty;
    });
    const result = manager.transaction({ scope: target, undoable: false }, () => { target.opacity = 0.5; });
    expect(error.kind).equals('non-undoable');
    expect(result.history).equals(null);
    expect(undo.undos).to.be.empty;
  });

  it('does not split an unknown group subclass with opaque replay behaviour', () => {
    class OpaqueGroup extends GroupChange {}
    const target = morph();
    undo.undoStart(target, 'opaque subclass');
    const wrapper = new OpaqueGroup(target);
    manager.groupChangesWhile(target, wrapper, () => { target.opacity = 0.5; target.rotation = 1; });
    const original = undo.undoInProgress.recorder.changes;
    expect(failureOf(() => undo.replaceRecordedChanges([wrapper.changes[0]], entry(() => {}, () => {}))).kind).equals('partial-wrapper');
    expect(undo.undoInProgress.recorder.changes).equals(original);
  });
});
