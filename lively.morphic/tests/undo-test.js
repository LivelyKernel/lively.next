/* global it, describe, beforeEach, afterEach */
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { morph, MorphicEnv } from '../index.js';
import { expect } from 'mocha-es6';
import { pt, Color } from 'lively.graphics';
import { arr } from 'lively.lang';
import {
  CompositeEditTransaction,
  EditTransaction,
  EditTransactionKind,
  MorphicChangeSetTransaction
} from '../undo.js';
import {
  MorphicReplayDirection,
  MorphicTransactionManager,
  SetMorphProperty
} from '../changes/index.js';

let env;

class TestEditTransaction extends EditTransaction {
  constructor ({ label, kind = EditTransactionKind.COMPONENT_COMMAND, apply, reverseApply }) {
    super({ kind, label });
    this.applyHandler = apply;
    this.reverseApplyHandler = reverseApply;
  }

  apply () { this.applyHandler(); return this; }
  reverseApply () { this.reverseApplyHandler(); return this; }
}

describe('undo', () => {
  beforeEach(async () => env = await MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv())));
  afterEach(() => MorphicEnv.popDefault().uninstall());

  it('records changes for undo', () => {
    let m1 = morph({ submorphs: [{ fill: Color.green }] });
    m1.undoStart('test');
    m1.fill = Color.green;
    m1.submorphs[0].position = pt(10, 10);
    m1.undoStop('test');
    expect(env.undoManager.undos).containSubset([{ name: 'test', changes: [{ prop: 'fill' }, { prop: 'position' }] }]);
  });

  it('does undo and redo', () => {
    let m1 = morph({ position: pt(3, 4), submorphs: [{ fill: Color.green }] });
    m1.undoStart('test');
    m1.submorphs[0].fill = Color.yellow;
    m1.position = pt(10, 10);
    m1.undoStop('test');
    env.undoManager.undo();
    expect(m1.position).equals(pt(3, 4));
    expect(m1.submorphs[0].fill).equals(Color.green);
    expect(env.undoManager.undos).to.have.length(0);
    expect(env.undoManager.redos).to.have.length(1);
    env.undoManager.redo();
    expect(m1.position).equals(pt(10, 10));
    expect(m1.submorphs[0].fill).equals(Color.yellow);
    expect(env.undoManager.undos).to.have.length(1);
    expect(env.undoManager.redos).to.have.length(0);
  });

  it('redo removed on new undo', () => {
    let m1 = morph({ position: pt(3, 4) });
    m1.undoStart('test'); m1.position = pt(10, 10); m1.undoStop('test');
    env.undoManager.undo();
    m1.undoStart('test'); m1.position = pt(20, 20); m1.undoStop('test');
    expect(env.undoManager.undos).to.have.length(1);
    expect(env.undoManager.redos).to.have.length(0);
  });

  it('morph remove', () => {
    let m1 = morph({ submorphs: [{}] }); let m2 = m1.submorphs[0];
    m1.undoStart('test'); m2.remove(); m1.undoStop('test');
    env.undoManager.undo();
    expect(m1.submorphs).equals([m2]);
    expect(m2.owner).equals(m1);
  });

  it('only records changes of morph and its submorphs', () => {
    let m1 = morph(); let m2 = m1.addMorph({}); let m3 = morph();
    m1.undoStart('test');
    m1.fill = Color.blue;
    m2.fill = Color.green;
    m3.fill = Color.yellow;
    m1.undoStop('test');

    expect(arr.uniq(env.undoManager.undos.flatMap(({ changes }) => arr.pluck(changes, 'target'))))
      .equals([m1, m2]);
  });

  it('does not record structural changes of transient morphs', () => {
    const root = morph({
      submorphs: [
        { name: 'target', extent: pt(10, 10) },
        { name: 'selection', epiMorph: true }
      ]
    });
    const target = root.getSubmorphNamed('target');
    const selection = root.getSubmorphNamed('selection');

    root.undoStart('resize with expiring selection');
    target.extent = pt(20, 20);
    selection.remove();
    root.undoStop();

    // A transient overlay can independently be reused or reattached before
    // the user's next undo. Its lifecycle must not stale the resize record.
    root.dontRecordChangesWhile(() => root.addMorph(selection));

    expect(() => env.undoManager.undo()).not.to.throw();
    expect(target.extent).equals(pt(10, 10));
    expect(selection.owner).equals(root);
  });

  it('can have multiple targets', () => {
    let m1 = morph(); let m2 = m1.addMorph({}); let m3 = morph();
    m1.undoStart('test').addTarget(m3);
    m1.fill = Color.blue;
    m2.fill = Color.green;
    m3.fill = Color.yellow;
    m1.undoStop('test');

    expect(arr.uniq(env.undoManager.undos.flatMap(({ changes }) => arr.pluck(changes, 'target'))))
      .equals([m1, m2, m3]);
  });

  it('stores and replays generic edit transactions', () => {
    const state = { value: 2 };
    const transaction = new TestEditTransaction({
      label: 'component property',
      apply: () => { state.value = 2; },
      reverseApply: () => { state.value = 1; }
    });

    env.undoManager.addTransaction(transaction);
    env.undoManager.undo();
    expect(state.value).equals(1);
    env.undoManager.redo();
    expect(state.value).equals(2);
  });

  it('replaces recorded changes with a generic transaction in the active undo', () => {
    const target = morph({ fill: Color.red });
    target.undoStart('projectional property');
    target.fill = Color.green;
    const [legacyChange] = env.undoManager.undoInProgress.recorder.changes;
    const transaction = new TestEditTransaction({
      label: 'component property',
      apply: () => { target.fill = Color.green; },
      reverseApply: () => { target.fill = Color.red; }
    });

    expect(env.undoManager.discardRecordedChanges([legacyChange])).equals(1);
    env.undoManager.addTransaction(transaction, { joinActive: true });
    const joined = target.undoStop();

    expect(joined).to.be.instanceOf(CompositeEditTransaction);
    expect(joined.transactions[1]).equals(transaction);
    env.undoManager.undo();
    expect(target.fill).equals(Color.red);
    env.undoManager.redo();
    expect(target.fill).equals(Color.green);
  });

  it('groups mixed-domain transactions and replays them in domain order', () => {
    const replayOrder = [];
    const componentTransaction = new TestEditTransaction({
      label: 'component',
      apply: () => replayOrder.push('apply component'),
      reverseApply: () => replayOrder.push('reverse component')
    });
    const textTransaction = new TestEditTransaction({
      label: 'text',
      kind: EditTransactionKind.TEXT,
      apply: () => replayOrder.push('apply text'),
      reverseApply: () => replayOrder.push('reverse text')
    });

    env.undoManager.addTransaction(componentTransaction);
    env.undoManager.addTransaction(textTransaction);
    const grouped = env.undoManager.group();

    expect(grouped).to.be.instanceOf(CompositeEditTransaction);
    expect(env.undoManager.undos).deep.equals([grouped]);
    env.undoManager.undo();
    expect(replayOrder).deep.equals(['reverse text', 'reverse component']);
    env.undoManager.redo();
    expect(replayOrder).deep.equals([
      'reverse text',
      'reverse component',
      'apply component',
      'apply text'
    ]);
  });

  it('rolls back already replayed domains when a composite apply fails', () => {
    const state = { value: 0 };
    const first = new TestEditTransaction({
      label: 'first',
      apply: () => { state.value = 1; },
      reverseApply: () => { state.value = 0; }
    });
    const failing = new TestEditTransaction({
      label: 'failing',
      apply: () => { throw new Error('cross-domain failure'); },
      reverseApply: () => {}
    });
    const composite = new CompositeEditTransaction([first, failing]);
    let actualError;

    try { composite.apply(); } catch (error) { actualError = error; }

    expect(actualError.message).equals('cross-domain failure');
    expect(state.value).equals(0);
  });

  it('keeps journal stacks unchanged when replay fails', () => {
    const transaction = new TestEditTransaction({
      label: 'failing reverse',
      apply: () => {},
      reverseApply: () => { throw new Error('reverse failed'); }
    });
    env.undoManager.addTransaction(transaction);
    let actualError;

    try { env.undoManager.undo(); } catch (error) { actualError = error; }

    expect(actualError.message).equals('reverse failed');
    expect(env.undoManager.undos).deep.equals([transaction]);
    expect(env.undoManager.redos).deep.equals([]);
  });

  it('stores morphic change sets with explicit undo and redo replay origins', () => {
    const target = { value: 0 };
    const replayed = [];
    const manager = new MorphicTransactionManager({
      resolveMorph: id => id === 'target' ? target : null,
      setMorphProperty: (morph, property, value) => { morph[property] = value; }
    });
    manager.addCommitListener(changeSet => replayed.push(changeSet));
    const changeSet = manager.transaction({ label: 'set value' }, transaction => {
      transaction.perform(new SetMorphProperty({
        targetId: 'target', property: 'value', before: 0, after: 1
      }));
    });
    env.undoManager.addTransaction(new MorphicChangeSetTransaction(changeSet, manager));
    replayed.length = 0;

    env.undoManager.undo();
    env.undoManager.redo();

    expect(target.value).equals(1);
    expect(replayed.map(({ origin }) => origin)).deep.equals([
      MorphicReplayDirection.UNDO,
      MorphicReplayDirection.REDO
    ]);
  });
});
