/* global WeakRef */
import { obj, arr, fun } from 'lively.lang';
import { MorphicChangeSet, MorphicRollbackError } from './changes/change-set.js';
import { cloneSnapshotContainers, MorphicValueSemantics, SetMorphProperty } from './changes/operations.js';
import { MorphicReplayDirection } from './changes/replay.js';
import { textReplayFor } from './changes/text.js';
import { sameDerivations, copyDerivations } from './changes/derived.js';
import { GroupChange, MethodCallChange } from './changes.js';
import { MorphicHistoryOwnershipError } from './changes/errors.js';

const historyClaims = new WeakMap();
const pendingHistory = new WeakMap();
const publicationOrder = new WeakMap();
const historyClock = { next: 0 };
const commitLifetimes = new WeakMap();

/** A nested delivery may publish before its outer delivery first requests a token. */
function publishedAfter (published, token) {
  if (published?.manager === token.manager) {
    const context = token.context.deref(); const prior = published.context.deref();
    if (context && published.ancestors.some(reference => reference.deref() === context)) return true;
    if (prior && token.ancestors.some(reference => reference.deref() === prior)) return false;
  }
  return (published?.order ?? published ?? -1) > token.order;
}

/** Claims stay weak: a domain entry must not retain the legacy event snapshots. */
function claimsFor (entry) { return historyClaims.get(entry)?.map(reference => reference.deref()).filter(Boolean); }

/** Preserve both wrapper and leaf identities for membership checks. */
function identities (change) {
  return [change, ...(change.changes || []).flatMap(identities)];
}

/** Only plain batches can be split; a method wrapper owns its entire inverse. */
function replayLeaves (changes) {
  return changes.flatMap(change => Object.getPrototypeOf(change) === GroupChange.prototype
    ? replayLeaves(change.changes) : [change]);
}

/** Legacy joins remember identity boundaries, so later recording cannot move them. */
function chronologicalRecords (active) {
  if (active._historyOrder) return active._historyOrder;
  const changes = active.recorder.changes;
  const slots = active.joinedTransactions.map(entry => ({
    entry, index: changes.filter(change => active._joinPositions?.get(entry)?.has(change)).length
  }));
  return changes.flatMap((change, index) => [...slots.filter(slot => slot.index === index).map(slot => slot.entry), ...replayLeaves([change])])
    .concat(slots.filter(slot => slot.index === changes.length).map(slot => slot.entry));
}

/** Build the complete replacement before mutating either recorder or ownership. */
function replacementPlan (active, owned, replacement, { allowClaim = false, virtualBefore = null, pendingEntry = null } = {}) {
  const order = chronologicalRecords(active);
  const requested = new Set(owned.flatMap(identities));
  const selected = [];
  const found = new Set();
  order.forEach((record, index) => {
    if (record === pendingEntry) {
      owned.flatMap(identities).forEach(identity => found.add(identity));
      selected.push(index);
      return;
    }
    const covered = new Set(claimsFor(record) || identities(record));
    if (![...covered].some(identity => requested.has(identity))) return;
    const leaves = historyClaims.has(record) ? [...covered] : replayLeaves([record]).flatMap(leaf =>
      leaf instanceof MethodCallChange ? leaf.changes.flatMap(identities).filter(change => !change.changes?.length) : [leaf]);
    if (!leaves.every(identity => requested.has(identity)) || historyClaims.has(record) && !allowClaim) {
      throw new MorphicHistoryOwnershipError(historyClaims.has(record) ? 'partial-overlap' : 'partial-wrapper', { ownedIdentities: owned });
    }
    covered.forEach(identity => { if (requested.has(identity)) found.add(identity); });
    selected.push(index);
  });
  const missing = owned.filter(identity => !replayLeaves([identity]).length || !replayLeaves([identity]).every(part => found.has(part)));
  if (missing.length || !owned.length && !selected.length) {
    if (selected.length || !virtualBefore) throw new MorphicHistoryOwnershipError('missing', { ownedIdentities: owned, missingIdentities: missing });
    const index = order.findIndex(record => !virtualBefore.has(record));
    return { order: [...order.slice(0, index < 0 ? order.length : index), ...(replacement ? [replacement] : []), ...order.slice(index < 0 ? order.length : index)] };
  }
  const first = selected[0]; const last = arr.last(selected);
  const interleavedEntries = order.slice(first, last + 1).filter((record, index) => !selected.includes(first + index));
  if (interleavedEntries.length) throw new MorphicHistoryOwnershipError('noncontiguous', { ownedIdentities: owned, interleavedEntries });
  return { order: [...order.slice(0, first), ...(replacement ? [replacement] : []), ...order.slice(last + 1)] };
}

/** Install a preflighted timeline while keeping recorder and join APIs compatible. */
function installReplacement (active, plan) {
  active._historyOrder = plan.order;
  active.recorder.changes = plan.order.filter(record => !(record instanceof EditTransaction));
  active.joinedTransactions = plan.order.filter(record => record instanceof EditTransaction);
  delete active._lastJoinedChanges;
}

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
    this.textReplay = textReplayFor(changeSet.operations);
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
        this.changeSet.operations.length !== transaction.changeSet.operations.length ||
        !sameDerivations(this.changeSet, transaction.changeSet)) return false;
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
    const changeSet = new MorphicChangeSet({ ...this.changeSet, operations });
    copyDerivations(this.changeSet, changeSet);
    return new ChangeSetEditTransaction(changeSet, this.changeManager, {
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
      if (typeof filterFn === 'function' && !filterFn(change)) return false;
      this._historyOrder?.push(change);
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
      const merged = last.merge(transaction);
      this.joinedTransactions[this.joinedTransactions.length - 1] = merged;
      if (this._historyOrder) this._historyOrder[this._historyOrder.indexOf(last)] = merged;
      (this._joinPositions ||= new WeakMap()).set(merged, this._joinPositions.get(last));
    } else {
      this.joinedTransactions.push(transaction);
      this._historyOrder?.push(transaction);
      (this._joinPositions ||= new WeakMap()).set(transaction, new WeakSet(recorded));
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

  static _commitToken (manager, context) {
    return Object.freeze({ order: historyClock.next++, manager, context: new WeakRef(context),
      ancestors: Object.freeze(manager._activeCommitDeliveries.filter(ancestor => ancestor !== context).map(ancestor => new WeakRef(ancestor))) });
  }

  static _openLegacyCommit (manager, context) {
    const lifetime = { token: this._commitToken(manager, context), phase: 'pending', context, undoManager: manager.undoManager, pending: null };
    commitLifetimes.set(lifetime.token, lifetime);
    return lifetime;
  }

  static _closeLegacyCommit (lifetime) {
    lifetime.phase = 'published';
    lifetime.context = null;
    return lifetime.pending ? this._publishCommit(lifetime.token) : null;
  }

  /** Internal commit staging; the token never grants access to published history. */
  static _stageCommit (token, { legacyChanges, undoManager, entry = null, undoable = true }) {
    const active = undoManager?.undoInProgress;
    const pending = {
      phase: 'pending', legacyChanges, undoManager, entry, undoable, installed: null,
      before: active ? new WeakSet(chronologicalRecords(active)) : null, token
    };
    pendingHistory.set(token, pending);
    const lifetime = commitLifetimes.get(token);
    if (lifetime) lifetime.pending = pending;
    return pending;
  }

  static _publishCommit (token) {
    const pending = pendingHistory.get(token);
    if (!pending || pending.phase === 'cancelled') return null;
    pending.phase = 'published';
    const before = pending.before;
    pending.legacyChanges = [];
    pending.before = null;
    if (!pending.entry || !pending.undoManager) return null;
    const manager = pending.undoManager;
    pending.previous = arr.last(manager.undoInProgress?.joinedTransactions || []);
    pending.stored = pending.installed ? pending.entry : manager.addTransaction(pending.entry, { joinActive: true, group: false });
    const active = manager.undoInProgress;
    if (active && !pending.installed && pending.stored === pending.entry) {
      active._joinPositions.set(pending.stored, before || new WeakSet());
      const order = chronologicalRecords(active).filter(entry => entry !== pending.stored);
      const index = order.findIndex(entry => !before?.has(entry));
      order.splice(index < 0 ? order.length : index, 0, pending.stored);
      active._historyOrder = order;
    }
    if (!active && pending.stored) {
      publicationOrder.set(pending.stored, pending.token);
      const index = manager.undos.findIndex(entry => publishedAfter(publicationOrder.get(entry), pending.token));
      if (index > -1) { arr.remove(manager.undos, pending.stored); manager.undos.splice(index, 0, pending.stored); }
    }
    pending.installed = null;
    return pending.stored ? { undoManager: manager, entry: pending.stored } : null;
  }

  static _commitFor (token) {
    const pending = pendingHistory.get(token);
    if (pending) return pending;
    const lifetime = commitLifetimes.get(token);
    if (!lifetime || lifetime.phase !== 'pending') return lifetime;
    const context = lifetime.context;
    return this._stageCommit(token, { legacyChanges: context.legacyChanges, undoManager: lifetime.undoManager, undoable: context.committedChange?.meta?.undoable !== false });
  }

  static _cancelCommit (token, pending = pendingHistory.get(token)) {
    if (!pending) return;
    if (pending.phase === 'published' && pending.stored) {
      pending.undoManager._replaceHistoryEntry(pending.stored, pending.stored === pending.entry ? null : pending.previous);
    } else if (pending.installed) {
      const active = pending.undoManager.undoInProgress;
      if (active !== pending.installed) throw new MorphicHistoryOwnershipError('published');
      installReplacement(active, { order: chronologicalRecords(active).filter(entry => entry !== pending.entry) });
    }
    pending.phase = 'cancelled';
    pending.legacyChanges = [];
    pending.before = null;
    pending.installed = null;
    pending.entry?.dispose?.();
    pending.undoManager?.cancelEmptyGroup();
  }

  /** Replace a known receipt entry, including an entry inside a closed group. */
  _replaceHistoryEntry (owned, replacement, { preflight = false, allowMissing = false, skipClaims = [] } = {}) {
    let found = false;
    const ownedEntries = new Set(Array.isArray(owned) ? owned : [owned]);
    const replacements = new Map();
    const rewriteChange = change => {
      if (ownedEntries.has(change)) { found = true; return replacement; }
      if (!(change instanceof GroupChange) || !change.changes.length) return change;
      const children = change.changes.map(rewriteChange).filter(Boolean);
      if (children.every((child, index) => child === change.changes[index]) && children.length === change.changes.length) return change;
      if (Object.getPrototypeOf(change) !== GroupChange.prototype && children.length) throw new MorphicHistoryOwnershipError('partial-wrapper');
      return children.length ? Object.assign(Object.create(Object.getPrototypeOf(change)), change, { changes: children }) : null;
    };
    const rewrite = entry => {
      if (replacements.has(entry)) return replacements.get(entry);
      if (ownedEntries.has(entry)) { found = true; return replacement; }
      if (!skipClaims.includes(entry) && claimsFor(entry)?.some(identity => ownedEntries.has(identity))) throw new MorphicHistoryOwnershipError('partial-overlap');
      if (entry instanceof RecordedChangeTransaction && entry.recorded()) {
        const changes = entry.changes.map(rewriteChange).filter(Boolean);
        const rewritten = changes.every((change, index) => change === entry.changes[index]) && changes.length === entry.changes.length
          ? entry : changes.length ? Object.assign(Object.create(Object.getPrototypeOf(entry)), entry, { changes }) : null;
        replacements.set(entry, rewritten);
        return rewritten;
      }
      if (entry instanceof CompositeEditTransaction) {
        const children = entry.transactions.map(rewrite).filter(child => child && !(child instanceof RecordedChangeTransaction && child.recorded() && !child.changes.length));
        const rewritten = children.every((child, index) => child === entry.transactions[index]) && children.length === entry.transactions.length
          ? entry : children.length ? new CompositeEditTransaction(children, entry) : null;
        replacements.set(entry, rewritten);
        return rewritten;
      }
      return entry;
    };
    const undos = this.undos.map(rewrite).filter(Boolean);
    const redos = this.redos.map(rewrite).filter(Boolean);
    const current = this.grouping.current.map(rewrite).filter(Boolean);
    const active = this.undoInProgress;
    const joined = active?.joinedTransactions.map(rewrite).filter(Boolean);
    const recorded = active?.recorder.changes.map(rewriteChange).filter(Boolean);
    const order = active?._historyOrder?.map(entry => entry instanceof EditTransaction ? rewrite(entry) : rewriteChange(entry)).filter(Boolean);
    if (!found && !allowMissing) throw new MorphicHistoryOwnershipError('stale-receipt');
    if (preflight) return;
    this.undos = undos; this.redos = redos; this.grouping.current = current;
    if (active) {
      active.joinedTransactions = joined;
      active.recorder.changes = recorded;
      if (order) active._historyOrder = order;
      delete active._lastJoinedChanges;
    }
  }

  /** Own one contiguous run; failed membership/overlap checks never discard work. */
  replaceRecordedChanges (legacyChanges, transaction, { commitToken = null } = {}) {
    if (!(transaction instanceof EditTransaction) || !Array.isArray(legacyChanges) ||
        legacyChanges.some(change => !change || typeof change !== 'object')) {
      throw new MorphicHistoryOwnershipError('invalid-replacement', { ownedIdentities: legacyChanges || [] });
    }
    if (new Set(legacyChanges).size !== legacyChanges.length) throw new MorphicHistoryOwnershipError('duplicate', { ownedIdentities: legacyChanges });
    if (this.applyCount) throw new MorphicHistoryOwnershipError('replay');
    const pending = commitToken && UndoManager._commitFor(commitToken);
    if (commitToken && pending?.phase !== 'pending') throw new MorphicHistoryOwnershipError(pending ? 'published' : 'unknown-commit');
    if (pending?.undoable === false) throw new MorphicHistoryOwnershipError('non-undoable');
    if (!legacyChanges.length && !pending?.entry) throw new MorphicHistoryOwnershipError('missing');
    const owned = legacyChanges.flatMap(identities);
    if (pending && (owned.some(change => !pending.legacyChanges.flatMap(identities).includes(change)) ||
        pending.entry && pending.legacyChanges.flatMap(identities).some(change => !owned.includes(change)))) {
      throw new MorphicHistoryOwnershipError('partial-overlap', { ownedIdentities: legacyChanges });
    }
    const source = pending?.undoManager;
    const sourceActive = source?.undoInProgress;
    const active = this.undoInProgress;
    if (!active && !pending) throw new MorphicHistoryOwnershipError('missing', { ownedIdentities: legacyChanges, missingIdentities: legacyChanges });
    const sourcePlan = source !== this && sourceActive
      ? replacementPlan(sourceActive, legacyChanges, null, { allowClaim: true, virtualBefore: pending.before || new WeakSet(),
          pendingEntry: pending.installed === sourceActive ? pending.entry : null }) : null;
    const destinationPlan = active ? replacementPlan(active, legacyChanges, transaction, {
      allowClaim: !!pending, virtualBefore: pending && (source === this || !chronologicalRecords(active).length) ? pending.before || new WeakSet() : null,
      pendingEntry: pending?.installed === active ? pending.entry : null
    }) : null;
    const prior = pending?.entry;
    if (prior?.textReplay && !transaction.textReplay) transaction.textReplay = prior.textReplay;
    historyClaims.set(transaction, owned.map(change => new WeakRef(change)));
    if (sourcePlan) installReplacement(sourceActive, sourcePlan);
    if (destinationPlan) installReplacement(active, destinationPlan);
    if (pending) {
      pending.entry = transaction; pending.undoManager = this; pending.installed = active;
      if (prior && prior !== transaction) prior.dispose?.();
      if (source !== this) source?.cancelEmptyGroup();
    }
    return transaction;
  }

  cancelEmptyGroup () {
    const active = this.undoInProgress;
    if (!active || active.joinedTransactions.length || replayLeaves(active.recorder.changes).length) return false;
    active.stopRecording();
    this.undoInProgress = null;
    return true;
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
    if (undo._historyOrder) {
      const entries = [];
      let recorded = undo;
      recorded.changes = [];
      for (const change of undo._historyOrder) {
        if (change instanceof EditTransaction) {
          if (recorded) { entries.push(recorded); recorded = null; }
          entries.push(change);
        } else {
          if (!recorded) {
            recorded = new RecordedChangeTransaction(undo.label, [], undo.no);
            recorded.changes = [];
            recorded.timestamp = undo.timestamp;
          }
          recorded.changes.push(change);
        }
      }
      if (recorded) entries.push(recorded);
      delete undo._historyOrder;
      undo.joinedTransactions = [];
      return this.addTransaction(entries.length === 1 ? entries[0] : new CompositeEditTransaction(entries, undo));
    }
    const transaction = undo.joinedTransactions.length
      ? new CompositeEditTransaction([undo, ...undo.joinedTransactions], {
          label: undo.label,
          no: undo.no,
          timestamp: undo.timestamp
        })
      : undo;
    undo.joinedTransactions = [];
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
    publicationOrder.set(transaction, historyClock.next++);
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
    if (this.undoInProgress._historyOrder) this.undoInProgress._historyOrder = this.undoInProgress._historyOrder.filter(change => !discarded.has(change));
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
        if (active._historyOrder) active._historyOrder = active._historyOrder.map(entry => entry instanceof EditTransaction ? prune(entry) : entry).filter(Boolean);
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
