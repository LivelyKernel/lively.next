## interval.js

Intervals are arrays whose first two elements are numbers and the
 first element should be less or equal the second element, see
 [`interval.isInterval`](). This abstraction is useful when working with text
 ranges in rich text, for example.

- [GLOBAL](#GLOBAL)

### <a name="GLOBAL"></a>GLOBAL

Intervals are arrays whose first two elements are numbers and the
 first element should be less or equal the second element, see
 [`interval.isInterval`](). This abstraction is useful when working with text
 ranges in rich text, for example.

#### <a name="isInterval"></a>isInterval(object)

 

```js
interval.isInterval([1,12]) // => true
interval.isInterval([1,12, {property: 23}]) // => true
interval.isInterval([1]) // => false
interval.isInterval([12, 1]) // => false
```

#### <a name="sort"></a>sort(intervals)

 Sorts intervals according to rules defined in [`interval.compare`]().

#### <a name="compare"></a>compare(a, b)

 How [`interval.sort`]() compares.
 We assume that `a[0] <= a[1] and b[0] <= b[1]` according to `isInterval`
 ```
 -3: a < b and non-overlapping, e.g [1,2] and [3,4]
 -2: a < b and intervals border at each other, e.g [1,3] and [3,4]
 -1: a < b and overlapping, e.g, [1,3] and [2,4] or [1,3] and [1,4]
  0: a = b, e.g. [1,2] and [1,2]
  1: a > b and overlapping, e.g. [2,4] and [1,3]
  2: a > b and share border, e.g [1,4] and [0,1]
  3: a > b and non-overlapping, e.g [2,4] and [0,1]
 ```

#### <a name="compare"></a>compare(a, b)

 we know a[0] > b[0], 1 || 2 || 3

#### <a name="coalesce"></a>coalesce(interval1, interval2, optMergeCallback)

 Turns two interval into one iff compare(interval1, interval2) ∈ [-2,
 -1,0,1, 2] (see [`inerval.compare`]()).
 Otherwise returns null. Optionally uses merge function.
 

```js
interval.coalesce([1,4], [5,7]) // => null
  interval.coalesce([1,2], [1,2]) // => [1,2]
  interval.coalesce([1,4], [3,6]) // => [1,6]
  interval.coalesce([3,6], [4,5]) // => [3,6]
```

#### <a name="coalesce"></a>coalesce(interval1, interval2, optMergeCallback)

 swap

#### <a name="coalesceOverlapping"></a>coalesceOverlapping(intervals, mergeFunc)

 Like `coalesce` but accepts an array of intervals.
 

```js
interval.coalesceOverlapping([[9,10], [1,8], [3, 7], [15, 20], [14, 21]])
  // => [[1,8],[9,10],[14,21]]
```

#### <a name="intervalsInRangeDo"></a>intervalsInRangeDo(start, end, intervals, iterator, mergeFunc, context)

 Merges and iterates through sorted intervals. Will "fill up"
 intervals. This is currently used for computing text chunks in
 lively.morphic.TextCore.
 

```js
interval.intervalsInRangeDo(
  2, 10, [[0, 1], [5,8], [2,4]],
  function(i, isNew) { i.push(isNew); return i; })
// => [[2,4,false],[4,5,true],[5,8,false],[8,10,true]]
```

#### <a name="intervalsInRangeDo"></a>intervalsInRangeDo(start, end, intervals, iterator, mergeFunc, context)

 need to be sorted for the algorithm below

#### <a name="intervalsInRangeDo"></a>intervalsInRangeDo(start, end, intervals, iterator, mergeFunc, context)

 merged intervals are already sorted, simply "negate" the interval array;

#### <a name="intervalsInbetween"></a>intervalsInbetween(start, end, intervals)

 Computes "free" intervals between the intervals given in range start - end
 currently used for computing text chunks in lively.morphic.TextCore
 

```js
interval.intervalsInbetween(0, 10,[[1,4], [5,8]])
// => [[0,1],[4,5],[8,10]]
```

#### <a name="mapToMatchingIndexes"></a>mapToMatchingIndexes(intervals, intervalsToFind)

 Returns an array of indexes of the items in intervals that match
 items in `intervalsToFind`.
 Note: We expect intervals and intervals to be sorted according to [`interval.compare`]()!
 This is the optimized version of:
 ```
 return intervalsToFind.collect(function findOne(toFind) {
    var startIdx, endIdx;
    var start = intervals.detect(function(ea, i) {
       startIdx = i; return ea[0] === toFind[0]; });
    if (start === undefined) return [];
    var end = intervals.detect(function(ea, i) {
       endIdx = i; return ea[1] === toFind[1]; });
    if (end === undefined) return [];
    return Array.range(startIdx, endIdx);
 });
 ```