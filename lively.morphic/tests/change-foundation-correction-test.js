/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv } from '../index.js';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { SetMorphProperty, MorphicRollbackError } from '../changes/index.js';
import { UndoManager, EditTransaction, EditTransactionKind, CompositeEditTransaction } from '../undo.js';

/** Catch an exact thrown value without confusing a falsy error with success. */
function failureOf (fn) {
  try { fn(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

describe('morphic transaction corrections', function () {
  this.timeout(5000);
  let env, manager, undo;
  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    manager = env.changeManager;
    undo = env.undoManager;
  });
  afterEach(() => MorphicEnv.popDefault().uninstall());

  for (const cause of [0, '', null, undefined, false]) {
    for (const primitive of ['setter', 'perform', 'structural']) {
      it(`rolls back a caught ${primitive} failure of ${String(cause)}`, () => {
        const source = morph({ submorphs: [{}] });
        const destination = morph();
        const target = source.submorphs[0];
        let commits = 0;
        manager.addCommittedChangeListener(() => commits++);
        if (primitive === 'structural') target.onOwnerChanged = owner => { if (owner === destination) throw cause; };
        else target.makeDirty = () => { throw cause; };
        const error = failureOf(() => manager.transaction({ scope: [source, destination] }, tx => {
          source.opacity = 0.75;
          expect(failureOf(() => {
            if (primitive === 'structural') destination.addMorph(target);
            else if (primitive === 'setter') target.opacity = 0.5;
            else tx.perform(new SetMorphProperty({ targetId: target.id, property: 'opacity', before: 1, after: 0.5 }));
          })).equals(cause);
        }));
        expect(error).equals(cause);
        expect(source.opacity).equals(1);
        expect(target.opacity).equals(1);
        expect(target.owner).equals(source);
        expect(source.submorphs).deep.equals([target]);
        expect(destination.submorphs).to.have.length(0);
        expect(undo.undos).to.have.length(0);
        expect(commits).equals(0);
      });
    }

    it(`preserves an incomplete inverse's exact ${String(cause)} error in operation pairs`, () => {
      const target = morph();
      const setProperty = target.setProperty;
      const original = new Error('callback failure');
      target.setProperty = function (property, value) {
        if ((property === 'opacity' && value === 1) || (property === 'rotation' && value === 0)) throw cause;
        return setProperty.call(this, property, value);
      };
      const error = failureOf(() => manager.transaction({ scope: target }, () => {
        target.opacity = 0.5;
        target.rotation = 1;
        throw original;
      }));
      expect(error).to.be.instanceOf(MorphicRollbackError);
      expect(error.cause).equals(original);
      expect(error.rollbackErrors.map(({ operation }) => operation.property)).deep.equals(['rotation', 'opacity']);
      expect(error.unreversedOperations).deep.equals(error.rollbackErrors.map(({ operation }) => operation));
      error.rollbackErrors.forEach(({ error: inverseError }) => expect(inverseError).equals(cause));
      expect(manager._lastRollbackDiagnostics).to.have.length(2);
      manager._lastRollbackDiagnostics.forEach(({ error: inverseError }) => expect(inverseError).equals(cause));
    });

    it(`retains a verified complete inverse's ${String(cause)} diagnostic and the original error`, () => {
      const target = morph();
      const setProperty = target.setProperty;
      const original = new Error('callback failure');
      target.setProperty = function (property, value) {
        const result = setProperty.call(this, property, value);
        if (property === 'opacity' && value === 1) throw cause;
        return result;
      };
      const error = failureOf(() => manager.transaction({ scope: target }, () => { target.opacity = 0.5; throw original; }));
      expect(error).equals(original);
      expect(target.opacity).equals(1);
      expect(manager._lastRollbackDiagnostics).to.have.length(1);
      expect(manager._lastRollbackDiagnostics[0].error).equals(cause);
    });
  }

  it('deduplicates the transaction leaves with an explicit alternate undo owner', () => {
    const target = morph();
    const alternate = new UndoManager();
    const audit = manager.recordChangesStart();
    undo.undoStart(target, 'earlier ordinary work');
    target.rotation = 0.25;
    const earlier = undo.undoInProgress.recorder.changes[0];
    alternate.undoStart(target, 'atomic owner');
    const result = manager.transaction({ scope: target, undoManager: alternate }, () => { target.opacity = 0.5; });
    expect(result.history.undoManager).equals(alternate);
    expect(undo.undoInProgress.recorder.changes).deep.equals([earlier]);
    expect(undo.undoInProgress.joinedTransactions).to.have.length(0);
    expect(alternate.undoInProgress.recorder.changes).to.have.length(0);
    expect(alternate.undoInProgress.joinedTransactions).to.have.length(1);
    expect(manager.recordChangesStop(audit.id).map(change => change.prop)).deep.equals(['rotation', 'opacity']);
    alternate.undoStop();
    undo.undoStop();
    alternate.undo();
    expect(target.opacity).equals(1);
    expect(target.rotation).equals(0.25);
    undo.undo();
    expect(target.rotation).equals(0);
    undo.redo();
    alternate.redo();
    expect(target.rotation).equals(0.25);
    expect(target.opacity).equals(0.5);
  });

  for (const boundary of ['undoStop', 'undoStart']) {
    it(`releases joined entries from the closed recording token at ${boundary}`, () => {
      const target = morph();
      undo.undoStart(target, 'first gesture');
      manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
      const recording = undo.undoInProgress;
      const joined = recording.joinedTransactions.slice();
      expect(joined).to.have.length(1);

      if (boundary === 'undoStart') undo.undoStart(target, 'next gesture');
      else undo.undoStop();

      expect(recording.isRecording()).equals(false);
      expect(recording.joinedTransactions).to.be.empty;
      expect(undo.undos[0].transactions.slice(1)).deep.equals(joined);
      if (boundary === 'undoStart') {
        manager.transaction({ scope: target }, () => { target.rotation = 0.25; });
        undo.undoStop();
        undo.undo();
        expect(target.rotation).equals(0);
        expect(target.opacity).equals(0.5);
      }
      undo.undo();
      expect(target.opacity).equals(1);
      undo.redo();
      expect(target.opacity).equals(0.5);
    });
  }

  for (const direction of ['apply', 'reverseApply']) {
    for (const nestedCompensation of [false, true]) {
      it(`keeps incomplete morphic rollback during composite ${direction} with ${nestedCompensation ? 'nested' : 'plain'} compensation failure`, () => {
        const cause = new Error('root original');
        const innerOperation = new SetMorphProperty({ targetId: 'inner', property: 'opacity', before: 1, after: 0.5 });
        const outerOperation = new SetMorphProperty({ targetId: 'outer', property: 'opacity', before: 1, after: 0.5 });
        const innerInverse = new Error('inner inverse');
        const outerInverse = new Error('outer inverse');
        const incomplete = new MorphicRollbackError('inner incomplete', {
          cause, rollbackErrors: [{ operation: innerOperation, error: innerInverse }], unreversedOperations: [innerOperation]
        });
        const compensationFailure = nestedCompensation ? new MorphicRollbackError('outer incomplete', {
          cause: new Error('outer replay failed'), rollbackErrors: [{ operation: outerOperation, error: outerInverse }], unreversedOperations: [outerOperation]
        }) : outerInverse;
        const first = new EditTransaction({ kind: EditTransactionKind.TEXT, label: 'earlier replay unit' });
        const second = new EditTransaction({ kind: EditTransactionKind.TEXT, label: 'incomplete unit' });
        const opposite = direction === 'apply' ? 'reverseApply' : 'apply';
        first[direction] = () => {};
        first[opposite] = () => { throw compensationFailure; };
        second[direction] = () => { throw incomplete; };
        const composite = new CompositeEditTransaction(direction === 'apply' ? [first, second] : [second, first]);
        const error = failureOf(() => composite[direction]());
        expect(error).to.be.instanceOf(MorphicRollbackError);
        expect(error.cause).equals(cause);
        expect(error.rollbackErrors.map(pair => pair.error)).deep.equals([innerInverse, outerInverse]);
        expect(error.unreversedOperations).deep.equals([innerOperation, nestedCompensation ? outerOperation : first]);
      });
    }
  }
});
