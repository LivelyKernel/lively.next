/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv } from '../index.js';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { ChangeManager } from '../changes.js';
import { MorphicTransactionAsyncError, MorphicTransactionUnsupportedError } from '../changes/index.js';

/** Catch an exact thrown value. */
function failureOf (fn) {
  try { fn(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

/** Check that a manager again uses its ordinary prototype dispatch. */
function expectOrdinary (manager) {
  for (const name of ['_record', 'informCommittedChangeListeners']) {
    expect(Object.getOwnPropertyDescriptor(manager, name)).equals(undefined);
    expect(manager[name]).equals(ChangeManager.prototype[name]);
  }
}

describe('morphic transaction dispatch lifetime', function () {
  this.timeout(5000);
  let env, manager;
  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    manager = env.changeManager;
  });
  afterEach(() => MorphicEnv.popDefault().uninstall());

  for (const exit of ['success', 'error', 'thenable']) {
    it(`restores shared dispatch guards after ${exit}`, () => {
      const target = morph();
      const other = new ChangeManager();
      const cause = new Error('callback');
      expectOrdinary(manager);
      expectOrdinary(other);
      const run = () => manager.transaction({ scope: target }, () => {
        for (const current of [manager, other]) {
          expect(current._record).equals(ChangeManager.prototype._record);
          expect(current.informCommittedChangeListeners).equals(ChangeManager.prototype.informCommittedChangeListeners);
        }
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
      expectOrdinary(manager);
      expectOrdinary(other);
      expect(target.opacity).equals(exit === 'success' ? 0.5 : 1);
    });
  }

  for (const innerFails of [false, true]) {
    it(`keeps the outer dispatch after a nested ${innerFails ? 'failure' : 'success'}`, () => {
      const target = morph();
      const other = new ChangeManager();
      const cause = new Error('savepoint');
      manager.transaction({ scope: target }, () => {
        const record = manager._record;
        const foreignRecord = other._record;
        const inner = () => manager.transaction({}, () => {
          target.opacity = 0.5;
          if (innerFails) throw cause;
        });
        if (innerFails) expect(failureOf(inner)).equals(cause);
        else inner();
        expect(manager._record).equals(record);
        expect(other._record).equals(foreignRecord);
        expect(manager._record).equals(ChangeManager.prototype._record);
        target.rotation = 1;
      });
      expectOrdinary(manager);
      expectOrdinary(other);
      expect(target.opacity).equals(innerFails ? 1 : 0.5);
      expect(target.rotation).equals(1);
    });
  }

  it('guards a manager constructed inside a frame before a foreign write', () => {
    const target = morph();
    const foreign = { id: 'foreign', _morphicState: { value: 0 } };
    let other;
    const error = failureOf(() => manager.transaction({ scope: target }, () => {
      target.opacity = 0.5;
      other = new ChangeManager();
      expect(other._record).equals(ChangeManager.prototype._record);
      other.addValueChange(foreign, 'value', 1);
    }));
    expect(error).to.be.instanceOf(MorphicTransactionUnsupportedError);
    expect(target.opacity).equals(1);
    expect(foreign._morphicState.value).equals(0);
    expectOrdinary(manager);
    expectOrdinary(other);
  });

  it('restores own method descriptors and keeps an existing record wrapper active', () => {
    const target = morph();
    let records = 0;
    Object.defineProperty(manager, '_record', {
      configurable: true, enumerable: true, writable: false,
      value (morph, change) { records++; return ChangeManager.prototype._record.call(this, morph, change); }
    });
    Object.defineProperty(manager, 'informCommittedChangeListeners', {
      configurable: true, enumerable: false, writable: false,
      value (change) { return ChangeManager.prototype.informCommittedChangeListeners.call(this, change); }
    });
    const before = ['_record', 'informCommittedChangeListeners'].map(name => Object.getOwnPropertyDescriptor(manager, name));
    let commits = 0;
    manager.addCommittedChangeListener(() => commits++);
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(records).equals(1);
    expect(commits).equals(1);
    for (const [index, name] of ['_record', 'informCommittedChangeListeners'].entries()) {
      expect(Object.getOwnPropertyDescriptor(manager, name)).deep.equals(before[index]);
    }
    target.opacity = 0.75;
    expect(records).equals(2);
    expect(commits).equals(2);
  });

  it('preserves an inherited record wrapper and restores the prototype dispatch', () => {
    const target = morph();
    const ordinaryRecord = ChangeManager.prototype._record;
    let records = 0;
    const inherited = Object.create(Object.getPrototypeOf(manager), {
      _record: {
        configurable: true,
        value (morph, change) { records++; return ChangeManager.prototype._record.call(this, morph, change); }
      }
    });
    Object.setPrototypeOf(manager, inherited);
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(records).equals(1);
    expect(ChangeManager.prototype._record).equals(ordinaryRecord);
    expect(Object.getOwnPropertyDescriptor(manager, '_record')).equals(undefined);
    expect(manager._record).equals(inherited._record);
    target.opacity = 0.75;
    expect(records).equals(2);
  });

  it('closes dispatch before committed and deferred consumers start independent work', () => {
    const target = morph();
    const other = new ChangeManager();
    let commits = 0, deferred = 0;
    manager.addCommittedChangeListener(() => {
      expectOrdinary(manager);
      expectOrdinary(other);
      commits++;
    });
    target.onChange = change => {
      if (change.prop !== 'opacity') return;
      manager.deferAfterChangeNotifications(change, () => {
        expectOrdinary(manager);
        expectOrdinary(other);
        deferred++;
      });
    };
    manager.transaction({ scope: target }, () => { target.opacity = 0.5; });
    expect(commits).equals(1);
    expect(deferred).equals(1);
  });
});
