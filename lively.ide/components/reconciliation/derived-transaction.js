import { EditTransaction, EditTransactionKind } from 'lively.morphic/undo.js';
import { MorphicChangeSet } from 'lively.morphic/changes/index.js';

export const DerivedTransactionDirection = Object.freeze({
  FORWARD: 'forward',
  REVERSE: 'reverse'
});

const directions = new Set(Object.values(DerivedTransactionDirection));

function isPromise (value) {
  return value && typeof value.then === 'function';
}

function storeFor (stores, moduleId) {
  const store = stores instanceof Map ? stores.get(moduleId) : stores?.[moduleId];
  if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
    throw new Error(`Derived propagation requires a source store for ${moduleId}`);
  }
  return store;
}

function writeStore (store, source, transaction, moduleId) {
  const result = store.write(source, transaction);
  if (isPromise(result)) {
    throw new Error(`Derived propagation source store for ${moduleId} must be synchronous`);
  }
  if (store.read() !== source) {
    throw new Error(`Derived propagation source store diverged for ${moduleId}`);
  }
}

export class PreparedDerivedPropagationTransaction {
  constructor ({ id, modules }) {
    if (typeof id !== 'string' || !id) {
      throw new Error('Prepared derived propagation transactions require an id');
    }
    if (!Array.isArray(modules)) {
      throw new Error('Prepared derived propagation transactions require module plans');
    }
    const moduleIds = new Set();
    this.modules = Object.freeze(modules
      .filter(({ sourceBefore, sourceAfter }) => sourceBefore !== sourceAfter)
      .map(plan => {
        if (typeof plan?.moduleId !== 'string' || !plan.moduleId ||
            typeof plan.sourceBefore !== 'string' ||
            typeof plan.sourceAfter !== 'string') {
          throw new Error('Derived propagation module plans require source snapshots');
        }
        if (moduleIds.has(plan.moduleId)) {
          throw new Error(`Duplicate derived propagation module plan for ${plan.moduleId}`);
        }
        moduleIds.add(plan.moduleId);
        return Object.freeze({
          moduleId: plan.moduleId,
          sourceBefore: plan.sourceBefore,
          sourceAfter: plan.sourceAfter
        });
      }));
    this.id = id;
    Object.freeze(this);
  }
}

export class DerivedPropagationConflictError extends Error {
  constructor (message, transaction) {
    super(message);
    this.name = 'DerivedPropagationConflictError';
    this.transaction = transaction;
  }
}

export class DerivedPropagationRollbackError extends Error {
  constructor (message, cause, rollbackErrors, transaction) {
    super(message);
    this.name = 'DerivedPropagationRollbackError';
    this.cause = cause;
    this.rollbackErrors = Object.freeze(rollbackErrors.slice());
    this.transaction = transaction;
  }
}

function replayFor (plan, direction) {
  return direction === DerivedTransactionDirection.FORWARD
    ? { sourceBefore: plan.sourceBefore, sourceAfter: plan.sourceAfter }
    : { sourceBefore: plan.sourceAfter, sourceAfter: plan.sourceBefore };
}

export function validatePreparedDerivedPropagation (transaction, stores, direction) {
  if (!(transaction instanceof PreparedDerivedPropagationTransaction)) {
    throw new Error('Can only validate a PreparedDerivedPropagationTransaction');
  }
  if (!directions.has(direction)) {
    throw new Error(`Unknown derived propagation direction: ${direction}`);
  }
  for (const plan of transaction.modules) {
    const store = storeFor(stores, plan.moduleId);
    const replay = replayFor(plan, direction);
    if (store.read() !== replay.sourceBefore) {
      throw new DerivedPropagationConflictError(
        `Source changed while derived propagation ${transaction.id} was being planned for ${plan.moduleId}`,
        transaction
      );
    }
  }
  return transaction;
}

export function applyPreparedDerivedPropagation (transaction, {
  stores,
  direction = DerivedTransactionDirection.FORWARD
}) {
  validatePreparedDerivedPropagation(transaction, stores, direction);
  const attempted = [];
  try {
    for (const plan of transaction.modules) {
      const store = storeFor(stores, plan.moduleId);
      const replay = replayFor(plan, direction);
      attempted.push({ plan, store, replay });
      writeStore(store, replay.sourceAfter, transaction, plan.moduleId);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const { plan, store, replay } of attempted.reverse()) {
      try {
        writeStore(store, replay.sourceBefore, transaction, plan.moduleId);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new DerivedPropagationRollbackError(
        `Failed to apply derived propagation ${transaction.id} and roll it back completely`,
        error,
        rollbackErrors,
        transaction
      );
    }
    throw error;
  }
  return Object.freeze({ transaction, direction });
}

export class ProjectionalDerivedEditTransaction extends EditTransaction {
  constructor (transaction, stores, { label = 'derived component propagation' } = {}) {
    if (!(transaction instanceof PreparedDerivedPropagationTransaction)) {
      throw new Error('ProjectionalDerivedEditTransaction requires a prepared transaction');
    }
    super({
      kind: EditTransactionKind.COMPONENT_COMMAND,
      label,
      metadata: { derivedPropagationTransactionId: transaction.id }
    });
    this.transaction = transaction;
    this.stores = stores;
  }

  apply () {
    applyPreparedDerivedPropagation(this.transaction, {
      stores: this.stores,
      direction: DerivedTransactionDirection.FORWARD
    });
    return this;
  }

  reverseApply () {
    applyPreparedDerivedPropagation(this.transaction, {
      stores: this.stores,
      direction: DerivedTransactionDirection.REVERSE
    });
    return this;
  }
}

export class PreparedDerivedRuntimeRenameTransaction {
  constructor ({ id, renames }) {
    if (typeof id !== 'string' || !id) {
      throw new Error('Prepared derived runtime transactions require an id');
    }
    if (!Array.isArray(renames)) {
      throw new Error('Prepared derived runtime transactions require rename plans');
    }
    const ids = new Set();
    this.renames = Object.freeze(renames.map(rename => {
      if (typeof rename?.id !== 'string' || !rename.id ||
          typeof rename.beforeName !== 'string' || !rename.beforeName ||
          typeof rename.afterName !== 'string' || !rename.afterName) {
        throw new Error('Derived runtime rename plans require identity and name snapshots');
      }
      if (ids.has(rename.id)) {
        throw new Error(`Duplicate derived runtime rename plan for ${rename.id}`);
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

function runtimeStoreFor (stores, id) {
  const store = stores instanceof Map ? stores.get(id) : stores?.[id];
  if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
    throw new Error(`Derived propagation requires a runtime store for ${id}`);
  }
  return store;
}

function runtimeReplayFor (rename, direction) {
  return direction === DerivedTransactionDirection.FORWARD
    ? { nameBefore: rename.beforeName, nameAfter: rename.afterName }
    : { nameBefore: rename.afterName, nameAfter: rename.beforeName };
}

export function validatePreparedDerivedRuntimeRenames (transaction, stores, direction) {
  if (!(transaction instanceof PreparedDerivedRuntimeRenameTransaction)) {
    throw new Error('Can only validate a PreparedDerivedRuntimeRenameTransaction');
  }
  if (!directions.has(direction)) {
    throw new Error(`Unknown derived runtime direction: ${direction}`);
  }
  for (const rename of transaction.renames) {
    const store = runtimeStoreFor(stores, rename.id);
    const replay = runtimeReplayFor(rename, direction);
    if (store.read() !== replay.nameBefore) {
      throw new DerivedPropagationConflictError(
        `Runtime changed while derived propagation ${transaction.id} was being planned for ${rename.id}`,
        transaction
      );
    }
  }
  return transaction;
}

export function applyPreparedDerivedRuntimeRenames (transaction, {
  stores,
  direction = DerivedTransactionDirection.FORWARD
}) {
  validatePreparedDerivedRuntimeRenames(transaction, stores, direction);
  const attempted = [];
  try {
    for (const rename of transaction.renames) {
      const store = runtimeStoreFor(stores, rename.id);
      const replay = runtimeReplayFor(rename, direction);
      attempted.push({ rename, store, replay });
      const result = store.write(replay.nameAfter, transaction);
      if (isPromise(result)) {
        throw new Error(`Derived runtime store for ${rename.id} must be synchronous`);
      }
      if (store.read() !== replay.nameAfter) {
        throw new Error(`Derived runtime store diverged for ${rename.id}`);
      }
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const { rename, store, replay } of attempted.reverse()) {
      try {
        store.write(replay.nameBefore, transaction);
        if (store.read() !== replay.nameBefore) {
          throw new Error(`Derived runtime rollback diverged for ${rename.id}`);
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new DerivedPropagationRollbackError(
        `Failed to apply derived runtime propagation ${transaction.id} and roll it back completely`,
        error,
        rollbackErrors,
        transaction
      );
    }
    throw error;
  }
  return Object.freeze({ transaction, direction });
}

export class ProjectionalDerivedRuntimeEditTransaction extends EditTransaction {
  constructor (transaction, stores, { label = 'derived runtime propagation' } = {}) {
    if (!(transaction instanceof PreparedDerivedRuntimeRenameTransaction)) {
      throw new Error('ProjectionalDerivedRuntimeEditTransaction requires a prepared transaction');
    }
    super({
      kind: EditTransactionKind.COMPONENT_COMMAND,
      label,
      metadata: { derivedRuntimeTransactionId: transaction.id }
    });
    this.transaction = transaction;
    this.stores = stores;
  }

  apply () {
    applyPreparedDerivedRuntimeRenames(this.transaction, {
      stores: this.stores,
      direction: DerivedTransactionDirection.FORWARD
    });
    return this;
  }

  reverseApply () {
    applyPreparedDerivedRuntimeRenames(this.transaction, {
      stores: this.stores,
      direction: DerivedTransactionDirection.REVERSE
    });
    return this;
  }
}

export class PreparedDerivedRuntimeChangeTransaction {
  constructor ({ id, changeSet, inverseChangeSet }) {
    if (typeof id !== 'string' || !id) {
      throw new Error('Prepared derived runtime change transactions require an id');
    }
    if (!(changeSet instanceof MorphicChangeSet) ||
        !(inverseChangeSet instanceof MorphicChangeSet)) {
      throw new Error('Prepared derived runtime changes require exact morphic change sets');
    }
    this.id = id;
    this.changeSet = changeSet;
    this.inverseChangeSet = inverseChangeSet;
    Object.freeze(this);
  }
}

function runtimeChangeSetFor (transaction, direction) {
  return direction === DerivedTransactionDirection.FORWARD
    ? transaction.changeSet
    : transaction.inverseChangeSet;
}

export function validatePreparedDerivedRuntimeChanges (transaction, runtimeContext, direction) {
  if (!(transaction instanceof PreparedDerivedRuntimeChangeTransaction)) {
    throw new Error('Can only validate a PreparedDerivedRuntimeChangeTransaction');
  }
  if (!directions.has(direction)) {
    throw new Error(`Unknown derived runtime change direction: ${direction}`);
  }
  runtimeChangeSetFor(transaction, direction).validate(runtimeContext);
  return transaction;
}

export function applyPreparedDerivedRuntimeChanges (transaction, {
  runtimeContext,
  direction = DerivedTransactionDirection.FORWARD
}) {
  validatePreparedDerivedRuntimeChanges(transaction, runtimeContext, direction);
  runtimeChangeSetFor(transaction, direction).apply(runtimeContext);
  return Object.freeze({ transaction, direction });
}

export class ProjectionalDerivedRuntimeChangeEditTransaction extends EditTransaction {
  constructor (transaction, runtimeContext, {
    label = 'derived structural runtime propagation'
  } = {}) {
    if (!(transaction instanceof PreparedDerivedRuntimeChangeTransaction)) {
      throw new Error(
        'ProjectionalDerivedRuntimeChangeEditTransaction requires a prepared transaction'
      );
    }
    super({
      kind: EditTransactionKind.COMPONENT_COMMAND,
      label,
      metadata: { derivedRuntimeChangeTransactionId: transaction.id }
    });
    this.transaction = transaction;
    this.runtimeContext = runtimeContext;
  }

  apply () {
    applyPreparedDerivedRuntimeChanges(this.transaction, {
      runtimeContext: this.runtimeContext,
      direction: DerivedTransactionDirection.FORWARD
    });
    return this;
  }

  reverseApply () {
    applyPreparedDerivedRuntimeChanges(this.transaction, {
      runtimeContext: this.runtimeContext,
      direction: DerivedTransactionDirection.REVERSE
    });
    return this;
  }
}
