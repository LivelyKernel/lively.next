import { obj, arr, fun } from 'lively.lang';
import { MorphicChangeSet } from './changes/change-set.js';
import { MorphicReplayDirection } from './changes/manager.js';

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
    try { transaction[selector](); } catch (error) { rollbackErrors.push(error); }
  });
  return rollbackErrors;
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

  apply () {
    const applied = [];
    try {
      this.transactions.forEach(transaction => {
        transaction.apply();
        applied.push(transaction);
      });
    } catch (error) {
      const rollbackErrors = compensate(applied, 'reverseApply');
      if (rollbackErrors.length) {
        throw new EditTransactionRollbackError(
          `Failed to apply ${this.label} and to roll it back completely`,
          error,
          rollbackErrors
        );
      }
      throw error;
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
      if (rollbackErrors.length) {
        throw new EditTransactionRollbackError(
          `Failed to reverse ${this.label} and to restore it completely`,
          error,
          rollbackErrors
        );
      }
      throw error;
    }
    return this;
  }
}

export class MorphicChangeSetTransaction extends EditTransaction {
  constructor (changeSet, manager, { label = changeSet?.label || '', no = 0 } = {}) {
    if (!(changeSet instanceof MorphicChangeSet)) {
      throw new Error('MorphicChangeSetTransaction requires a MorphicChangeSet');
    }
    if (!manager || typeof manager.replay !== 'function') {
      throw new Error('MorphicChangeSetTransaction requires a transaction manager');
    }
    super({
      kind: EditTransactionKind.MORPHIC_CHANGE_SET,
      label,
      no,
      metadata: { changeSetId: changeSet.id }
    });
    this.changeSet = changeSet;
    this.manager = manager;
  }

  apply () {
    this.manager.replay(this.changeSet, MorphicReplayDirection.REDO);
    return this;
  }

  reverseApply () {
    this.manager.replay(this.changeSet, MorphicReplayDirection.UNDO);
    return this;
  }
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
    this.joinedTransactions.push(transaction);
    return transaction;
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

  canMergeWith (transaction) {
    return transaction instanceof RecordedChangeTransaction;
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
      console.warn(`There is already an undo being recorded. Tried to start undo ${name} for ${morph.name}, but ${this.undoInProgress.name} is currently in progress.`);
      return;
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
    if (!(transaction instanceof EditTransaction)) {
      throw new Error('UndoManager can only store EditTransaction instances');
    }
    if (joinActive && this.undoInProgress) {
      return this.undoInProgress.joinTransaction(transaction);
    }
    this.undos.push(transaction);
    if (group) this.grouping.current.push(transaction);
    if (this.redos.length) this.redos.length = 0;
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
    } catch (error) {
      this.undos.push(undo);
      throw error;
    } finally {
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
    } catch (error) {
      this.redos.unshift(redo);
      throw error;
    } finally {
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
