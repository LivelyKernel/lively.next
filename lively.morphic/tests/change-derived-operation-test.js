/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv, World } from '../index.js';
import { pt, Rectangle, Transform, Color } from 'lively.graphics';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { MorphicRollbackError } from '../changes/index.js';
import { connect } from 'lively.bindings';

/** Return the original thrown value for identity checks. */
function failureOf (fn) {
  try { fn(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

describe('morphic source-unit reactions', function () {
  this.timeout(10000);
  let manager, undo;
  beforeEach(async () => {
    const env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    await env.setWorld(new World({ extent: pt(600, 400) }));
    manager = env.changeManager;
    undo = env.undoManager;
  });
  afterEach(() => MorphicEnv.popDefault().uninstall());

  for (const exit of ['commit', 'rollback', 'thenable']) {
    it(`retains no source-unit bookkeeping on the manager after ${exit}`, () => {
      const target = morph();
      const fields = ['_notificationParent', '_unitJournal'];
      const before = fields.map(key => Object.getOwnPropertyDescriptor(manager, key));
      const cause = new Error('source unit');
      target.onChange = change => { if (change.prop === 'opacity') target.rotation += 0.1; };
      const run = () => manager.transaction({ scope: target }, () => {
        target.opacity = 0.5;
        if (exit === 'rollback') throw cause;
        if (exit === 'thenable') return Promise.reject(cause);
      });
      if (exit === 'commit') run();
      else {
        const error = failureOf(run);
        if (exit === 'rollback') expect(error).equals(cause);
        else expect(error.name).equals('MorphicTransactionAsyncError');
      }
      fields.forEach((key, index) => expect(Object.getOwnPropertyDescriptor(manager, key)).deep.equals(before[index]));
      expect([target.opacity, target.rotation]).deep.equals(exit === 'commit' ? [0.5, 0.1] : [1, 0]);
    });
  }

  it('retains no source-unit bookkeeping on the manager after undo and redo', () => {
    const target = morph();
    const fields = ['_notificationParent', '_unitJournal'];
    const before = fields.map(key => Object.getOwnPropertyDescriptor(manager, key));
    target.onChange = change => { if (change.prop === 'opacity') target.rotation += 0.1; };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    for (let cycle = 0; cycle < 5; cycle++) {
      undo.undo();
      expect([target.opacity, target.rotation]).deep.equals([1, 0]);
      fields.forEach((key, index) => expect(Object.getOwnPropertyDescriptor(manager, key)).deep.equals(before[index]));
      undo.redo();
      expect([target.opacity, target.rotation]).deep.equals([0.5, 0.1]);
      fields.forEach((key, index) => expect(Object.getOwnPropertyDescriptor(manager, key)).deep.equals(before[index]));
    }
  });

  it('retains no source-unit bookkeeping while preserving nested savepoint reactions', () => {
    const target = morph();
    const fields = ['_notificationParent', '_unitJournal'];
    const before = fields.map(key => Object.getOwnPropertyDescriptor(manager, key));
    target.onChange = change => {
      if (change.prop === 'opacity') manager.transaction({}, () => { target.rotation += 0.1; });
    };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    fields.forEach((key, index) => expect(Object.getOwnPropertyDescriptor(manager, key)).deep.equals(before[index]));
    undo.undo();
    expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    undo.redo();
    expect([target.opacity, target.rotation]).deep.equals([0.5, 0.1]);
    fields.forEach((key, index) => expect(Object.getOwnPropertyDescriptor(manager, key)).deep.equals(before[index]));
  });

  it('replays fresh equal Point reactions with exact undo and redo', () => {
    const target = morph({ extent: pt(100, 100) });
    let extentWrites = 0;
    target.onChange = change => {
      if (change.prop === 'opacity') target.extent = pt(target.opacity * 100, 100);
      if (change.prop === 'extent') extentWrites++;
    };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    for (let cycle = 0; cycle < 5; cycle++) {
      extentWrites = 0;
      undo.undo();
      expect(target.opacity).equals(1);
      expect(target.extent).equals(pt(100, 100));
      expect(extentWrites).equals(1);
      extentWrites = 0;
      undo.redo();
      expect(target.opacity).equals(0.5);
      expect(target.extent).equals(pt(50, 100));
      expect(extentWrites).equals(1);
    }
  });

  it('journals and repairs non-idempotent reactions over five replay cycles', () => {
    const target = morph();
    const writes = [];
    target.onChange = change => {
      if (change.prop === 'opacity') target.rotation += 0.1;
      if (change.prop === 'rotation') writes.push([change.prevValue, change.value]);
    };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    for (let cycle = 0; cycle < 5; cycle++) {
      writes.length = 0;
      undo.undo();
      expect([target.opacity, target.rotation]).deep.equals([1, 0]);
      expect(writes).deep.equals([[0.1, 0.2], [0.2, 0]]);
      undo.redo();
      expect([target.opacity, target.rotation]).deep.equals([0.5, 0.1]);
    }
  });

  it('rolls back a non-idempotent reaction and rethrows the original error', () => {
    const target = morph();
    target.onChange = change => { if (change.prop === 'opacity') target.rotation += 0.1; };
    const cause = new Error('failed event');
    const failure = failureOf(() => manager.transaction({ scope: target }, () => { target.opacity = 0.5; throw cause; }));
    expect(failure).equals(cause);
    expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    expect(undo.undos).to.have.length(0);
  });

  it('uses first-before and last-after for repeated derived property writes', () => {
    const target = morph();
    target.onChange = change => {
      if (change.prop !== 'opacity') return;
      target.rotation += 0.1;
      target.rotation += 0.2;
    };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    const after = target.rotation;
    for (let cycle = 0; cycle < 5; cycle++) {
      undo.undo();
      expect([target.opacity, target.rotation]).deep.equals([1, 0]);
      undo.redo();
      expect([target.opacity, target.rotation]).deep.equals([0.5, after]);
    }
  });

  it('reconciles nested reactions over undo redo and callback rollback', () => {
    const target = morph({ extent: pt(100, 100) });
    target.onChange = change => {
      if (change.prop === 'opacity') target.rotation += 0.1;
      if (change.prop === 'rotation') target.extent = pt(target.rotation * 100, 100);
    };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    undo.undo();
    expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    expect(target.extent).equals(pt(100, 100));
    undo.redo();
    expect([target.opacity, target.rotation]).deep.equals([0.5, 0.1]);
    expect(target.extent).equals(pt(10, 100));
    undo.undo();
    const cause = new Error('nested failure');
    const failure = failureOf(() => manager.transaction({ scope: target }, () => { target.opacity = 0.25; throw cause; }));
    expect(failure).equals(cause);
    expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    expect(target.extent).equals(pt(100, 100));
  });

  it('explicitly restores an original derived write that replay does not reproduce', () => {
    const target = morph();
    let enabled = true;
    target.onChange = change => { if (enabled && change.prop === 'opacity') target.rotation = 0.25; };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    enabled = false;
    undo.undo();
    expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    undo.redo();
    expect([target.opacity, target.rotation]).deep.equals([0.5, 0.25]);
  });

  it('repairs replay-only properties back to their pre-replay value', () => {
    const target = morph();
    let enabled = false;
    target.onChange = change => { if (enabled && change.prop === 'opacity') target.rotation += 1; };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    enabled = true;
    undo.undo();
    expect([target.opacity, target.rotation]).deep.equals([1, 0]);
    undo.redo();
    expect([target.opacity, target.rotation]).deep.equals([0.5, 0]);
  });

  it('keeps logged partial reaction writes exact without changing informMorph error handling', () => {
    const target = morph();
    const logged = [];
    const original = console.error;
    const listenerError = new Error('listener after write');
    target.onChange = change => {
      if (change.prop === 'opacity') { target.rotation += 0.1; throw listenerError; }
    };
    console.error = (...args) => logged.push(args);
    try {
      manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
      undo.undo();
      expect([target.opacity, target.rotation]).deep.equals([1, 0]);
      undo.redo();
      expect([target.opacity, target.rotation]).deep.equals([0.5, 0.1]);
      undo.undo();
      const cause = new Error('callback failure');
      const failure = failureOf(() => manager.transaction({ scope: target }, () => { target.opacity = 0.25; throw cause; }));
      expect(failure).equals(cause);
      expect([target.opacity, target.rotation]).deep.equals([1, 0]);
      expect(logged.length).equals(6);
    } finally { console.error = original; }
  });

  it('reports non-convergent repair as incomplete with offending operations', () => {
    const target = morph();
    target.onChange = change => { if (change.prop === 'opacity') target.rotation += 0.1; };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    target.onChange = change => {
      if (change.prop === 'opacity') target.rotation += 0.1;
      if (change.prop === 'rotation' && change.value === 0) target.opacity = 0.25;
    };
    const failure = failureOf(() => undo.undo());
    expect(failure).to.be.instanceOf(MorphicRollbackError);
    expect(failure.unreversedOperations.some(operation => operation.property === 'opacity')).equals(true);
    expect(failure.unreversedOperations.some(operation => operation.property === 'opacity' && operation.after === 0.25)).equals(true);
    expect(failure.rollbackErrors.length > 0).equals(true);
  });

  it('captures closed graphics types as immutable copies without changing outside defaults', () => {
    const values = [pt(1, 2), new Rectangle(1, 2, 3, 4), new Transform(pt(1, 2), 0.25, pt(2, 2)), Color.rgb(20, 40, 60)];
    for (const value of values) {
      const target = morph();
      target.setProperty('payload', value);
      const outside = manager.addValueChange(target, 'payload', value);
      expect(outside.operation.valueSemantics).equals('reference');
      const after = value.copy ? value.copy() : new Color(value.r, value.g, value.b, value.a);
      const result = manager.transaction({ scope: target, undoable: false }, () => { target.setProperty('payload', after); });
      const operation = result.changeSet.operations[0];
      expect(operation.valueSemantics).equals('snapshot');
      expect(operation.before === value || operation.after === after).equals(false);
      expect(Object.isFrozen(operation.before)).equals(true);
      expect(operation.before.equals(value)).equals(true);
    }
  });

  it('never lets an original or restored graphics object mutate retained endpoints', () => {
    for (const original of [pt(1, 2), new Transform(pt(1, 2), 0, pt(1, 1))]) {
      const target = morph();
      target.setProperty('payload', original);
      const after = original.copy();
      if (after.isPoint) after.x = 3; else after.e = 3;
      manager.transaction({ scope: target }, () => { target.setProperty('payload', after); });
      if (original.isPoint) original.x = 999; else original.e = 999;
      undo.undo();
      const restored = target.getProperty('payload');
      expect(restored.isPoint ? restored.x : restored.e).equals(1);
      if (restored.isPoint) restored.x = 888; else restored.e = 888;
      // Restore the current endpoint before redo's exact precondition.
      target.setProperty('payload', original.isPoint ? pt(1, 2) : new Transform(pt(1, 2), 0, pt(1, 1)));
      undo.redo();
      expect(target.getProperty('payload').isPoint ? target.getProperty('payload').x : target.getProperty('payload').e).equals(3);
      undo.undo();
      expect(target.getProperty('payload').isPoint ? target.getProperty('payload').x : target.getProperty('payload').e).equals(1);
    }
  });

  it('preserves reference semantics for equal objects outside the closed list', () => {
    class IdentityValue { constructor (n) { this.n = n; } equals (other) { return this.n === other.n; } }
    const target = morph();
    const before = new IdentityValue(1);
    const after = new IdentityValue(2);
    target.setProperty('payload', before);
    const result = manager.transaction({ scope: target, undoable: false }, () => { target.setProperty('payload', after); });
    expect(result.changeSet.operations[0].valueSemantics).equals('reference');
    target.setProperty('payload', new IdentityValue(2));
    const failure = failureOf(() => manager.applyChangeSet(result.changeSet, { context: manager.operationContext({ scope: target }), direction: 'undo', notify: false }));
    expect(failure.message).includes('Precondition failed');
    expect(target.getProperty('payload') === after).equals(false);
  });

  it('keeps a non-graphics endpoint by reference when a property changes type', () => {
    for (const after of [{ n: 2 }, [2]]) {
      const target = morph();
      const before = pt(1, 2);
      target.setProperty('payload', before);
      manager.transaction({ scope: target }, () => target.setProperty('payload', after));
      before.x = 999;
      undo.undo();
      expect(target.getProperty('payload')).equals(pt(1, 2));
      undo.redo();
      expect(target.getProperty('payload')).equals(after);
      after.extra = 3;
      undo.undo();
      undo.redo();
      expect(target.getProperty('payload')).equals(after);
      expect(target.getProperty('payload').extra).equals(3);
    }
  });

  it('repairs equal-but-distinct reference reactions rather than consuming them as values', () => {
    class IdentityValue { constructor (n) { this.n = n; } equals (other) { return this.n === other.n; } }
    const target = morph();
    const before = new IdentityValue(1);
    target.setProperty('payload', before);
    const writes = [];
    target.onChange = change => {
      if (change.prop === 'opacity') target.setProperty('payload', new IdentityValue(target.opacity));
      if (change.prop === 'payload') writes.push(change.value);
    };
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    const after = target.getProperty('payload');
    expect(result.changeSet.operations[1].valueSemantics).equals('reference');
    writes.length = 0;
    undo.undo();
    expect(target.getProperty('payload')).equals(before);
    expect(writes).to.have.length(2);
    expect(writes[0] === before).equals(false);
    expect(writes[1]).equals(before);
    writes.length = 0;
    undo.redo();
    expect(target.getProperty('payload')).equals(after);
    expect(writes).to.have.length(2);
    expect(writes[0] === after).equals(false);
    expect(writes[1]).equals(after);
  });

  it('tracks reactions through bindings and owner notification chains', () => {
    const target = morph();
    const owner = morph({ submorphs: [target] });
    const receiver = morph();
    receiver.react = change => { if (change.prop === 'opacity') receiver.rotation += 0.1; };
    connect(target, 'change', receiver, 'react');
    owner.onSubmorphChange = change => { if (change.prop === 'opacity') owner.rotation += 0.2; };
    manager.transaction({ scope: [owner, receiver] }, () => { target.opacity = 0.5; });
    undo.undo();
    expect([target.opacity, receiver.rotation, owner.rotation]).deep.equals([1, 0, 0]);
    undo.redo();
    expect([target.opacity, receiver.rotation, owner.rotation]).deep.equals([0.5, 0.1, 0.2]);
    undo.undo();
    const cause = new Error('owner and binding rollback');
    expect(failureOf(() => manager.transaction({ scope: [owner, receiver] }, () => { target.opacity = 0.25; throw cause; }))).equals(cause);
    expect([target.opacity, receiver.rotation, owner.rotation]).deep.equals([1, 0, 0]);
  });

  it('keeps rollback and silent replay reactions out of committed delivery and history', () => {
    const target = morph();
    target.onChange = change => { if (change.prop === 'opacity') target.rotation += 0.1; };
    const cause = new Error('no commit');
    let deliveries = 0;
    manager.addCommittedChangeListener(() => deliveries++);
    expect(failureOf(() => manager.transaction({ scope: target }, () => { target.opacity = 0.5; throw cause; }))).equals(cause);
    expect(deliveries).equals(0);
    expect(undo.undos).to.have.length(0);
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(deliveries).equals(1);
    deliveries = 0;
    const context = manager.operationContext({ scope: target });
    manager.applyChangeSet(result.changeSet, { context, direction: 'undo', notify: false });
    manager.applyChangeSet(result.changeSet, { context, direction: 'redo', notify: false });
    expect(deliveries).equals(0);
    expect(undo.undos).to.have.length(1);
    expect(undo.redos).to.have.length(0);
    expect(undo.undoInProgress).equals(null);
  });

  it('delivers only the final successful replay boundary without new history', () => {
    const target = morph();
    target.onChange = change => { if (change.prop === 'opacity') target.rotation += 0.1; };
    const origins = [];
    manager.addCommittedChangeListener(changeSet => origins.push(changeSet.origin));
    const result = manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    origins.length = 0;
    undo.undo();
    undo.redo();
    expect(origins).deep.equals(['undo', 'redo']);
    expect(undo.undos).to.have.length(1);
    expect(undo.redos).to.have.length(0);
    origins.length = 0;
    target.onChange = change => {
      if (change.prop === 'opacity') target.rotation += 0.1;
      if (change.prop === 'rotation' && change.value === 0) target.opacity = 0.25;
    };
    expect(failureOf(() => manager.applyChangeSet(result.changeSet, {
      context: manager.operationContext({ scope: target }), direction: 'undo'
    }))).to.be.instanceOf(MorphicRollbackError);
    expect(origins).to.have.length(0);
    expect(undo.undos).to.have.length(1);
    expect(undo.redos).to.have.length(0);
  });

  it('preserves source-unit ownership when continuous scalar events coalesce', () => {
    const target = morph();
    const writes = [];
    target.onChange = change => {
      if (change.prop === 'opacity') target.rotation += 0.1;
      if (change.prop === 'rotation') writes.push([change.prevValue, change.value]);
    };
    undo.undoStart(target, 'opacity gesture');
    for (const opacity of [0.5, 0.25]) manager.transaction({ scope: target }, () => { target.opacity = opacity; });
    undo.undoStop();
    expect(undo.undos).to.have.length(1);
    for (let cycle = 0; cycle < 3; cycle++) {
      writes.length = 0;
      undo.undo();
      expect([target.opacity, target.rotation]).deep.equals([1, 0]);
      expect(writes).deep.equals([[0.2, 0.2 + 0.1], [0.2 + 0.1, 0]]);
      undo.redo();
      expect([target.opacity, target.rotation]).deep.equals([0.25, 0.2]);
    }
  });
});
