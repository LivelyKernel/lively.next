/* eslint-disable no-console */
/* global WeakMap, WeakRef */
import { arr, obj } from 'lively.lang';
import { signal } from 'lively.bindings';
import { MorphicChangeSet, MorphicRollbackError } from './changes/change-set.js';
import { MorphicReplayDirection } from './changes/replay.js';
import {
  MorphicAttachmentKind,
  MorphicValueSemantics,
  MoveMorph,
  ReplaceText,
  SetMorphProperty,
  attachedMorph,
  detachedMorph,
  inferredValueSemantics
} from './changes/operations.js';

import { operationContext } from './changes/operation-context.js';
import { captureRecovery, recover, assertSupportedOperation, attachmentOf, propertyEquals, readProperty } from './changes/recovery.js';
import { MorphicTransactionUnsupportedError, MorphicTransactionAsyncError, MorphicSemanticViewReplayError, MorphicCompensationConflictError, MorphicHistoryOwnershipError } from './changes/errors.js';
import { ChangeSetEditTransaction, UndoManager, EditTransaction } from './undo.js';
import { DomainEditOperation } from './changes/domain-edit.js';
import { guardMorphState, captureStateGuardViolations, restoreStateGuards, releaseStateGuards, writeRecordedState } from './changes/state-guard.js';
import { prepareTextEdit, enlistTextMorphs, semanticTextOperations, releaseTextRecovery } from './changes/text.js';
import { Range } from './text/range.js';
import { graphicsValuePolicy } from './changes/graphics-policy.js';
import { rememberDerivations, changeSetUnits, reconcileSourceUnit } from './changes/derived.js';
import { matchesCompensationEndpoint, compensationTextLengths } from './changes/compensation.js';

const atomicState = { activeManager: null, depth: 0, descriptors: null };
const semanticReceipts = new WeakMap();
const compensationReceipts = new WeakMap();
const commitTokens = new WeakMap();
const atomicMethods = ['_record', 'informCommittedChangeListeners', 'addValueChange'];

/** Shared guards cover every environment without visiting live managers. */
function enterAtomicDispatch () {
  if (atomicState.depth++) return;
  atomicState.descriptors = Object.fromEntries(atomicMethods.map(name =>
    [name, Object.getOwnPropertyDescriptor(ChangeManager.prototype, name)]));
  try {
    ChangeManager.prototype._record = ChangeManager.prototype._recordAtomic;
    ChangeManager.prototype.informCommittedChangeListeners = ChangeManager.prototype._informCommittedAtomic;
    ChangeManager.prototype.addValueChange = ChangeManager.prototype._addValueChangeAtomic;
  } catch (error) { leaveAtomicDispatch(); throw error; }
}

/** Nested savepoints share the guards; the outer finally restores exact descriptors. */
function leaveAtomicDispatch () {
  if (--atomicState.depth) return;
  for (const name of atomicMethods) Object.defineProperty(ChangeManager.prototype, name, atomicState.descriptors[name]);
  atomicState.descriptors = null;
}

/** Keep the first primitive failure, including a falsy thrown value. */
function failAtomicFrame (frame, error) {
  if (!frame.hasFailed) {
    frame.hasFailed = true;
    frame.failed = error;
  }
}

function isPromise (value) {
  return value && typeof value.then === 'function';
}

function leafChangesOf (change) {
  return change.changes?.length
    ? change.changes.flatMap(leafChangesOf)
    : [change];
}

function committedChangeContext (changes, committedChange = null) {
  const targets = new Map();
  changes.forEach(change => {
    const candidates = [
      change.target,
      change.morph,
      ...(change.owners || []),
      ...(change.args || []).filter(arg => arg?.isMorph)
    ];
    candidates.forEach(target => {
      while (target) {
        if (target.id) targets.set(target.id, target);
        target = target.owner;
      }
    });
  });
  return Object.freeze({
    legacyChanges: Object.freeze(changes.slice()),
    committedChange,
    resolveMorph: id => targets.get(id)
  });
}

/** Notify change bindings while the change remains applied. */
function signalBindings (changeManager, obj, name, change) {
  // optimized lively.bindings.signal
  let conns = obj.attributeConnections;
  if (!conns) return;
  conns = conns.slice();
  for (let i = 0; i < conns.length; i++) {
    if (changeManager._suppressedChangeNotifications?.has(change)) return;
    if (conns[i].sourceAttrName === name) { conns[i].update(change); }
  }
}

function informMorph (changeManager, change, morph) {
  const previous = changeManager._currentMorphNotification;
  changeManager._currentMorphNotification = change;
  try {
    if (changeManager._suppressedChangeNotifications?.has(change)) return;
    morph.onChange(change);
    signalBindings(changeManager, morph, 'change', change);
    let owner = morph.owner;
    while (owner && !changeManager._suppressedChangeNotifications?.has(change)) {
      owner.onSubmorphChange(change, morph);
      owner = owner.owner;
    }
  } catch (err) {
    console.error(`Error in informMorph: ${err.stack}`);
  } finally {
    changeManager._currentMorphNotification = previous;
    const callbacks = changeManager._afterMorphNotifications?.get(change);
    if (callbacks) {
      changeManager._afterMorphNotifications.delete(change);
      for (const callback of callbacks) {
        try { callback(); } catch (err) { console.error(`Error after informMorph: ${err.stack}`); }
      }
    }
  }
}

/** Atomic reactions run as new leaves; ordinary notification skips this work. */
function informAtomicMorph (changeManager, change, morph) {
  const operationDepth = changeManager._operationDepth;
  const frame = changeManager._atomicFrame;
  const previous = frame?.root.notificationParent;
  changeManager._operationDepth = 0;
  if (frame) frame.root.notificationParent = frame.notifications.get(change) || previous;
  try { informMorph(changeManager, change, morph); } finally {
    changeManager._operationDepth = operationDepth;
    if (frame) frame.root.notificationParent = previous;
  }
}

class Change {
  constructor (target) {
    this.target = target;
    this.group = null;
  }

  get type () { return 'abstract change'; }
  apply () { throw new Error('Not yet implemented'); }
  reverseApply () { throw new Error('Not yet implemented'); }
}

export class GroupChange extends Change {
  constructor (target) {
    super(target);
    this.changes = [];
  }

  consumesChanges () { return true; }

  addChange (c) {
    this.changes.push(c);
    c.group = this;
  }

  apply () {
    this.changes.slice().forEach(change => change.apply());
    return this;
  }

  reverseApply () {
    this.changes.slice().reverse().forEach(change => change.reverseApply());
    return this;
  }
}

export class ValueChange extends Change {
  get type () { return 'setter'; }

  constructor (target, prop, value, meta, valuePolicy = {}, captureOperation = true) {
    super(target);
    const prevValue = target._morphicState[prop];
    this.prop = prop;
    this.value = value;
    this.prevValue = prevValue;
    this.meta = meta;
    this.valuePolicy = valuePolicy;
    if (captureOperation &&
        (valuePolicy.valueSemantics || inferredValueSemantics(prevValue, value)) === MorphicValueSemantics.SNAPSHOT) {
      this._operation = this.operation;
    }
  }

  get operation () {
    return this._operation ||= new SetMorphProperty({
      targetId: this.target.id,
      property: this.prop,
      before: this.prevValue,
      after: this.value,
      metadata: this.meta,
      ...this.valuePolicy
    });
  }

  operationContext (originalValue) {
    const { target } = this;
    return {
      resolveMorph: id => id === target.id ? target : null,
      setMorphProperty: (resolvedTarget, property, value, operation) => {
        // Inferred snapshots preserve legacy identity until the original mutates.
        if (!this.valuePolicy.valueSemantics &&
            operation.valueSemantics === MorphicValueSemantics.SNAPSHOT &&
            operation.snapshotValuesEqual(operation.snapshotValue(originalValue), operation.after)) {
          value = originalValue;
        }
        if (property in resolvedTarget) resolvedTarget[property] = value;
        else resolvedTarget.setProperty(property, value);
      },
      // Legacy undo has no conflict handling. Preserve that behavior while
      // exposing exact preconditions to the transaction kernel.
      checkPreconditions: false
    };
  }

  applyOperation (operation, replayDirection) {
    const { target, meta } = this;
    const originalValue = replayDirection === MorphicReplayDirection.UNDO ? this.prevValue : this.value;
    const replayMeta = replayDirection
      ? {
          ...meta,
          originalOrigin: meta.origin,
          origin: replayDirection,
          replayDirection
        }
      : meta;
    return target.withMetaDo(replayMeta, () => operation.apply(this.operationContext(originalValue)));
  }

  apply () {
    this.applyOperation(this.operation, MorphicReplayDirection.REDO);
  }

  reverseApply () {
    this.applyOperation(this.operation.invert(), MorphicReplayDirection.UNDO);
  }
}

export class MethodCallChange extends GroupChange {
  get type () { return 'method-call'; }

  constructor (target, selector, args, undo, meta) {
    super(target);
    this.selector = selector;
    this.args = args;
    this.undo = undo;
    this.meta = meta;
  }

  apply () {
    const { target, selector, args } = this;
    target.withMetaDo({
      ...this.meta,
      originalOrigin: this.meta.origin,
      origin: MorphicReplayDirection.REDO,
      replayDirection: MorphicReplayDirection.REDO
    }, () => target[selector].apply(target, args));
  }

  reverseApply () {
    if (!this.undo) return;
    this.target.withMetaDo({
      ...this.meta,
      originalOrigin: this.meta.origin,
      origin: MorphicReplayDirection.UNDO,
      replayDirection: MorphicReplayDirection.UNDO
    }, () => {
      if (typeof this.undo === 'function') this.undo();
      else {
        const { target, selector, args } = this.undo;
        target[selector].apply(target, args);
      }
    });
  }
}

function morphAttachment (morph) {
  const owner = morph.owner;
  return owner && !owner.isHand
    ? attachedMorph({
        ownerId: owner.id,
        index: owner.submorphs.indexOf(morph),
        transform: morph.getTransform().copy()
      })
    : detachedMorph();
}

export class StructuralChange extends Change {
  get type () { return 'method-call'; }

  constructor ({ target, morph, selector, args, operation, owners, meta }) {
    super(target);
    this.morph = morph;
    this.selector = selector;
    this.args = args;
    this.operation = operation;
    this.owners = owners;
    this.meta = meta;
  }

  operationContext () {
    const { morph, owners } = this;
    const targets = new Map([[morph.id, morph]]);
    owners.forEach(owner => owner && targets.set(owner.id, owner));
    return {
      resolveMorph: id => targets.get(id),
      moveMorph: (movedMorph, from, to) => {
        const actual = morphAttachment(movedMorph);
        // Legacy undo skips morphs moved elsewhere since the recorded change.
        if (actual.kind !== from.kind ||
            actual.ownerId !== from.ownerId) return;
        if (to.kind === MorphicAttachmentKind.DETACHED) {
          movedMorph.remove();
          return;
        }
        const owner = targets.get(to.ownerId);
        let insertionIndex = to.index;
        const currentIndex = owner.submorphs.indexOf(movedMorph);
        if (currentIndex > -1 && currentIndex < insertionIndex) insertionIndex++;
        owner.addMorphAt(movedMorph, insertionIndex);
        if (movedMorph.owner !== owner) return;
        const transform = to.transform;
        if (transform && !obj.equals(movedMorph.getTransform(), transform)) {
          movedMorph.dontRecordChangesWhile(() => movedMorph.setTransform(transform.copy()));
        }
      }
    };
  }

  applyOperation (operation, replayDirection) {
    const replayMeta = {
      ...this.meta,
      originalOrigin: this.meta.origin,
      origin: replayDirection,
      replayDirection
    };
    return this.target.withMetaDo(replayMeta, () => operation.apply(this.operationContext()));
  }

  apply () { this.applyOperation(this.operation, MorphicReplayDirection.REDO); }
  reverseApply () {
    this.applyOperation(this.operation.invert(), MorphicReplayDirection.UNDO);
  }
}

export class ChangeManager {
  constructor ({ undoManager = null, resolveMorph = null } = {}) {
    this.undoManager = undoManager;
    this.resolveMorph = resolveMorph;
    this.reset();
  }

  reset () {
    this._activeCommitDeliveries = [];
    this._usedCommitDeliveries = [];
    this._atomicFrame = null;
    this._operationDepth = 0;
    this._structuralCaptures = [];
    this.changes = [];
    this.changeRecordedListeners = [];
    this.committedChangeListeners = [];
    this.committedChangeListenerScopes = new WeakMap();
    this.revision = 0;
    this.commitCounter = 0;
    this.recordingChangesDepth = 0;

    this.changeRecordersPerMorph = new WeakMap();
    this.changeRecorders = {};

    this.changeGroupStack = [];
    this.defaultMeta = {};
    this.metaStack = [];
    this.propertyValuePolicies = new Map();
  }

  operationContext (options) { return operationContext(this, options); }

  /** Tokens authenticate live deliveries; a saved context cannot stage new history. */
  commitTokenFor (context) {
    if (!this._activeCommitDeliveries.includes(context)) throw new MorphicHistoryOwnershipError('published');
    let token = commitTokens.get(context);
    if (!token) {
      const lifetime = UndoManager._openLegacyCommit(this, context);
      token = lifetime.token;
      commitTokens.set(context, token);
      this._usedCommitDeliveries.push(lifetime);
    }
    return token;
  }

  _closeCommitDelivery (context) {
    for (let index = this._usedCommitDeliveries.length - 1; index >= 0; index--) {
      const lifetime = this._usedCommitDeliveries[index];
      if (lifetime.context !== context) continue;
      this._usedCommitDeliveries.splice(index, 1);
      UndoManager._closeLegacyCommit(lifetime);
    }
  }

  get _textCaptureActive () { return !!atomicState.activeManager; }

  _assignText (target, value) {
    const range = target.document ? target.documentRange
      : prepareTextEdit(target, { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }, target.textAndAttributes).insertedRange;
    return this._replaceText(target, range, value, { fullAssignment: true });
  }

  _changeTextAttributes (target, range, attributes, mode) {
    const value = target.textAndAttributesInRange(range).map((entry, index) => {
      if (index % 2 === 0) return entry;
      if (mode === 'set') return attributes;
      if (mode === 'add') return { ...entry, ...attributes };
      if (!entry) return entry;
      const result = { ...entry };
      Object.keys(attributes || {}).forEach(key => delete result[key]);
      return Object.keys(result).length ? result : null;
    });
    return this._replaceText(target, range, value, { attributesOnly: true });
  }

  /** Engine hook for the supported Text APIs; direct Document calls are not captured. */
  _replaceText (target, range, value, options = {}) {
    this._assertAtomicAccess(target);
    if (!options.fullAssignment && !options.attributesOnly && new Range(range).isEmpty() &&
        (value === '' || Array.isArray(value) && (!value.length || value.length === 2 && !value[0]))) return new Range(range);
    const frame = this._atomicFrame;
    const operation = prepareTextEdit(target, range, value, { ...options, metadata: this.defaultMeta });
    enlistTextMorphs(this, frame, target, operation);
    this._perform(frame, operation);
    return new Range(operation.insertedRange);
  }

  _enlistAtomicMorph (frame, morph) {
    this._assertAtomicAccess(morph);
    guardMorphState(this, frame, morph);
    frame.context.enlist?.(morph);
  }

  _notifyTextOperation (target, operation, capturedOperation = operation) {
    const change = new MethodCallChange(target, 'replace', [new Range(operation.range), operation.after], {
      target, selector: 'replace', args: [new Range(operation.insertedRange), operation.before, false]
    }, { ...this.defaultMeta, textReplacement: true });
    change.operation = capturedOperation;
    this._record(target, change);
  }

  /** Keep lazy engine fitting in the text source unit without changing ordinary fit. */
  _guardAtomicTextFit (frame, target) {
    let prototype = target;
    while (prototype && !Object.hasOwn(prototype, 'fit')) prototype = Object.getPrototypeOf(prototype);
    if (!prototype) return;
    const fits = frame.root.textFits ||= new Map();
    if (fits.has(prototype)) return;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'fit');
    if (typeof descriptor.value !== 'function' || !descriptor.configurable && !descriptor.writable) {
      this._rejectAtomic('Text fitting requires a restorable engine method', 'text-fit-descriptor', target);
    }
    const original = descriptor.value;
    Object.defineProperty(prototype, 'fit', { ...descriptor, value: function (...args) {
      const manager = atomicState.activeManager;
      const root = manager?._atomicFrame?.root;
      const previous = root?.notificationParent;
      let current = manager?._atomicFrame;
      let source;
      while (current && !source) { source = current.textOrigins?.get(this); current = current.parent; }
      if (root) root.notificationParent = previous || source;
      try { return original.apply(this, args); } finally { if (root) root.notificationParent = previous; }
    } });
    fits.set(prototype, descriptor);
  }

  _rejectAtomic (message, kind, morph = null, detection = 'before') {
    const manager = atomicState.activeManager || this;
    const error = new MorphicTransactionUnsupportedError(message, { kind, targetId: morph?.id, detection });
    if (manager._atomicFrame) failAtomicFrame(manager._atomicFrame, error);
    throw error;
  }

  _assertAtomicAccess (morph) {
    if (!atomicState.activeManager) return;
    if (atomicState.activeManager !== this || (morph?.env && morph.env.changeManager !== this)) {
      this._rejectAtomic('Cross-environment mutation is unsupported', 'cross-environment', morph);
    }
    const frame = this._atomicFrame;
    if (frame && !this._recovering) {
      if (frame.root.fault) throw frame.root.fault;
      if (frame.hasFailed) throw frame.failed;
    }
  }

  _performEdit (frame, edit) {
    if (!(edit instanceof EditTransaction)) this._rejectAtomic('performEdit requires an EditTransaction', 'domain-edit');
    try { return this._perform(frame, new DomainEditOperation(edit, { metadata: this.defaultMeta })); }
    catch (error) { failAtomicFrame(frame, error); throw error; }
  }

  _perform (frame, operation) {
    if (this._atomicFrame !== frame || frame.closed) throw new Error('Transaction scope is closed');
    this._assertAtomicAccess();
    try { assertSupportedOperation(operation); } catch (error) { failAtomicFrame(frame, error); throw error; }
    if (!(operation instanceof DomainEditOperation)) this._enlistAtomicMorph(frame, frame.context.resolveMorph(operation.targetId));
    if (operation instanceof MoveMorph) {
      this._enlistAtomicMorph(frame, frame.context.resolveMorph(operation.from.ownerId));
      this._enlistAtomicMorph(frame, frame.context.resolveMorph(operation.to.ownerId));
    }
    if (operation instanceof ReplaceText) enlistTextMorphs(this, frame, frame.context.resolveMorph(operation.targetId), operation);
    if (operation instanceof ReplaceText) this._guardAtomicTextFit(frame, frame.context.resolveMorph(operation.targetId));
    operation.validate(frame.context);
    const recovery = captureRecovery(operation, frame.context);
    recovery.derivedFrom = frame.root.notificationParent || this._performingRecovery;
    if (operation instanceof ReplaceText) (frame.textOrigins ||= new Map()).set(frame.context.resolveMorph(operation.targetId), recovery);
    if (!this._recovering) {
      frame.journal.push(recovery);
      if (operation instanceof ReplaceText || operation instanceof DomainEditOperation) {
        recovery.recorded = true;
        frame.operations.push(recovery);
      }
    }
    frame.root.unitJournal?.entries.push(recovery);
    this._operationDepth++;
    const previous = this._performingRecovery;
    this._performingRecovery = recovery;
    try {
      operation.apply(frame.context);
      if (operation instanceof ReplaceText) {
        recovery.operation = new ReplaceText({ ...(recovery.appliedOperation || operation), embedded: operation.embedded.map(entry => ({
          ...entry, after: attachmentOf(frame.context.resolveMorph(entry.morphId))
        })) });
        recovery.appliedOperation = recovery.operation;
        const target = frame.context.resolveMorph(operation.targetId);
        this._notifyTextOperation(target, recovery.operation);
      }
      if (!this._recovering && !recovery.recorded) frame.operations.push(recovery);
    } catch (error) {
      if (operation instanceof ReplaceText && recovery.appliedOperation) {
        recovery.appliedOperation = new ReplaceText({ ...recovery.appliedOperation, embedded: operation.embedded.map(entry => ({
          ...entry, after: attachmentOf(frame.context.resolveMorph(entry.morphId))
        })) });
      }
      failAtomicFrame(frame, error);
      throw error;
    } finally {
      if (operation instanceof ReplaceText) releaseTextRecovery(operation);
      this._operationDepth--;
      this._performingRecovery = previous;
    }
    return operation;
  }

  _discardAtomicRecords (frame, { failed = false } = {}) {
    const owned = new Set(frame.recorded);
    if (failed) this.changes = this.changes.filter(change => !owned.has(change));
    const recorders = failed ? Object.values(this.changeRecorders)
      : [...new Set([this.undoManager, frame.options.undoManager])]
          .map(manager => manager?.undoInProgress?.recorder).filter(Boolean);
    for (const changeRecorder of recorders) {
      changeRecorder.changes = changeRecorder.changes.filter(change => !owned.has(change));
    }
    for (const manager of new Set([this.undoManager, frame.options.undoManager])) {
      const active = manager?.undoInProgress;
      if (active?._historyOrder) active._historyOrder = active._historyOrder.filter(change => !owned.has(change));
    }
    for (const group of this.changeGroupStack) {
      group.changes = group.changes.filter(change => !owned.has(change));
    }
  }

  _rollbackFrame (frame, cause) {
    this._recovering = true;
    this._operationDepth++;
    let rollback;
    const undoManager = frame.options.undoManager;
    if (undoManager) undoManager.applyCount++;
    try {
      rollback = recover(frame.journal, { reconcileUnit: unit => reconcileSourceUnit(
        this, unit, frame.context, 'reverse', replacement => {
          const previous = this._performingRecovery;
          this._performingRecovery = unit.entry;
          try {
            if (replacement) return this._perform(frame, replacement);
            unit.entry.restore();
            if (unit.entry.operation instanceof ReplaceText) {
              this._notifyTextOperation(frame.context.resolveMorph(unit.entry.operation.targetId), unit.entry.operation.invert(), unit.entry.operation);
            }
          } finally { this._performingRecovery = previous; }
        }, { recovering: true }
      ) });
    } finally {
      if (undoManager) undoManager.applyCount--;
      this._operationDepth--;
      this._recovering = false;
      this._discardAtomicRecords(frame, { failed: true });
      if (undoManager?.undoInProgress) undoManager.undoInProgress._joinBarrier = (undoManager.undoInProgress._joinBarrier || 0) + 1;
    }
    frame.root.diagnostics ||= [];
    frame.root.diagnostics.push(...rollback.diagnostics);
    this._lastRollbackDiagnostics = frame.root.diagnostics;
    if (rollback.unreversedOperations.length) {
      const previous = frame.root.fault;
      frame.root.fault = new MorphicRollbackError('Morphic transaction rollback is incomplete', {
        cause: previous ? previous.cause : cause instanceof MorphicRollbackError ? cause.cause : cause,
        rollbackErrors: [...(previous?.rollbackErrors || []), ...rollback.rollbackErrors],
        unreversedOperations: [...(previous?.unreversedOperations || []), ...rollback.unreversedOperations]
      });
    }
    return frame.root.fault || cause;
  }

  transaction (options, callback) {
    if (typeof callback !== 'function') throw new Error('Morphic transactions require a callback');
    if (atomicState.activeManager && atomicState.activeManager !== this) this._rejectAtomic('Cross-environment transaction is unsupported', 'cross-environment');
    const parent = this._atomicFrame;
    this._assertAtomicAccess();
    if (parent && ((options?.undoManager !== undefined && options.undoManager !== parent.options.undoManager) ||
        (options?.undoable !== undefined && options.undoable !== parent.options.undoable))) {
      this._rejectAtomic('A savepoint cannot change history ownership', 'savepoint-options');
    }
    const opts = parent ? parent.options : {
      label: '', origin: 'user', undoable: true, undoManager: this.undoManager,
      ...options
    };
    if (opts.undoable && !opts.undoManager) throw new Error('Undoable transactions require an UndoManager');
    const id = `morphic-transaction-${this.commitCounter++}`;
    const frame = {
      id, parent, options: opts, journal: [], operations: [], recorded: [], deferred: [], notifications: new WeakMap(), stateGuards: new Map(), closed: false, hasFailed: false, failed: undefined,
      context: parent?.context || this.operationContext({ scope: options?.scope, metadata: {
        ...opts.metadata, origin: opts.origin, undoable: opts.undoable
      } })
    };
    frame.root = parent?.root || frame;
    this._atomicFrame = frame;
    const previousManager = atomicState.activeManager;
    atomicState.activeManager = this;
    let value;
    let changeSet;
    let dispatchEntered = false;
    try {
      enterAtomicDispatch();
      dispatchEntered = true;
      (Array.isArray(options?.scope) ? options.scope : [options?.scope]).filter(Boolean)
        .forEach(morph => this._enlistAtomicMorph(frame, morph));
      try {
        this.doWithValueChangeMeta({ ...opts.metadata, origin: opts.origin, undoable: opts.undoable }, null, () => {
          value = callback(Object.freeze({ id, perform: operation => this._perform(frame, operation), performEdit: edit => this._performEdit(frame, edit) }));
          if (isPromise(value)) {
            Promise.resolve(value).catch(() => {});
            throw new MorphicTransactionAsyncError();
          }
        });
      } finally {
        const violation = captureStateGuardViolations(frame);
        if (violation) failAtomicFrame(frame, violation);
      }
      if (frame.root.fault) throw frame.root.fault;
      if (frame.hasFailed) throw frame.failed;
      changeSet = new MorphicChangeSet({
        id, label: opts.label, origin: opts.origin, undoable: opts.undoable,
        operations: frame.operations.filter(entry => !entry.structuralOwner).map(entry => entry.operation),
        metadata: opts.metadata
      });
      rememberDerivations(changeSet, frame.operations.filter(entry => !entry.structuralOwner));
      restoreStateGuards(frame);
    } catch (error) {
      throw this._rollbackFrame(frame, error);
    } finally {
      if (!parent && frame.textFits) {
        for (const [prototype, descriptor] of frame.textFits) Object.defineProperty(prototype, 'fit', descriptor);
        frame.textFits.clear();
      }
      releaseStateGuards(frame);
      frame.closed = true;
      this._atomicFrame = parent;
      atomicState.activeManager = previousManager;
      if (dispatchEntered) leaveAtomicDispatch();
    }
    if (parent) {
      parent.journal.push(...frame.journal);
      parent.operations.push(...frame.operations);
      parent.recorded.push(...frame.recorded);
      parent.deferred.push(...frame.deferred);
      if (frame.textOrigins) for (const [target, source] of frame.textOrigins) (parent.textOrigins ||= new Map()).set(target, source);
      return { value, changeSet, history: null };
    }
    frame.context.retainDetached?.(changeSet.operations);
    let entry = null;
    if (changeSet.operations.length && opts.undoable && !opts.undoManager.applyCount) {
      entry = new ChangeSetEditTransaction(changeSet, this, {
        context: frame.context, groupToken: opts.undoManager.undoInProgress
      });
    }
    const context = Object.freeze({
      ...frame.context, capturedChangeSet: changeSet,
      legacyChanges: Object.freeze(frame.recorded.filter(change => !(change instanceof GroupChange) || change.operation)), committedChange: null,
      undoManager: opts.undoManager
    });
    const token = UndoManager._commitToken(this, context);
    commitTokens.set(context, token);
    const pending = UndoManager._stageCommit(token, { legacyChanges: context.legacyChanges, undoManager: opts.undoManager, entry, undoable: changeSet.undoable, orderedBeforeDelivery: true });
    compensationReceipts.set(changeSet, { changeSet, context: new WeakRef(context), pending, operationContext: frame.context,
      textLengths: compensationTextLengths(changeSet, frame.context) });
    let history;
    try {
      if (changeSet.operations.length && opts.notify !== false) this._deliverAtomicCommit(changeSet, frame, context);
    } finally {
      this._discardAtomicRecords(frame);
      history = UndoManager._publishCommit(token);
    }
    for (const callback of frame.deferred) {
      try { callback(); } catch (error) { console.error(`Error after atomic commit: ${error.stack}`); }
    }
    return { value, changeSet, history };
  }

  _deliverAtomicCommit (changeSet, frame, context) {
    const { legacyChanges } = context;
    const listeners = this.committedChangeListeners.slice().filter(listener => {
      const containsMorph = this.committedChangeListenerScopes.get(listener);
      if (containsMorph && !legacyChanges.some(change =>
        [change.target, change.morph, ...(change.owners || [])].some(morph => morph && containsMorph(morph))) &&
          !changeSet.operations.some(operation => operation.targetId && containsMorph(frame.context.resolveMorph(operation.targetId)))) return false;
      return true;
    });
    if (!listeners.length) return;
    const view = changeSet.operations.some(operation => operation instanceof ReplaceText)
      ? new MorphicChangeSet({ ...changeSet, operations: semanticTextOperations(changeSet.operations, context) }) : changeSet;
    if (view !== changeSet) semanticReceipts.set(view, { context, commitToken: commitTokens.get(context), capturedChangeSet: changeSet });
    this._activeCommitDeliveries.push(context);
    try {
      listeners.forEach(listener => {
        try { listener(view, context); } catch (error) {
          console.error(`Error in committed change listener: ${error.stack}`);
        }
      });
    } finally {
      this._activeCommitDeliveries.pop();
      if (this._usedCommitDeliveries.length) this._closeCommitDelivery(context);
    }
  }

  applyChangeSet (changeSet, { context, direction = 'forward', origin = direction, undoManager = this.undoManager, notify = true } = {}) {
    changeSet = this._capturedChangeSet(changeSet, context);
    if (!(changeSet instanceof MorphicChangeSet) || !context) throw new Error('applyChangeSet requires a change set and operation context');
    if (!['forward', 'undo', 'redo'].includes(direction)) throw new Error(`Unknown replay direction: ${direction}`);
    if (atomicState.activeManager) this._rejectAtomic('Use perform inside a transaction', 'nested-replay');
    const units = changeSetUnits(changeSet);
    if (direction === 'undo') units.reverse();
    const guards = new Set([this.undoManager, undoManager].filter(Boolean));
    guards.forEach(manager => manager.applyCount++);
    try {
      // The journal and recovery path are the same as a new edit; history is disabled.
      const result = this.transaction({
        label: changeSet.label, origin, undoable: false, undoManager, notify,
        metadata: { ...changeSet.metadata, originalOrigin: changeSet.origin, replayDirection: direction, replayOf: changeSet.id }
      }, tx => {
        this._atomicFrame.context = context;
        for (const unit of units) {
          const rollback = reconcileSourceUnit(this, unit, context, direction === 'undo' ? 'reverse' : 'forward', replacement => {
            tx.perform(replacement || (direction === 'undo' ? unit.entry.operation.invert() : unit.entry.operation));
          });
          if (rollback.unreversedOperations.length) {
            const error = new MorphicRollbackError('Morphic source-unit replay did not converge', {
              cause: new Error('Source-unit reaction conflict'), ...rollback
            });
            this._atomicFrame.root.fault = error;
            throw error;
          }
        }
      });
      return result.changeSet;
    } finally { guards.forEach(manager => manager.applyCount--); }
  }

  _capturedChangeSet (changeSet, context) {
    if (changeSet?.operations?.some(operation => operation instanceof SetMorphProperty && operation.property === 'textAndAttributes' && operation.metadata.textReplacement)) {
      const receipt = semanticReceipts.get(changeSet);
      if (!receipt || receipt.context !== context || receipt.commitToken !== commitTokens.get(context) || receipt.capturedChangeSet !== context.capturedChangeSet) {
        throw new MorphicSemanticViewReplayError(changeSet);
      }
      changeSet = receipt.capturedChangeSet;
    }
    return changeSet;
  }

  /** Explicit postcommit reversal; a receipt owns history and notification cleanup. */
  compensate (input, { context, commitToken = null, undoManager = this.undoManager, cause = null } = {}) {
    if (commitToken && (commitTokens.get(context) !== commitToken || !this._activeCommitDeliveries.includes(context))) {
      throw new MorphicHistoryOwnershipError('published');
    }
    let receipt = compensationReceipts.get(input);
    let changeSet = input instanceof MorphicChangeSet ? this._capturedChangeSet(input, context) : context?.capturedChangeSet;
    if (changeSet) changeSet = this._capturedChangeSet(changeSet, context);
    receipt ||= compensationReceipts.get(changeSet);
    if (!receipt) {
      const legacyChanges = context?.legacyChanges || (input instanceof MorphicChangeSet ? [] : [input]);
      const operations = changeSet?.operations || legacyChanges.flatMap(leafChangesOf).map(change => change.operation).filter(Boolean);
      if (!operations.length) throw new MorphicCompensationConflictError(changeSet, cause);
      operations.forEach(assertSupportedOperation);
      changeSet ||= new MorphicChangeSet({ id: `morphic-compensation-${this.commitCounter++}`, operations });
      const scope = legacyChanges.flatMap(leafChangesOf).flatMap(change => [change.target, change.morph, ...(change.owners || [])]).filter(Boolean);
      receipt = { changeSet, context: context && new WeakRef(context), legacyChanges: legacyChanges.map(change => new WeakRef(change)),
        operationContext: this.operationContext({ scope, resolveMorph: context?.resolveMorph }) };
    }
    const commitContext = receipt.context?.deref();
    if (context && commitContext && context !== commitContext && context !== receipt.operationContext) {
      throw new MorphicCompensationConflictError(changeSet, cause);
    }
    const runtime = receipt.operationContext;
    const matches = endpoint => {
      try { return matchesCompensationEndpoint(receipt.changeSet, runtime, endpoint, receipt.textLengths); } catch (error) { return false; }
    };
    const before = matches('before'); const after = matches('after');
    if (receipt.compensated) {
      if (!before) throw new MorphicCompensationConflictError(receipt.changeSet, cause);
      return { state: 'already-compensated' };
    }
    if (!before && !after) throw new MorphicCompensationConflictError(receipt.changeSet, cause);
    const token = commitToken || (commitContext && commitTokens.get(commitContext));
    const pending = receipt.pending || UndoManager._commitFor(token);
    if (pending?.phase === 'published' && pending.stored) pending.undoManager._replaceHistoryEntry(pending.stored, null, { preflight: true });
    const managers = new Set([this.undoManager, undoManager, pending?.undoManager].filter(Boolean));
    const owned = [...(commitContext?.legacyChanges || receipt.legacyChanges?.map(reference => reference.deref()) || []), commitContext?.committedChange].filter(Boolean).flatMap(change => [change, ...leafChangesOf(change)]);
    const skipClaims = [pending?.entry, pending?.stored];
    managers.forEach(manager => manager._replaceHistoryEntry(owned, null, { preflight: true, allowMissing: true, skipClaims }));
    const snapshots = new Map([...managers].map(manager => [manager, new Set(manager.undoInProgress?.recorder.changes || [])]));
    try {
      if (!before) this.applyChangeSet(receipt.changeSet, { context: runtime, direction: 'undo', origin: 'runtime-projection', undoManager, notify: false });
      if (!matches('before')) throw new MorphicCompensationConflictError(receipt.changeSet, cause);
    } catch (error) {
      throw new MorphicRollbackError('Morphic compensation is incomplete', {
        cause: cause !== null ? cause : error instanceof MorphicRollbackError ? error.cause : error,
        rollbackErrors: error instanceof MorphicRollbackError ? error.rollbackErrors : receipt.changeSet.operations.map(operation => ({ operation, error })),
        unreversedOperations: error instanceof MorphicRollbackError ? error.unreversedOperations : receipt.changeSet.operations
      });
    }
    for (const manager of managers) {
      const inverse = (manager.undoInProgress?.recorder.changes || []).filter(change => !snapshots.get(manager).has(change));
      manager._replaceHistoryEntry([...owned, ...inverse], null, { allowMissing: true, skipClaims });
    }
    UndoManager._cancelCommit(token, pending);
    owned.forEach(change => this.suppressChangeNotifications(change));
    managers.forEach(manager => manager.cancelEmptyGroup());
    receipt.compensated = true;
    compensationReceipts.set(input, receipt);
    compensationReceipts.set(receipt.changeSet, receipt);
    return { state: 'compensated' };
  }

  suppressChangeNotifications (change) {
    if (!change) return;
    this._suppressedChangeNotifications ||= new WeakSet();
    this._suppressedChangeNotifications.add(change);
  }

  deferAfterChangeNotifications (change, callback) {
    if (this._atomicFrame) {
      this._atomicFrame.deferred.push(callback);
      return true;
    }
    if (this._currentMorphNotification !== change) return false;
    this._afterMorphNotifications ||= new WeakMap();
    const callbacks = this._afterMorphNotifications.get(change) || [];
    callbacks.push(callback);
    this._afterMorphNotifications.set(change, callbacks);
    return true;
  }

  changesFor (morph) { return this.changes.filter(c => c.target === morph); }

  apply (target, change) { change.apply(); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface for adding changes, used by morphs

  doWithValueChangeMeta (meta, morph, doFn) {
    this.defaultMeta = { ...arr.last(this.metaStack), ...meta };
    this.metaStack.push(meta);
    let res;
    try {
      res = doFn(morph);
      if (isPromise(res)) {
        throw new Error('withMetaDo callbacks must be synchronous');
      }
    } finally {
      this.metaStack.pop();
      this.defaultMeta = arr.last(this.metaStack) || {};
    }
    return res;
  }

  addValueChange (morph, prop, value, meta) {
    const valuePolicy = this.propertyValuePolicies.get(prop) || {};
    const change = new ValueChange(
      morph,
      prop,
      value,
      { ...this.defaultMeta, ...meta },
      valuePolicy,
      this.recordingChangesDepth > 0 ||
        this.changeRecordedListeners.length > 0 ||
        this.hasCommittedListenerFor(morph)
    );
    return this._record(morph, change);
  }

  setPropertyValuePolicy (property, policy = {}) {
    if (typeof property !== 'string' || !property) {
      throw new Error('Property value policies require a property name');
    }
    if (!policy || typeof policy !== 'object') {
      throw new Error('Property value policies require a policy object');
    }
    if (policy.valueSemantics !== undefined &&
        !Object.values(MorphicValueSemantics).includes(policy.valueSemantics)) {
      throw new Error(`Unknown morphic property value semantics: ${policy.valueSemantics}`);
    }
    this.propertyValuePolicies.set(property, Object.freeze({ ...policy }));
    return this;
  }

  removePropertyValuePolicy (property) {
    this.propertyValuePolicies.delete(property);
    return this;
  }

  addMethodCallChangeDoing (spec, morph, doFn) {
    if (atomicState.activeManager) this._rejectAtomic('MethodCallChange requires a typed operation', 'method-call', morph);
    let { target, selector, args, undo, meta = {} } = spec;
    if (!undo) undo = () => console.warn(`No undo recorded for ${target}.${selector}`);
    const change = new MethodCallChange(target, selector, args, undo, { ...this.defaultMeta, ...meta });
    morph.groupChangesWhile(change, doFn);
    return change;
  }

  addStructuralChangeDoing (spec, targetMorph, doFn) {
    const { morph, selector, args, meta = {} } = spec;
    const fromOwner = morph.owner;
    const from = morphAttachment(morph);
    let recovery;
    let primitiveCompleted = false;
    if (atomicState.activeManager) {
      this._assertAtomicAccess(targetMorph);
      this._assertAtomicAccess(morph);
      const frame = this._atomicFrame;
      const performedMove = this._operationDepth && this._performingRecovery?.operation;
      if (frame && !(performedMove instanceof MoveMorph && performedMove.morphId === morph.id) &&
          !(performedMove instanceof ReplaceText && performedMove.embedded.some(entry => entry.morphId === morph.id)) &&
          !this._structuralCaptures.some(entry => entry.morph === morph)) {
        this._enlistAtomicMorph(frame, targetMorph);
        this._enlistAtomicMorph(frame, morph);
        recovery = captureRecovery(new MoveMorph({ morphId: morph.id, from: attachmentOf(morph), to: attachmentOf(morph) }), frame.context);
        recovery.morph = morph;
        if (!recovery.owners.includes(targetMorph)) recovery.owners.push(targetMorph);
        recovery.derivedFrom = frame.root.notificationParent || this._performingRecovery;
        if (!this._recovering) frame.journal.push(recovery);
        frame.root.unitJournal?.entries.push(recovery);
        this._structuralCaptures.push(recovery);
      }
    }
    try {
      // Audited primitive internals, not the public recording-suppression API.
      this.groupChangesWhile(targetMorph, undefined, doFn, false);
      primitiveCompleted = true;
    } catch (error) {
      if (this._atomicFrame && !this._recovering) failAtomicFrame(this._atomicFrame, error);
      throw error;
    } finally {
      if (recovery) {
        arr.remove(this._structuralCaptures, recovery);
        if (primitiveCompleted) recovery.operation = new MoveMorph({
          morphId: morph.id, from: recovery.operation.from, to: attachmentOf(morph),
          metadata: { ...this.defaultMeta, ...meta }
        });
      }
    }
    const toOwner = morph.owner;
    const to = morphAttachment(morph);
    const changeMeta = { ...this.defaultMeta, ...meta };
    const operation = new MoveMorph({
      morphId: morph.id,
      from,
      to,
      metadata: changeMeta
    });
    const change = new StructuralChange({
      target: targetMorph,
      morph,
      selector,
      args,
      operation,
      owners: [fromOwner, toOwner],
      meta: changeMeta
    });
    if (!recovery) return this._record(targetMorph, change);
    change._atomicRecovery = recovery;
    try { return this._record(targetMorph, change); } finally { delete change._atomicRecovery; }
  }

  _recordAtomic (morph, change) {
    try {
      this._assertAtomicAccess(morph);
      const frame = this._atomicFrame;
      if (frame) {
        const performed = this._performingRecovery;
        const operation = performed?.operation;
        const textLeaf = operation instanceof ReplaceText && (
          morph.id === operation.targetId && (change.operation === performed.operation || change.prop === 'textAndAttributes' ||
            (operation.fullAssignment || morph._isUpgrading) && ['document', 'textLayout', 'needsDocument', 'selection', 'renderingState'].includes(change.prop)) ||
          change instanceof StructuralChange && operation.embedded.some(entry => entry.morphId === change.morph.id) ||
          operation.embedded.some(entry => entry.morphId === morph.id) && ['position', 'rotation', 'scale'].includes(change.prop)
        );
        const anchorPlacement = operation instanceof ReplaceText && change.prop === 'position' &&
          operation.embedded.some(entry => entry.morphId === morph.id) &&
          morph.owner?._positioningSubmorph === morph && this._currentMorphNotification?.target !== morph;
        const directLeaf = anchorPlacement || this._operationDepth && (textLeaf || operation?.targetId === morph.id && (
          operation instanceof SetMorphProperty && change.prop === operation.property ||
          operation instanceof MoveMorph && (change instanceof StructuralChange || ['position', 'rotation', 'scale'].includes(change.prop))
        ));
        if (directLeaf) {
          if (!this._recovering && !performed.recorded) {
            performed.recorded = true;
            arr.remove(frame.journal, performed);
            frame.journal.push(performed);
            frame.operations.push(performed);
          }
          frame.notifications.set(change, performed);
        } else if ((!this._recovering || frame.root.unitJournal) && !(change instanceof GroupChange) && !(change instanceof StructuralChange)) {
          let captured = change.operation;
          try { assertSupportedOperation(captured); } catch (error) { failAtomicFrame(frame, error); throw error; }
          if (change instanceof ValueChange) {
            const expected = frame.root.unitJournal?.policyFor(captured);
            const policy = expected || (Object.keys(change.valuePolicy).length ? change.valuePolicy : graphicsValuePolicy(change.prevValue, change.value));
            captured = new SetMorphProperty({
              targetId: morph.id, property: change.prop, before: change.prevValue, after: change.value, metadata: change.meta,
              valueSemantics: policy.valueSemantics, snapshotValue: policy.snapshotValue,
              materializeValue: policy.materializeValue, snapshotValuesEqual: policy.snapshotValuesEqual
            });
          }
          try { assertSupportedOperation(captured); } catch (error) { failAtomicFrame(frame, error); throw error; }
          this._enlistAtomicMorph(frame, morph);
          const recovery = captureRecovery(captured, frame.context, { rawState: change instanceof ValueChange });
          recovery.derivedFrom = frame.root.notificationParent || this._performingRecovery;
          recovery.structuralOwner = this._structuralCaptures.find(entry => entry.morph === morph &&
            ['position', 'rotation', 'scale'].includes(captured.property));
          if (!this._recovering) {
            frame.journal.push(recovery);
            frame.operations.push(recovery);
          }
          frame.root.unitJournal?.entries.push(recovery);
          frame.notifications.set(change, recovery);
        } else if (change._atomicRecovery) {
          const recovery = change._atomicRecovery;
          if (!this._recovering) frame.operations.push(recovery);
          frame.notifications.set(change, recovery);
        }
        frame.recorded.push(change);
      }
      return this._recordWithAtomicNotifications(morph, change);
    } catch (error) {
      if (this._atomicFrame && !this._recovering) failAtomicFrame(this._atomicFrame, error);
      throw error;
    }
  }

  // Mirror ordinary recording while clearing primitive depth only at the observer boundary.
  // The prototype dispatch also preserves wrappers that delegate to prototype._record.
  _recordWithAtomicNotifications (morph, change) {
    // FIXME
    signal(this, 'changeRecorded', change);
    if (change.hasOwnProperty('value')) {
      writeRecordedState(morph, change.prop, change.value);
    }

    const isDocumentChange = change.prevValue?.isDocument ||
     change.value?.isDocument ||
     change.selector === 'replace';
    const isUpdatingChange = !obj.equals(change.prevValue, change.value);
    // calling `makeDirty` on `Text` leads to a remeasure of the text.
    // In the case that we are just scrolling a statically rendered text, we do not need this.
    // Actually, it is harmful, since this will rehang our node, thus resetting the scroll position of the node
    // and resulting in an endless loop which shows visible jiggle of text.
    const isScrollChange = change.prop === 'scroll';
    const isStaticText = !morph.document;
    const skipRender = this.defaultMeta.skipRender;
    const scrollingStaticText = isStaticText && isScrollChange;

    if ((isDocumentChange || isUpdatingChange) && !scrollingStaticText && !skipRender) morph.makeDirty();

    const grouping = arr.last(this.changeGroupStack);
    if (grouping && grouping.consumesChanges()) {
      grouping.addChange(change);
    } else {
      this.changes.push(change);
      morph._rev = ++this.revision;
      this.informChangeListeners(change);
      this.informCommittedChangeListeners(change);
    }
    informAtomicMorph(this, change, morph);

    return change;
  }

  _record (morph, change) {
    // FIXME
    signal(this, 'changeRecorded', change);
    if (change.hasOwnProperty('value')) {
      morph._morphicState[change.prop] = change.value;
    }

    const isDocumentChange = change.prevValue?.isDocument ||
     change.value?.isDocument ||
     change.selector === 'replace';
    const isUpdatingChange = !obj.equals(change.prevValue, change.value);
    // calling `makeDirty` on `Text` leads to a remeasure of the text.
    // In the case that we are just scrolling a statically rendered text, we do not need this.
    // Actually, it is harmful, since this will rehang our node, thus resetting the scroll position of the node
    // and resulting in an endless loop which shows visible jiggle of text.
    const isScrollChange = change.prop === 'scroll';
    const isStaticText = !morph.document;
    const skipRender = this.defaultMeta.skipRender;
    const scrollingStaticText = isStaticText && isScrollChange;

    if ((isDocumentChange || isUpdatingChange) && !scrollingStaticText && !skipRender) morph.makeDirty();

    const grouping = arr.last(this.changeGroupStack);
    if (grouping && grouping.consumesChanges()) {
      grouping.addChange(change);
    } else {
      this.changes.push(change);
      morph._rev = ++this.revision;
      this.informChangeListeners(change);
      this.informCommittedChangeListeners(change);
    }
    informMorph(this, change, morph);

    return change;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // group changes

  /**
   * A non-atomic recording batch: on error clean the stack and rethrow;
   * applied mutations remain. Use ChangeManager.transaction for atomic edits.
   */
  groupChangesWhile (targetMorph, groupChange, whileFn, record = true) {
    if (atomicState.activeManager && groupChange instanceof MethodCallChange) {
      this._rejectAtomic('MethodCallChange requires a typed operation', 'method-call', targetMorph);
    }
    if (!groupChange) groupChange = new GroupChange(targetMorph);
    this.changeGroupStack.push(groupChange);
    // Method calls replay their explicit undo rather than their leaf changes.
    // A grouped commit can bring previously untracked leaves into a listener's scope.
    const captureValues = record &&
      (!(groupChange instanceof MethodCallChange) || this.committedChangeListeners.length > 0);
    if (captureValues) this.recordingChangesDepth++;
    try {
      whileFn();
      arr.remove(this.changeGroupStack, groupChange);
      return record ? this._record(targetMorph, groupChange) : groupChange;
    } catch (err) {
      arr.remove(this.changeGroupStack, groupChange);
      throw err;
    } finally {
      if (captureValues) this.recordingChangesDepth--;
    }
  }

  dontRecordChangesWhile (targetMorph, whileFn) {
    if (atomicState.activeManager && !this._recovering) {
      this._rejectAtomic('Recording suppression is unsupported in a transaction', 'dont-record', targetMorph);
    }
    return this.groupChangesWhile(targetMorph, undefined, whileFn, false);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // listen for changes / record changes

  recordChangesWhile (whileFn, optFilter) {
    const from = this.changes.length;
    this.recordingChangesDepth++;
    try { whileFn(); } finally { this.recordingChangesDepth--; }
    const changes = this.changes.slice(from, this.changes.length);
    return optFilter ? changes.filter(optFilter) : changes;
  }

  addChangeListener (listenFn) {
    arr.pushIfNotIncluded(this.changeRecordedListeners, listenFn);
  }

  addCommittedChangeListener (listenFn, { containsMorph } = {}) {
    arr.pushIfNotIncluded(this.committedChangeListeners, listenFn);
    this.committedChangeListenerScopes.set(listenFn, containsMorph);
    return listenFn;
  }

  removeCommittedChangeListener (listenFn) {
    arr.remove(this.committedChangeListeners, listenFn);
    this.committedChangeListenerScopes.delete(listenFn);
  }

  hasCommittedListenerFor (morph) {
    return this.committedChangeListeners.some(listener => {
      const containsMorph = this.committedChangeListenerScopes.get(listener);
      return !containsMorph || containsMorph(morph);
    });
  }

  removeChangeListener (listenFn) {
    arr.remove(this.changeRecordedListeners, listenFn);
  }

  informChangeListeners (change) {
    // optimized version if lively.binings.signal
    this.changeRecordedListeners.forEach(fn => fn(change));
  }

  _addValueChangeAtomic (morph, prop, value, meta) {
    this._assertAtomicAccess(morph);
    return atomicState.descriptors.addValueChange.value.call(this, morph, prop, value, meta);
  }

  _informCommittedAtomic (change) {
    if (this._atomicFrame) return null;
    return atomicState.descriptors.informCommittedChangeListeners.value.call(this, change);
  }

  informCommittedChangeListeners (change) {
    if (!this.committedChangeListeners.length) return null;
    const legacyChanges = leafChangesOf(change);
    const listeners = this.committedChangeListeners.filter(listener => {
      const containsMorph = this.committedChangeListenerScopes.get(listener);
      return !containsMorph || [change, ...legacyChanges].some(legacyChange =>
        [legacyChange.target, legacyChange.morph, ...(legacyChange.owners || [])]
          .some(morph => morph && containsMorph(morph)));
    });
    if (!listeners.length) return null;
    const normalizedTextReplacement = change.selector === 'replace' &&
      change.target?.isText &&
      change.meta?.partOfTextAndAttributesAssignment !== true &&
      Array.isArray(change.meta?.prevTextAndAttributes);
    let operations = legacyChanges
      .map(legacyChange => legacyChange.operation)
      .filter(Boolean);
    if (normalizedTextReplacement) {
      operations = [new SetMorphProperty({
        targetId: change.target.id,
        property: 'textAndAttributes',
        before: change.meta.prevTextAndAttributes,
        after: change.target.textAndAttributes,
        metadata: {
          ...change.meta,
          acceptAlreadyApplied: true,
          textReplacement: true
        }
      })];
    }
    if (!operations.length) return null;
    const meta = { ...(change.meta || operations[0].metadata) };
    const changeSet = new MorphicChangeSet({
      id: `legacy-morphic-change-${this.commitCounter++}`,
      label: change.selector || change.prop || change.type,
      origin: meta.origin || 'user',
      undoable: meta.undoable !== false,
      operations,
      metadata: meta
    });
    const context = committedChangeContext(
      normalizedTextReplacement
        ? [change]
        : legacyChanges,
      change
    );
    this._activeCommitDeliveries.push(context);
    try {
      listeners.forEach(listener => {
        try { listener(changeSet, context); } catch (error) {
          console.error(`Error in committed change listener: ${error.stack}`);
        }
      });
    } finally {
      this._activeCommitDeliveries.pop();
      if (this._usedCommitDeliveries.length) this._closeCommitDelivery(context);
    }
    return changeSet;
  }

  recordChangesStart (optFilter, optName = '') {
    // change recorder is a change listener that is identified by id

    // Recorder object to be used to record specific changes when they occur,
    // based on change listeners
    const id = obj.newKeyIn(this.changeRecorders, optName + '__change_recorder_' + Date.now());
    const listener = optFilter
      ? change => optFilter(change) && recorder.changes.push(change) // eslint-disable-line no-use-before-define
      : change => recorder.changes.push(change); // eslint-disable-line no-use-before-define
    let recorder = this.changeRecorders[id] = { id, filter: optFilter, changes: [], listener };

    this.addChangeListener(listener);

    return recorder;
  }

  recordChangesStop (id) {
    if (!(id in this.changeRecorders)) return [];
    const { changes, listener } = this.changeRecorders[id];
    delete this.changeRecorders[id];
    this.removeChangeListener(listener);
    return changes;
  }

  recordChangesStartForMorph (morph, optFilter) {
    const recorder = this.recordChangesStart(optFilter, morph.id);

    // store recorder alongside morph for easy lookup and
    // to make it easy to just start / stop recordings
    // without having to manage listener storage and its lifetime

    let perMorph = this.changeRecordersPerMorph.get(morph);
    if (!perMorph) {
      perMorph = [];
      this.changeRecordersPerMorph.set(morph, perMorph);
    }
    perMorph.push(recorder.id);

    return recorder;
  }

  recordChangesStopForMorph (morph, optId) {
    const perMorph = this.changeRecordersPerMorph.get(morph);
    if (!perMorph || !perMorph.length) {
      console.warn(`Cannot endMorphChangeRecorder for morph ${morph}: recorder not found`);
      return [];
    }

    let id = optId;
    if (!optId) id = perMorph.pop();
    else arr.remove(perMorph, id);

    return this.recordChangesStop(id);
  }
}
