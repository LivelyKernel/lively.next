/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv, Text, TilingLayout, World } from '../index.js';
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { pt } from 'lively.graphics';
import { GroupChange } from '../changes.js';
import { SetMorphProperty } from '../changes/operations.js';

describe('reviewed morphic change regressions', () => {
  let env;
  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
    await env.setWorld(new World({ extent: pt(300, 300) }));
  });
  afterEach(() => MorphicEnv.popDefault().uninstall());

  it('passes fresh mutable containers into layout materialization on apply, undo, and redo', () => {
    const target = { id: 'target', layout: null };
    const inputs = [];
    const operation = new SetMorphProperty({
      targetId: target.id, property: 'layout',
      before: { resizePolicies: [['before', { width: 'fill', height: 'fixed' }]] },
      after: { resizePolicies: [['after', { width: 'fill', height: 'fixed' }]] },
      materializeValue: spec => {
        inputs.push(spec);
        return new TilingLayout(spec);
      }
    });
    const context = { resolveMorph: () => target, checkPreconditions: false };
    for (const replay of [operation, operation.invert(), operation]) {
      replay.apply(context);
      expect(Object.isFrozen(inputs[inputs.length - 1])).equals(false);
      expect(() => target.layout.config.resizePolicies.splice(0, 1)).not.to.throw();
    }
    expect(operation.before.resizePolicies[0][0]).equals('before');
    expect(operation.after.resizePolicies[0][0]).equals('after');
    expect(inputs[0]).not.equals(inputs[2]);
  });

  it('avoids eager property snapshots and commit construction outside listener scopes', () => {
    const tracked = morph();
    const unrelated = morph();
    const commits = [];
    let snapshots = 0;
    env.changeManager.setPropertyValuePolicy('customState', {
      valueSemantics: 'snapshot',
      snapshotValue: value => { snapshots++; return value; }
    });
    env.changeManager.addCommittedChangeListener(change => commits.push(change), {
      containsMorph: target => target === tracked
    });
    unrelated.setProperty('customState', { value: 1 });
    expect(snapshots).equals(0);
    expect(commits).deep.equals([]);
    expect(env.changeManager.commitCounter).equals(0);
    tracked.setProperty('customState', { value: 2 });
    expect(snapshots).equals(2);
    expect(commits).to.have.length(1);
  });

  it('delivers grouped moves and removals to old and new owners and unscoped listeners', () => {
    const child = morph({ name: 'child' });
    const left = morph({ submorphs: [child] });
    const right = morph();
    const unrelated = morph();
    const counts = [0, 0, 0];
    [left, right].forEach((root, index) => {
      env.changeManager.addCommittedChangeListener(() => counts[index]++, {
        containsMorph: target => target === root || root.isAncestorOf(target)
      });
    });
    const globalListener = env.changeManager.addCommittedChangeListener(() => counts[2]++);
    unrelated.groupChangesWhile(new GroupChange(unrelated), () => right.addMorph(child));
    expect(counts).deep.equals([1, 1, 1]);
    child.remove();
    expect(counts).deep.equals([1, 2, 2]);
    env.changeManager.removeCommittedChangeListener(globalListener);
    expect(env.changeManager.hasCommittedListenerFor(child)).equals(false);
    expect(env.changeManager.hasCommittedListenerFor(left)).equals(true);
  });

});
