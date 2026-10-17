/* global Proxy, WeakMap, Reflect */
import { MorphicTransactionUnsupportedError } from './errors.js';

const guardedStates = new WeakMap();

/** Compare data or accessor descriptors without invoking user getters. */
function descriptorsEqual (left, right) {
  return !!left && !!right && ['value', 'get', 'set', 'writable', 'enumerable', 'configurable']
    .every(key => Object.is(left[key], right[key]));
}

/** Check shallow slots, prototype and extensibility through the retained raw object. */
function stateMatches (guard) {
  const actual = Object.getOwnPropertyDescriptors(guard.state);
  const keys = Reflect.ownKeys(guard.expected);
  return Reflect.ownKeys(actual).length === keys.length &&
    keys.every(key => descriptorsEqual(actual[key], guard.expected[key])) &&
    Object.getPrototypeOf(guard.state) === guard.prototype &&
    Object.isExtensible(guard.state) === guard.extensible;
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
    expected: Object.getOwnPropertyDescriptors(state),
    prototype: Object.getPrototypeOf(state), extensible: Object.isExtensible(state)
  };
  guard.cleanup = {
    operation: { kind: 'state-guard-cleanup', targetId: morph.id },
    restored: () => descriptorsEqual(Object.getOwnPropertyDescriptor(morph, '_morphicState'), descriptor) && stateMatches(guard),
    restore: () => {
      if (!stateMatches(guard)) restoreRawState(guard);
      restoreSlot(morph, descriptor);
    }
  };
  frame.stateGuards.set(morph, guard);
  frame.journal.unshift(guard.cleanup);
  guardedStates.set(morph, guard);
  morph._morphicState = proxy;
}

/** Journal each kind of unrecorded damage once per savepoint. */
function captureGuardViolations (frame, guard) {
  let violation = null;
  const slot = { ...guard.descriptor, value: guard.proxy };
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

/** Restore the enclosing proxy or original data value before leaving the savepoint. */
export function restoreStateGuards (frame) {
  const guards = [...frame.stateGuards.values()].reverse();
  for (const guard of guards) guard.cleanup.restore();
  if (frame.parent) {
    const cleanups = new Set(guards.map(guard => guard.cleanup));
    frame.journal = frame.journal.filter(entry => !cleanups.has(entry));
  }
}

/** Revoke captured proxies on every exit, even when recovery itself is incomplete. */
export function releaseStateGuards (frame) {
  for (const guard of [...frame.stateGuards.values()].reverse()) {
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
    current.expected[property] = Object.getOwnPropertyDescriptor(state, property);
  }
}
