import { EditTransaction, EditTransactionKind } from 'lively.morphic/undo.js';

export const PolicyCacheTransactionDirection = Object.freeze({
  FORWARD: 'forward',
  REVERSE: 'reverse'
});

const directions = new Set(Object.values(PolicyCacheTransactionDirection));

function storeFor (stores, id) {
  const store = stores instanceof Map ? stores.get(id) : stores?.[id];
  if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
    throw new Error(`Policy cache synchronization requires a store for ${id}`);
  }
  return store;
}

function replayFor (rename, direction) {
  return direction === PolicyCacheTransactionDirection.FORWARD
    ? { nameBefore: rename.beforeName, nameAfter: rename.afterName }
    : { nameBefore: rename.afterName, nameAfter: rename.beforeName };
}

function writeStore (store, name, transaction, id) {
  const result = store.write(name, transaction);
  if (result && typeof result.then === 'function') {
    throw new Error(`Policy cache store for ${id} must be synchronous`);
  }
  if (store.read() !== name) {
    throw new Error(`Policy cache store diverged for ${id}`);
  }
}

export class PreparedPolicyCacheRenameTransaction {
  constructor ({ id, renames }) {
    if (typeof id !== 'string' || !id) {
      throw new Error('Prepared policy cache transactions require an id');
    }
    if (!Array.isArray(renames)) {
      throw new Error('Prepared policy cache transactions require rename plans');
    }
    const ids = new Set();
    this.renames = Object.freeze(renames.map(rename => {
      if (typeof rename?.id !== 'string' || !rename.id ||
          typeof rename.beforeName !== 'string' || !rename.beforeName ||
          typeof rename.afterName !== 'string' || !rename.afterName) {
        throw new Error('Policy cache rename plans require identity and name snapshots');
      }
      if (ids.has(rename.id)) {
        throw new Error(`Duplicate policy cache rename plan for ${rename.id}`);
      }
      ids.add(rename.id);
      return Object.freeze({
        id: rename.id,
        beforeName: rename.beforeName,
        afterName: rename.afterName
      });
    }));
    this.id = id;
    Object.freeze(this);
  }
}

export class PreparedPolicyCachePropertyTransaction {
  constructor ({ id, changes }) {
    if (typeof id !== 'string' || !id) {
      throw new Error('Prepared policy cache property transactions require an id');
    }
    if (!Array.isArray(changes)) {
      throw new Error('Prepared policy cache property transactions require change plans');
    }
    const ids = new Set();
    this.changes = Object.freeze(changes.map(change => {
      if (typeof change?.id !== 'string' || !change.id ||
          typeof change.property !== 'string' || !change.property ||
          !Object.prototype.hasOwnProperty.call(change, 'beforeValue') ||
          !Object.prototype.hasOwnProperty.call(change, 'afterValue')) {
        throw new Error('Policy cache property plans require identity, property, and value snapshots');
      }
      if (ids.has(change.id)) {
        throw new Error(`Duplicate policy cache property plan for ${change.id}`);
      }
      ids.add(change.id);
      return Object.freeze({
        id: change.id,
        property: change.property,
        beforeValue: change.beforeValue,
        afterValue: change.afterValue
      });
    }));
    this.id = id;
    Object.freeze(this);
  }
}

export class PolicyCacheConflictError extends Error {
  constructor (message, transaction) {
    super(message);
    this.name = 'PolicyCacheConflictError';
    this.transaction = transaction;
  }
}

export class PolicyCacheRollbackError extends Error {
  constructor (message, cause, rollbackErrors, transaction) {
    super(message);
    this.name = 'PolicyCacheRollbackError';
    this.cause = cause;
    this.rollbackErrors = Object.freeze(rollbackErrors.slice());
    this.transaction = transaction;
  }
}

export function validatePreparedPolicyCacheRenames (transaction, stores, direction) {
  if (!(transaction instanceof PreparedPolicyCacheRenameTransaction)) {
    throw new Error('Can only validate a PreparedPolicyCacheRenameTransaction');
  }
  if (!directions.has(direction)) {
    throw new Error(`Unknown policy cache transaction direction: ${direction}`);
  }
  for (const rename of transaction.renames) {
    const replay = replayFor(rename, direction);
    if (storeFor(stores, rename.id).read() !== replay.nameBefore) {
      throw new PolicyCacheConflictError(
        `Policy cache changed while transaction ${transaction.id} was being planned for ${rename.id}`,
        transaction
      );
    }
  }
  return transaction;
}

export function applyPreparedPolicyCacheRenames (transaction, {
  stores,
  direction = PolicyCacheTransactionDirection.FORWARD
}) {
  validatePreparedPolicyCacheRenames(transaction, stores, direction);
  const attempted = [];
  try {
    for (const rename of transaction.renames) {
      const store = storeFor(stores, rename.id);
      const replay = replayFor(rename, direction);
      attempted.push({ rename, store, replay });
      writeStore(store, replay.nameAfter, transaction, rename.id);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const { rename, store, replay } of attempted.reverse()) {
      try {
        writeStore(store, replay.nameBefore, transaction, rename.id);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new PolicyCacheRollbackError(
        `Failed to synchronize policy cache ${transaction.id} and roll it back completely`,
        error,
        rollbackErrors,
        transaction
      );
    }
    throw error;
  }
  return Object.freeze({ transaction, direction });
}

function propertyReplayFor (change, direction) {
  return direction === PolicyCacheTransactionDirection.FORWARD
    ? { valueBefore: change.beforeValue, valueAfter: change.afterValue }
    : { valueBefore: change.afterValue, valueAfter: change.beforeValue };
}

export function validatePreparedPolicyCacheProperties (transaction, stores, direction) {
  if (!(transaction instanceof PreparedPolicyCachePropertyTransaction)) {
    throw new Error('Can only validate a PreparedPolicyCachePropertyTransaction');
  }
  if (!directions.has(direction)) {
    throw new Error(`Unknown policy cache transaction direction: ${direction}`);
  }
  for (const change of transaction.changes) {
    const replay = propertyReplayFor(change, direction);
    if (storeFor(stores, change.id).read() !== replay.valueBefore) {
      throw new PolicyCacheConflictError(
        `Policy cache changed while transaction ${transaction.id} was being planned for ${change.id}`,
        transaction
      );
    }
  }
  return transaction;
}

export function applyPreparedPolicyCacheProperties (transaction, {
  stores,
  direction = PolicyCacheTransactionDirection.FORWARD
}) {
  validatePreparedPolicyCacheProperties(transaction, stores, direction);
  const attempted = [];
  try {
    for (const change of transaction.changes) {
      const store = storeFor(stores, change.id);
      const replay = propertyReplayFor(change, direction);
      attempted.push({ change, store, replay });
      const result = store.write(replay.valueAfter, transaction);
      if (result && typeof result.then === 'function') {
        throw new Error(`Policy cache store for ${change.id} must be synchronous`);
      }
      if (store.read() !== replay.valueAfter) {
        throw new Error(`Policy cache store diverged for ${change.id}`);
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const { change, store, replay } of attempted.reverse()) {
      try {
        const result = store.write(replay.valueBefore, transaction);
        if (result && typeof result.then === 'function') {
          throw new Error(`Policy cache store for ${change.id} must be synchronous`);
        }
        if (store.read() !== replay.valueBefore) {
          throw new Error(`Policy cache store diverged for ${change.id}`);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new PolicyCacheRollbackError(
        `Failed to synchronize policy cache ${transaction.id} and roll it back completely`,
        error,
        rollbackErrors,
        transaction
      );
    }
    throw error;
  }
  return Object.freeze({ transaction, direction });
}

export class ProjectionalPolicyCacheEditTransaction extends EditTransaction {
  constructor (transaction, stores, {
    label = 'component policy cache synchronization',
    afterReplay = null
  } = {}) {
    if (!(transaction instanceof PreparedPolicyCacheRenameTransaction)) {
      throw new Error('ProjectionalPolicyCacheEditTransaction requires a prepared transaction');
    }
    if (afterReplay !== null && typeof afterReplay !== 'function') {
      throw new Error('Policy cache replay notifications must be functions');
    }
    super({
      kind: EditTransactionKind.COMPONENT_COMMAND,
      label,
      metadata: { policyCacheTransactionId: transaction.id }
    });
    this.transaction = transaction;
    this.stores = stores;
    this.afterReplay = afterReplay;
    this.lastReplayNotificationError = null;
  }

  replay (direction) {
    applyPreparedPolicyCacheRenames(this.transaction, {
      stores: this.stores,
      direction
    });
    if (this.afterReplay) {
      try {
        this.afterReplay({ transaction: this.transaction, direction });
        this.lastReplayNotificationError = null;
      } catch (error) {
        this.lastReplayNotificationError = error;
      }
    }
    return this;
  }

  apply () {
    return this.replay(PolicyCacheTransactionDirection.FORWARD);
  }

  reverseApply () {
    return this.replay(PolicyCacheTransactionDirection.REVERSE);
  }
}

export class ProjectionalPolicyCachePropertyEditTransaction extends EditTransaction {
  constructor (transaction, stores, {
    label = 'component policy cache property synchronization',
    afterReplay = null
  } = {}) {
    if (!(transaction instanceof PreparedPolicyCachePropertyTransaction)) {
      throw new Error('ProjectionalPolicyCachePropertyEditTransaction requires a prepared transaction');
    }
    if (afterReplay !== null && typeof afterReplay !== 'function') {
      throw new Error('Policy cache replay notifications must be functions');
    }
    super({
      kind: EditTransactionKind.COMPONENT_COMMAND,
      label,
      metadata: { policyCacheTransactionId: transaction.id }
    });
    this.transaction = transaction;
    this.stores = stores;
    this.afterReplay = afterReplay;
    this.lastReplayNotificationError = null;
  }

  replay (direction) {
    applyPreparedPolicyCacheProperties(this.transaction, {
      stores: this.stores,
      direction
    });
    if (this.afterReplay) {
      try {
        this.afterReplay({ transaction: this.transaction, direction });
        this.lastReplayNotificationError = null;
      } catch (error) {
        this.lastReplayNotificationError = error;
      }
    }
    return this;
  }

  apply () {
    return this.replay(PolicyCacheTransactionDirection.FORWARD);
  }

  reverseApply () {
    return this.replay(PolicyCacheTransactionDirection.REVERSE);
  }
}
