## array.js


* Methods to make working with arrays more convenient and collection-like
* abstractions for groups, intervals, grids.


<!--*no toc!*-->

#### <a name="range"></a>range(begin, end, step)

 

```js
arr.range(0,5) // => [0,1,2,3,4,5]
  arr.range(0,10,2) // => [0,2,4,6,8,10]
```

#### <a name="withN"></a>withN(n, obj)

 

```js
arr.withN(3, "Hello") // => ["Hello","Hello","Hello"]
```

#### <a name="genN"></a>genN(n, generator)


 Takes a generator function that is called for each `n`.
 

```js
arr.genN(3, num.random) // => [46,77,95]
```

#### <a name="filter"></a>filter(array, iterator, context)


 Calls `iterator` for each element in `array` and returns a subset of it
 including the elements for which `iterator` returned a truthy value.
 Like `Array.prototype.filter`.

#### <a name="findAndGet"></a>findAndGet(arr, iterator)

 find the first occurence for which `iterator` returns a truthy value and
 return *this* value, i.e. unlike find the iterator result and not the
 element of the list is returned

#### <a name="filterByKey"></a>filterByKey(arr, key)


 

```js
var objects = [{x: 3}, {y: 4}, {x:5}]
  arr.filterByKey(objects, "x") // => [{x: 3},{x: 5}]
```

#### <a name="grep"></a>grep(arr, filter, context)

 [a] -> String|RegExp -> [a]
 `filter` can be a String or RegExp. Will stringify each element in
 

```js
["Hello", "World", "Lively", "User"].grep("l") // => ["Hello","World","Lively"]
```

#### <a name="mask"></a>mask(array, mask)

 select every element in array for which array's element is truthy
 

```js
[1,2,3].mask([false, true, false]) => [2]
```

#### <a name="reject"></a>reject(array, func, context)



#### <a name="rejectByKey"></a>rejectByKey(array, key)



#### <a name="without"></a>without(array, elem)

 non-mutating
 

```js
arr.without([1,2,3,4,5,6], 3) // => [1,2,4,5,6]
```

#### <a name="withoutAll"></a>withoutAll(array, otherArr)

 non-mutating
 

```js
arr.withoutAll([1,2,3,4,5,6], [3,4]) // => [1,2,5,6]
```

#### <a name="uniq"></a>uniq(array, sorted)

 non-mutating
 Removes duplicates from array.

#### <a name="uniqBy"></a>uniqBy(array, comparator, context)

 like `arr.uniq` but with custom equality: `comparator(a,b)` returns
 BOOL. True if a and be should be regarded equal, false otherwise.

#### <a name="compact"></a>compact(array)

 removes falsy values
 

```js
arr.compact([1,2,undefined,4,0]) // => [1,2,4]
```

#### <a name="mutableCompact"></a>mutableCompact(array)

 fix gaps that were created with 'delete'

#### <a name="forEach"></a>forEach(array, iterator, context)


 `iterator` is called on each element in `array` for side effects. Like
 `Array.prototype.forEach`.

#### <a name="zip"></a>zip()

 Takes any number of lists as arguments. Combines them elment-wise.
 

```js
arr.zip([1,2,3], ["a", "b", "c"], ["A", "B"])
// => [[1,"a","A"],[2,"b","B"],[3,"c",undefined]]
```

#### <a name="flatten"></a>flatten(array, optDepth)

 Turns a nested collection into a flat one.
 

```js
arr.flatten([1, [2, [3,4,5], [6]], 7,8])
// => [1,2,3,4,5,6,7,8]
```

#### <a name="flatmap"></a>flatmap(array, it, ctx)

 the simple version
 Array.prototype.concat.apply([], array.map(it, ctx));
 causes stack overflows with really big arrays

#### <a name="interpose"></a>interpose(array, delim)

 Injects delim between elements of array
 

```js
lively.lang.arr.interpose(["test", "abc", 444], "aha"));
// => ["test","aha","abc","aha",444]
```

#### <a name="map"></a>map(array, iterator, context)


 Applies `iterator` to each element of `array` and returns a new Array
 with the results of those calls. Like `Array.prototype.some`.

#### <a name="invoke"></a>invoke(array, method, arg1, arg2, arg3, arg4, arg5, arg6)

 Calls `method` on each element in `array`, passing all arguments. Often
 a handy way to avoid verbose `map` calls.
 

```js
arr.invoke(["hello", "world"], "toUpperCase") // => ["HELLO","WORLD"]
```

#### <a name="pluck"></a>pluck(array, property)

 Returns `property` or undefined from each element of array. For quick
 `map`s and similar to `invoke`.
 

```js
arr.pluck(["hello", "world"], 0) // => ["h","w"]
```

#### <a name="reduce"></a>reduce(array, iterator, memo, context)


 Applies `iterator` to each element of `array` and returns a new Array
 with the results of those calls. Like `Array.prototype.some`.

#### <a name="reduceRight"></a>reduceRight(array, iterator, memo, context)



#### <a name="some"></a>some(array, iterator, context)


 Returns true if there is at least one abject in `array` for which
 `iterator` returns a truthy result. Like `Array.prototype.some`.

#### <a name="every"></a>every(array, iterator, context)


 Returns true if for all abjects in `array` `iterator` returns a truthy
 result. Like `Array.prototype.every`.

#### <a name="equals"></a>equals(array, otherArray)

 Returns true iff each element in `array` is equal (`==`) to its
 corresponding element in `otherArray`

#### <a name="deepEquals"></a>deepEquals(array, otherArray)

 Returns true iff each element in `array` is structurally equal
 (`lang.obj.equals`) to its corresponding element in `otherArray`

#### <a name="sort"></a>sort(array, sortFunc)


 Just `Array.prototype.sort`

#### <a name="sortBy"></a>sortBy(array, iterator, context)

 

```js
arr.sortBy(["Hello", "Lively", "User"], function(ea) {
  return ea.charCodeAt(ea.length-1); }) // => ["Hello","User","Lively"]
```

#### <a name="sortByKey"></a>sortByKey(array, key)

 

```js
lively.lang.arr.sortByKey([{x: 3}, {x: 2}, {x: 8}], "x")
// => [{x: 2},{x: 3},{x: 8}]
```

#### <a name="reMatches"></a>reMatches(arr, re, stringifier)

 result might include null items if re did not match (usful for masking)
 

```js
var morphs = $world.withAllSubmorphsDo(function(x) { return x; ;
  morphs.mask(morphs.reMatches(/code/i))
```

#### <a name="intersect"></a>intersect(array1, array2)

 set-like intersection

#### <a name="union"></a>union(array1, array2)

 set-like union

#### <a name="pushAt"></a>pushAt(array, item, index)

 inserts `item` at `index`, mutating

#### <a name="removeAt"></a>removeAt(array, index)

 inserts item at `index`, mutating

#### <a name="remove"></a>remove(array, item)

 removes first occurrence of item in `array`, mutating

#### <a name="pushAll"></a>pushAll(array, items)

 appends all `items`, mutating

#### <a name="pushAllAt"></a>pushAllAt(array, items, idx)

 inserts all `items` at `idx`, mutating

#### <a name="pushIfNotIncluded"></a>pushIfNotIncluded(array, item)

 only appends `item` if its not already in `array`, mutating

#### <a name="replaceAt"></a>replaceAt(array, item, index)

 mutating

#### <a name="clear"></a>clear(array)

 removes all items, mutating

#### <a name="doAndContinue"></a>doAndContinue(array, iterator, endFunc, context)

 Iterates over array but instead of consecutively calling iterator,
 iterator gets passed in the invocation for the next iteration step
 as a function as first parameter. This allows to wait arbitrarily
 between operation steps, great for managing dependencies between tasks.
 Related is [`fun.composeAsync`]().
 

```js
arr.doAndContinue([1,2,3,4], function(next, n) {
  alert("At " + n);
  setTimeout(next, 100);
}, function() { alert("Done"); })
// If the elements are functions you can leave out the iterator:
arr.doAndContinue([
  function(next) { alert("At " + 1); next(); },
  function(next) { alert("At " + 2); next(); }
], null, function() { alert("Done"); });
```

#### <a name="nestedDelay"></a>nestedDelay(array, iterator, waitSecs, endFunc, context, optSynchronChunks)

 Calls `iterator` for every element in `array` and waits between iterator
 calls `waitSecs`. Eventually `endFunc` is called. When passing a number n
 as `optSynchronChunks`, only every nth iteration is delayed.

#### <a name="swap"></a>swap(array, index1, index2)

 mutating
 

```js
var a = [1,2,3,4];
arr.swap(a, 3, 1);
a // => [1,4,3,2]
```

#### <a name="rotate"></a>rotate(array, times)

 non-mutating
 

```js
arr.rotate([1,2,3]) // => [2,3,1]
```

#### <a name="groupBy"></a>groupBy(array, iterator, context)

 Applies `iterator` to each element in `array`, and puts the return value
 into a collection (the group) associated to it's stringified representation
 (the "hash").
 See [`Group.prototype`] for available operations on groups.
 

```js
Example 1: Groups characters by how often they occur in a string:
var chars = arr.from("Hello World");
arr.groupBy(arr.uniq(chars), function(c) {
  return arr.count(chars, c); })
// => {
//   "1": ["H","e"," ","W","r","d"],
//   "2": ["o"],
//   "3": ["l"]
// }
// Example 2: Group numbers by a custom qualifier:
arr.groupBy([3,4,1,7,4,3,8,4], function(n) {
  if (n <= 3) return "small";
  if (n <= 7) return "medium";
  return "large";
});
// => {
//   large: [8],
//   medium: [4,7,4,4],
//   small: [3,1,3]
// }
```

#### <a name="groupByKey"></a>groupByKey(array, key)

 var objects = [{x: }]
 arr.groupBy(arr.uniq(chars), function(c) {
   return arr.count(chars, c); })
 // => {
 //   "1": ["H","e"," ","W","r","d"],
 //   "2": ["o"],
 //   "3": ["l"]
 // }

#### <a name="partition"></a>partition(array, iterator, context)

 

```js
var array = [1,2,3,4,5,6];
arr.partition(array, function(ea) { return ea > 3; })
// => [[1,2,3,4],[5,6]]
```

#### <a name="batchify"></a>batchify(array, constrainedFunc, context)

 Takes elements and fits them into subarrays (= batches) so that for
 each batch constrainedFunc returns true. Note that contrained func
 should at least produce 1-length batches, otherwise an error is raised
 

```js
// Assume you have list of things that have different sizes and you want to
// create sub-arrays of these things, with each sub-array having if possible
// less than a `batchMaxSize` of combined things in it:
var sizes = [
  Math.pow(2, 15), // 32KB
  Math.pow(2, 29), // 512MB
  Math.pow(2, 29), // 512MB
  Math.pow(2, 27), // 128MB
  Math.pow(2, 26), // 64MB
  Math.pow(2, 26), // 64MB
  Math.pow(2, 24), // 16MB
  Math.pow(2, 26)] // 64MB
var batchMaxSize = Math.pow(2, 28)/*256MB*/;
function batchConstrained(batch) {
  return batch.length == 1 || batch.sum() < batchMaxSize;
}
var batches = sizes.batchify(batchConstrained);
batches.pluck('length') // => [4,1,1,2]
batches.map(arr.sum).map(num.humanReadableByteSize) // => ["208.03MB","512MB","512MB","128MB"]
```

#### <a name="toTuples"></a>toTuples(array, tupleLength)

 Creates sub-arrays with length `tupleLength`
 

```js
arr.toTuples(["H","e","l","l","o"," ","W","o","r","l","d"], 4)
// => [["H","e","l","l"],["o"," ","W","o"],["r","l","d"]]
```

#### <a name="combinationsPick"></a>combinationsPick(listOfListsOfValues, pickIndices)

 Given a "listOfListsOfValues" in the form of an array of arrays and
 `pickIndices` list with the size of the number of arrays which indicates what
 values to pick from each of the arrays, return a list with two values:
 1. values picked from each of the arrays, 2. the next pickIndices or null if at end
 

```js
var searchSpace = [["a", "b", "c"], [1,2]];
 arr.combinationsPick(searchSpace, [0,1]);
   // => [["a",2], [1,0]]
 arr.combinationsPick(searchSpace, [1,0]);
   // => [["b",1], [1,1]]
```

#### <a name="combinations"></a>combinations(listOfListsOfValues)

 Given a "listOfListsOfValues" in the form of an array of arrays,
 retrieve all the combinations by picking one item from each array.
 This basically creates a search tree, traverses it and gathers all node
 values whenever a leaf node is reached.
 

```js
lively.lang.arr.combinations([['a', 'b', 'c'], [1, 2]])
   // => [["a", 1], ["a", 2], ["b", 1], ["b", 2], ["c", 1], ["c", 2]]
```

#### <a name="shuffle"></a>shuffle(array)

 Ramdomize the order of elements of array. Does not mutate array.
 

```js
arr.shuffle([1,2,3,4,5]) // => [3,1,2,5,4]
```

#### <a name="max"></a>max(array, iterator, context)

 

```js
var array = [{x:3,y:2}, {x:5,y:1}, {x:1,y:5}];
  arr.max(array, function(ea) { return ea.x; }) // => {x: 5, y: 1}
```

#### <a name="min"></a>min(array, iterator, context)

 Similar to `arr.max`.

#### <a name="sum"></a>sum(array)



#### <a name="clone"></a>clone(array)

 shallow copy

#### <a name="mapAsyncSeries"></a>mapAsyncSeries(array, iterator, callback)

 Apply `iterator` over `array`. Unlike `mapAsync` the invocation of
 the iterator happens step by step in the order of the items of the array
 and not concurrently.

#### <a name="mapAsync"></a>mapAsync(array, options, iterator, callback)

 Apply `iterator` over `array`. In each iterator gets a callback as third
 argument that should be called when the iteration is done. After all
 iterators have called their callbacks, the main `callback` function is
 invoked with the result array.
 

```js
lively.lang.arr.mapAsync([1,2,3,4],
  function(n, i, next) { setTimeout(function() { next(null, n + i); }, 20); },
  function(err, result) { /* result => [1,3,5,7] */ });
```