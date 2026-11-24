/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv, Hand } from '../index.js';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { ChangeManager, ValueChange } from '../changes.js';
import {
  MorphicChangeSet, MorphicRollbackError, SetMorphProperty,
  MorphicTransactionUnsupportedError, MorphicTransactionAsyncError, MorphicValueSemantics,
} from '../changes/index.js';
import { pt, Color } from 'lively.graphics';

/** Return the exact thrown value, including null and other falsy values. */
function errorFrom (fn) {
  try { fn(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

describe('morphic change foundation', function () {
  this.timeout(5000);
  let env, manager, undo;
  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    manager = env.changeManager;
    undo = env.undoManager;
  });
  afterEach(() => MorphicEnv.popDefault().uninstall());

  it('captures ordinary setters and explicit operations in one commit', () => {
    const target = morph();
    const notifications = [];
    manager.addCommittedChangeListener((set, context) => notifications.push({ set, context }));
    const result = manager.transaction({ scope: target }, tx => {
      target.opacity = 0.5;
      tx.perform(new SetMorphProperty({ targetId: target.id, property: 'rotation', before: 0, after: 1 }));
      return 42;
    });
    expect(result.value).equals(42);
    expect(result.changeSet.operations.map(op => op.property)).deep.equals(['opacity', 'rotation']);
    expect(undo.undos).to.have.length(1);
    expect(notifications).to.have.length(1);
    expect(notifications[0].context.capturedChangeSet).equals(result.changeSet);
    undo.undo();
    expect(target.opacity).equals(1);
    expect(target.rotation).equals(0);
    undo.redo();
    expect(target.opacity).equals(0.5);
    expect(target.rotation).equals(1);
  });

  it('captures setter-generated leaves once in actual write order', () => {
    const target = morph();
    target.setProperty('wrapped', 0);
    Object.defineProperty(target, 'wrapped', {
      configurable: true,
      get () { return this.getProperty('wrapped'); },
      set (value) { this.rotation = value; this.setProperty('wrapped', value); }
    });
    const result = manager.transaction({ scope: target }, tx => tx.perform(new SetMorphProperty({
      targetId: target.id, property: 'wrapped', before: 0, after: 1
    })));
    expect(result.changeSet.operations.map(op => op.property)).deep.equals(['rotation', 'wrapped']);
    undo.undo();
    expect(target.wrapped).equals(0);
    expect(target.rotation).equals(0);
    undo.redo();
    expect(target.wrapped).equals(1);
    expect(target.rotation).equals(1);
  });

  it('requires a history owner before an undoable callback runs', () => {
    const isolated = new ChangeManager();
    let ran = false;
    errorFrom(() => isolated.transaction({}, () => { ran = true; }));
    expect(ran).equals(false);
    const result = isolated.transaction({ undoable: false }, () => 23);
    expect(result.value).equals(23);
    expect(result.history).equals(null);
  });

  it('closes scope handles and does not publish empty commits', () => {
    let handle, commits = 0;
    manager.addCommittedChangeListener(() => commits++);
    manager.transaction({}, tx => { handle = tx; });
    expect(undo.undos).to.have.length(0);
    expect(commits).equals(0);
    expect(errorFrom(() => handle.perform(null)).message).equals('Transaction scope is closed');
  });

  it('recovers a setter which fails after its write even when the callback catches it', () => {
    const target = morph();
    const cause = new Error('makeDirty failed after assignment');
    target.makeDirty = () => { throw cause; };
    const error = errorFrom(() => manager.transaction({ scope: target }, () => {
      expect(errorFrom(() => { target.opacity = 0.5; })).equals(cause);
    }));
    expect(error).equals(cause);
    expect(target.opacity).equals(1);
    expect(undo.undos).to.have.length(0);
    expect(manager._lastRollbackDiagnostics[0].error).equals(cause);
  });

  it('rolls back scalar and nested mutable writes exactly', () => {
    const target = morph();
    const before = { nested: { values: [1] } };
    const after = { nested: { values: [2] } };
    target.setProperty('payload', before);
    const cause = new Error('callback');
    let commits = 0;
    manager.addCommittedChangeListener(() => commits++);
    const error = errorFrom(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      target.setProperty('payload', after);
      after.nested.values.push(9);
      throw cause;
    }));
    expect(error).equals(cause);
    expect(target.opacity).equals(1);
    expect(target.getProperty('payload')).deep.equals(before);
    expect(commits).equals(0);
    expect(undo.undos).to.have.length(0);
    expect(manager._atomicFrame).equals(null);
  });

  it('preserves cycles reference identity and captured custom policies', () => {
    const target = morph();
    const before = Object.create(null);
    before.self = before;
    before.values = [1];
    const after = { values: [2] };
    after.self = after;
    const reference = morph();
    target.setProperty('payload', before);
    target.setProperty('reference', reference);
    manager.setPropertyValuePolicy('reference', { valueSemantics: MorphicValueSemantics.REFERENCE });
    const result = manager.transaction({ scope: target }, () => {
      target.setProperty('payload', after);
      target.setProperty('reference', target);
    });
    after.values.push(3);
    expect(result.changeSet.operations[0].after.values).deep.equals([2]);
    after.values.pop(); // Restore live preconditions after the deliberately unrecorded mutation.
    undo.undo();
    const restored = target.getProperty('payload');
    expect(Object.getPrototypeOf(restored)).equals(null);
    expect(restored.self).equals(restored);
    expect(restored.values).deep.equals([1]);
    expect(target.getProperty('reference')).equals(reference);
    undo.redo();
    expect(target.getProperty('payload').values).deep.equals([2]);
    expect(result.changeSet.operations[1].before).equals(reference);

    class Box { constructor (value) { this.value = value; } }
    manager.setPropertyValuePolicy('box', {
      valueSemantics: MorphicValueSemantics.SNAPSHOT,
      snapshotValue: box => box.value,
      materializeValue: value => new Box(value),
      snapshotValuesEqual: Object.is
    });
    target.setProperty('box', new Box(1));
    manager.transaction({ scope: target }, () => target.setProperty('box', new Box(2)));
    manager.removePropertyValuePolicy('box');
    undo.undo();
    expect(target.getProperty('box').value).equals(1);
    undo.redo();
    expect(target.getProperty('box').value).equals(2);
  });

  it('restores add remove reorder and transformed reparent', () => {
    const source = morph({ position: pt(20, 30), rotation: 0.25, submorphs: [{ name: 'a' }, { name: 'child', position: pt(5, 7), rotation: Math.PI * 2 + 0.3, scale: 1.7 }, { name: 'z' }] });
    const destination = morph({ position: pt(80, 90), rotation: -0.5, scale: 2 });
    const child = source.submorphs[1];
    const transform = child.getTransform().copy();
    const localRotation = child.rotation;
    const localScale = child.scale;
    manager.transaction({ scope: [source, destination] }, () => destination.addMorph(child));
    const movedTransform = child.getTransform().copy();
    undo.undo();
    expect(child.owner).equals(source);
    expect(source.submorphs.indexOf(child)).equals(1);
    expect(child.rotation).equals(localRotation);
    expect(child.scale).equals(localScale);
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) expect(child.getTransform()[key]).equals(transform[key]);
    undo.redo();
    expect(child.owner).equals(destination);
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) expect(child.getTransform()[key]).equals(movedTransform[key]);
    manager.transaction({ scope: destination }, () => child.remove());
    undo.undo();
    expect(child.owner).equals(destination);
    expect(destination.submorphs[0]).equals(child);
    manager.transaction({ scope: source }, () => source.addMorphAt(source.submorphs[1], 0));
    undo.undo();
    expect(source.submorphs.map(m => m.name)).deep.equals(['a', 'z']);
    const added = morph();
    manager.transaction({ scope: source }, () => source.addMorph(added));
    undo.undo();
    expect(added.owner).equals(null);
    undo.redo();
    expect(added.owner).equals(source);
    const hand = new Hand(1);
    manager.transaction({ scope: [source, hand] }, () => hand.addMorph(added));
    undo.undo();
    expect(added.owner).equals(source);
    undo.redo();
    expect(added.owner).equals(hand);
  });

  for (const phase of ['after splice', 'after removal', 'before owner assignment', 'after insertion']) {
    it(`recovers a structural primitive failing ${phase}`, () => {
      const source = morph({ submorphs: [{ name: 'a' }, { name: 'child' }, { name: 'z' }] });
      const destination = morph();
      const child = source.submorphs[1];
      const cause = new Error(phase);
      if (phase === 'after splice') child.suspendSteppingAll = () => { throw cause; };
      else if (phase === 'before owner assignment') {
        let currentOwner = child._owner;
        Object.defineProperty(child, '_owner', {
          configurable: true,
          get () { return currentOwner; },
          set (owner) { if (owner === destination) throw cause; currentOwner = owner; }
        });
      } else if (phase === 'after removal') {
        const remove = child.remove;
        child.remove = function () { remove.call(this); throw cause; };
      } else child.onOwnerChanged = owner => { if (owner === destination) throw cause; };
      const failure = errorFrom(() => manager.transaction({ scope: [source, destination] }, () => {
        source.opacity = 0.5;
        destination.addMorph(child);
      }));
      expect(failure).equals(cause);
      expect(source.opacity).equals(1);
      expect(child.owner).equals(source);
      expect(source.submorphs.map(m => m.name)).deep.equals(['a', 'child', 'z']);
      expect(destination.submorphs).to.have.length(0);
      expect(undo.undos).to.have.length(0);
    });
  }

  it('treats nested transactions as savepoints', () => {
    const target = morph();
    const cause = new Error('inner');
    let commits = 0;
    manager.addCommittedChangeListener(() => commits++);
    const result = manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      expect(errorFrom(() => manager.transaction({}, () => { target.rotation = 1; throw cause; }))).equals(cause);
      expect(target.rotation).equals(0);
      manager.transaction({}, () => { target.scale = 2; });
      expect(commits).equals(0);
    });
    expect(commits).equals(1);
    expect(result.changeSet.operations.map(op => op.property)).deep.equals(['opacity', 'scale']);
    undo.undo();
    expect(target.opacity).equals(1);
    expect(target.scale).equals(1);
  });

  it('rejects unsupported method changes before the callback even if caught', () => {
    const target = morph();
    let ran = false, rejection;
    const error = errorFrom(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      rejection = errorFrom(() => target.addMethodCallChangeDoing({ target, selector: 'opaque', args: [] }, () => { ran = true; }));
    }));
    expect(error).equals(rejection);
    expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(ran).equals(false);
    expect(target.opacity).equals(1);
  });

  it('rejects unrecorded values and public recording suppression', () => {
    const target = morph();
    for (const kind of ['value', 'dont-record']) {
      let ran = false;
      const error = errorFrom(() => manager.transaction({ scope: target }, () => {
        target.opacity = 0.5;
        if (kind === 'value') {
          const change = new ValueChange(target, 'rotation', 1, {});
          Object.defineProperty(change, 'operation', { value: null });
          manager._record(target, change);
        } else target.dontRecordChangesWhile(() => { ran = true; });
      }));
      expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
      expect(ran).equals(false);
      expect(target.opacity).equals(1);
      expect(target.rotation).equals(0);
    }
  });

  it('rejects cross-environment writes and opaque operations', () => {
    const target = morph();
    const other = new ChangeManager();
    const foreign = { id: 'foreign', _morphicState: { value: 0 }, makeDirty () {}, onChange () {} };
    const error = errorFrom(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      other.addValueChange(foreign, 'value', 1);
    }));
    expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(foreign._morphicState.value).equals(0);
    expect(target.opacity).equals(1);
    let applied = false;
    errorFrom(() => manager.transaction({}, tx => tx.perform({
      kind: 'unknown', targetId: target.id, apply () { applied = true; }
    })));
    expect(applied).equals(false);
  });

  it('rejects thenables synchronously without absorbing the continuation', async () => {
    const target = morph();
    const continuationError = new Error('post-await');
    let continuation, postAwaitMeta;
    const error = errorFrom(() => manager.transaction({ scope: target, metadata: { marker: true } }, () => {
      continuation = (async () => {
        target.opacity = 0.5;
        await Promise.resolve();
        postAwaitMeta = manager.defaultMeta;
        target.rotation = 1;
        throw continuationError;
      })();
      return continuation;
    }));
    expect(error).to.be.instanceOf(MorphicTransactionAsyncError);
    expect(target.opacity).equals(1);
    expect(manager._atomicFrame).equals(null);
    expect(undo.undos).to.have.length(0);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(target.rotation).equals(1);
    expect(postAwaitMeta).deep.equals({});
    expect(undo.undos).to.have.length(0);
  });

  it('keeps original thrown values and throwing then getters after complete rollback', () => {
    const target = morph();
    for (const cause of [new Error('callback'), 0, null]) {
      expect(errorFrom(() => manager.transaction({ scope: target }, () => { target.opacity = 0.5; throw cause; }))).equals(cause);
      expect(target.opacity).equals(1);
    }
    const cause = new Error('then getter');
    expect(errorFrom(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      return { get then () { throw cause; } };
    }))).equals(cause);
    expect(target.opacity).equals(1);
  });

  for (const innerIncomplete of [false, true]) for (const outerIncomplete of [false, true]) {
    it(`aggregates rollback: inner ${innerIncomplete ? 'incomplete' : 'complete'}, outer ${outerIncomplete ? 'incomplete' : 'complete'}`, () => {
      const target = morph();
      const originalSet = target.setProperty;
      const cause = new Error('root cause');
      const inverseErrors = { opacity: new Error('outer inverse'), rotation: new Error('inner inverse') };
      target.setProperty = function (property, value) {
        if ((property === 'opacity' && value === 1 && outerIncomplete) ||
            (property === 'rotation' && value === 0 && innerIncomplete)) throw inverseErrors[property];
        return originalSet.call(this, property, value);
      };
      const error = errorFrom(() => manager.transaction({ scope: target }, () => {
        target.opacity = 0.5;
        manager.transaction({}, () => { target.rotation = 1; throw cause; });
      }));
      if (!innerIncomplete && !outerIncomplete) expect(error).equals(cause);
      else {
        expect(error).to.be.instanceOf(MorphicRollbackError);
        expect(error.cause).equals(cause);
        expect(error.rollbackErrors.map(fault => fault.operation.property)).deep.equals([
          ...(innerIncomplete ? ['rotation'] : []), ...(outerIncomplete ? ['opacity'] : [])
        ]);
        expect(error.unreversedOperations.map(op => op.property)).deep.equals(error.rollbackErrors.map(fault => fault.operation.property));
      }
      expect(target.opacity).equals(outerIncomplete ? 0.5 : 1);
      expect(target.rotation).equals(innerIncomplete ? 1 : 0);
      expect(undo.undos).to.have.length(0);
    });
  }

  it('forbids outer commit after a caught incomplete inner rollback', () => {
    const target = morph();
    const originalSet = target.setProperty;
    target.setProperty = function (property, value) {
      if (property === 'rotation' && value === 0) return;
      return originalSet.call(this, property, value);
    };
    const cause = new Error('inner');
    let innerError;
    const error = errorFrom(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      innerError = errorFrom(() => manager.transaction({}, () => { target.rotation = 1; throw cause; }));
      expect(errorFrom(() => { target.scale = 2; })).equals(innerError);
      return 'must not commit';
    }));
    expect(error).to.be.instanceOf(MorphicRollbackError);
    expect(error.cause).equals(cause);
    expect(error.unreversedOperations).to.have.length(1);
    expect(target.opacity).equals(1);
    expect(target.scale).equals(1);
    expect(undo.undos).to.have.length(0);
  });

  it('continues rollback and reports every incomplete operation in reverse order', () => {
    const target = morph();
    const set = target.setProperty;
    target.setProperty = function (property, value) {
      if (property === 'rotation' && value === 0) return;
      if (property === 'opacity' && value === 1) throw new Error('blocked opacity inverse');
      return set.call(this, property, value);
    };
    const cause = new Error('callback');
    const error = errorFrom(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      target.scale = 2;
      target.rotation = 1;
      throw cause;
    }));
    expect(error).to.be.instanceOf(MorphicRollbackError);
    expect(error.cause).equals(cause);
    expect(error.unreversedOperations.map(op => op.property)).deep.equals(['rotation', 'opacity']);
    expect(error.rollbackErrors.map(({ operation }) => operation.property)).deep.equals(['rotation', 'opacity']);
    expect(target.scale).equals(1);
  });

  it('does not mask a caught incomplete inner failure with a later outer error', () => {
    const target = morph();
    const set = target.setProperty;
    target.setProperty = function (property, value) {
      if (property === 'rotation' && value === 0) return;
      return set.call(this, property, value);
    };
    const cause = new Error('inner original');
    const error = errorFrom(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      errorFrom(() => manager.transaction({}, () => { target.rotation = 1; throw cause; }));
      throw new Error('outer must not mask the original');
    }));
    expect(error.cause).equals(cause);
    expect(error.unreversedOperations).to.have.length(1);
    expect(target.opacity).equals(1);
  });

  it('verifies an inverse which throws after actually restoring the state', () => {
    const target = morph();
    const originalSet = target.setProperty;
    target.setProperty = function (property, value) {
      const result = originalSet.call(this, property, value);
      if (property === 'opacity' && value === 1) throw new Error('inverse already restored');
      return result;
    };
    const cause = new Error('original');
    expect(errorFrom(() => manager.transaction({ scope: target }, () => { target.opacity = 0.5; throw cause; }))).equals(cause);
    expect(target.opacity).equals(1);
  });

  it('delivers morph originals before inverses and no committed rollback event', () => {
    const owner = morph({ submorphs: [{}] });
    const target = owner.submorphs[0];
    const seen = [];
    let commits = 0;
    target.onChange = change => { if (change.prop === 'opacity') seen.push(['target', change.value]); };
    owner.onSubmorphChange = change => { if (change.prop === 'opacity') seen.push(['owner', change.value]); };
    manager.addCommittedChangeListener(() => commits++);
    errorFrom(() => manager.transaction({ scope: owner }, () => { target.opacity = 0.5; throw new Error('stop'); }));
    expect(seen).deep.equals([['target', 0.5], ['owner', 0.5], ['target', 1], ['owner', 1]]);
    expect(commits).equals(0);
    manager.transaction({ scope: owner }, () => { target.opacity = 0.75; });
    expect(commits).equals(1);
  });

  it('defers fallback consumers until committed ownership exists and drops failed callbacks', () => {
    const target = morph();
    const owned = new WeakSet();
    const observed = [];
    target.onChange = change => {
      if (change.prop === 'opacity') manager.deferAfterChangeNotifications(change, () => observed.push(owned.has(change)));
    };
    manager.addCommittedChangeListener((set, context) => context.legacyChanges.forEach(change => owned.add(change)));
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(observed).deep.equals([true]);
    errorFrom(() => manager.transaction({ scope: target }, () => { target.opacity = 0.25; throw new Error('stop'); }));
    expect(observed).deep.equals([true]);
    target.opacity = 0.75;
    expect(observed).deep.equals([true, true]);
  });

  it('joins synchronous morph reactions and commits consumer writes as separate work', () => {
    const target = morph();
    const commits = [];
    target.onChange = change => { if (change.prop === 'opacity') target.rotation = change.value; };
    manager.addCommittedChangeListener(set => {
      commits.push(set.operations.map(op => op.property));
      if (commits.length === 1) target.scale = 2;
    });
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(result.changeSet.operations.map(op => op.property)).deep.equals(['opacity', 'rotation']);
    expect(commits).deep.equals([['opacity', 'rotation'], ['scale']]);
    expect(result.changeSet.operations.some(op => op.property === 'scale')).equals(false);
    expect(manager._atomicFrame).equals(null);
  });

  it('treats committed consumer exceptions as postcommit diagnostics', () => {
    const target = morph();
    const logged = [];
    const previous = console.error;
    const cause = new Error('consumer');
    manager.addCommittedChangeListener(() => { throw cause; });
    console.error = (...args) => logged.push(args);
    try { manager.transaction({ scope: target }, () => { target.opacity = 0.5; }); } finally { console.error = previous; }
    expect(target.opacity).equals(0.5);
    expect(undo.undos).to.have.length(1);
    expect(logged).to.have.length(1);
  });

  it('replays without recording feedback and restores partially failing replay', () => {
    const target = morph();
    const origins = [];
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    manager.addCommittedChangeListener(set => {
      origins.push(set.origin);
      undo.undoStart(target, 'must not record replay');
    });
    undo.undo();
    undo.redo();
    expect(origins).deep.equals(['undo', 'redo']);
    expect(undo.undos).to.have.length(1);
    expect(undo.undoInProgress).equals(null);
    expect(undo.applyCount).equals(0);
    const originalSet = target.setProperty;
    const cause = new Error('replay');
    target.setProperty = function (property, value) {
      const result = originalSet.call(this, property, value);
      if (property === 'opacity' && value === 1) throw cause;
      return result;
    };
    expect(errorFrom(() => undo.undo())).equals(cause);
    expect(target.opacity).equals(0.5);
    expect(undo.undos).to.have.length(0);
    expect(undo.redos).to.have.length(0);
    expect(undo.applyCount).equals(0);
  });

  it('checks sequential replay preconditions at each operation and never creates history', () => {
    const target = morph();
    const set = new MorphicChangeSet({ id: 'sequential', operations: [
      new SetMorphProperty({ targetId: target.id, property: 'opacity', before: 1, after: 0.5 }),
      new SetMorphProperty({ targetId: target.id, property: 'opacity', before: 0.5, after: 0.25 })
    ] });
    const context = manager.operationContext({ scope: target });
    manager.applyChangeSet(set, { context });
    expect(target.opacity).equals(0.25);
    manager.applyChangeSet(set, { context, direction: 'undo' });
    expect(target.opacity).equals(1);
    expect(undo.undos).to.have.length(0);
    expect(undo.applyCount).equals(0);
  });

  it('coalesces only continuous scalar events within one active group', () => {
    const target = morph();
    undo.undoStart(target, 'drag');
    for (let i = 1; i <= 100; i++) manager.transaction({ scope: target }, () => { target.opacity = 1 - i / 200; });
    expect(undo.undoInProgress.joinedTransactions).to.have.length(1);
    expect(undo.undoInProgress.joinedTransactions[0].changeSet.operations).to.have.length(1);
    undo.undoStop();
    expect(undo.undos).to.have.length(1);
    undo.undo();
    expect(target.opacity).equals(1);
    undo.redo();
    expect(target.opacity).equals(0.5);
    undo.undoStart(target, 'next drag');
    manager.transaction({ scope: target }, () => { target.opacity = 0.25; });
    undo.undoStop();
    expect(undo.undos).to.have.length(2);
  });

  it('detects discard then add at the same recorder count', () => {
    const target = morph();
    undo.undoStart(target, 'drag');
    target.fill = Color.red;
    manager.transaction({ scope: target }, () => { target.opacity = 0.75; });
    const first = undo.undoInProgress.recorder.changes.slice();
    undo.discardRecordedChanges(first);
    target.fill = Color.green;
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(undo.undoInProgress.joinedTransactions).to.have.length(2);
    undo.undoStop();
  });

  it('keeps successful gesture events when a later event fails and closes an abandoned group', () => {
    const target = morph();
    undo.undoStart(target, 'drag');
    manager.transaction({ scope: target }, () => { target.opacity = 0.75; });
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    errorFrom(() => manager.transaction({ scope: target }, () => { target.opacity = 0.25; throw new Error('event'); }));
    expect(target.opacity).equals(0.5);
    undo.undoStart(target, 'next gesture');
    expect(undo.undos).to.have.length(1);
    manager.transaction({ scope: target }, () => { target.rotation = 1; });
    undo.undoStop();
    undo.undo();
    expect(target.rotation).equals(0);
    expect(target.opacity).equals(0.5);
    undo.undo();
    expect(target.opacity).equals(1);
    undo.redo();
    expect(target.opacity).equals(0.5);
  });
});
