/* global describe, it, xit, beforeEach, afterEach */
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { morph, MorphicEnv } from '../index.js';
import { GroupChange } from '../changes.js';
import {
  MorphicValueSemantics,
  MoveMorph,
  SetMorphProperty
} from '../changes/operations.js';
import { expect } from 'mocha-es6';
import { Color, pt } from 'lively.graphics';

let env;

function submorphNames (owner) {
  return owner.submorphs.map(submorph => submorph.name);
}

describe('morphic change engine characterization', function () {
  this.timeout(5000);

  beforeEach(async () => {
    env = await MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
  });

  afterEach(() => MorphicEnv.popDefault().uninstall());

  it('records exact scalar property before and after values', () => {
    const target = morph({ fill: Color.red });
    const [change] = target.recordChangesWhile(() => target.fill = Color.green);

    expect(change.type).equals('setter');
    expect(change.prop).equals('fill');
    expect(change.prevValue).equals(Color.red);
    expect(change.value).equals(Color.green);
    expect(change.operation).to.be.instanceOf(SetMorphProperty);
    expect(change.operation.before).equals(Color.red);
    expect(change.operation.after).equals(Color.green);
  });

  it('combines nested metadata scopes and restores the outer scope', () => {
    const target = morph();
    const changes = target.recordChangesWhile(() => {
      target.withMetaDo({ origin: 'outer', shared: 'outer' }, () => {
        target.fill = Color.red;
        target.withMetaDo({ origin: 'inner', nested: true }, () => {
          target.opacity = 0.5;
        });
        target.rotation = 0.25;
      });
    });

    expect(changes[0].meta).deep.equals({ origin: 'outer', shared: 'outer' });
    expect(changes[1].meta).deep.equals({ origin: 'inner', shared: 'outer', nested: true });
    expect(changes[2].meta).deep.equals({ origin: 'outer', shared: 'outer' });
    expect(env.changeManager.defaultMeta).deep.equals({});
    expect(env.changeManager.metaStack).deep.equals([]);
  });

  it('cleans up a failed change group and propagates its exception', () => {
    const target = morph();
    const group = new GroupChange(target);
    const expectedError = new Error('failed grouped edit');
    let actualError;

    try {
      target.groupChangesWhile(group, () => {
        target.fill = Color.red;
        throw expectedError;
      });
    } catch (error) {
      actualError = error;
    }

    expect(actualError).equals(expectedError);
    expect(env.changeManager.changeGroupStack).deep.equals([]);
    const [subsequentChange] = target.recordChangesWhile(() => target.opacity = 0.5);
    expect(subsequentChange.prop).equals('opacity');
    expect(subsequentChange.group).equals(null);
  });

  it('notifies the manager, target, and owners in deterministic order', () => {
    const owner = morph({ submorphs: [{ name: 'target' }] });
    const target = owner.submorphs[0];
    const notifications = [];
    const listener = change => {
      if (change.target === target && change.prop === 'fill') notifications.push('manager');
    };
    env.changeManager.addChangeListener(listener);
    target.onChange = change => {
      if (change.prop === 'fill') notifications.push('target');
    };
    owner.onSubmorphChange = change => {
      if (change.prop === 'fill') notifications.push('owner');
    };

    target.fill = Color.green;
    env.changeManager.removeChangeListener(listener);

    expect(notifications).deep.equals(['manager', 'target', 'owner']);
  });

  it('restores a removed morph at its exact sibling index', () => {
    const owner = morph({
      submorphs: [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    });
    const removedMorph = owner.submorphs[1];

    owner.undoStart('remove b');
    removedMorph.remove();
    owner.undoStop();
    expect(submorphNames(owner)).deep.equals(['a', 'c']);

    env.undoManager.undo();
    expect(submorphNames(owner)).deep.equals(['a', 'b', 'c']);
    expect(owner.submorphs[1]).equals(removedMorph);

    env.undoManager.redo();
    expect(submorphNames(owner)).deep.equals(['a', 'c']);
    expect(removedMorph.owner).equals(null);
  });

  it('does not add undo entries while replaying undo and redo', () => {
    const target = morph({ position: pt(0, 0) });
    target.undoStart('move');
    target.position = pt(20, 30);
    target.undoStop();

    expect(env.undoManager.undos).to.have.length(1);
    env.undoManager.undo();
    expect(target.position).equals(pt(0, 0));
    expect(env.undoManager.undos).to.have.length(0);
    expect(env.undoManager.redos).to.have.length(1);

    env.undoManager.redo();
    expect(target.position).equals(pt(20, 30));
    expect(env.undoManager.undos).to.have.length(1);
    expect(env.undoManager.redos).to.have.length(0);
  });

  it('propagates synchronous exceptions from withMetaDo', () => {
    const target = morph();
    const expectedError = new Error('failed metadata scope');
    let actualError;

    try {
      target.withMetaDo({ origin: 'test' }, () => { throw expectedError; });
    } catch (error) {
      actualError = error;
    }

    expect(actualError).equals(expectedError);
  });

  it('rejects promise-returning withMetaDo callbacks', async () => {
    const target = morph();
    let actualError;
    try {
      await target.withMetaDo({ origin: 'test' }, async () => target);
    } catch (error) {
      actualError = error;
    }
    expect(actualError).to.be.instanceOf(Error);
    expect(actualError.message).equals('withMetaDo callbacks must be synchronous');
  });

  it('gives sibling reordering an exact inverse', () => {
    const owner = morph({
      submorphs: [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    });
    const reorderedMorph = owner.submorphs[1];

    owner.undoStart('reorder b');
    owner.addMorph(reorderedMorph, owner.submorphs[0]);
    owner.undoStop();
    expect(submorphNames(owner)).deep.equals(['b', 'a', 'c']);

    env.undoManager.undo();
    expect(submorphNames(owner)).deep.equals(['a', 'b', 'c']);
    env.undoManager.redo();
    expect(submorphNames(owner)).deep.equals(['b', 'a', 'c']);
  });

  it('gives reparenting an exact inverse', () => {
    const root = morph({
      submorphs: [{ name: 'source', submorphs: [{ name: 'moved' }] }, { name: 'destination' }]
    });
    const source = root.submorphs[0];
    const destination = root.submorphs[1];
    const movedMorph = source.submorphs[0];

    root.undoStart('reparent moved');
    destination.addMorph(movedMorph);
    root.undoStop();
    expect(movedMorph.owner).equals(destination);

    env.undoManager.undo();
    expect(movedMorph.owner).equals(source);
    expect(source.submorphs).deep.equals([movedMorph]);
    env.undoManager.redo();
    expect(movedMorph.owner).equals(destination);
  });

  it('records a reparent as one exact structural operation', () => {
    const root = morph({
      submorphs: [{ name: 'source', submorphs: [{ name: 'moved' }] }, { name: 'destination' }]
    });
    const source = root.submorphs[0];
    const destination = root.submorphs[1];
    const movedMorph = source.submorphs[0];

    const changes = root.recordChangesWhile(() => destination.addMorph(movedMorph));

    expect(changes).to.have.length(1);
    expect(changes[0].selector).equals('addMorphAt');
    expect(changes[0].operation).to.be.instanceOf(MoveMorph);
    expect(changes[0].operation.from.ownerId).equals(source.id);
    expect(changes[0].operation.from.index).equals(0);
    expect(changes[0].operation.to.ownerId).equals(destination.id);
    expect(changes[0].operation.to.index).equals(0);
  });

  it('preserves operation metadata in replay notifications', () => {
    const target = morph({ fill: Color.red });
    const replayMetadata = [];
    target.onChange = change => {
      if (change.prop === 'fill') replayMetadata.push(change.meta);
    };

    target.undoStart('recolor');
    target.withMetaDo({ origin: 'direct-manipulation' }, () => target.fill = Color.green);
    target.undoStop();
    replayMetadata.length = 0;

    env.undoManager.undo();
    expect(replayMetadata[0]).containSubset({
      origin: 'undo',
      originalOrigin: 'direct-manipulation',
      replayDirection: 'undo'
    });
    env.undoManager.redo();
    expect(replayMetadata[1]).containSubset({
      origin: 'redo',
      originalOrigin: 'direct-manipulation',
      replayDirection: 'redo'
    });
  });

  xit('KNOWN BROKEN: a failed grouped edit rolls back applied changes', () => {
    const target = morph({ fill: Color.red, opacity: 1 });
    try {
      target.groupChangesWhile(new GroupChange(target), () => {
        target.fill = Color.green;
        target.opacity = 0.5;
        throw new Error('abort');
      });
    } catch (error) {
      expect(error.message).equals('abort');
    }

    expect(target.fill).equals(Color.red);
    expect(target.opacity).equals(1);
  });

  it('snapshots mutable property values for replay', () => {
    const target = morph();
    const nextValue = { nested: { value: 2 } };
    target.setProperty('customState', { nested: { value: 1 } });

    target.undoStart('set mutable property');
    target.setProperty('customState', nextValue);
    target.undoStop();
    nextValue.nested.value = 3;

    env.undoManager.undo();
    env.undoManager.redo();
    expect(target.getProperty('customState')).deep.equals({ nested: { value: 2 } });
  });

  it('uses property-specific snapshot and materialization policies', () => {
    env.changeManager.setPropertyValuePolicy('customDate', {
      valueSemantics: MorphicValueSemantics.SNAPSHOT,
      snapshotValue: value => value instanceof Date ? value.getTime() : value,
      materializeValue: value => value === undefined ? value : new Date(value),
      snapshotValuesEqual: (left, right) => left === right
    });
    const target = morph();
    const nextValue = new Date(2000);
    target.setProperty('customDate', new Date(1000));

    target.undoStart('set snapshot-policy property');
    target.setProperty('customDate', nextValue);
    target.undoStop();
    nextValue.setTime(3000);

    env.undoManager.undo();
    expect(target.getProperty('customDate').getTime()).equals(1000);
    env.undoManager.redo();
    expect(target.getProperty('customDate').getTime()).equals(2000);
  });
});
