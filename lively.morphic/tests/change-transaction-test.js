/* global describe, it */
import { expect } from 'mocha-es6';
import {
  CustomOperation,
  MoveMorph,
  MorphicChangeSet,
  MorphicOperationKind,
  MorphicReplayDirection,
  MorphicTransactionManager,
  MorphicValueSemantics,
  SetMorphProperty,
  attachedMorph,
  detachedMorph
} from '../changes/index.js';

function createContext (targets) {
  const targetsById = new Map(Object.entries(targets));
  return {
    resolveMorph: id => targetsById.get(id),
    setMorphProperty: (target, property, value) => { target[property] = value; }
  };
}

function captureError (callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  return null;
}

function valueOperation (targetId, before, after) {
  const applyValue = (context, operation) => {
    context.resolveMorph(operation.targetId).value = operation.after;
  };
  return new CustomOperation({
    targetId,
    before,
    after,
    applyHandler: applyValue,
    reverseHandler: applyValue
  });
}

function createTreeContext (root) {
  const targetsById = new Map();
  const visit = morph => {
    targetsById.set(morph.id, morph);
    morph.children.forEach(visit);
  };
  visit(root);

  const attachmentOf = morph => morph.owner
    ? attachedMorph({ ownerId: morph.owner.id, index: morph.owner.children.indexOf(morph) })
    : detachedMorph();

  return {
    resolveMorph: id => targetsById.get(id),
    validateMoveMorph: (morph, from, to) => {
      expect(attachmentOf(morph)).deep.equals(from);
      if (to.kind === 'attached') {
        let owner = targetsById.get(to.ownerId);
        while (owner) {
          if (owner === morph) throw new Error('MoveMorph cannot create an ownership cycle');
          owner = owner.owner;
        }
      }
    },
    moveMorph: (morph, from, to) => {
      if (from.kind === 'attached') {
        const source = targetsById.get(from.ownerId);
        source.children.splice(source.children.indexOf(morph), 1);
        morph.owner = null;
      }
      if (to.kind === 'attached') {
        const destination = targetsById.get(to.ownerId);
        destination.children.splice(to.index, 0, morph);
        morph.owner = destination;
      }
    }
  };
}

function treeNode (id, children = []) {
  const node = { id, owner: null, children };
  children.forEach(child => { child.owner = node; });
  return node;
}

describe('morphic transaction kernel', () => {
  it('defines closed immutable property operations with exact inverses', () => {
    const operation = new SetMorphProperty({
      targetId: 'target',
      property: 'fill',
      before: 'red',
      after: 'green',
      metadata: { origin: 'test' }
    });
    const inverse = operation.invert();

    expect(operation.kind).equals(MorphicOperationKind.SET_MORPH_PROPERTY);
    expect(Object.isFrozen(operation)).to.be.true;
    expect(Object.isFrozen(operation.metadata)).to.be.true;
    expect(inverse.before).equals('green');
    expect(inverse.after).equals('red');
    expect(inverse.metadata).deep.equals(operation.metadata);
  });

  it('snapshots mutable containers and materializes fresh replay values', () => {
    const before = { nested: { value: 1 } };
    const after = { nested: { value: 2 } };
    const operation = new SetMorphProperty({
      targetId: 'target', property: 'state', before, after
    });
    const target = { state: before };
    const context = createContext({ target });

    after.nested.value = 3;
    expect(operation.valueSemantics).equals(MorphicValueSemantics.SNAPSHOT);
    expect(Object.isFrozen(operation.after)).to.be.true;
    expect(Object.isFrozen(operation.after.nested)).to.be.true;
    operation.apply(context);
    expect(target.state).deep.equals({ nested: { value: 2 } });
    expect(target.state).not.equals(operation.after);
    target.state.nested.value = 4;
    expect(operation.after).deep.equals({ nested: { value: 2 } });
  });

  it('supports explicit reference semantics for identity-bearing values', () => {
    const before = [];
    const after = [];
    const operation = new SetMorphProperty({
      targetId: 'target',
      property: 'items',
      before,
      after,
      valueSemantics: MorphicValueSemantics.REFERENCE
    });

    expect(operation.before).equals(before);
    expect(operation.after).equals(after);
    expect(operation.invert().before).equals(after);
  });

  it('supports property-domain snapshot and materialization hooks', () => {
    const before = new Date(1000);
    const after = new Date(2000);
    const operation = new SetMorphProperty({
      targetId: 'target',
      property: 'date',
      before,
      after,
      valueSemantics: MorphicValueSemantics.SNAPSHOT,
      snapshotValue: value => value instanceof Date ? value.getTime() : value,
      materializeValue: value => new Date(value),
      snapshotValuesEqual: (left, right) => left === right
    });
    const target = { date: before };
    const context = createContext({ target });

    operation.apply(context);
    expect(target.date).to.be.instanceOf(Date);
    expect(target.date.getTime()).equals(2000);
    operation.invert().apply(context);
    expect(target.date.getTime()).equals(1000);
  });

  it('represents insertion, removal, reordering, and reparenting as exact moves', () => {
    const a = treeNode('a');
    const b = treeNode('b');
    const c = treeNode('c');
    const destination = treeNode('destination');
    const root = treeNode('root', [treeNode('source', [a, b, c]), destination]);
    const source = root.children[0];
    const context = createTreeContext(root);

    const reorder = new MoveMorph({
      morphId: 'b',
      from: attachedMorph({ ownerId: 'source', index: 1 }),
      to: attachedMorph({ ownerId: 'source', index: 0 })
    });
    reorder.apply(context);
    expect(source.children.map(({ id }) => id)).deep.equals(['b', 'a', 'c']);
    reorder.invert().apply(context);
    expect(source.children.map(({ id }) => id)).deep.equals(['a', 'b', 'c']);

    const reparent = new MoveMorph({
      morphId: 'b',
      from: attachedMorph({ ownerId: 'source', index: 1 }),
      to: attachedMorph({ ownerId: 'destination', index: 0 })
    });
    reparent.apply(context);
    expect(source.children.map(({ id }) => id)).deep.equals(['a', 'c']);
    expect(destination.children).deep.equals([b]);
    reparent.invert().apply(context);
    expect(source.children.map(({ id }) => id)).deep.equals(['a', 'b', 'c']);

    const remove = new MoveMorph({
      morphId: 'b',
      from: attachedMorph({ ownerId: 'source', index: 1 }),
      to: detachedMorph()
    });
    remove.apply(context);
    expect(b.owner).equals(null);
    remove.invert().apply(context);
    expect(source.children.map(({ id }) => id)).deep.equals(['a', 'b', 'c']);
  });

  it('rejects structural moves with stale source locations or ownership cycles', () => {
    const child = treeNode('child');
    const parent = treeNode('parent', [child]);
    const root = treeNode('root', [parent]);
    const context = createTreeContext(root);
    const staleMove = new MoveMorph({
      morphId: 'child',
      from: attachedMorph({ ownerId: 'parent', index: 1 }),
      to: detachedMorph()
    });
    const cyclicMove = new MoveMorph({
      morphId: 'parent',
      from: attachedMorph({ ownerId: 'root', index: 0 }),
      to: attachedMorph({ ownerId: 'child', index: 0 })
    });

    expect(captureError(() => staleMove.apply(context))).to.be.instanceOf(Error);
    expect(captureError(() => cyclicMove.apply(context)).message)
      .equals('MoveMorph cannot create an ownership cycle');
    expect(root.children).deep.equals([parent]);
    expect(parent.children).deep.equals([child]);
  });

  it('validates every target before applying a change set', () => {
    const firstTarget = { value: 0 };
    const context = createContext({ first: firstTarget });
    const changeSet = new MorphicChangeSet({
      id: 'invalid-target',
      operations: [
        new SetMorphProperty({ targetId: 'first', property: 'value', before: 0, after: 1 }),
        new SetMorphProperty({ targetId: 'missing', property: 'value', before: 0, after: 1 })
      ]
    });

    const error = captureError(() => changeSet.apply(context));
    expect(error.message).equals('Cannot resolve morph missing');
    expect(firstTarget.value).equals(0);
  });

  it('rolls back already applied operations when a later operation fails', () => {
    const firstTarget = { value: 0 };
    const secondTarget = { value: 0 };
    const context = createContext({ first: firstTarget, second: secondTarget });
    const failingOperation = new CustomOperation({
      targetId: 'second',
      before: 0,
      after: 1,
      applyHandler: () => { throw new Error('apply failed'); },
      reverseHandler: () => {}
    });
    const changeSet = new MorphicChangeSet({
      id: 'atomic-application',
      operations: [valueOperation('first', 0, 1), failingOperation]
    });

    const error = captureError(() => changeSet.apply(context));
    expect(error.message).equals('apply failed');
    expect(firstTarget.value).equals(0);
    expect(secondTarget.value).equals(0);
  });

  it('joins nested operations and notifies only after the outer commit', () => {
    const firstTarget = { value: 0 };
    const secondTarget = { value: 0 };
    const manager = new MorphicTransactionManager(
      createContext({ first: firstTarget, second: secondTarget })
    );
    const notifications = [];
    manager.addCommitListener(changeSet => notifications.push(changeSet));

    const changeSet = manager.transaction({ label: 'outer', origin: 'test' }, transaction => {
      transaction.perform(new SetMorphProperty({
        targetId: 'first', property: 'value', before: 0, after: 1
      }));
      const nestedTransaction = manager.transaction({ label: 'nested' }, nested => {
        nested.perform(new SetMorphProperty({
          targetId: 'second', property: 'value', before: 0, after: 2
        }));
      });
      expect(nestedTransaction).equals(transaction);
      expect(notifications).to.have.length(0);
    });

    expect(firstTarget.value).equals(1);
    expect(secondTarget.value).equals(2);
    expect(changeSet.operations).to.have.length(2);
    expect(Object.isFrozen(changeSet.operations)).to.be.true;
    expect(notifications).deep.equals([changeSet]);
  });

  it('rolls back an entire transaction and suppresses commit notification on failure', () => {
    const firstTarget = { value: 0 };
    const secondTarget = { value: 0 };
    const manager = new MorphicTransactionManager(
      createContext({ first: firstTarget, second: secondTarget })
    );
    const notifications = [];
    manager.addCommitListener(changeSet => notifications.push(changeSet));

    const error = captureError(() => manager.transaction({ label: 'failing' }, transaction => {
      transaction.perform(new SetMorphProperty({
        targetId: 'first', property: 'value', before: 0, after: 1
      }));
      transaction.perform(new CustomOperation({
        targetId: 'second',
        before: 0,
        after: 1,
        applyHandler: () => { throw new Error('transaction failed'); },
        reverseHandler: () => {}
      }));
    }));

    expect(error.message).equals('transaction failed');
    expect(firstTarget.value).equals(0);
    expect(secondTarget.value).equals(0);
    expect(manager.activeTransaction).equals(null);
    expect(notifications).deep.equals([]);
  });

  it('rejects asynchronous callbacks and rolls back synchronous mutations', () => {
    const target = { value: 0 };
    const manager = new MorphicTransactionManager(createContext({ target }));

    const error = captureError(() => manager.transaction({ label: 'async' }, transaction => {
      transaction.perform(new SetMorphProperty({
        targetId: 'target', property: 'value', before: 0, after: 1
      }));
      return Promise.resolve();
    }));

    expect(error.message).equals('Morphic transactions must be synchronous');
    expect(target.value).equals(0);
  });

  it('replays undo and redo with explicit origins and directions', () => {
    const target = { fill: 'red' };
    const manager = new MorphicTransactionManager(createContext({ target }));
    const notifications = [];
    manager.addCommitListener(changeSet => notifications.push(changeSet));

    const committed = manager.transaction({
      label: 'recolor',
      origin: 'direct-manipulation'
    }, transaction => {
      transaction.perform(new SetMorphProperty({
        targetId: 'target', property: 'fill', before: 'red', after: 'green'
      }));
    });
    const undo = manager.replay(committed, MorphicReplayDirection.UNDO);
    const redo = manager.replay(committed, MorphicReplayDirection.REDO);

    expect(target.fill).equals('green');
    expect(notifications).deep.equals([committed, undo, redo]);
    expect(undo.origin).equals('undo');
    expect(undo.metadata.replayDirection).equals('undo');
    expect(redo.origin).equals('redo');
    expect(redo.metadata.replayDirection).equals('redo');
  });

  it('requires custom operations to provide an explicit inverse handler', () => {
    const error = captureError(() => new CustomOperation({
      targetId: 'target',
      applyHandler: () => {}
    }));
    expect(error.message).equals('CustomOperation requires explicit apply and reverse handlers');
  });
});
