/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { MorphicEnv, morph } from '../index.js';
import { MorphicRollbackError, MorphicTransactionAsyncError } from '../changes/index.js';
import { releaseStateGuards } from '../changes/state-guard.js';
import { defaultDOMEnv } from '../rendering/dom-helper.js';

describe('rollback reaction guard cleanup', function () {
  let env;
  /** Return the exact thrown value. */
  function failureOf (fn) {
    try { fn(); } catch (error) { return error; }
    throw new Error('Expected failure');
  }

  /** Retain the original state slot without invoking getters. */
  function snapshot (target) {
    return { target, state: target._morphicState, descriptor: Object.getOwnPropertyDescriptor(target, '_morphicState') };
  }

  /** Assert exact identity and descriptor recovery, and a usable slot. */
  function assertRestored ({ target, state, descriptor }) {
    expect(target._morphicState === state).equals(true);
    expect(Object.getOwnPropertyDescriptor(target, '_morphicState')).deep.equals(descriptor);
    expect(() => target.rotation).not.to.throw();
  }
  beforeEach(async () => { env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv())); });
  afterEach(() => MorphicEnv.popDefault().uninstall());

  /** Exercise the rollback reaction and its two positive controls. */
  function checkRollback (enlistInitially, react) {
    const source = morph();
    const target = morph();
    const state = target._morphicState;
    const descriptor = Object.getOwnPropertyDescriptor(target, '_morphicState');
    const manager = env.changeManager;
    const writes = [];
    let deliveries = 0;
    manager.addCommittedChangeListener(() => deliveries++);
    manager.addChangeListener(change => {
      if (change.target === target && change.prop === 'rotation') writes.push([change.prevValue, change.value]);
    });
    const originalOnChange = source.onChange;
    source.onChange = function (change) {
      originalOnChange.call(this, change);
      if (react && change.prop === 'opacity' && change.value === 1) target.rotation += 0.25;
    };
    const cause = new Error('callback failed');
    let caught;
    try {
      manager.transaction({ scope: enlistInitially ? [source, target] : source }, () => {
        source.opacity = 0.5;
        throw cause;
      });
    } catch (error) { caught = error; }
    expect(caught).equals(cause);
    expect(source.opacity).equals(1);
    expect(writes).deep.equals(react ? [[0, 0.25], [0.25, 0]] : []);
    expect(deliveries).equals(0);
    expect(env.undoManager.undos).to.have.length(0);
    expect(env.undoManager.redos).to.have.length(0);
    expect(manager._atomicFrame).equals(null);
    expect(target._morphicState === state).equals(true);
    expect(Object.getOwnPropertyDescriptor(target, '_morphicState')).deep.equals(descriptor);
    expect(target.rotation).equals(0);
  }

  it('restores guards first enlisted by an ordinary recorded reaction during rollback', () => {
    checkRollback(false, true);
  });

  it('restores the same reaction when its target was an initial scope root', () => {
    checkRollback(true, true);
  });

  it('restores the source without a rollback-created reaction', () => {
    checkRollback(false, false);
  });

  for (const exit of ['success', 'error', 'thenable']) {
    it(`restores all guards first enlisted by reactions on ${exit}`, () => {
      const source = morph();
      const target = morph();
      const snapshots = [source, target].map(snapshot);
      const manager = env.changeManager;
      let captured;
      let deliveries = 0;
      manager.addCommittedChangeListener(() => deliveries++);
      const onChange = source.onChange;
      source.onChange = function (change) {
        onChange.call(this, change);
        if (change.prop === 'opacity' && (exit === 'success' ? change.value === 0.5 : change.value === 1)) {
          target.rotation += 0.25;
          captured = target._morphicState;
        }
      };
      const cause = new Error('scope exit');
      const run = () => manager.transaction({ scope: source }, () => {
        source.opacity = 0.5;
        if (exit === 'error') throw cause;
        if (exit === 'thenable') return Promise.reject(cause);
      });
      if (exit === 'success') run();
      else {
        const error = failureOf(run);
        if (exit === 'error') expect(error === cause).equals(true);
        else expect(error).instanceOf(MorphicTransactionAsyncError);
      }
      snapshots.forEach(assertRestored);
      expect(target.rotation).equals(exit === 'success' ? 0.25 : 0);
      expect(failureOf(() => captured.rotation)).instanceOf(TypeError);
      expect(deliveries).equals(exit === 'success' ? 1 : 0);
      expect(env.undoManager.undos.length).equals(exit === 'success' ? 1 : 0);
      expect(env.undoManager.redos.length).equals(0);
    });
  }

  for (const direction of ['undo', 'redo']) {
    it(`restores late reaction guards during ${direction} replay and an injected replay rollback`, () => {
      const source = morph();
      const late = morph();
      const rollbackTarget = morph();
      const snapshots = [source, late, rollbackTarget].map(snapshot);
      const manager = env.changeManager;
      const committed = manager.transaction({ scope: source }, () => { source.opacity = 0.5; });
      if (direction === 'redo') committed.history.entry.reverseApply();
      let failReplay = true;
      const cause = new Error('replay failed after source');
      const onChange = source.onChange;
      source.onChange = function (change) {
        onChange.call(this, change);
        if (change.prop !== 'opacity') return;
        const replayValue = direction === 'undo' ? 1 : 0.5;
        if (change.value === replayValue) late.rotation += 0.25;
        else rollbackTarget.rotation += 0.25;
      };
      // Fail after the ordinary replay source write, outside informMorph's logged-error contract.
      const perform = manager._perform;
      manager._perform = function (frame, operation) {
        const result = perform.call(this, frame, operation);
        if (failReplay && !this._recovering && operation.targetId === source.id) {
          failReplay = false;
          throw cause;
        }
        return result;
      };
      let deliveries = 0;
      manager.addCommittedChangeListener(() => deliveries++);
      try {
        const run = () => direction === 'undo' ? committed.history.entry.reverseApply() : committed.history.entry.apply();
        expect(failureOf(run) === cause).equals(true);
        snapshots.forEach(assertRestored);
        expect(source.opacity).equals(direction === 'undo' ? 0.5 : 1);
        expect(late.rotation).equals(0);
        expect(rollbackTarget.rotation).equals(0);
        expect(deliveries).equals(0);
        run();
        snapshots.forEach(assertRestored);
        expect(source.opacity).equals(direction === 'undo' ? 1 : 0.5);
        expect(late.rotation).equals(0);
        expect(rollbackTarget.rotation).equals(0);
        expect(deliveries).equals(1);
        expect(env.undoManager.undos.length).equals(1);
        expect(env.undoManager.redos.length).equals(0);
      } finally { manager._perform = perform; }
    });
  }

  for (const outerExit of ['success', 'error', 'thenable']) {
    it(`restores the inner late guard to its parent proxy before outer ${outerExit}`, () => {
      const source = morph();
      const target = morph();
      const snapshots = [source, target].map(snapshot);
      const manager = env.changeManager;
      const innerCause = new Error('inner');
      const outerCause = new Error('outer');
      const onChange = source.onChange;
      let innerProxy;
      let outerProxy;
      source.onChange = function (change) {
        onChange.call(this, change);
        if (change.prop === 'opacity' && change.value === 1) {
          target.rotation += 0.25;
          innerProxy = target._morphicState;
        }
      };
      const run = () => manager.transaction({ scope: source }, () => {
        expect(failureOf(() => manager.transaction({ scope: source }, () => {
          source.opacity = 0.5;
          throw innerCause;
        })) === innerCause).equals(true);
        expect(target.rotation).equals(0);
        outerProxy = target._morphicState;
        expect(outerProxy === innerProxy).equals(false);
        expect(failureOf(() => innerProxy.rotation)).instanceOf(TypeError);
        target.rotation = 0.75;
        if (outerExit === 'error') throw outerCause;
        if (outerExit === 'thenable') return Promise.resolve();
      });
      if (outerExit === 'success') run();
      else {
        const error = failureOf(run);
        if (outerExit === 'error') expect(error === outerCause).equals(true);
        else expect(error).instanceOf(MorphicTransactionAsyncError);
      }
      snapshots.forEach(assertRestored);
      expect(target.rotation).equals(outerExit === 'success' ? 0.75 : 0);
      expect(failureOf(() => outerProxy.rotation)).instanceOf(TypeError);
    });
  }

  for (const fails of ['throw', 'no-op']) {
    it(`aggregates a forced late cleanup ${fails} without revoking its live slot`, () => {
      const source = morph();
      const target = morph();
      const saved = snapshot(target);
      const manager = env.changeManager;
      const cause = new Error('original callback');
      const cleanupFailure = new Error('forced guard cleanup failure');
      const onChange = source.onChange;
      let guard;
      source.onChange = function (change) {
        onChange.call(this, change);
        if (change.prop === 'opacity' && change.value === 1) {
          target.rotation += 0.25;
          guard = manager._atomicFrame.stateGuards.get(target);
          guard.cleanup.restore = () => { if (fails === 'throw') throw cleanupFailure; };
        }
      };
      try {
        const error = failureOf(() => manager.transaction({ scope: source }, () => {
          source.opacity = 0.5;
          throw cause;
        }));
        expect(error).instanceOf(MorphicRollbackError);
        expect(error.cause === cause).equals(true);
        expect(error.unreversedOperations.some(op => op.kind === 'state-guard-cleanup' && op.targetId === target.id)).equals(true);
        expect(error.rollbackErrors.some(pair => pair.operation.kind === 'state-guard-cleanup' && (fails === 'throw' ? pair.error === cleanupFailure : pair.error.message === 'Rollback did not restore the operation state'))).equals(true);
        expect(target._morphicState === guard.proxy).equals(true);
        expect(target.rotation).equals(0);
        expect(source.opacity).equals(1);
        expect(env.undoManager.undos.length).equals(0);
        expect(env.undoManager.redos.length).equals(0);
        expect(manager._atomicFrame).equals(null);
      } finally {
        Object.defineProperty(target, '_morphicState', saved.descriptor);
        guard?.revoke();
      }
    });
  }

  it('never revokes an unrestored guard even when release is called directly', () => {
    const target = morph();
    let guard;
    const manager = env.changeManager;
    const cause = new Error('scope');
    const error = failureOf(() => manager.transaction({ scope: target }, () => {
      guard = manager._atomicFrame.stateGuards.get(target);
      const frame = { stateGuards: new Map([[target, guard]]) };
      releaseStateGuards(frame);
      expect(target.opacity).equals(1);
      throw cause;
    }));
    expect(error === cause).equals(true);
    expect(target.opacity).equals(1);
  });
});
