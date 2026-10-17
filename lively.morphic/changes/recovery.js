import {
  SetMorphProperty, MoveMorph, ReplaceText, MorphicValueSemantics,
  attachedMorph, detachedMorph, cloneSnapshotContainers
} from './operations.js';
import { MorphicTransactionUnsupportedError, MorphicRollbackError } from './errors.js';
import { journalUnits } from './derived.js';

/** Reject opaque handlers before any effect. */
export function assertSupportedOperation (operation) {
  if (!operation || ![SetMorphProperty.prototype, MoveMorph.prototype, ReplaceText.prototype]
    .includes(Object.getPrototypeOf(operation))) {
    throw new MorphicTransactionUnsupportedError('Unsupported morphic operation', {
      kind: operation?.kind || 'unknown', targetId: operation?.targetId
    });
  }
}

/** Read an exact ownership endpoint, including hand ownership. */
export function attachmentOf (morph) {
  const localState = morph.isMorph ? Object.freeze({
    position: Object.freeze(morph.position.copy()), rotation: morph.rotation, scale: morph.scale
  }) : null;
  return morph.owner
    ? attachedMorph({
        ownerId: morph.owner.id,
        index: (morph.owner.submorphs || morph.owner.children).indexOf(morph),
        transform: morph.getTransform?.().copy(),
        localState
      })
    : detachedMorph({ localState });
}

/** Compare matrix values independently of key order and signed zero. */
export function transformsEqual (left, right) {
  return ['a', 'b', 'c', 'd', 'e', 'f'].every(key => left[key] === right[key]);
}

/** Compare the recorded owner, index and optional local transform. */
export function attachmentsEqual (left, right) {
  return left.kind === right.kind && left.ownerId === right.ownerId &&
    left.index === right.index && (!right.transform || transformsEqual(left.transform, right.transform)) &&
    (!right.localState || left.localState &&
      left.localState.position.equals(right.localState.position) &&
      left.localState.rotation === right.localState.rotation && left.localState.scale === right.localState.scale);
}

/** Use the value policy captured by the operation, not a later registration. */
export function propertyEquals (value, expected, operation) {
  return operation.valueSemantics === MorphicValueSemantics.SNAPSHOT
    ? operation.snapshotValuesEqual(operation.snapshotValue(value), expected)
    : Object.is(value, expected);
}

/** Read a property through the supplied runtime context. */
export function readProperty (context, morph, property) {
  return context.readMorphProperty ? context.readMorphProperty(morph, property) : morph[property];
}

/** Capture actual state before attempting an operation, including its failing write. */
export function captureRecovery (operation, context, { rawState = false } = {}) {
  assertSupportedOperation(operation);
  const target = context.resolveMorph(operation.targetId);
  if (!target) throw new Error(`Cannot resolve morph ${operation.targetId}`);
  if (operation instanceof ReplaceText) return context.captureTextRecovery(target, operation);
  if (operation instanceof SetMorphProperty) {
    // ValueChange is a raw state leaf; public getters can initialize another leaf.
    const read = rawState && target.isMorph ? () => target.getProperty(operation.property) : () => readProperty(context, target, operation.property);
    const current = read();
    const before = operation.valueSemantics === MorphicValueSemantics.SNAPSHOT
      ? cloneSnapshotContainers(operation.snapshotValue(current), true)
      : current;
    return {
      operation,
      restored: () => propertyEquals(read(), before, operation),
      restore: () => {
        const value = operation.valueSemantics === MorphicValueSemantics.SNAPSHOT
          ? operation.materializeValue(cloneSnapshotContainers(before)) : before;
        if (rawState && target.isMorph) target.setProperty(operation.property, value);
        else if (context.setMorphProperty) context.setMorphProperty(target, operation.property, value, operation);
        else target[operation.property] = value;
      }
    };
  }
  const before = attachmentOf(target);
  const transform = target.getTransform?.().copy();
  const owners = [target.owner, context.resolveMorph(operation.to.ownerId)].filter(Boolean);
  return {
    operation,
    owners,
    restored: () => attachmentsEqual(attachmentOf(target), before) &&
      (!transform || transformsEqual(target.getTransform(), transform)) &&
      owners.every(owner => {
        const children = owner.submorphs || owner.children;
        return children.filter(child => child === target).length === (owner.id === before.ownerId ? 1 : 0);
      }),
    restore: () => {
      if (context.restoreMoveMorph) context.restoreMoveMorph(target, before, transform, owners);
      else context.moveMorph(target, attachmentOf(target), { ...before, transform });
    }
  };
}

/** Verification, rather than an inverse's return/throw, decides completeness. */
export function recover (journal, { reconcileUnit } = {}) {
  const rollbackErrors = [];
  const unreversedOperations = [];
  const diagnostics = [];
  const units = reconcileUnit ? journalUnits(journal).reverse() : journal.slice().reverse().map(entry => ({ entry }));
  for (const unit of units) {
    const { entry } = unit;
    if (reconcileUnit && [SetMorphProperty, MoveMorph, ReplaceText].some(Type => entry.operation instanceof Type)) {
      let result;
      try { result = reconcileUnit(unit); } catch (error) {
        if (error instanceof MorphicRollbackError) {
          diagnostics.push(...error.rollbackErrors);
          rollbackErrors.push(...error.rollbackErrors);
          unreversedOperations.push(...error.unreversedOperations);
        }
        const pair = { operation: entry.operation, error };
        diagnostics.push(pair);
        rollbackErrors.push(pair);
        unreversedOperations.push(entry.operation);
        continue;
      }
      diagnostics.push(...result.diagnostics);
      rollbackErrors.push(...result.rollbackErrors);
      unreversedOperations.push(...result.unreversedOperations);
      continue;
    }
    let error;
    let hasError = false;
    let restored = false;
    try { restored = entry.restored(); } catch (failure) { error = failure; hasError = true; }
    if (!restored) {
      try { entry.restore(); } catch (failure) { error = failure; hasError = true; }
      try { restored = entry.restored(); } catch (failure) { if (!hasError) { error = failure; hasError = true; } }
    }
    if (hasError) diagnostics.push({ operation: entry.operation, error });
    if (!restored) {
      rollbackErrors.push({
        operation: entry.operation,
        error: hasError ? error : new Error('Rollback did not restore the operation state')
      });
      unreversedOperations.push(entry.operation);
    }
  }
  return { rollbackErrors, unreversedOperations, diagnostics };
}
