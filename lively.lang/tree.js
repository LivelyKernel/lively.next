/*
 * Methods for traversing and transforming tree structures.
 */

import { flatten } from './array.js';

function prewalk (treeNode, iterator, childGetter, counter = { i: 0 }, depth = 0) {
  let i = counter.i++;
  iterator(treeNode, i, depth);
  (childGetter(treeNode, i, depth) || [])
    .forEach(ea => prewalk(ea, iterator, childGetter, counter, depth + 1));
}

function postwalk (treeNode, iterator, childGetter, counter = { i: 0 }, depth = 0) {
  let i = counter.i++;
  (childGetter(treeNode, i, depth) || [])
    .forEach(ea => postwalk(ea, iterator, childGetter, counter, depth));
  iterator(treeNode, i, depth);
}

function find (treeNode, testFunc, childGetter) {
  // Traverses a `treeNode` recursively and returns the first node for which
  // `testFunc` returns true. `childGetter` is a function to retrieve the
  // children from a node.
  if (testFunc(treeNode)) return treeNode;
  let children = childGetter(treeNode);
  if (!children || !children.length) return undefined;
  for (let i = 0; i < children.length; i++) {
    let found = find(children[i], testFunc, childGetter);
    if (found) return found;
  }
  return undefined;
}
let detect = find;

function filter (treeNode, testFunc, childGetter) {
  // Traverses a `treeNode` recursively and returns all nodes for which
  // `testFunc` returns true. `childGetter` is a function to retrieve the
  // children from a node.
  let result = [];
  if (testFunc(treeNode)) result.push(treeNode);
  return result.concat(
    flatten((childGetter(treeNode) || []).map(function (n) {
      return filter(n, testFunc, childGetter);
    })));
}

function map (treeNode, mapFunc, childGetter, depth = 0) {
  // Traverses a `treeNode` recursively and call `mapFunc` on each node. The
  // return values of all mapFunc calls is the result. `childGetter` is a
  // function to retrieve the children from a node.
  return [mapFunc(treeNode, depth)].concat(
    flatten((childGetter(treeNode) || [])
      .map(n => map(n, mapFunc, childGetter, depth + 1))));
}

function mapTree (treeNode, mapFunc, childGetter, depth = 0) {
  // Traverses the tree and creates a structurally identical tree but with
  // mapped nodes
  let mappedNodes = (childGetter(treeNode) || [])
    .map(n => mapTree(n, mapFunc, childGetter, depth + 1));
  return mapFunc(treeNode, mappedNodes, depth);
}

export {
  prewalk,
  postwalk,
  find,
  detect, filter,
  map,
  mapTree
};
