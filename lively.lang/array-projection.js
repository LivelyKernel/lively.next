/**
 * Accessor to sub-ranges of arrays. This is used, for example, for rendering
 * large lists or tables in which only a part of the items should be used for
 * processing or rendering.
 * 
 * An array projection provides convenient access and
 * can apply operations to sub-ranges.
 * @module lively.lang/array-projection 
 */

/** 
 * Create a projection.
 * 
 * ```
 * arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 1)
 * => { array: [/.../], from: 1, to: 5 }
 * ``` 
*/
function create (array, length, optStartIndex) {
  
  let startIndex = optStartIndex || 0;
  if (startIndex + length > array.length) { startIndex -= startIndex + length - array.length; }
  return { array, from: startIndex, to: startIndex + length };
}

/** 
 * Convert a projection back to an array.
 */
function toArray (projection) {
  return projection.array.slice(projection.from, projection.to);
}

/**
 * Maps index from original Array to projection.
 * 
 * ```
 * var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
 * arrayProjection.originalToProjectedIndex(proj, 1) => null
 * arrayProjection.originalToProjectedIndex(proj, 3) => 0
 * arrayProjection.originalToProjectedIndex(proj, 5) => 2
 * ```
 */
function originalToProjectedIndex (projection, index) {
  return index < projection.from || index >= projection.to
    ? null : index - projection.from;
}

/**
 * Inverse to `originalToProjectedIndex`.
 * ```
 * var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
 * projectedToOriginalIndex(proj, 1) => 4
 * ```
 */
function projectedToOriginalIndex (projection, index) {
 
  if (index < 0 || index > projection.to - projection.from) return null;
  return projection.from + index;
}

/**
 * Computes how the projection needs to shift minimally (think "scroll"
 * down or up) so that index becomes "visible" in projection.
 * ```
 * var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
 * arrayProjection.transformToIncludeIndex(proj, 1)
 * => { array: [/.../], from: 1, to: 5 }
 * ```
 */
function transformToIncludeIndex (projection, index) {
  if (!(index in projection.array)) return null;
  let delta = 0;
  if (index < projection.from) delta = -projection.from + index;
  if (index >= projection.to) delta = index - projection.to + 1;
  if (delta === 0) return projection;
  return create(
    projection.array,
    projection.to - projection.from,
    projection.from + delta);
}

export {
  create,
  toArray,
  originalToProjectedIndex,
  projectedToOriginalIndex,
  transformToIncludeIndex
};
