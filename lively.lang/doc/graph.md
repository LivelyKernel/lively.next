## graph.js


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


<!--*no toc!*-->

#### <a name="clone"></a>clone(graph)

 return a copy of graph map

#### <a name="without"></a>without(graph, ids)

 return a copy of graph map with ids removed

#### <a name="hull"></a>hull(graphMap, id, ignore, maxDepth)

 Takes a graph in object format and a start id and then traverses the
 graph and gathers all nodes that can be reached from that start id.
 Returns a list of those nodes.
 Optionally use `ignore` list to filter out certain nodes that shouldn't
 be considered and maxDepth to stop early. By default a maxDepth of 20 is
 used.
 

```js
var testGraph = {
"a": ["b", "c"],
"b": ["c", "d", "e", "f"],
"d": ["c", "f"],
"e": ["a", "f"],
"f": []
}
hull(testGraph, "d") // => ["c", "f"]
hull(testGraph, "e") // => ['a', 'f', 'b', 'c', 'd', 'e']
hull(testGraph, "e", ["b"]) // =? ["a", "f", "c"]
```

#### <a name="subgraphReachableBy"></a>subgraphReachableBy(graphMap, id, ignore, maxDepth)

Like hull but returns subgraph map of `graphMap`
 

```js
subgraphReachableBy(testGraph, "e", [], 2);
// => {e: [ 'a', 'f' ], a: [ 'b', 'c' ], f: []}
```

#### <a name="invert"></a>invert(g)

 inverts the references of graph object `g`.
 

```js
invert({a: ["b"], b: ["a", "c"]})
  // => {a: ["b"], b: ["a"], c: ["b"]}
```

#### <a name="sortByReference"></a>sortByReference(depGraph, startNode)

 Sorts graph into an array of arrays. Each "bucket" contains the graph
 nodes that have no other incoming nodes than those already visited. This
 means, we start with the leaf nodes and then walk our way up.
 This is useful for computing how to traverse a dependency graph: You get
 a sorted list of dependencies that also allows circular references.
 

```js
var depGraph = {a: ["b", "c"], b: ["c"], c: ["b"]};
sortByReference(depGraph, "a");
// => [["c"], ["b"], ["a"]]
```

#### <a name="reduce"></a>reduce(doFunc, graph, rootNode, carryOver, ignore, context)

 Starts with `rootNode` and visits all (in)directly related nodes, calling
 `doFunc` at each node. The result of `doFunc` is passed as first
 argument to the next iterator call. For the first call the value
 `carryOver` is used.
 

```js
var depGraph = {a: ["b", "c"],b: ["c"]}
graphReduce((_, ea, i) => console.log("%s %s", ea, i), depGraph, "a")
```