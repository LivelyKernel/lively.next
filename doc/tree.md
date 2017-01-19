## tree.js


* Methods for traversing and transforming tree structures.


<!--*no toc!*-->

#### <a name="find"></a>find(treeNode, testFunc, childGetter)

 Traverses a `treeNode` recursively and returns the first node for which
 `testFunc` returns true. `childGetter` is a function to retrieve the
 children from a node.

#### <a name="filter"></a>filter(treeNode, testFunc, childGetter)

 Traverses a `treeNode` recursively and returns all nodes for which
 `testFunc` returns true. `childGetter` is a function to retrieve the
 children from a node.

#### <a name="map"></a>map(treeNode, mapFunc, childGetter, )

 Traverses a `treeNode` recursively and call `mapFunc` on each node. The
 return values of all mapFunc calls is the result. `childGetter` is a
 function to retrieve the children from a node.

#### <a name="mapTree"></a>mapTree(treeNode, mapFunc, childGetter, )

 Traverses the tree and creates a structurally identical tree but with
 mapped nodes