import {
  MorphicChangeSet,
  MorphicValueSemantics
} from 'lively.morphic/changes/index.js';
import { EditTransaction, EditTransactionKind } from 'lively.morphic/undo.js';
import { ComponentDocument } from './component-document.js';
import { reduceComponent } from './reducer.js';
import { projectComponentRuntime } from './runtime-projector.js';
import { projectComponentSource } from './source-projector.js';

export const ComponentTransactionPlanningDiagnosticKind = Object.freeze({
  REDUCTION_FAILED: 'reduction-failed',
  SOURCE_PROJECTION_FAILED: 'source-projection-failed',
  RUNTIME_PROJECTION_FAILED: 'runtime-projection-failed'
});

export const ComponentTransactionState = Object.freeze({
  COMMITTED: 'committed'
});

export const ComponentRuntimeCommitMode = Object.freeze({
  APPLY: 'apply',
  ADOPT_ALREADY_APPLIED: 'adopt-already-applied'
});

export const ComponentTransactionDirection = Object.freeze({
  FORWARD: 'forward',
  REVERSE: 'reverse'
});

const runtimeCommitModes = new Set(Object.values(ComponentRuntimeCommitMode));
const transactionDirections = new Set(Object.values(ComponentTransactionDirection));

function diagnostic (kind, message, details = {}) {
  return Object.freeze({ kind, message, ...details });
}

function planningFailure (diagnostics) {
  return Object.freeze({
    supported: false,
    transaction: null,
    diagnostics: Object.freeze(diagnostics)
  });
}

function isPromise (value) {
  return value && typeof value.then === 'function';
}

function assertStore (store, label) {
  if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
    throw new Error(`Component transactions require a ${label} store`);
  }
}

function writeStore (store, value, transaction, label) {
  const result = store.write(value, transaction);
  if (isPromise(result)) {
    throw new Error(`Component transaction ${label} stores must be synchronous`);
  }
  if (store.read() !== value) {
    throw new Error(`Component transaction ${label} store diverged from the planned value`);
  }
}

export class PreparedComponentTransaction {
  constructor ({
    id,
    sourceBefore,
    sourceAfter,
    beforeDocument,
    document,
    command,
    inverseCommand,
    reduction,
    sourceProjection,
    runtimeProjection,
    steps = null
  }) {
    if (typeof id !== 'string' || !id) {
      throw new Error('Prepared component transactions require an id');
    }
    if (typeof sourceBefore !== 'string' || typeof sourceAfter !== 'string') {
      throw new Error('Prepared component transactions require source snapshots');
    }
    if (!(beforeDocument instanceof ComponentDocument) ||
        !(document instanceof ComponentDocument)) {
      throw new Error('Prepared component transactions require document snapshots');
    }
    const normalizedSteps = steps || [{
      componentCommand: command,
      reduction,
      sourceProjection,
      runtimeProjection
    }];
    if (!Array.isArray(normalizedSteps) || !normalizedSteps.length) {
      throw new Error('Prepared component transactions require at least one command step');
    }
    let expectedSource = sourceBefore;
    for (const step of normalizedSteps) {
      if (!step.componentCommand || !step.reduction?.inverseCommand) {
        throw new Error('Prepared component transaction steps require exact inverse commands');
      }
      if (step.sourceProjection?.supported !== true ||
          step.sourceProjection.sourceBefore !== expectedSource ||
          !(step.sourceProjection.projectedDocument instanceof ComponentDocument)) {
        throw new Error('Prepared component transaction steps must form a continuous source plan');
      }
      if (step.runtimeProjection?.supported !== true ||
          !(step.runtimeProjection.changeSet instanceof MorphicChangeSet) ||
          !(step.runtimeProjection.inverseChangeSet instanceof MorphicChangeSet)) {
        throw new Error('Prepared component transaction steps require reversible runtime projections');
      }
      expectedSource = step.sourceProjection.sourceAfter;
    }
    if (expectedSource !== sourceAfter ||
        normalizedSteps[normalizedSteps.length - 1]
          .sourceProjection.projectedDocument !== document) {
      throw new Error('Prepared component transaction steps do not reach the planned result');
    }
    if (sourceProjection?.supported !== true ||
        sourceProjection.sourceBefore !== sourceBefore ||
        sourceProjection.sourceAfter !== sourceAfter ||
        sourceProjection.projectedDocument !== document) {
      throw new Error('Prepared component transactions require a complete source projection');
    }
    if (runtimeProjection?.supported !== true) {
      throw new Error('Prepared component transactions require a supported runtime projection');
    }
    if (!(runtimeProjection?.changeSet instanceof MorphicChangeSet) ||
        !(runtimeProjection?.inverseChangeSet instanceof MorphicChangeSet)) {
      throw new Error('Prepared component transactions require reversible runtime projections');
    }
    this.id = id;
    this.sourceBefore = sourceBefore;
    this.sourceAfter = sourceAfter;
    this.beforeDocument = beforeDocument;
    this.document = document;
    this.steps = Object.freeze(normalizedSteps.slice());
    this.commands = Object.freeze(normalizedSteps.map(step => step.componentCommand));
    this.inverseCommands = Object.freeze(normalizedSteps.slice().reverse()
      .map(step => step.reduction.inverseCommand));
    this.command = this.commands.length === 1 ? this.commands[0] : null;
    this.inverseCommand = this.inverseCommands.length === 1 ? this.inverseCommands[0] : null;
    this.reduction = this.steps.length === 1 ? this.steps[0].reduction : null;
    this.sourceProjection = sourceProjection;
    this.runtimeProjection = runtimeProjection;
    this.runtimeChangeSet = runtimeProjection.changeSet;
    this.inverseRuntimeChangeSet = runtimeProjection.inverseChangeSet;
    Object.freeze(this);
  }
}

export class ComponentTransactionConflictError extends Error {
  constructor (message, transaction) {
    super(message);
    this.name = 'ComponentTransactionConflictError';
    this.transaction = transaction;
  }
}

export class ComponentTransactionRollbackError extends Error {
  constructor (message, cause, rollbackErrors, transaction) {
    super(message);
    this.name = 'ComponentTransactionRollbackError';
    this.cause = cause;
    this.rollbackErrors = Object.freeze(rollbackErrors.slice());
    this.transaction = transaction;
  }
}

export function preparedComponentTransactionFromScalarShadowProjection ({
  id,
  shadowProjection
}) {
  if (!shadowProjection?.supported || shadowProjection.steps?.length !== 1) {
    throw new Error('Projectional cutover requires one supported shadow projection step');
  }
  const [step] = shadowProjection.steps;
  return new PreparedComponentTransaction({
    id,
    sourceBefore: shadowProjection.sourceBefore,
    sourceAfter: shadowProjection.sourceAfter,
    beforeDocument: shadowProjection.beforeDocument,
    document: shadowProjection.document,
    command: step.componentCommand,
    inverseCommand: step.reduction.inverseCommand,
    reduction: step.reduction,
    sourceProjection: step.sourceProjection,
    runtimeProjection: step.runtimeProjection
  });
}

export function preparedComponentTransactionFromShadowProjection ({ id, shadowProjection }) {
  if (!shadowProjection?.supported || !shadowProjection.steps?.length) {
    throw new Error('Projectional cutover requires a supported shadow projection');
  }
  if (shadowProjection.steps.length === 1) {
    return preparedComponentTransactionFromScalarShadowProjection({ id, shadowProjection });
  }
  return new PreparedComponentTransaction({
    id,
    sourceBefore: shadowProjection.sourceBefore,
    sourceAfter: shadowProjection.sourceAfter,
    beforeDocument: shadowProjection.beforeDocument,
    document: shadowProjection.document,
    sourceProjection: Object.freeze({
      supported: true,
      sourceBefore: shadowProjection.sourceBefore,
      sourceAfter: shadowProjection.sourceAfter,
      projectedDocument: shadowProjection.document
    }),
    runtimeProjection: Object.freeze({
      supported: true,
      changeSet: shadowProjection.runtimeChangeSet,
      inverseChangeSet: shadowProjection.inverseRuntimeChangeSet
    }),
    steps: shadowProjection.steps
  });
}

export function prepareScalarComponentTransaction ({
  id,
  source,
  document,
  command,
  resolveRuntimeTargetId,
  resolveRuntimeValue,
  resolveRuntimeLayout
}) {
  if (typeof id !== 'string' || !id) {
    throw new Error('Component transaction planning requires an id');
  }
  if (typeof source !== 'string') {
    throw new Error('Component transaction planning requires source text');
  }
  if (!(document instanceof ComponentDocument)) {
    throw new Error('Component transaction planning requires a ComponentDocument');
  }

  let reduction;
  try {
    reduction = reduceComponent(document, command);
  } catch (error) {
    return planningFailure([diagnostic(
      ComponentTransactionPlanningDiagnosticKind.REDUCTION_FAILED,
      error.message,
      { error, command }
    )]);
  }

  const sourceProjection = projectComponentSource({
    source,
    beforeDocument: document,
    reduction
  });
  if (!sourceProjection.supported) {
    return planningFailure([diagnostic(
      ComponentTransactionPlanningDiagnosticKind.SOURCE_PROJECTION_FAILED,
      'The component command could not be projected into source',
      { sourceDiagnostics: sourceProjection.diagnostics, command }
    )]);
  }

  const runtimeProjection = projectComponentRuntime({
    beforeDocument: document,
    reduction,
    changeSetId: `${id}:runtime`,
    resolveRuntimeTargetId,
    resolveRuntimeValue,
    resolveRuntimeLayout
  });
  if (!runtimeProjection.supported) {
    return planningFailure([diagnostic(
      ComponentTransactionPlanningDiagnosticKind.RUNTIME_PROJECTION_FAILED,
      'The component command could not be projected into runtime operations',
      { runtimeDiagnostics: runtimeProjection.diagnostics, command }
    )]);
  }

  return Object.freeze({
    supported: true,
    transaction: new PreparedComponentTransaction({
      id,
      sourceBefore: source,
      sourceAfter: sourceProjection.sourceAfter,
      beforeDocument: document,
      document: sourceProjection.projectedDocument,
      command,
      inverseCommand: reduction.inverseCommand,
      reduction,
      sourceProjection,
      runtimeProjection
    }),
    diagnostics: Object.freeze([])
  });
}

function transactionReplay (transaction, direction) {
  const forward = direction === ComponentTransactionDirection.FORWARD;
  return Object.freeze({
    sourceBefore: forward ? transaction.sourceBefore : transaction.sourceAfter,
    sourceAfter: forward ? transaction.sourceAfter : transaction.sourceBefore,
    documentBefore: forward ? transaction.beforeDocument : transaction.document,
    documentAfter: forward ? transaction.document : transaction.beforeDocument,
    runtimeChangeSet: forward
      ? transaction.runtimeChangeSet
      : transaction.inverseRuntimeChangeSet,
    inverseRuntimeChangeSet: forward
      ? transaction.inverseRuntimeChangeSet
      : transaction.runtimeChangeSet
  });
}

function supplementalAdoptionChangeSet (changeSet, transactionId) {
  const operations = changeSet.operations.filter(operation =>
    operation.metadata.applyWhenAdopting === true);
  return operations.length
    ? new MorphicChangeSet({
        id: `${transactionId}:adoption-supplement`,
        label: 'apply supplemental adopted runtime changes',
        origin: 'runtime-projection',
        undoable: false,
        operations,
        metadata: { supplementalFor: transactionId }
      })
    : null;
}

function supplementalRuntimeStateIsCurrent (changeSet, runtimeContext) {
  return changeSet.operations.every(operation => {
    const target = runtimeContext.resolveMorph?.(operation.targetId);
    if (!target || !Object.prototype.hasOwnProperty.call(operation, 'property')) {
      return false;
    }
    const current = runtimeContext.readMorphProperty
      ? runtimeContext.readMorphProperty(target, operation.property)
      : target[operation.property];
    return operation.valueSemantics === MorphicValueSemantics.SNAPSHOT
      ? operation.snapshotValuesEqual(operation.snapshotValue(current), operation.after)
      : Object.is(current, operation.after);
  });
}

export function applyPreparedComponentTransaction (transaction, {
  sourceStore,
  documentStore,
  runtimeContext,
  runtimeCommitMode = ComponentRuntimeCommitMode.APPLY,
  direction = ComponentTransactionDirection.FORWARD
}) {
  if (!(transaction instanceof PreparedComponentTransaction)) {
    throw new Error('Can only commit a PreparedComponentTransaction');
  }
  assertStore(sourceStore, 'source');
  assertStore(documentStore, 'document');
  if (!runtimeCommitModes.has(runtimeCommitMode)) {
    throw new Error(`Unknown component runtime commit mode: ${runtimeCommitMode}`);
  }
  if (!transactionDirections.has(direction)) {
    throw new Error(`Unknown component transaction direction: ${direction}`);
  }
  if (runtimeCommitMode === ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED &&
      direction !== ComponentTransactionDirection.FORWARD) {
    throw new Error('Already-applied runtime changes can only be adopted forward');
  }
  const replay = transactionReplay(transaction, direction);
  if (sourceStore.read() !== replay.sourceBefore) {
    throw new ComponentTransactionConflictError(
      `Source changed while component transaction ${transaction.id} was being planned`,
      transaction
    );
  }
  if (documentStore.read() !== replay.documentBefore) {
    throw new ComponentTransactionConflictError(
      `Component document changed while transaction ${transaction.id} was being planned`,
      transaction
    );
  }

  // Runtime validation belongs to planning/validation and must happen before
  // either authoritative representation is mutated. A direct mutation can
  // leave explicitly marked supplemental operations unapplied; install those
  // first, then validate that the complete runtime result can be adopted.
  const supplementalChangeSet = runtimeCommitMode ===
    ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED
    ? supplementalAdoptionChangeSet(replay.runtimeChangeSet, transaction.id)
    : null;
  const runtimeValidationSet = runtimeCommitMode === ComponentRuntimeCommitMode.APPLY
    ? replay.runtimeChangeSet
    : replay.inverseRuntimeChangeSet;
  try {
    supplementalChangeSet?.apply(runtimeContext);
    runtimeValidationSet.validate(runtimeContext);
  } catch (error) {
    if (supplementalChangeSet) {
      try {
        supplementalChangeSet.invert({
          id: `${supplementalChangeSet.id}:rollback`,
          origin: 'runtime-projection'
        }).apply(runtimeContext);
      } catch (rollbackError) {
        error.rollbackErrors = [...(error.rollbackErrors || []), rollbackError];
      }
    }
    throw error;
  }

  let sourceAttempted = false;
  let documentAttempted = false;
  try {
    sourceAttempted = true;
    writeStore(sourceStore, replay.sourceAfter, transaction, 'source');
    documentAttempted = true;
    writeStore(documentStore, replay.documentAfter, transaction, 'document');
    if (runtimeCommitMode === ComponentRuntimeCommitMode.APPLY) {
      replay.runtimeChangeSet.apply(runtimeContext);
    } else if (supplementalChangeSet &&
               !supplementalRuntimeStateIsCurrent(supplementalChangeSet, runtimeContext)) {
      // Installing new source can synchronously refresh a live component from
      // its policy cache. Reassert supplemental layout/name projections after
      // that refresh so adoption ends in the state that was preflighted.
      supplementalChangeSet.apply({
        ...runtimeContext,
        checkPreconditions: false
      });
    }
  } catch (error) {
    const rollbackErrors = error.rollbackErrors?.slice() || [];
    if (documentAttempted) {
      try {
        writeStore(documentStore, replay.documentBefore, transaction, 'document');
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (sourceAttempted) {
      try {
        writeStore(sourceStore, replay.sourceBefore, transaction, 'source');
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (runtimeCommitMode === ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED) {
      try {
        replay.inverseRuntimeChangeSet.apply(runtimeContext);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new ComponentTransactionRollbackError(
        `Failed to commit component transaction ${transaction.id} and roll it back completely`,
        error,
        rollbackErrors,
        transaction
      );
    }
    throw error;
  }

  return Object.freeze({
    state: ComponentTransactionState.COMMITTED,
    transaction,
    runtimeCommitMode,
    direction
  });
}

export function commitPreparedComponentTransaction (transaction, adapters) {
  return applyPreparedComponentTransaction(transaction, {
    ...adapters,
    direction: ComponentTransactionDirection.FORWARD
  });
}

export class ProjectionalComponentEditTransaction extends EditTransaction {
  constructor (transaction, adapters, {
    label = transaction?.commands?.length > 1
      ? 'component command batch'
      : `component ${transaction?.command?.kind || 'command'}`,
    afterReplay = null
  } = {}) {
    if (!(transaction instanceof PreparedComponentTransaction)) {
      throw new Error('ProjectionalComponentEditTransaction requires a prepared transaction');
    }
    assertStore(adapters?.sourceStore, 'source');
    assertStore(adapters?.documentStore, 'document');
    if (afterReplay !== null && typeof afterReplay !== 'function') {
      throw new Error('Projectional component replay notifications must be functions');
    }
    super({
      kind: EditTransactionKind.COMPONENT_COMMAND,
      label,
      metadata: { componentTransactionId: transaction.id }
    });
    this.transaction = transaction;
    this.adapters = adapters;
    this.afterReplay = afterReplay;
    this.lastReplayNotificationError = null;
  }

  replay (direction) {
    const result = applyPreparedComponentTransaction(this.transaction, {
      ...this.adapters,
      runtimeCommitMode: ComponentRuntimeCommitMode.APPLY,
      direction
    });
    if (this.afterReplay) {
      try {
        this.afterReplay(result);
        this.lastReplayNotificationError = null;
      } catch (error) {
        // Notifications are not authoritative transaction state. Preserve a
        // diagnostic without corrupting the undo journal after a valid replay.
        this.lastReplayNotificationError = error;
      }
    }
    return this;
  }

  apply () {
    return this.replay(ComponentTransactionDirection.FORWARD);
  }

  reverseApply () {
    return this.replay(ComponentTransactionDirection.REVERSE);
  }
}
