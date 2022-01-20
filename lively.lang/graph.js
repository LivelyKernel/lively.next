/**
 * Computation over graphs. Unless otherwise specified a graph is a simple JS
 * object whose properties are interpreted as nodes that refer to arrays whose
 * elements describe edges.
 * 
 * ```js
 * var testGraph = {
 *   "a": ["b", "c"],
 *   "b": ["c", "d", "e", "f"],
 *   "d": ["c", "f"],
 *   "e": ["a", "f"],
 *   "f": []
 * }
 * ```
 * @module lively.lang/graph 
 */

import { range, shuffle, withoutAll } from './array.js';

/**
 * Returns a copy of graph map.
 * @param { Object.<string, string[]> } graph - The map to copy.
 * @returns { Object.<string, string[]> } The copy of the graph.
 */
function clone (graph) {
  const cloned = {};
  for (const id in graph) { cloned[id] = graph[id].slice(); }
  return cloned;
}

/**
 * Returns a copy of graph map with the given ids removed.
 * @param { Object.<string, string[]> } graph - The map to copy.
 * @param { string[] } ids - The list of ids to exclude in the copy.
 * @returns { Object.<string, string[]> } The (filtered) copy of the graph.
 */
function without (graph, ids) {
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

/**
 * Takes a graph in object format and a start id and then traverses the
 * graph and gathers all nodes that can be reached from that start id.
 * Returns a list of those nodes.
 * Optionally use `ignore` list to filter out certain nodes that shouldn't
 * be considered and maxDepth to stop early. By default a maxDepth of 20 is
 * used.
 * @param { Object.<string, string[]> } g - The graph to traverse.
 * @param { string } id - The id of the node to start the hull computation from.
 * @param { string[] } ignoredKeyList - The ids of the nodes to skip from the traversal.
 * @param { number } [maxDepth] - The maximum recursion depth of the traversal.
 * @returns { string[] } The list of ids of all the nodes inside the hull.
 * @example
 * var testGraph = {
 * "a": ["b", "c"],
 * "b": ["c", "d", "e", "f"],
 * "d": ["c", "f"],
 * "e": ["a", "f"],
 * "f": []
 * }
 * hull(testGraph, "d") // => ["c", "f"]
 * hull(testGraph, "e") // => ['a', 'f', 'b', 'c', 'd', 'e']
 * hull(testGraph, "e", ["b"]) // => ["a", "f", "c"]
 */
function hull (g, id, ignoredKeyList = [], maxDepth = Infinity) {
  if (!Array.isArray(g[id])) return [];

  const hull = [];
  const visited = {};

  // Below is an optimized variant.
  // The functional but slow version:
  // return uniq(
  //         flatten(
  //           values(
  //             subgraphReachableBy(
  //               graphMap, id, ignore, maxDepth))));
  
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

/**
 * Like `hull` but returns subgraph map of `graphMap`.
 * @see hull
 * @param { Object.<string, string[]> } graphMap - The graph to compute the subgraph for.
 * @param { string } startId - The id of the node to start the subgraph computation from.
 * @param { string[] } ignore - The ids of the nodes to skip from the traversal.
 * @param { number } [maxDepth] - The maximum recursion depth of the traversal.
 * @returns { Object.<string, string[]> } The subgraph reachable from `id`.
 * @example
 * subgraphReachableBy(testGraph, "e", [], 2);
 * // => {e: [ 'a', 'f' ], a: [ 'b', 'c' ], f: []}
 */
function subgraphReachableBy (graphMap, startId, ignore, maxDepth = Infinity) {
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

/**
 * Inverts the references of graph object `g`.
 * @param { Object.<string, string[]> } g - The graph to invert.
 * @returns { Object.<string, string[]> } The inverted graph.
 * @example
 * invert({a: ["b"], b: ["a", "c"]})
 *   // => {a: ["b"], b: ["a"], c: ["b"]}
 */
function invert (g) {
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

/**
 * Sorts graph into an array of arrays. Each "bucket" contains the graph
 * nodes that have no other incoming nodes than those already visited. This
 * means, we start with the leaf nodes and then walk our way up.
 * This is useful for computing how to traverse a dependency graph: You get
 * a sorted list of dependencies that also allows circular references.
 * @param { Object.<string, string[]> } depGraph - The graph to sort into buckets.
 * @param { string } startNode - The id of the node at the top of the dependency graph.
 * @returns { string[][] } The sorted sets of nodes.
 * @example
 * var depGraph = {a: ["b", "c"], b: ["c"], c: ["b"]};
 * sortByReference(depGraph, "a");
 * // => [["c"], ["b"], ["a"]]
 */
function sortByReference (depGraph, startNode) {
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
    let minDepCount = Infinity; let minKeys = []; let minKeyIndexes = []; let affectedKeys = [];
    for (let i = 0; i < remaining.length; i++) {
      let key = remaining[i];
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
    for (let i = minKeyIndexes.length; i--;) {
      let key = remaining[minKeyIndexes[i]];
      inverseDepGraph[key] = [];
      remaining.splice(minKeyIndexes[i], 1);
    }
    for (let key of affectedKeys) {
      uniqDepGraph[key] = uniqDepGraph[key].filter(ea => !minKeys.includes(ea));
    }
    groups.push(minKeys);
  }
  return groups;
}

/**
 * Starts with `rootNode` and visits all (in)directly related nodes, calling
 * `doFunc` at each node. The result of `doFunc` is passed as first
 * argument to the next iterator call. For the first call the value
 * `carryOver` is used.
 * @param { function(string, *, number): * } doFunc - The function applied to each visited node.
 * @param { Object.<string, string[]> } graph - The graph to traverse.
 * @param { string } rootNode - The id of the node to start the traversal from.
 * @param { * } carryOver - The value to feed into the first call of `doFunc`.
 * @param { Object } context - The object to bind `this` to when calling the `doFunc`.
 * @returns { * } The final result of the reducer.
 * Example:
 * var depGraph = {a: ["b", "c"],b: ["c"]}
 * reduce((_, ea, i) => console.log("%s %s", ea, i), depGraph, "a")
 */
function reduce (doFunc, graph, rootNode, carryOver, ignore, context) {
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

/**
 * Generates a graph based on a given number of ids that should appear.
 * @param { number } [nKeys=10] - The number of ids inside the generated graph.
 * @returns { Object.<string, string[]> } A graph with the provided number of ids initialized at random.
 */
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
