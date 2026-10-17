/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv } from '../index.js';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { MorphicTransactionUnsupportedError, MorphicTransactionAsyncError, MorphicRollbackError, MorphicChangeSet, SetMorphProperty } from '../changes/index.js';

/** Return the exact failure. */
function failureOf (callback) {
  try { callback(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

describe('morphic atomic direct state guards', function () {
  this.timeout(5000);
  let env, manager;
  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    manager = env.changeManager;
  });
  afterEach(() => MorphicEnv.popDefault().uninstall());

  const writes = {
    set: target => { target._morphicState.opacity = 0.3; },
    delete: target => { delete target._morphicState.opacity; },
    defineProperty: target => Object.defineProperty(target._morphicState, 'opacity', { value: 0.3 }),
    setPrototypeOf: target => Object.setPrototypeOf(target._morphicState, {}),
    preventExtensions: target => Object.preventExtensions(target._morphicState)
  };
  for (const [kind, write] of Object.entries(writes)) {
    it(`rejects ${kind} before its effect and rolls back even a caught violation`, () => {
      const target = morph();
      const state = target._morphicState;
      const descriptor = Object.getOwnPropertyDescriptor(target, '_morphicState');
      let violation;
      const error = failureOf(() => manager.transaction({ scope: target }, () => {
        target.opacity = 0.5;
        violation = failureOf(() => write(target));
        expect(violation).to.be.instanceOf(MorphicTransactionUnsupportedError);
        expect(violation.detection).equals('before');
        expect(target.opacity).equals(0.5);
      }));
      expect(error).equals(violation);
      expect(target.opacity).equals(1);
      expect(target._morphicState).equals(state);
      expect(Object.getOwnPropertyDescriptor(target, '_morphicState')).deep.equals(descriptor);
      expect(env.undoManager.undos).to.have.length(0);
    });
  }

  for (const exit of ['success', 'error', 'thenable']) {
    it(`restores the state object and descriptor after ${exit}`, () => {
      const target = morph();
      const state = target._morphicState;
      const descriptor = Object.getOwnPropertyDescriptor(target, '_morphicState');
      const cause = new Error('callback');
      const run = () => manager.transaction({ scope: target }, () => {
        expect(target._morphicState).not.equals(state);
        target.opacity = 0.5;
        if (exit === 'error') throw cause;
        if (exit === 'thenable') return Promise.reject(cause);
      });
      if (exit === 'success') run();
      else {
        const error = failureOf(run);
        if (exit === 'error') expect(error).equals(cause);
        else expect(error).to.be.instanceOf(MorphicTransactionAsyncError);
      }
      expect(target._morphicState).equals(state);
      expect(Object.getOwnPropertyDescriptor(target, '_morphicState')).deep.equals(descriptor);
      target._morphicState.opacity = 0.7;
      expect(target.opacity).equals(0.7);
    });
  }

  for (const fails of [false, true]) {
    it(`restores the parent guard after a nested ${fails ? 'failure' : 'success'}`, () => {
      const target = morph();
      const state = target._morphicState;
      const descriptor = Object.getOwnPropertyDescriptor(target, '_morphicState');
      manager.transaction({ scope: target }, () => {
        const parentState = target._morphicState;
        const parentDescriptor = Object.getOwnPropertyDescriptor(target, '_morphicState');
        const cause = new Error('savepoint');
        const run = () => manager.transaction({ scope: target }, () => {
          target.opacity = 0.5;
          if (fails) throw cause;
        });
        if (fails) expect(failureOf(run)).equals(cause);
        else run();
        expect(target._morphicState).equals(parentState);
        expect(Object.getOwnPropertyDescriptor(target, '_morphicState')).deep.equals(parentDescriptor);
        target.rotation = 1;
      });
      expect(target._morphicState).equals(state);
      expect(Object.getOwnPropertyDescriptor(target, '_morphicState')).deep.equals(descriptor);
    });
  }

  it('enlists a morph on its first recorded write before observer delivery', () => {
    const target = morph();
    const state = target._morphicState;
    const violations = [];
    target.onChange = () => {
      violations.push(failureOf(() => { target._morphicState.opacity = 0.3; }));
    };
    const error = failureOf(() => manager.transaction({}, () => { target.opacity = 0.5; }));
    expect(error).equals(violations[0]);
    expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(target.opacity).equals(1);
    expect(target._morphicState).equals(state);
  });

  it('rejects an unsupported slot descriptor before the callback', () => {
    const target = morph();
    Object.defineProperty(target, '_morphicState', { writable: false });
    let ran = false;
    const error = failureOf(() => manager.transaction({ scope: target }, () => { ran = true; }));
    expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(ran).equals(false);
  });

  it('supports nonconfigurable writable data slots without redefining them', () => {
    const target = morph();
    Object.defineProperty(target, '_morphicState', { configurable: false });
    const descriptor = Object.getOwnPropertyDescriptor(target, '_morphicState');
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(Object.getOwnPropertyDescriptor(target, '_morphicState')).deep.equals(descriptor);
    expect(target.opacity).equals(0.5);
  });

  const slotWrites = {
    assignment: target => { target._morphicState = { opacity: 0.2 }; },
    deletion: target => { delete target._morphicState; },
    redefinition: target => Object.defineProperty(target, '_morphicState', { value: {}, enumerable: false }),
    accessor: target => Object.defineProperty(target, '_morphicState', { get: () => ({}) })
  };
  for (const [kind, write] of Object.entries(slotWrites)) {
    it(`detects slot ${kind} after effect, restores it, then rolls back recorded edits`, () => {
      const target = morph();
      const state = target._morphicState;
      const descriptor = Object.getOwnPropertyDescriptor(target, '_morphicState');
      let ran = false;
      const error = failureOf(() => manager.transaction({ scope: target }, () => {
        target.opacity = 0.5;
        write(target);
        ran = true;
      }));
      expect(ran).equals(true);
      expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
      expect(error.kind).equals('state-slot');
      expect(error.detection).equals('after');
      expect(target._morphicState).equals(state);
      expect(Object.getOwnPropertyDescriptor(target, '_morphicState')).deep.equals(descriptor);
      expect(target.opacity).equals(1);
      expect(env.undoManager.undos).to.have.length(0);
    });
  }

  const aliasWrites = {
    assignment: state => { state.opacity = 0.2; },
    deletion: state => { delete state.opacity; },
    newSlot: state => { state.guardExtra = 23; },
    symbol: state => { state[Symbol('guard')] = 23; },
    descriptor: state => Object.defineProperty(state, 'opacity', { enumerable: false }),
    accessor: state => Object.defineProperty(state, 'opacity', { configurable: true, get: () => 0.2 }),
    prototype: state => Object.setPrototypeOf(state, {})
  };
  for (const [kind, write] of Object.entries(aliasWrites)) {
    it(`detects a shallow raw-alias ${kind} after effect and recovers the exact slots`, () => {
      const target = morph();
      const state = target._morphicState;
      const slots = Object.getOwnPropertyDescriptors(state);
      const prototype = Object.getPrototypeOf(state);
      const error = failureOf(() => manager.transaction({ scope: target }, () => {
        target.opacity = 0.5;
        write(state);
      }));
      expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
      expect(error.kind).equals('direct-state-alias');
      expect(error.detection).equals('after');
      expect(target._morphicState).equals(state);
      expect(Object.getOwnPropertyDescriptors(state)).deep.equals(slots);
      expect(Object.getPrototypeOf(state)).equals(prototype);
      expect(target.opacity).equals(1);
    });
  }

  it('preserves the original callback error when alias and slot recovery completes', () => {
    const target = morph();
    const state = target._morphicState;
    const cause = new Error('original callback');
    const error = failureOf(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      state.opacity = 0.2;
      target._morphicState = {};
      throw cause;
    }));
    expect(error).equals(cause);
    expect(target._morphicState).equals(state);
    expect(target.opacity).equals(1);
  });

  for (const exit of ['success', 'error', 'thenable', 'violation']) {
    it(`revokes captured proxies after ${exit}, for both reads and writes`, () => {
      const target = morph();
      let captured;
      const run = () => manager.transaction({ scope: target }, () => {
        captured = target._morphicState;
        target.opacity = 0.5;
        if (exit === 'error') throw new Error('callback');
        if (exit === 'thenable') return Promise.resolve();
        if (exit === 'violation') captured.opacity = 0.2;
      });
      if (exit === 'success') run();
      else failureOf(run);
      expect(failureOf(() => captured.opacity)).to.be.instanceOf(TypeError);
      expect(failureOf(() => { captured.opacity = 0.7; })).to.be.instanceOf(TypeError);
      target._morphicState.opacity = 0.9;
      expect(target.opacity).equals(0.9);
    });
  }

  it('revokes the child proxy while the parent remains guarded, including thenable exit', () => {
    const target = morph();
    const state = target._morphicState;
    manager.transaction({ scope: target }, () => {
      const outer = target._morphicState;
      let inner;
      expect(failureOf(() => manager.transaction({ scope: target }, () => {
        inner = target._morphicState;
        target.opacity = 0.5;
        return Promise.resolve();
      }))).to.be.instanceOf(MorphicTransactionAsyncError);
      expect(target._morphicState).equals(outer);
      expect(target.opacity).equals(1);
      expect(failureOf(() => inner.opacity)).to.be.instanceOf(TypeError);
      target.opacity = 0.8;
    });
    expect(target._morphicState).equals(state);
    expect(target.opacity).equals(0.8);
  });

  it('keeps a morph first enlisted in a child guarded in the parent scope', () => {
    const target = morph();
    const state = target._morphicState;
    const error = failureOf(() => manager.transaction({}, () => {
      manager.transaction({}, () => { target.opacity = 0.5; });
      target._morphicState.opacity = 0.2;
    }));
    expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(error.detection).equals('before');
    expect(target._morphicState).equals(state);
    expect(target.opacity).equals(1);
  });

  it('recovers an inner alias violation and lets the parent commit its earlier work', () => {
    const target = morph();
    const state = target._morphicState;
    manager.transaction({ scope: target }, () => {
      target.opacity = 0.6;
      const error = failureOf(() => manager.transaction({ scope: target }, () => {
        target.opacity = 0.3;
        state.opacity = 0.2;
      }));
      expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
      expect(target.opacity).equals(0.6);
      target.rotation = 1;
    });
    expect(target._morphicState).equals(state);
    expect(target.opacity).equals(0.6);
    expect(target.rotation).equals(1);
    env.undoManager.undo();
    expect(target.opacity).equals(1);
    expect(target.rotation).equals(0);
  });

  it('reports irreversible raw-alias extensibility damage as incomplete rollback', () => {
    const target = morph();
    const state = target._morphicState;
    const error = failureOf(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      Object.preventExtensions(state);
    }));
    expect(error).to.be.instanceOf(MorphicRollbackError);
    expect(error.cause).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(error.cause.detection).equals('after');
    expect(error.unreversedOperations.map(op => op.kind)).includes('direct-state-alias');
    expect(error.rollbackErrors).to.have.length(error.unreversedOperations.length);
    expect(target._morphicState).equals(state);
    expect(target.opacity).equals(1);
  });

  it('does not mask a falsy callback error with incomplete state recovery', () => {
    const target = morph();
    const state = target._morphicState;
    const error = failureOf(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      Object.defineProperty(state, 'opacity', { value: 0.2, writable: false, configurable: false });
      throw false;
    }));
    expect(error).to.be.instanceOf(MorphicRollbackError);
    expect(error.cause).equals(false);
    expect(error.unreversedOperations[0].kind).equals('direct-state-alias');
    expect(target._morphicState).equals(state);
  });

  it('aggregates an incomplete child cleanup innermost-first even if its error is caught', () => {
    const target = morph();
    const cause = new Error('child');
    let inner;
    const outer = failureOf(() => manager.transaction({ scope: target }, () => {
      try {
        manager.transaction({ scope: target }, () => {
          target.opacity = 0.5;
          Object.defineProperty(target, '_morphicState', { value: {}, configurable: false, writable: false });
          throw cause;
        });
      } catch (error) { inner = error; }
    }));
    expect(inner).to.be.instanceOf(MorphicRollbackError);
    expect(outer).to.be.instanceOf(MorphicRollbackError);
    expect(outer.cause).equals(cause);
    expect(outer.unreversedOperations.slice(0, inner.unreversedOperations.length)).deep.equals(inner.unreversedOperations);
    expect(outer.unreversedOperations[outer.unreversedOperations.length - 1].kind).equals('state-guard-cleanup');
    expect(env.undoManager.undos).to.have.length(0);
  });

  it('documents nested aliases as outside the shallow detection boundary', () => {
    const target = morph();
    const nested = { value: 1 };
    target._morphicState.guardPayload = nested;
    manager.transaction({ scope: target }, () => { target._morphicState.guardPayload.value = 2; });
    expect(nested.value).equals(2);
    expect(env.undoManager.undos).to.have.length(0);
  });

  it('documents never-enlisted morphs as outside the detection boundary', () => {
    const target = morph();
    const state = target._morphicState;
    manager.transaction({}, () => { target._morphicState.opacity = 0.2; });
    expect(target._morphicState).equals(state);
    expect(target.opacity).equals(0.2);
    expect(env.undoManager.undos).to.have.length(0);
  });


  for (const kind of ['alias', 'slot']) {
    it(`rejects a subsequent recorded write before capturing its endpoint from ${kind} damage`, () => {
      const target = morph();
      const state = target._morphicState;
      let violation;
      const error = failureOf(() => manager.transaction({ scope: target }, () => {
        if (kind === 'alias') state.opacity = 0.2;
        else target._morphicState = { opacity: 0.2 };
        violation = failureOf(() => { target.opacity = 0.7; });
        expect(violation.detection).equals('after');
      }));
      expect(error).equals(violation);
      expect(target._morphicState).equals(state);
      expect(target.opacity).equals(1);
    });
  }

  it('recovers all damaged enlisted morphs when more than one alias changes', () => {
    const first = morph();
    const second = morph();
    const firstState = first._morphicState;
    const secondState = second._morphicState;
    const error = failureOf(() => manager.transaction({ scope: [first, second] }, () => {
      first.opacity = 0.5;
      second.opacity = 0.6;
      firstState.opacity = 0.2;
      secondState.opacity = 0.3;
    }));
    expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(first.opacity).equals(1);
    expect(second.opacity).equals(1);
    expect(first._morphicState).equals(firstState);
    expect(second._morphicState).equals(secondState);
  });


  it('keeps every enlisted proxy active until all rollback observers finish', () => {
    const first = morph();
    const second = morph();
    const firstState = first._morphicState;
    const secondState = second._morphicState;
    const violations = [];
    const cause = new Error('rollback');
    first.onChange = () => {
      if (first.opacity === 1) violations.push(failureOf(() => { second._morphicState.opacity = 0.2; }));
    };
    const error = failureOf(() => manager.transaction({}, () => {
      first.opacity = 0.5;
      second.opacity = 0.6;
      first.opacity = 0.4;
      throw cause;
    }));
    expect(error).equals(cause);
    expect(violations).to.have.length(1);
    expect(violations[0]).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(violations[0].detection).equals('before');
    expect(first._morphicState).equals(firstState);
    expect(second._morphicState).equals(secondState);
    expect(first.opacity).equals(1);
    expect(second.opacity).equals(1);
  });

  it('repairs shallow raw-alias damage made by a rollback observer', () => {
    const target = morph();
    const state = target._morphicState;
    const slots = Object.getOwnPropertyDescriptors(state);
    const cause = new Error('rollback');
    target.onChange = () => { if (target.opacity === 1) state.unrecorded = 23; };
    const error = failureOf(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      throw cause;
    }));
    expect(error).equals(cause);
    expect(target._morphicState).equals(state);
    expect(Object.getOwnPropertyDescriptors(state)).deep.equals(slots);
  });

  it('does not reapply a completed savepoint snapshot while rolling back later parent edits', () => {
    const target = morph();
    const state = target._morphicState;
    const cause = new Error('parent rollback');
    const error = failureOf(() => manager.transaction({}, () => {
      manager.transaction({}, () => { target.opacity = 0.5; });
      target.opacity = 0.3;
      throw cause;
    }));
    expect(error).equals(cause);
    expect(target._morphicState).equals(state);
    expect(target.opacity).equals(1);
  });


  for (const hook of ['absent', 'custom']) {
    it(`guards replay targets before a caller context's ${hook} enlist hook`, () => {
      const target = morph();
      const state = target._morphicState;
      const set = new MorphicChangeSet({ id: 'custom-context-state-guard', operations: [
        new SetMorphProperty({ targetId: target.id, property: 'opacity', before: 1, after: 0.5 })
      ] });
      const context = { resolveMorph: id => id === target.id ? target : null };
      const violations = [];
      const checkGuard = () => {
        violations.push(failureOf(() => { target._morphicState.opacity = 0.2; }));
      };
      if (hook === 'custom') context.enlist = checkGuard;
      else target.onChange = checkGuard;
      const error = failureOf(() => manager.applyChangeSet(set, { context }));
      expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
      expect(error).equals(violations[0]);
      expect(error.detection).equals('before');
      expect(target._morphicState).equals(state);
      expect(target.opacity).equals(1);
      expect(env.undoManager.undos).to.have.length(0);
    });
  }

});
