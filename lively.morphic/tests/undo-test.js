/* global it, describe, beforeEach, afterEach */
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { morph, MorphicEnv, Hand, World } from '../index.js';
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
  MorphicValueSemantics,
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

  it('undoes a copy dropped from the hand after a transient halo shifts its index', () => {
    const world = new World();
    const hand = new Hand(1);
    const halo = morph({ epiMorph: true });
    const copy = morph({ name: 'copy' });
    world.addMorph(hand);
    world.addMorph(halo);
    world.addMorph(copy);
    copy.undoStart('copy halo');
    hand.grab(copy);
    copy.undoInProgress.addTarget(world);
    hand.dropMorphsOn(world);
    copy.undoStop();
    halo.remove();

    env.undoManager.undo();
    expect(copy.owner).equals(null);
    expect(hand.grabbedMorphs).not.includes(copy);
    env.undoManager.redo();
    expect(copy.owner).equals(world);
    expect(hand.grabbedMorphs).not.includes(copy);
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

  for (const asArray of [false, true]) {
    it(`restores unchanged ${asArray ? 'array' : 'object'} identities while publishing snapshots`, () => {
      const target = morph();
      const beforeModel = { title: 'before', nested: { value: 1 } };
      const afterModel = { title: 'after', nested: { value: 2 } };
      const beforeItem = { value: beforeModel };
      const afterItem = { value: afterModel };
      const before = asArray ? [beforeItem] : beforeItem;
      const after = asArray ? [afterItem] : afterItem;
      target.setProperty('items', before);
      const operations = [];
      const listener = env.changeManager.addCommittedChangeListener(changeSet => {
        operations.push(...changeSet.operations.filter(operation => operation.property === 'items'));
      }, { containsMorph: morph => morph === target });
      try {
        target.undoStart('replace items');
        target.setProperty('items', after);
        target.undoStop();

        env.undoManager.undo();
        const restored = target.getProperty('items');
        expect(Object.is(restored, before)).equals(true);
        expect(Object.is(asArray ? restored[0] : restored, beforeItem)).equals(true);
        expect(Object.is((asArray ? restored[0] : restored).value, beforeModel)).equals(true);
        env.undoManager.redo();
        expect(Object.is(target.getProperty('items'), after)).equals(true);
        expect(Object.is((asArray ? after[0] : after).value, afterModel)).equals(true);

        expect(operations).to.have.length(3);
        for (const [index, operation] of operations.entries()) {
          const expected = index === 1 ? before : after;
          expect(operation.valueSemantics).equals(MorphicValueSemantics.SNAPSHOT);
          expect(operation.after).deep.equals(expected);
          expect(Object.is(operation.after, expected)).equals(false);
          expect(Object.isFrozen(operation.after)).equals(true);
          expect(Object.isFrozen((asArray ? operation.after[0] : operation.after).value)).equals(true);
        }
        expect(Object.isFrozen(beforeModel)).equals(false);
        expect(Object.isFrozen(afterModel)).equals(false);
      } finally {
        env.changeManager.removeCommittedChangeListener(listener);
      }
    });
  }

  it('keeps explicit snapshot policies for unchanged containers during undo and redo', () => {
    env.changeManager.setPropertyValuePolicy('items', { valueSemantics: MorphicValueSemantics.SNAPSHOT });
    const target = morph();
    const before = [{ value: { title: 'before' } }];
    const after = [{ value: { title: 'after' } }];
    target.setProperty('items', before);
    target.undoStart('replace snapshot items');
    target.setProperty('items', after);
    target.undoStop();

    env.undoManager.undo();
    expect(target.getProperty('items')).deep.equals(before);
    expect(Object.is(target.getProperty('items'), before)).equals(false);
    expect(Object.is(target.getProperty('items')[0].value, before[0].value)).equals(false);
    env.undoManager.redo();
    expect(target.getProperty('items')).deep.equals(after);
    expect(Object.is(target.getProperty('items'), after)).equals(false);
    expect(Object.is(target.getProperty('items')[0].value, after[0].value)).equals(false);
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

  it('skips a stale structural undo and keeps earlier history reachable', () => {
    const child = morph({ name: 'moved' });
    const left = morph({ name: 'left', submorphs: [child] });
    const right = morph({ name: 'right' });
    const root = morph({ fill: Color.red, submorphs: [left, right] });
    root.undoStart('earlier fill');
    root.fill = Color.green;
    const earlier = root.undoStop();
    root.undoStart('move into right');
    right.addMorphAt(child, 0);
    const stale = root.undoStop();
    root.addMorph(child);

    expect(() => env.undoManager.undo()).not.to.throw();
    expect(child.owner).equals(root);
    expect(env.undoManager.undos).deep.equals([earlier]);
    expect(env.undoManager.redos).deep.equals([stale]);
    env.undoManager.undo();
    expect(root.fill).equals(Color.red);
    expect(child.owner).equals(root);
  });

  it('logs an ownership cycle during legacy structural undo without blocking history', async () => {
    const world = new World();
    const previousWorld = env.domEnv.window.$world;
    const errors = [];
    const logError = world.logError;
    world.logError = error => errors.push(error);
    try {
      await env.setWorld(world);
      const child = morph({ name: 'child', position: pt(10, 20) });
      const owner = morph({ name: 'owner', submorphs: [child] });
      world.addMorph(owner);
      owner.undoStart('remove child');
      child.remove();
      const removal = owner.undoStop();
      child.addMorph(owner);
      child.position = pt(40, 50);
      const position = child.position;
      expect(() => env.undoManager.undo()).not.to.throw();
      expect(errors).has.length(1);
      expect(errors[0].message).includes('Circular relationships');
      expect(child.owner).equals(null);
      expect(owner.owner).equals(child);
      expect(child.position).equals(position);
      expect(env.undoManager.undos).to.be.empty;
      expect(env.undoManager.redos).deep.equals([removal]);
    } finally {
      world.logError = logError;
      env.domEnv.window.$world = previousWorld;
    }
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

  it('closes an interrupted joined group when another undo starts', () => {
    const target = morph({ fill: Color.red });
    target.undoStart('interrupted joined group');
    target.fill = Color.green;
    const [change] = env.undoManager.undoInProgress.recorder.changes;
    env.undoManager.discardRecordedChanges([change]);
    env.undoManager.addTransaction(new TestEditTransaction({
      label: 'joined fill',
      apply: () => { target.fill = Color.green; },
      reverseApply: () => { target.fill = Color.red; }
    }), { joinActive: true });
    const interrupted = env.undoManager.undoInProgress;
    const next = target.undoStart('next group');
    expect(next).not.equals(interrupted);
    expect(interrupted.isRecording()).equals(false);
    expect(interrupted.joinedTransactions).to.be.empty;
    target.opacity = 0.5;
    target.undoStop();
    expect(env.undoManager.undos).has.length(2);
    env.undoManager.undo();
    expect(target.opacity).equals(1);
    expect(target.fill).equals(Color.green);
    env.undoManager.undo();
    expect(target.fill).equals(Color.red);
    env.undoManager.redo();
    env.undoManager.redo();
    expect(target.fill).equals(Color.green);
    expect(target.opacity).equals(0.5);
  });

  it('prunes a domain from nested groups while preserving other entries and group identities', () => {
    const kept = new TestEditTransaction({ label: 'kept', apply: () => {}, reverseApply: () => {} });
    const expired = new TestEditTransaction({ label: 'expired', apply: () => {}, reverseApply: () => {} });
    const group = new CompositeEditTransaction([kept, new CompositeEditTransaction([expired])]);
    env.undoManager.addTransaction(group);
    env.undoManager.removeTransactions(transaction => transaction === expired);
    expect(env.undoManager.undos[0].transactions).deep.equals([kept]);
    expect(env.undoManager.grouping.current).deep.equals(env.undoManager.undos);
    env.undoManager.undo();
    expect(env.undoManager.redos).has.length(1);
    env.undoManager.removeTransactions(transaction => transaction === kept);
    expect(env.undoManager.redos).to.be.empty;
  });

  it('preserves unrelated recorded changes when removing an active joined domain', () => {
    const target = morph({ fill: Color.red });
    target.undoStart('mixed active group');
    target.fill = Color.green;
    const expired = new TestEditTransaction({ label: 'expired', apply: () => {}, reverseApply: () => {} });
    env.undoManager.addTransaction(expired, { joinActive: true });
    env.undoManager.removeTransactions(transaction => transaction === expired);
    expect(env.undoManager.undoInProgress.joinedTransactions).to.be.empty;
    target.undoStop();
    env.undoManager.undo();
    expect(target.fill).equals(Color.red);
    env.undoManager.redo();
    expect(target.fill).equals(Color.green);
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

  it('drops a failed undo and reaches the earlier entry', () => {
    const target = morph({ fill: Color.red });
    target.undoStart('earlier fill');
    target.fill = Color.green;
    const earlier = target.undoStop();
    const failure = new Error('reverse failed');
    const transaction = new TestEditTransaction({
      label: 'failing reverse',
      apply: () => {},
      reverseApply: () => { throw failure; }
    });
    env.undoManager.addTransaction(transaction);
    let actualError;

    try { env.undoManager.undo(); } catch (error) { actualError = error; }

    expect(actualError).equals(failure);
    expect(env.undoManager.applyCount).equals(0);
    expect(env.undoManager.undos).deep.equals([earlier]);
    expect(env.undoManager.redos).deep.equals([]);
    expect(env.undoManager.grouping.current).not.includes(transaction);
    env.undoManager.undo();
    expect(target.fill).equals(Color.red);
  });

  it('drops a failed redo and reaches the following entry', () => {
    const failure = new Error('apply failed');
    const failing = new TestEditTransaction({
      label: 'failing apply',
      apply: () => { throw failure; },
      reverseApply: () => {}
    });
    const target = morph({ fill: Color.red });
    env.undoManager.addTransaction(failing);
    target.undoStart('later fill');
    target.fill = Color.green;
    const later = target.undoStop();
    env.undoManager.undo();
    env.undoManager.undo();
    let actualError;
    try { env.undoManager.redo(); } catch (error) { actualError = error; }

    expect(actualError).equals(failure);
    expect(env.undoManager.applyCount).equals(0);
    expect(env.undoManager.undos).to.be.empty;
    expect(env.undoManager.redos).deep.equals([later]);
    env.undoManager.redo();
    expect(target.fill).equals(Color.green);
    expect(env.undoManager.undos).deep.equals([later]);
    expect(env.undoManager.redos).to.be.empty;
  });

  it('ignores transactions added by committed listeners during undo and redo', () => {
    const target = morph({ fill: Color.red });
    target.undoStart('reconciled fill');
    target.withMetaDo({ reconcileChanges: true }, () => { target.fill = Color.green; });
    const original = target.undoStop();
    const attempted = [];
    const transaction = new TestEditTransaction({
      label: 'replay listener', apply: () => {}, reverseApply: () => {}
    });
    const listener = env.changeManager.addCommittedChangeListener(changeSet => {
      if (!changeSet.metadata.reconcileChanges) return;
      attempted.push(changeSet.origin);
      env.undoManager.addTransaction(transaction, { joinActive: true });
    });
    try {
      env.undoManager.undo();
      expect(attempted).deep.equals(['undo']);
      expect(target.fill).equals(Color.red);
      expect(env.undoManager.undos).to.be.empty;
      expect(env.undoManager.redos).deep.equals([original]);
      expect(env.undoManager.grouping.current).to.be.empty;
      env.undoManager.redo();
      expect(attempted).deep.equals(['undo', 'redo']);
      expect(target.fill).equals(Color.green);
      expect(env.undoManager.undos).deep.equals([original]);
      expect(env.undoManager.redos).to.be.empty;
      expect(env.undoManager.grouping.current).to.be.empty;
    } finally { env.changeManager.removeCommittedChangeListener(listener); }
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
