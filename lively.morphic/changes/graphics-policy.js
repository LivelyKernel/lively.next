import { Point, Rectangle, Transform, Color } from 'lively.graphics';
import { isSnapshotContainer } from './operations.js';

const prototypes = [Point.prototype, Rectangle.prototype, Transform.prototype, Color.prototype];
// Mixed endpoints must not turn an unrelated array/object into a value snapshot.
class ReferenceEndpoint {
  constructor (value) { this.value = value; Object.freeze(this); }
}
/** Subclasses and unrelated equals methods retain reference semantics. */
function listed (value) { return value && prototypes.includes(Object.getPrototypeOf(value)); }
/** Materialize a fresh graphics value or the exact retained reference. */
function copy (value) {
  if (value instanceof ReferenceEndpoint) return value.value;
  if (!listed(value)) return value;
  return value.copy ? value.copy() : Object.assign(Object.create(Color.prototype), value);
}
/** Copy graphics endpoints without cloning unrelated mixed endpoint containers. */
function snapshot (value) {
  return listed(value) ? Object.freeze(copy(value)) : isSnapshotContainer(value) ? new ReferenceEndpoint(value) : value;
}
/** Only the closed graphics list compares by value. */
function equal (left, right) {
  if (left instanceof ReferenceEndpoint) left = left.value;
  if (right instanceof ReferenceEndpoint) right = right.value;
  return Object.is(left, right) || listed(left) && listed(right) &&
    Object.getPrototypeOf(left) === Object.getPrototypeOf(right) && left.equals(right);
}

/** Atomic capture only; explicit property policies and legacy recording keep their contracts. */
export function graphicsValuePolicy (before, after) {
  return listed(before) || listed(after)
    ? { valueSemantics: 'snapshot', snapshotValue: snapshot, materializeValue: copy, snapshotValuesEqual: equal } : {};
}
