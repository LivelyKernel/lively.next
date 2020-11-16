/*
Computation over graphs. Unless otherwise specified a graph is a simple JS
object whose properties are interpreted as nodes that refer to arrays whose
elements describe edges. Example:

```js
var testGraph = {
  "a": ["b", "c"],
  "b": ["c", "d", "e", "f"],
  "d": ["c", "f"],
  "e": ["a", "f"],
  "f": []
}
```
*/

import { range, shuffle, withoutAll, flatten, uniq } from './array.js';
import { values } from './object.js';

// show-in-doc
function clone (graph) {
  // return a copy of graph map
  const cloned = {};
  for (const id in graph) { cloned[id] = graph[id].slice(); }
  return cloned;
}

function without (graph, ids) {
  // return a copy of graph map with ids removed
  const cloned = {};
  for (const id in graph) {
    if (ids.includes(id)) continue;
    cloned[id] = [];
    const refs = graph[id];
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      if (!ids.includes(ref)) { cloned[id].push(ref); }
    }
  }
  return cloned;
}

function hull (g, id, ignoredKeyList = [], maxDepth = Infinity) {
  // Takes a graph in object format and a start id and then traverses the
  // graph and gathers all nodes that can be reached from that start id.
  // Returns a list of those nodes.
  // Optionally use `ignore` list to filter out certain nodes that shouldn't
  // be considered and maxDepth to stop early. By default a maxDepth of 20 is
  // used.
  // Example:
  // var testGraph = {
  // "a": ["b", "c"],
  // "b": ["c", "d", "e", "f"],
  // "d": ["c", "f"],
  // "e": ["a", "f"],
  // "f": []
  // }
  // hull(testGraph, "d") // => ["c", "f"]
  // hull(testGraph, "e") // => ['a', 'f', 'b', 'c', 'd', 'e']
  // hull(testGraph, "e", ["b"]) // => ["a", "f", "c"]

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // below is an optimized variant, the functional but slow version:
  // return uniq(
  //         flatten(
  //           values(
  //             subgraphReachableBy(
  //               graphMap, id, ignore, maxDepth))));

  if (!Array.isArray(g[id])) return [];

  const hull = [];
  const visited = {};

  const ignoredKeys = {};
  for (let i = 0; i < ignoredKeyList.length; i++) { ignoredKeys[ignoredKeyList[i]] = true; }
  const toVisitList = g[id].slice();
  const toVisitMapAndDistFromRoot = {};
  for (let i = toVisitList.length; i--;) {
    const key = toVisitList[i];
    if (key in ignoredKeys) toVisitList.splice(i, 1);
    else toVisitMapAndDistFromRoot[key] = 1;
  }

  if (ignoredKeyList) {
    while (true) {
      if (toVisitList.length === 0) break;
      for (let i = 0; i < toVisitList.length; i++) {
        const key = toVisitList.shift();
        if (key in visited || key in ignoredKeys) continue;
        const dist = toVisitMapAndDistFromRoot[key] || 0;
        if (dist > maxDepth) continue;
        hull.push(key);
        visited[key] = true;
        const refs = g[key];
        if (!refs) continue;
        for (let j = 0; j < refs.length; j++) {
          const refKey = refs[j];
          if (refKey in visited || refKey in toVisitMapAndDistFromRoot) continue;
          toVisitMapAndDistFromRoot[refKey] = dist + 1;
          toVisitList.push(refKey);
        }
      }
    }
  }
  return hull;
}

function subgraphReachableBy (graphMap, startId, ignore, maxDepth = Infinity) {
  // show-in-doc
  // Like hull but returns subgraph map of `graphMap`
  // Example:
  // subgraphReachableBy(testGraph, "e", [], 2);
  // // => {e: [ 'a', 'f' ], a: [ 'b', 'c' ], f: []}
  if (ignore) graphMap = without(graphMap, ignore);
  const ids = [startId]; let step = 0; const subgraph = {};
  while (ids.length && step++ < maxDepth) {
    const id = ids.shift();
    if (subgraph[id]) continue;
    const newIds = graphMap[id] || [];
    subgraph[id] = newIds;
    ids.push(...newIds);
  }
  return subgraph;
}

function invert (g) {
  // inverts the references of graph object `g`.
  // Example:
  // invert({a: ["b"], b: ["a", "c"]})
  //   // => {a: ["b"], b: ["a"], c: ["b"]}
  const inverted = {};
  for (const key in g) {
    const refs = g[key];
    for (let i = 0; i < refs.length; i++) {
      const key2 = refs[i];
      if (!inverted[key2]) inverted[key2] = [key];
      else inverted[key2].push(key);
    }
  }
  return inverted;
}

function sortByReference (depGraph, startNode) {
  // Sorts graph into an array of arrays. Each "bucket" contains the graph
  // nodes that have no other incoming nodes than those already visited. This
  // means, we start with the leaf nodes and then walk our way up.
  // This is useful for computing how to traverse a dependency graph: You get
  // a sorted list of dependencies that also allows circular references.
  // Example:
  // var depGraph = {a: ["b", "c"], b: ["c"], c: ["b"]};
  // sortByReference(depGraph, "a");
  // // => [["c"], ["b"], ["a"]]

  // establish unique list of keys
  const remaining = []; const remainingSeen = {}; const uniqDepGraph = {}; const inverseDepGraph = {};
  for (const key in depGraph) {
    if (!remainingSeen.hasOwnProperty(key)) {
      remainingSeen[key] = true;
      remaining.push(key);
    }
    const deps = depGraph[key]; const uniqDeps = {};
    if (deps) {
      uniqDepGraph[key] = [];
      for (const dep of deps) {
        if (uniqDeps.hasOwnProperty(dep) || key === dep) continue;
        const inverse = inverseDepGraph[dep] || (inverseDepGraph[dep] = []);
        if (!inverse.includes(key)) inverse.push(key);
        uniqDeps[dep] = true;
        uniqDepGraph[key].push(dep);
        if (!remainingSeen.hasOwnProperty(dep)) {
          remainingSeen[dep] = true;
          remaining.push(dep);
        }
      }
    }
  }

  // for each iteration find the keys with the minimum number of dependencies
  // and add them to the result group list
  const groups = [];
  while (remaining.length) {
    let minDepCount = Infinity; var minKeys = []; let minKeyIndexes = []; let affectedKeys = [];
    for (var i = 0; i < remaining.length; i++) {
      var key = remaining[i];
      const deps = uniqDepGraph[key] || [];
      if (deps.length > minDepCount) continue;

      // if (deps.length === minDepCount && !minKeys.some(ea => deps.includes(ea))) {
      if (deps.length === minDepCount && !deps.some(ea => minKeys.includes(ea))) {
        minKeys.push(key);
        minKeyIndexes.push(i);
        affectedKeys.push(...inverseDepGraph[key] || []);
        continue;
      }
      minDepCount = deps.length;
      minKeys = [key];
      minKeyIndexes = [i];
      affectedKeys = (inverseDepGraph[key] || []).slice();
    }
    for (var i = minKeyIndexes.length; i--;) {
      var key = remaining[minKeyIndexes[i]];
      inverseDepGraph[key] = [];
      remaining.splice(minKeyIndexes[i], 1);
    }
    for (var key of affectedKeys) {
      uniqDepGraph[key] = uniqDepGraph[key].filter(ea => !minKeys.includes(ea));
    }
    groups.push(minKeys);
  }
  return groups;
}

function reduce (doFunc, graph, rootNode, carryOver, ignore, context) {
  // Starts with `rootNode` and visits all (in)directly related nodes, calling
  // `doFunc` at each node. The result of `doFunc` is passed as first
  // argument to the next iterator call. For the first call the value
  // `carryOver` is used.
  // Example:
  // var depGraph = {a: ["b", "c"],b: ["c"]}
  // graphReduce((_, ea, i) => console.log("%s %s", ea, i), depGraph, "a")

  let visitedNodes = ignore || []; let index = 0;
  iterator(rootNode);
  return carryOver;

  function iterator (currentNode) {
    if (visitedNodes.indexOf(currentNode) > -1) return;
    carryOver = doFunc.call(context, carryOver, currentNode, index++);
    visitedNodes = visitedNodes.concat([currentNode]);
    const next = withoutAll(graph[currentNode] || [], visitedNodes);
    next.forEach(function (ea) { return iterator(ea); });
  }
}

function random (nKeys = 10) {
  const g = {}; const keys = range(1, nKeys).map(String);
  for (let i = 0; i < keys.length; i++) {
    const r = Math.floor(Math.random() * nKeys);
    g[keys[i]] = shuffle(keys).slice(0, r);
  }
  return g;
}

export {
  clone, without, hull, subgraphReachableBy, invert, sortByReference, reduce,
  random
};
