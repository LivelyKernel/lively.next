import { obj, arr, fun } from 'lively.lang';
import { MorphicChangeSet, MorphicRollbackError } from './changes/change-set.js';
import { cloneSnapshotContainers, MorphicValueSemantics, SetMorphProperty } from './changes/operations.js';
import { MorphicReplayDirection } from './changes/replay.js';

export const EditTransactionKind = Object.freeze({
  RECORDED_MORPH_CHANGES: 'recorded-morph-changes',
  MORPHIC_CHANGE_SET: 'morphic-change-set',
  COMPOSITE: 'composite',
  COMPONENT_COMMAND: 'component-command',
  TEXT: 'text'
});

const transactionKinds = new Set(Object.values(EditTransactionKind));

export class EditTransaction {
  constructor ({ kind, label, no = 0, timestamp = null, metadata = {} }) {
    if (!transactionKinds.has(kind)) throw new Error(`Unknown edit transaction kind: ${kind}`);
    if (typeof label !== 'string') throw new Error('Edit transactions require a label');
    this.kind = kind;
    this.label = label;
    this.name = label;
    this.no = no;
    this.timestamp = timestamp;
    this.metadata = Object.freeze({ ...metadata });
  }

  apply () { throw new Error(`${this.constructor.name}.apply is not implemented`); }
  reverseApply () { throw new Error(`${this.constructor.name}.reverseApply is not implemented`); }
  canMergeWith () { return false; }
  merge () { throw new Error(`${this.constructor.name} cannot merge transactions`); }
}

export class EditTransactionRollbackError extends Error {
  constructor (message, cause, rollbackErrors) {
    super(message);
    this.name = 'EditTransactionRollbackError';
    this.cause = cause;
    this.rollbackErrors = rollbackErrors;
  }
}

function compensate (transactions, selector) {
  const rollbackErrors = [];
  transactions.slice().reverse().forEach(transaction => {
    try { transaction[selector](); } catch (error) { rollbackErrors.push({ operation: transaction, error }); }
  });
  return rollbackErrors;
}

/** Preserve incomplete runtime recovery through the legacy composite boundary. */
function compositeRollbackFailure (message, cause, failures) {
  if (!failures.length) return cause;
  if (!(cause instanceof MorphicRollbackError) && !failures.some(({ error }) => error instanceof MorphicRollbackError)) {
    return new EditTransactionRollbackError(message, cause, failures.map(({ error }) => error));
  }
  const rollbackErrors = cause instanceof MorphicRollbackError ? [...cause.rollbackErrors] : [];
  const unreversedOperations = cause instanceof MorphicRollbackError ? [...cause.unreversedOperations] : [];
  for (const failure of failures) {
    if (failure.error instanceof MorphicRollbackError) {
      rollbackErrors.push(...failure.error.rollbackErrors);
      unreversedOperations.push(...failure.error.unreversedOperations);
    } else {
      // An opaque legacy inverse can only identify its failed replay unit.
      rollbackErrors.push(failure);
      unreversedOperations.push(failure.operation);
    }
  }
  return new MorphicRollbackError(message, {
    cause: cause instanceof MorphicRollbackError ? cause.cause : cause,
    rollbackErrors,
    unreversedOperations
  });
}

export class CompositeEditTransaction extends EditTransaction {
  constructor (transactions, { label, no, timestamp, metadata = {} } = {}) {
    if (!transactions.length) throw new Error('Composite edit transactions cannot be empty');
    if (transactions.some(transaction => !(transaction instanceof EditTransaction))) {
      throw new Error('Composite entries must be EditTransaction instances');
    }
    super({
      kind: EditTransactionKind.COMPOSITE,
      label: label || transactions.map(transaction => transaction.label).join('-'),
      no: no ?? transactions[0].no,
      timestamp: timestamp ?? transactions[0].timestamp,
      metadata
    });
    this.transactions = Object.freeze(transactions.slice());
  }

  /** Merge only composites whose corresponding domains can all coalesce. */
  canMergeWith (transaction, interveningChanges = []) {
    return transaction instanceof CompositeEditTransaction &&
      this.transactions.length === transaction.transactions.length &&
      this.transactions.every((entry, index) =>
        entry.canMergeWith(transaction.transactions[index], interveningChanges));
  }

  /** Preserve domain replay order while releasing intermediate snapshots. */
  merge (transaction) {
    return new CompositeEditTransaction(this.transactions.map((entry, index) =>
      entry.merge(transaction.transactions[index])), this);
  }

  dispose () { this.transactions.forEach(entry => entry.dispose?.()); }

  apply () {
    const applied = [];
    try {
      this.transactions.forEach(transaction => {
        transaction.apply();
        applied.push(transaction);
      });
    } catch (error) {
      const rollbackErrors = compensate(applied, 'reverseApply');
      throw compositeRollbackFailure(
        `Failed to apply ${this.label} and to roll it back completely`,
        error, rollbackErrors
      );
    }
    return this;
  }

  reverseApply () {
    const reversed = [];
    try {
      this.transactions.slice().reverse().forEach(transaction => {
        transaction.reverseApply();
        reversed.push(transaction);
      });
    } catch (error) {
      const rollbackErrors = compensate(reversed, 'apply');
      throw compositeRollbackFailure(
        `Failed to reverse ${this.label} and to restore it completely`,
        error, rollbackErrors
      );
    }
    return this;
  }
}

export class ChangeSetEditTransaction extends EditTransaction {
  constructor (changeSet, changeManager, { context, label = changeSet?.label || '', metadata = {}, groupToken = null } = {}) {
    if (!(changeSet instanceof MorphicChangeSet) || !context || !changeManager?.applyChangeSet) {
      throw new Error('ChangeSetEditTransaction requires a change set, ChangeManager and context');
    }
    super({ kind: EditTransactionKind.MORPHIC_CHANGE_SET, label, metadata: { ...metadata, changeSetId: changeSet.id } });
    Object.assign(this, { changeSet, changeManager, context, groupToken });
    this.groupBarrier = groupToken?._joinBarrier || 0;
  }

  apply () {
    this.changeManager.applyChangeSet(this.changeSet, { context: this.context, direction: MorphicReplayDirection.REDO });
    return this;
  }

  reverseApply () {
    this.changeManager.applyChangeSet(this.changeSet, { context: this.context, direction: MorphicReplayDirection.UNDO });
    return this;
  }

  canMergeWith (transaction, interveningChanges = []) {
    if (!(transaction instanceof ChangeSetEditTransaction) || !this.groupToken ||
        this.groupToken !== transaction.groupToken || this.groupBarrier !== transaction.groupBarrier ||
        interveningChanges.length || this.changeManager !== transaction.changeManager ||
        this.changeSet.operations.length !== transaction.changeSet.operations.length) return false;
    return this.changeSet.operations.every((left, index) => {
      const right = transaction.changeSet.operations[index];
      return left instanceof SetMorphProperty && right instanceof SetMorphProperty &&
        left.targetId === right.targetId && left.property === right.property &&
        left.valueSemantics === right.valueSemantics && left.snapshotValue === right.snapshotValue &&
        left.materializeValue === right.materializeValue && left.snapshotValuesEqual === right.snapshotValuesEqual &&
        (left.valueSemantics === MorphicValueSemantics.SNAPSHOT
          ? left.snapshotValuesEqual(left.after, right.before) : Object.is(left.after, right.before));
    });
  }

  merge (transaction) {
    if (!this.canMergeWith(transaction)) throw new Error('Discontinuous scalar transactions cannot merge');
    const operations = this.changeSet.operations.map((operation, index) => new SetMorphProperty({
      ...operation,
      before: operation.valueSemantics === MorphicValueSemantics.SNAPSHOT
        ? operation.materializeValue(cloneSnapshotContainers(operation.before)) : operation.before,
      after: operation.valueSemantics === MorphicValueSemantics.SNAPSHOT
        ? operation.materializeValue(cloneSnapshotContainers(transaction.changeSet.operations[index].after))
        : transaction.changeSet.operations[index].after
    }));
    return new ChangeSetEditTransaction(new MorphicChangeSet({ ...this.changeSet, operations }), this.changeManager, {
      context: transaction.context, label: this.label, metadata: this.metadata, groupToken: this.groupToken
    });
  }

  dispose () { this.context.release?.(); }
}

export class RecordedChangeTransaction extends EditTransaction {
  constructor (name, targets = [], no = 0) {
    super({ kind: EditTransactionKind.RECORDED_MORPH_CHANGES, label: name, no });
    this.targets = targets;
    this.recorder = null;
    this.changes = null;
    this.joinedTransactions = [];
  }

  recorded () { return !!this.changes; }
  isRecording () { return !!this.recorder; }

  startRecording (filterFn) {
    if (this.recorded() || this.isRecording()) { throw new Error('Undo already recorded / recording'); }
    if (!this.targets.length) { throw new Error('Undo has no target morphs'); }

    this.timestamp = Date.now();
    const morph = this.targets[0];

    this.recorder = morph.recordChangesStart(change => {
      const { target, morph: structurallyChangedMorph, owners = [] } = change;
      const affectedMorphs = [target, structurallyChangedMorph, ...owners].filter(Boolean);
      if (affectedMorphs.some(affectedMorph => affectedMorph.isUsedAsEpiMorph())) return false;
      if (!this.targets.some(undoTarget =>
        undoTarget === target || undoTarget.isAncestorOf(target))) return false;
      if (typeof filterFn === 'function') return filterFn(change);
      return true;
    });

    return this;
  }

  stopRecording () {
    const { name, recorder: { id, changes }, targets: [morph] } = this;
    this.changes = morph.recordChangesStop(id);
    this.targets = null;
    this.recorder = null;
  }

  joinTransaction (transaction) {
    if (!(transaction instanceof EditTransaction)) {
      throw new Error('Can only join EditTransaction instances');
    }
    const last = arr.last(this.joinedTransactions);
    const recorded = this.recorder?.changes || [];
    const interveningChanges = recorded.filter(change => !this._lastJoinedChanges?.has(change));
    if (last && this._lastJoinedChanges && last.canMergeWith(transaction, interveningChanges)) {
      this.joinedTransactions[this.joinedTransactions.length - 1] = last.merge(transaction);
    } else {
      this.joinedTransactions.push(transaction);
    }
    this._lastJoinedChanges = new WeakSet(recorded);
    return arr.last(this.joinedTransactions);
  }

  apply () {
    if (!this.recorded()) { throw new Error('Cannot apply undo that has no changes recorded yet'); }
    this.changes.slice().forEach(change => change.apply());
    return this;
  }

  reverseApply () {
    if (!this.recorded()) { throw new Error('Cannot reverseApply undo that has no changes recorded yet'); }
    this.changes.slice().reverse().forEach(change => change.reverseApply());
    return this;
  }

  addTarget (t) { arr.pushIfNotIncluded(this.targets, t); }

  addUndos (undos) {
    undos = arr.sortBy(undos.concat(this).filter(ea => ea.recorded()), ({ no }) => no);
    if (!undos.length) return;
    this.changes = undos.flatMap(({ changes }) => changes);
    this.timestamp = undos[0].timestamp;
    this.no = undos[0].no;
    this.name = undos.map(({ name }) => name).join('-');
    this.label = this.name;
  }

  canMergeWith (transaction, interveningChanges = []) {
    return !interveningChanges.length && transaction instanceof RecordedChangeTransaction;
  }

  merge (transaction) {
    this.addUndos([transaction]);
    return this;
  }

  toString () {
    const { name, changes, no } = this;
    const isRecording = this.isRecording();
    const changesString = !changes.length
      ? 'no changes'
      : '\n  ' + changes.map(({ selector, args, prop, value, target }) =>
        selector
          ? `${target}.${selector}(${args.map(printArg)})`
          : `${target}.${prop} = ${printArg(value)}`).join('\n  ');
    return `RecordedChangeTransaction(${no}:${name} ${isRecording ? 'RECORDING ' : ''}${changesString})`;
  }
}

function printArg (x) {
  // short print
  return obj.inspect(x, { maxDepth: 1 }).replace(/\n/g, '').replace(/\s+/g, ' ');
}

export class UndoManager {
  constructor (optFilter) {
    this.reset();
    this.filter = optFilter;
  }

  reset () {
    for (const entry of new Set([...(this.undos || []), ...(this.redos || []), ...(this.undoInProgress?.joinedTransactions || [])])) entry.dispose?.();
    this.undos = [];
    this.redos = [];
    this.undoInProgress = null;
    this.applyCount = 0;
    this.counter = 0;
    this.grouping = {
      current: [],
      debounce: null,
      debouncedCanceled: false,
      debounceTime: 31
    };
  }

  group (prevUndo = null) {
    this.groupLaterCancel();

    // If prevUndo is given, merge prevUndo and all newer undos into a single undo group
    if (prevUndo && this.undos.includes(prevUndo)) {
      this.grouping.current = arr.uniq(this.undos.slice(this.undos.indexOf(prevUndo))
        .concat(this.grouping.current));
    }

    if (!this.grouping.current.length) return;

    const grouped = this.grouping.current.slice(1);
    const first = this.grouping.current[0];
    let undoGroup = first;
    for (const transaction of grouped) {
      undoGroup = undoGroup.canMergeWith(transaction)
        ? undoGroup.merge(transaction)
        : new CompositeEditTransaction(
          undoGroup instanceof CompositeEditTransaction
            ? undoGroup.transactions.concat(transaction)
            : [undoGroup, transaction]
        );
    }
    this.undos = arr.withoutAll(this.undos, grouped);
    if (undoGroup !== first) {
      const index = this.undos.indexOf(first);
      this.undos[index] = undoGroup;
    }
    this.grouping.current = [];
    return undoGroup;
  }

  ensureNewGroup (morph, name = 'new undo group') {
    // puts currently ongoing undos into a group then creates and returns a new group
    this.group();
    this.undoStart(morph, name);
    return this.undoStop();
  }

  groupLaterCancel () {
    const state = this.grouping;
    if (!state.debounce) return;
    state.debouncedCanceled = true;
    this.grouping = { ...state, debounce: null, debouncedCanceled: false };
  }

  groupLater (time) {
    const state = this.grouping;
    (state.debounce || (state.debounce = fun.debounce(time || state.debounceTime, () => {
      state.debounce = null;
      state.debouncedCanceled || this.group();
    })))();
  }

  undoStart (morph, name) {
    if (this.applyCount) return;
    if (this.undoInProgress) {
      if (this.undoInProgress.joinedTransactions.length) this.undoStop();
      else {
        console.warn(`There is already an undo being recorded. Tried to start undo ${name} for ${morph.name}, but ${this.undoInProgress.name} is currently in progress.`);
        return;
      }
    }
    return this.undoInProgress = new RecordedChangeTransaction(
      name,
      [morph],
      this.counter++
    ).startRecording(this.filter);
  }

  undoStop () {
    const undo = this.undoInProgress;
    if (!undo) return null;
    undo.stopRecording();
    this.undoInProgress = null;
    const transaction = undo.joinedTransactions.length
      ? new CompositeEditTransaction([undo, ...undo.joinedTransactions], {
          label: undo.label,
          no: undo.no,
          timestamp: undo.timestamp
        })
      : undo;
    return this.addTransaction(transaction);
  }

  addTransaction (transaction, { group = true, joinActive = false } = {}) {
    if (this.applyCount) return;
    if (!(transaction instanceof EditTransaction)) {
      throw new Error('UndoManager can only store EditTransaction instances');
    }
    if (joinActive && this.undoInProgress) {
      return this.undoInProgress.joinTransaction(transaction);
    }
    this.undos.push(transaction);
    if (group) this.grouping.current.push(transaction);
    if (this.redos.length) {
      this.redos.forEach(entry => entry.dispose?.());
      this.redos.length = 0;
    }
    return transaction;
  }

  discardRecordedChanges (changes) {
    const recorded = this.undoInProgress?.recorder?.changes;
    if (!recorded) return 0;
    const discarded = new Set(changes);
    const retained = recorded.filter(change => !discarded.has(change));
    const removed = recorded.length - retained.length;
    this.undoInProgress.recorder.changes = retained;
    return removed;
  }

  /** Remove expired domains from history, preserving other domains in the same group. */
  removeTransactions (predicate) {
    const replacements = new Map();
    const prune = transaction => {
      if (replacements.has(transaction)) return replacements.get(transaction);
      let retained = transaction;
      if (predicate(transaction)) { transaction.dispose?.(); retained = null; }
      else if (transaction instanceof CompositeEditTransaction) {
        let entries = transaction.transactions.map(prune).filter(Boolean);
        if (entries.some((entry, index) => entry !== transaction.transactions[index]) ||
            entries.length !== transaction.transactions.length) {
          entries = entries.filter(entry => !(entry instanceof RecordedChangeTransaction &&
            entry.recorded() && !entry.changes.length));
          retained = entries.length ? new CompositeEditTransaction(entries, transaction) : null;
        }
      }
      replacements.set(transaction, retained);
      return retained;
    };
    this.undos = this.undos.map(prune).filter(Boolean);
    this.redos = this.redos.map(prune).filter(Boolean);
    this.grouping.current = this.grouping.current.map(prune).filter(Boolean);
    const active = this.undoInProgress;
    if (active) {
      const retained = active.joinedTransactions.map(prune).filter(Boolean);
      if (retained.some((entry, index) => entry !== active.joinedTransactions[index]) ||
          retained.length !== active.joinedTransactions.length) {
        active.joinedTransactions = retained;
        delete active._lastJoinedChanges;
        if (!retained.length && !active.recorder.changes.length) {
          active.stopRecording();
          this.undoInProgress = null;
        }
      }
    }
  }


  removeLatestUndo () {
    this.undoStop();
    const undo = this.undos.pop();
    arr.remove(this.grouping.current, undo);
    return undo;
  }

  undo () {
    const undo = this.removeLatestUndo();
    if (!undo) return;
    arr.remove(this.grouping.current, undo);
    this.applyCount++;
    try {
      undo.reverseApply();
      this.redos.unshift(undo);
    } catch (error) { undo.dispose?.(); throw error; } finally {
      this.applyCount--;
    }
    return undo;
  }

  redo () {
    this.undoStop();
    const redo = this.redos.shift();
    if (!redo) return;
    this.applyCount++;
    try {
      redo.apply();
      this.undos.push(redo);
    } catch (error) { redo.dispose?.(); throw error; } finally {
      this.applyCount--;
    }
    return redo;
  }

  toString () {
    const undosPrinted = this.undos.length === 0
      ? ''
      : `\n  ${this.undos.length > 20 ? '...\n  ' : ''}${this.undos.slice(-20).join('\n  ')}`;
    const undoInProgress = !!this.undoInProgress;
    return `UndoManager(${this.undos.length} undos, ${this.redos.length} redos, ${undoInProgress ? ', UNDO IN PROGRESS' : ''}${undosPrinted})`;
  }
}
