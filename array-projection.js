// show-in-doc
// Accessor to sub-ranges of arrays. This is used, for example, for rendering
// large lists or tables in which only a part of the items should be used for
// processing or rendering. An array projection provides convenient access and
// can apply operations to sub-ranges.

function create(array, length, optStartIndex) {
  // Example:
  // arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 1)
  // // => { array: [/*...*/], from: 1, to: 5 }
  var startIndex = optStartIndex || 0;
  if (startIndex + length > array.length)
    startIndex -= startIndex + length - array.length;
  return {array, from: startIndex, to: startIndex+length}
}

function toArray(projection) {
  // show-in-doc
  return projection.array.slice(projection.from, projection.to);
}

function originalToProjectedIndex(projection, index) {
  // Maps index from original Array to projection.
  // Example:
  //   var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
  //   arrayProjection.originalToProjectedIndex(proj, 1) // => null
  //   arrayProjection.originalToProjectedIndex(proj, 3) // => 0
  //   arrayProjection.originalToProjectedIndex(proj, 5) // => 2
  return index < projection.from || index >= projection.to ?
    null : index - projection.from;
}

function projectedToOriginalIndex(projection, index) {
  // Inverse to `originalToProjectedIndex`.
  // Example:
  //   var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
  //   arrayProjection.projectedToOriginalIndex(proj, 1) // => 4
  if (index < 0  || index > projection.to - projection.from) return null;
  return projection.from + index;
}

function transformToIncludeIndex(projection, index) {
  // Computes how the projection needs to shift minimally (think "scroll"
  // down or up) so that index becomes "visible" in projection.
  // Example:
  // var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
  // arrayProjection.transformToIncludeIndex(proj, 1)
  // // => { array: [/*...*/], from: 1, to: 5 }
  if (!(index in projection.array)) return null;
  var delta = 0;
  if (index < projection.from) delta = -projection.from+index;
  if (index >= projection.to) delta = index-projection.to+1;
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
}