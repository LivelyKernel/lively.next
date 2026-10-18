/* global Proxy, WeakMap, Reflect */
import { MorphicTransactionUnsupportedError } from './errors.js';
import { recover } from './recovery.js';

const guardedStates = new WeakMap();

/** Compare data or accessor descriptors without invoking user getters. */
function descriptorsEqual (left, right) {
  return !!left && !!right && Object.is(left.value, right.value) &&
    left.get === right.get && left.set === right.set &&
    left.writable === right.writable && left.enumerable === right.enumerable &&
    left.configurable === right.configurable;
}

/** Check shallow slots, prototype and extensibility through the retained raw object. */
function stateMatches (guard) {
  if (Reflect.ownKeys(guard.state).length !== guard.keys.length ||
      Object.getPrototypeOf(guard.state) !== guard.prototype ||
      Object.isExtensible(guard.state) !== guard.extensible) return false;
  for (const key of guard.keys) {
    if (!descriptorsEqual(Object.getOwnPropertyDescriptor(guard.state, key), guard.expected[key])) return false;
  }
  return true;
}

/** Plain assignment preserves the instance shape; redefinition is recovery only. */
function restoreSlot (morph, descriptor) {
  const actual = Object.getOwnPropertyDescriptor(morph, '_morphicState');
  if (descriptorsEqual(actual, descriptor)) return;
  if (actual && 'value' in actual && descriptorsEqual({ ...actual, value: descriptor.value }, descriptor)) {
    morph._morphicState = descriptor.value;
  } else Object.defineProperty(morph, '_morphicState', descriptor);
}

/** Attempt every shallow repair so one irreversible slot cannot mask other recovery. */
function restoreRawState (guard) {
  const errors = [];
  const attempt = fn => { try { fn(); } catch (error) { errors.push(error); } };
  for (const key of Reflect.ownKeys(guard.state)) {
    if (!Object.hasOwn(guard.expected, key)) attempt(() => { delete guard.state[key]; });
  }
  for (const key of Reflect.ownKeys(guard.expected)) {
    if (!descriptorsEqual(Object.getOwnPropertyDescriptor(guard.state, key), guard.expected[key])) {
      attempt(() => Object.defineProperty(guard.state, key, guard.expected[key]));
    }
  }
  if (Object.getPrototypeOf(guard.state) !== guard.prototype) attempt(() => Object.setPrototypeOf(guard.state, guard.prototype));
  if (!guard.extensible && Object.isExtensible(guard.state)) attempt(() => Object.preventExtensions(guard.state));
  if (errors.length) throw errors[0];
}

/** Guard enlisted shallow slots without redefining properties or wrapping callbacks. */
export function guardMorphState (manager, frame, morph) {
  if (!morph) return;
  const existing = frame.stateGuards.get(morph);
  if (existing) {
    // Do not capture a later operation's before-value from already damaged state.
    if (!manager._recovering) {
      const violation = captureGuardViolations(frame, existing);
      if (violation) manager._rejectAtomic(violation.message, violation.kind, morph, 'after');
    }
    return;
  }
  // Operation contexts also support plain models without morphic state.
  if (!morph.isMorph && !Object.hasOwn(morph, '_morphicState') && !guardedStates.has(morph)) return;
  // A newly enlisted nested target remains guarded for the enclosing scope too.
  if (frame.parent) guardMorphState(manager, frame.parent, morph);
  const parent = guardedStates.get(morph);
  const descriptor = Object.getOwnPropertyDescriptor(morph, '_morphicState');
  const state = parent ? parent.state : descriptor?.value;
  if (!descriptor || !('value' in descriptor) || !descriptor.writable || !state || typeof state !== 'object') {
    manager._rejectAtomic('Morph state requires a writable own data slot', 'state-descriptor', morph);
  }
  const reject = () => manager._rejectAtomic('Direct morph state mutation is unsupported', 'direct-state', morph);
  const { proxy, revoke } = Proxy.revocable(state, {
    set: reject,
    deleteProperty: reject,
    defineProperty: reject,
    setPrototypeOf: reject,
    preventExtensions: reject
  });
  const guard = {
    morph, state, parent, descriptor, proxy, revoke,
    expected: Object.getOwnPropertyDescriptors(state), keys: Reflect.ownKeys(state),
    slot: { ...descriptor, value: proxy },
    prototype: Object.getPrototypeOf(state), extensible: Object.isExtensible(state)
  };
  guard.cleanup = {
    operation: { kind: 'state-guard-cleanup', targetId: morph.id },
    restored: () => descriptorsEqual(Object.getOwnPropertyDescriptor(morph, '_morphicState'), descriptor) && stateMatches(guard),
    restore: () => {
      try { if (!stateMatches(guard)) restoreRawState(guard); } finally { restoreSlot(morph, descriptor); }
    }
  };
  frame.stateGuards.set(morph, guard);
  frame.journal.unshift(guard.cleanup);
  guardedStates.set(morph, guard);
  morph._morphicState = proxy;
}

/** Journal each kind of unrecorded damage once per savepoint. */
function captureGuardViolations (frame, guard) {
  // Clean enlistment needs no damage records or recovery closures.
  const slot = guard.slot;
  if (descriptorsEqual(Object.getOwnPropertyDescriptor(guard.morph, '_morphicState'), slot) && stateMatches(guard)) return null;
  let violation = null;
  const damage = [
    { kind: 'state-slot', restored: () => descriptorsEqual(Object.getOwnPropertyDescriptor(guard.morph, '_morphicState'), slot), restore: () => restoreSlot(guard.morph, slot) },
    { kind: 'direct-state-alias', restored: () => stateMatches(guard), restore: () => restoreRawState(guard) }
  ];
  for (const entry of damage) {
    if (entry.restored()) continue;
    const error = new MorphicTransactionUnsupportedError('Unrecorded morph state mutation detected at scope exit', {
      kind: entry.kind, targetId: guard.morph.id, detection: 'after'
    });
    violation ||= error;
    guard.damages ||= new Set();
    if (guard.damages.has(entry.kind)) continue;
    guard.damages.add(entry.kind);
    frame.journal.push({ ...entry, operation: { kind: entry.kind, targetId: guard.morph.id } });
  }
  return violation;
}

/** Capture after-effect alias/slot damage before reversing the recorded operations. */
export function captureStateGuardViolations (frame) {
  let violation = null;
  for (const guard of frame.stateGuards.values()) {
    const error = captureGuardViolations(frame, guard);
    violation ||= error;
  }
  return violation;
}

/** Visit the live set after recovery: reactions may have enlisted new guards. */
export function restoreStateGuards (frame) {
  const result = { rollbackErrors: [], unreversedOperations: [], diagnostics: [] };
  for (const guard of frame.stateGuards.values()) {
    const cleanup = recover([guard.cleanup]);
    result.rollbackErrors.push(...cleanup.rollbackErrors);
    result.unreversedOperations.push(...cleanup.unreversedOperations);
    result.diagnostics.push(...cleanup.diagnostics);
  }
  if (frame.parent && !result.unreversedOperations.length) {
    const cleanups = new Set([...frame.stateGuards.values()].map(guard => guard.cleanup));
    frame.journal = frame.journal.filter(entry => !cleanups.has(entry));
  }
  return result;
}

/** An unrestored live slot must remain readable, even after incomplete recovery. */
export function releaseStateGuards (frame) {
  for (const guard of [...frame.stateGuards.values()].reverse()) {
    if (!descriptorsEqual(Object.getOwnPropertyDescriptor(guard.morph, '_morphicState'), guard.descriptor)) continue;
    guard.revoke();
    if (guard.parent) guardedStates.set(guard.morph, guard.parent);
    else guardedStates.delete(guard.morph);
  }
  frame.stateGuards.clear();
}

/** Bypass the proxy for this engine assignment only; observers get no permit. */
export function writeRecordedState (morph, property, value) {
  const guard = guardedStates.get(morph);
  const state = guard ? guard.state : morph._morphicState;
  state[property] = value;
  for (let current = guard; current; current = current.parent) {
    if (!Object.hasOwn(current.expected, property)) current.keys.push(property);
    current.expected[property] = Object.getOwnPropertyDescriptor(state, property);
  }
}
