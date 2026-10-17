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
  SetMorphProperty,
  attachedMorph,
  detachedMorph,
  inferredValueSemantics
} from './changes/operations.js';

import { operationContext } from './changes/operation-context.js';
import { captureRecovery, recover, assertSupportedOperation, attachmentOf, propertyEquals, readProperty } from './changes/recovery.js';
import { MorphicTransactionUnsupportedError, MorphicTransactionAsyncError } from './changes/errors.js';
import { ChangeSetEditTransaction } from './undo.js';
import { guardMorphState, captureStateGuardViolations, restoreStateGuards, releaseStateGuards, writeRecordedState } from './changes/state-guard.js';

const atomicState = { activeManager: null, depth: 0, recordDescriptor: null };
const liveChangeManagers = new Set();
const atomicDispatch = new Map();

/** Restore own descriptors, including the absence of an ordinary override. */
function restoreAtomicDispatch (manager, saved) {
  for (const name of ['informCommittedChangeListeners', '_record']) {
    if (saved.descriptors[name]) Object.defineProperty(manager, name, saved.descriptors[name]);
    else delete manager[name];
  }
}

/** Guard every environment before its next write, without a permanent hot-path test. */
function installAtomicDispatch (manager) {
  if (atomicDispatch.has(manager)) return;
  const saved = {
    record: manager._record,
    committed: manager.informCommittedChangeListeners,
    descriptors: Object.fromEntries(['_record', 'informCommittedChangeListeners']
      .map(name => [name, Object.getOwnPropertyDescriptor(manager, name)]))
  };
  atomicDispatch.set(manager, saved);
  try {
    for (const [name, value] of [['_record', manager._recordAtomic], ['informCommittedChangeListeners', manager._informCommittedAtomic]]) {
      const descriptor = saved.descriptors[name];
      Object.defineProperty(manager, name, {
        ...(descriptor && 'value' in descriptor ? descriptor : { configurable: true, writable: true }), value
      });
    }
  } catch (error) {
    restoreAtomicDispatch(manager, saved);
    atomicDispatch.delete(manager);
    throw error;
  }
}

/** Install once for the synchronous outer scope; nested savepoints share dispatch. */
function enterAtomicDispatch () {
  if (atomicState.depth++) return;
  try {
    atomicState.recordDescriptor = Object.getOwnPropertyDescriptor(ChangeManager.prototype, '_record');
    ChangeManager.prototype._record = ChangeManager.prototype._recordWithAtomicNotifications;
    for (const reference of liveChangeManagers) {
      const manager = reference.deref();
      if (manager) installAtomicDispatch(manager);
      else liveChangeManagers.delete(reference);
    }
  } catch (error) {
    leaveAtomicDispatch();
    throw error;
  }
}

/** Release strong references and guards on every outermost exit. */
function leaveAtomicDispatch () {
  if (--atomicState.depth) return;
  Object.defineProperty(ChangeManager.prototype, '_record', atomicState.recordDescriptor);
  atomicState.recordDescriptor = null;
  try {
    for (const [manager, saved] of atomicDispatch) restoreAtomicDispatch(manager, saved);
  } finally { atomicDispatch.clear(); }
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
  if (!changeManager._recovering) changeManager._operationDepth = 0;
  try { informMorph(changeManager, change, morph); } finally {
    changeManager._operationDepth = operationDepth;
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
    liveChangeManagers.add(new WeakRef(this));
    if (atomicState.depth) installAtomicDispatch(this);
  }

  reset () {
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

  _enlistAtomicMorph (frame, morph) {
    this._assertAtomicAccess(morph);
    guardMorphState(this, frame, morph);
    frame.context.enlist?.(morph);
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

  _perform (frame, operation) {
    if (this._atomicFrame !== frame || frame.closed) throw new Error('Transaction scope is closed');
    this._assertAtomicAccess();
    try { assertSupportedOperation(operation); } catch (error) { failAtomicFrame(frame, error); throw error; }
    this._enlistAtomicMorph(frame, frame.context.resolveMorph(operation.targetId));
    if (operation instanceof MoveMorph) {
      this._enlistAtomicMorph(frame, frame.context.resolveMorph(operation.from.ownerId));
      this._enlistAtomicMorph(frame, frame.context.resolveMorph(operation.to.ownerId));
    }
    operation.validate(frame.context);
    const recovery = captureRecovery(operation, frame.context);
    frame.journal.push(recovery);
    this._operationDepth++;
    const previous = this._performingRecovery;
    this._performingRecovery = recovery;
    try {
      operation.apply(frame.context);
      if (!recovery.recorded) frame.operations.push(recovery);
    } catch (error) {
      failAtomicFrame(frame, error);
      throw error;
    } finally {
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
    try { rollback = recover(frame.journal); } finally {
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
      id, parent, options: opts, journal: [], operations: [], recorded: [], deferred: [], stateGuards: new Map(), closed: false, hasFailed: false, failed: undefined,
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
          value = callback(Object.freeze({ id, perform: operation => this._perform(frame, operation) }));
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
      restoreStateGuards(frame);
    } catch (error) {
      throw this._rollbackFrame(frame, error);
    } finally {
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
      return { value, changeSet, history: null };
    }
    frame.context.retainDetached?.(changeSet.operations);
    let history = null;
    this._discardAtomicRecords(frame);
    if (changeSet.operations.length && opts.undoable && !opts.undoManager.applyCount) {
      const entry = new ChangeSetEditTransaction(changeSet, this, {
        context: frame.context, groupToken: opts.undoManager.undoInProgress
      });
      const stored = opts.undoManager.addTransaction(entry, { joinActive: true, group: false });
      history = { undoManager: opts.undoManager, entry: stored };
    }
    if (changeSet.operations.length && opts.notify !== false) this._deliverAtomicCommit(changeSet, frame);
    for (const callback of frame.deferred) {
      try { callback(); } catch (error) { console.error(`Error after atomic commit: ${error.stack}`); }
    }
    return { value, changeSet, history };
  }

  _deliverAtomicCommit (changeSet, frame) {
    const legacyChanges = frame.recorded.filter(change => !(change instanceof GroupChange));
    const context = Object.freeze({
      ...frame.context,
      capturedChangeSet: changeSet,
      legacyChanges: Object.freeze(legacyChanges), committedChange: null,
      undoManager: frame.options.undoManager, commitToken: Object.freeze({})
    });
    this.committedChangeListeners.slice().forEach(listener => {
      const containsMorph = this.committedChangeListenerScopes.get(listener);
      if (containsMorph && !legacyChanges.some(change =>
        [change.target, change.morph, ...(change.owners || [])].some(morph => morph && containsMorph(morph))) &&
          !changeSet.operations.some(operation => containsMorph(frame.context.resolveMorph(operation.targetId)))) return;
      try { listener(changeSet, context); } catch (error) {
        console.error(`Error in committed change listener: ${error.stack}`);
      }
    });
  }

  applyChangeSet (changeSet, { context, direction = 'forward', origin = direction, undoManager = this.undoManager, notify = true } = {}) {
    if (!(changeSet instanceof MorphicChangeSet) || !context) throw new Error('applyChangeSet requires a change set and operation context');
    if (!['forward', 'undo', 'redo'].includes(direction)) throw new Error(`Unknown replay direction: ${direction}`);
    if (atomicState.activeManager) this._rejectAtomic('Use perform inside a transaction', 'nested-replay');
    const operations = direction === 'undo'
      ? changeSet.operations.slice().reverse().map(operation => operation.invert()) : changeSet.operations;
    const guards = new Set([this.undoManager, undoManager].filter(Boolean));
    guards.forEach(manager => manager.applyCount++);
    try {
      // The journal and recovery path are the same as a new edit; history is disabled.
      const result = this.transaction({
        label: changeSet.label, origin, undoable: false, undoManager, notify,
        metadata: { ...changeSet.metadata, originalOrigin: changeSet.origin, replayDirection: direction, replayOf: changeSet.id }
      }, tx => {
        this._atomicFrame.context = context;
        const consumedReactions = new Set();
        for (const operation of operations) {
          // An earlier replayed setter may already have produced a recorded reaction.
          const reaction = operation instanceof SetMorphProperty && this._atomicFrame.operations.find(entry => {
            const prior = entry.operation;
            return entry.causedBy && !consumedReactions.has(entry) && prior instanceof SetMorphProperty &&
              prior.targetId === operation.targetId && prior.property === operation.property &&
              prior.valueSemantics === operation.valueSemantics &&
              propertyEquals(prior.materializeValue(prior.before), operation.before, operation) &&
              propertyEquals(readProperty(context, context.resolveMorph(operation.targetId), operation.property), operation.after, operation);
          });
          if (reaction) consumedReactions.add(reaction);
          else tx.perform(operation);
        }
      });
      return result.changeSet;
    } finally { guards.forEach(manager => manager.applyCount--); }
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
          !this._structuralCaptures.some(entry => entry.morph === morph)) {
        this._enlistAtomicMorph(frame, targetMorph);
        this._enlistAtomicMorph(frame, morph);
        recovery = captureRecovery(new MoveMorph({ morphId: morph.id, from: attachmentOf(morph), to: attachmentOf(morph) }), frame.context);
        recovery.morph = morph;
        if (!recovery.owners.includes(targetMorph)) recovery.owners.push(targetMorph);
        frame.journal.push(recovery);
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
        const directLeaf = this._operationDepth && operation?.targetId === morph.id && (
          operation instanceof SetMorphProperty && change.prop === operation.property ||
          operation instanceof MoveMorph && (change instanceof StructuralChange || ['position', 'rotation', 'scale'].includes(change.prop))
        );
        if (!this._recovering && directLeaf) {
          if (!performed.recorded) {
            performed.recorded = true;
            arr.remove(frame.journal, performed);
            frame.journal.push(performed);
            frame.operations.push(performed);
          }
        } else if (!this._recovering && !(change instanceof GroupChange) && !(change instanceof StructuralChange)) {
          const captured = change.operation;
          try { assertSupportedOperation(captured); } catch (error) { failAtomicFrame(frame, error); throw error; }
          this._enlistAtomicMorph(frame, morph);
          const recovery = captureRecovery(captured, frame.context);
          recovery.causedBy = performed;
          recovery.structuralOwner = this._structuralCaptures.find(entry => entry.morph === morph &&
            ['position', 'rotation', 'scale'].includes(captured.property));
          frame.journal.push(recovery);
          frame.operations.push(recovery);
        } else if (!this._recovering && change._atomicRecovery) {
          const recovery = change._atomicRecovery;
          arr.remove(frame.journal, recovery);
          frame.journal.push(recovery);
          frame.operations.push(recovery);
        }
        frame.recorded.push(change);
      }
      return atomicDispatch.get(this).record.call(this, morph, change);
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

  _informCommittedAtomic (change) {
    if (this._atomicFrame) return null;
    return atomicDispatch.get(this).committed.call(this, change);
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
    listeners.forEach(listener => {
      try { listener(changeSet, context); } catch (error) {
        console.error(`Error in committed change listener: ${error.stack}`);
      }
    });
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
