/*global System, global*/

/*
 * Methods to make working with arrays more convenient and collection-like
 * abstractions for groups, intervals, grids.
 */


import { equals as objectEquals } from "./object.js";
import { once, Null as NullFunction } from "./function.js";
import Group from "./Group.js";

var GLOBAL = typeof System !== "undefined" ? System.global :
  (typeof window !== 'undefined' ? window : global);

var features = {
  from: !!Array.from,
  filter: !!Array.prototype.filter,
  find: !!Array.prototype.find,
  findIndex: !!Array.prototype.findIndex,
  includes: !!Array.prototype.includes
}

// variety of functions for Arrays


// -=-=-=-=-=-=-=-
// array creations
// -=-=-=-=-=-=-=-

function range(begin, end, step) {
  // Examples:
  //   arr.range(0,5) // => [0,1,2,3,4,5]
  //   arr.range(0,10,2) // => [0,2,4,6,8,10]
  step = step || 0;
  var result = [];
  if (begin <= end) {
    if (step <= 0) step = -step || 1;
    for (var i = begin; i <= end; i += step) result.push(i);
  } else {
    if (step >= 0) step = -step || -1;
    for (var i = begin; i >= end; i += step) result.push(i);
  }
  return result;
}

var from = features.from ? Array.from : function(iterable) {
  // Makes JS arrays out of array like objects like `arguments` or DOM `childNodes`
  if (!iterable) return [];
  if (Array.isArray(iterable)) return iterable;
  if (iterable.toArray) return iterable.toArray();
  var length = iterable.length,
      results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}

function withN(n, obj) {
  // Example:
  //   arr.withN(3, "Hello") // => ["Hello","Hello","Hello"]
  var result = new Array(n);
  while (n > 0) result[--n] = obj;
  return result;
}

function genN(n, generator) {
  // Number -> Function -> Array
  // Takes a generator function that is called for each `n`.
  // Example:
  //   arr.genN(3, num.random) // => [46,77,95]
  var result = new Array(n);
  while (n > 0) result[--n] = generator(n);
  return result;
}

// -=-=-=-=-
// filtering
// -=-=-=-=-

function filter(array, iterator, context) {
  // [a] -> (a -> Boolean) -> c? -> [a]
  // Calls `iterator` for each element in `array` and returns a subset of it
  // including the elements for which `iterator` returned a truthy value.
  // Like `Array.prototype.filter`.
  return array.filter(iterator, context);
}

var detect = features.find ?
  function(arr, iterator, context) { return arr.find(iterator, context); } :
  function(arr, iterator, context) {
    // [a] -> (a -> Boolean) -> c? -> a
    // returns the first occurrence of an element in `arr` for which iterator
    // returns a truthy value
    for (var value, i = 0, len = arr.length; i < len; i++) {
      value = arr[i];
      if (iterator.call(context, value, i)) return value;
    }
    return undefined;
  }

var findIndex = features.findIndex ?
  function(arr, iterator, context) { return arr.findIndex(iterator, context); } :
  function(arr, iterator, context) {
    var i = -1;
    return arr.find(function(ea, j) { i = j; return iterator.call(ea, context); }) ? i : -1;
  }

function findAndGet(arr, iterator) {
  // find the first occurence for which `iterator` returns a truthy value and
  // return *this* value, i.e. unlike find the iterator result and not the
  // element of the list is returned
  var result;
  arr.find(function(ea, i) { return result = iterator(ea, i); });
  return result;
}

function filterByKey(arr, key) {
  // [a] -> String -> [a]
  // Example:
  //   var objects = [{x: 3}, {y: 4}, {x:5}]
  //   arr.filterByKey(objects, "x") // => [{x: 3},{x: 5}]
  return arr.filter(function(ea) { return !!ea[key]; });
}

function grep(arr, filter, context) {
  // [a] -> String|RegExp -> [a]
  // `filter` can be a String or RegExp. Will stringify each element in
  // Example:
  // ["Hello", "World", "Lively", "User"].grep("l") // => ["Hello","World","Lively"]
  if (typeof filter === 'string') filter = new RegExp(filter, 'i');
  return arr.filter(filter.test.bind(filter))
}

function mask(array, mask) {
  // select every element in array for which array's element is truthy
  // Example: [1,2,3].mask([false, true, false]) => [2]
  return array.filter(function(_, i) { return !!mask[i]; });
}

function reject(array, func, context) {
  // show-in-doc
  function iterator(val, i) { return !func.call(context, val, i); }
  return array.filter(iterator);
}

function rejectByKey(array, key) {
  // show-in-doc
  return array.filter(function(ea) { return !ea[key]; });
}

function without(array, elem) {
  // non-mutating
  // Example:
  // arr.without([1,2,3,4,5,6], 3) // => [1,2,4,5,6]
  return array.filter(val => val !== elem);
}

function withoutAll(array, otherArr) {
  // non-mutating
  // Example:
  // arr.withoutAll([1,2,3,4,5,6], [3,4]) // => [1,2,5,6]
  return array.filter(val => otherArr.indexOf(val) === -1);
}

function uniq(array, sorted) {
  // non-mutating
  // Removes duplicates from array.
  // if sorted == true then assume array is sorted which allows uniq to be more
  // efficient
  // uniq([3,5,6,2,3,4,2,6,4])
  if (!array.length) return array;

  let result = [array[0]];
  if (sorted) {
    for (let i = 1; i < array.length; i++) {
      let val = array[i];
      if (val !== result[result.length])
        result.push(val);
    }
  } else {
    for (let i = 1; i < array.length; i++) {
      let val = array[i];
      if (result.indexOf(val) === -1)
        result.push(val);
    }
  }
  return result;
}

function uniqBy(array, comparator, context) {
  // like `arr.uniq` but with custom equality: `comparator(a,b)` returns
  // BOOL. True if a and be should be regarded equal, false otherwise.
  var result = array.slice();
  for (let i = result.length; i--;) {
    var item = array[i];
    for (var j = i+1; j < result.length; j++) {
      if (comparator.call(context, item, result[j]))
        result.splice(j--, 1)
    }
  }
  return result;
}

function uniqByKey(array, key) {
  // like `arr.uniq` but with equality based on item[key]
  let seen = {}, result = [];
  for (var i = 0; i < array.length; i++) {
    let item = array[i];
    if (!seen[item[key]]) {
      seen[item[key]] = true;
      result.push(item);
    }
  }
  return result;
}

function compact(array) {
  // removes falsy values
  // Example:
  // arr.compact([1,2,undefined,4,0]) // => [1,2,4]
  return array.filter(Boolean);
}

function mutableCompact(array) {
  // fix gaps that were created with 'delete'
  var i = 0, j = 0, len = array.length;
  while (i < len) {
    if (array.hasOwnProperty(i)) array[j++] = array[i];
    i++;
  }
  while (j++ < len) array.pop();
  return array;
}

// -=-=-=-=-
// iteration
// -=-=-=-=-

function forEach(array, iterator, context) {
  // [a] -> (a -> Undefined) -> c? -> Undefined
  // `iterator` is called on each element in `array` for side effects. Like
  // `Array.prototype.forEach`.
  return array.forEach(iterator, context);
}

function zip(/*arr, arr2, arr3*/) {
  // Takes any number of lists as arguments. Combines them elment-wise.
  // Example:
  // arr.zip([1,2,3], ["a", "b", "c"], ["A", "B"])
  // // => [[1,"a","A"],[2,"b","B"],[3,"c",undefined]]
  var args = Array.from(arguments),
      array = args.shift(),
      iterator = typeof last(args) === 'function' ?
        args.pop() : function(x) { return x; },
      collections = [array].concat(args).map(function(ea) { return Array.from(ea); });
  return array.map(function(value, index) {
    return iterator(pluck(collections, index), index); });
}

function flatten(array, optDepth) {
  // Turns a nested collection into a flat one.
  // Example:
  // arr.flatten([1, [2, [3,4,5], [6]], 7,8])
  // // => [1,2,3,4,5,6,7,8]
  if (typeof optDepth === "number") {
    if (optDepth <= 0) return array;
    optDepth--;
  }
  return array.reduce(function(flattened, value) {
    return flattened.concat(Array.isArray(value) ?
      flatten(value, optDepth) : [value]);
  }, []);
}

function flatmap(array, it, ctx) {
  // the simple version
  // Array.prototype.concat.apply([], array.map(it, ctx));
  // causes stack overflows with really big arrays
  var results = [];
  for (var i = 0; i < array.length; i++) {
    results.push.apply(results, it.call(ctx, array[i], i));
  }
  return results;
}

function interpose(array, delim) {
  // Injects delim between elements of array
  // Example:
  // lively.lang.arr.interpose(["test", "abc", 444], "aha"));
  // // => ["test","aha","abc","aha",444]
  return array.reduce(function(xs, x) {
    if (xs.length > 0) xs.push(delim)
    xs.push(x); return xs;
  }, []);
}

function delimWith(array, delim) {
  // ignore-in-doc
  // previously used, use interpose now!
  return interpose(array, delim);
}

// -=-=-=-=-
// mapping
// -=-=-=-=-

function map(array, iterator, context) {
  // [a] -> (a -> b) -> c? -> [b]
  // Applies `iterator` to each element of `array` and returns a new Array
  // with the results of those calls. Like `Array.prototype.some`.
  return array.map(iterator, context);
}

function invoke(array, method, arg1, arg2, arg3, arg4, arg5, arg6) {
  // Calls `method` on each element in `array`, passing all arguments. Often
  // a handy way to avoid verbose `map` calls.
  // Example: arr.invoke(["hello", "world"], "toUpperCase") // => ["HELLO","WORLD"]
  return array.map(function(ea) {
    return ea[method](arg1, arg2, arg3, arg4, arg5, arg6);
  });
}

function pluck(array, property) {
  // Returns `property` or undefined from each element of array. For quick
  // `map`s and similar to `invoke`.
  // Example: arr.pluck(["hello", "world"], 0) // => ["h","w"]
  return array.map(ea => ea[property]);
}

// -=-=-=-=-
// folding
// -=-=-=-=-

function reduce(array, iterator, memo, context) {
  // Array -> Function -> Object? -> Object? -> Object?
  // Applies `iterator` to each element of `array` and returns a new Array
  // with the results of those calls. Like `Array.prototype.some`.
  return array.reduce(iterator, memo, context);
}

function reduceRight(array, iterator, memo, context) {
  // show-in-doc
  return array.reduceRight(iterator, memo, context);
}

// -=-=-=-=-
// testing
// -=-=-=-=-

var isArray = Array.isArray;

var includes = features.includes ?
  function(array, object) { return array.includes(object); } :
  function(array, object) {
    // Example: arr.include([1,2,3], 2) // => true
    return array.indexOf(object) !== -1;
  }

var include = includes;

function some(array, iterator, context) {
  // [a] -> (a -> Boolean) -> c? -> Boolean
  // Returns true if there is at least one abject in `array` for which
  // `iterator` returns a truthy result. Like `Array.prototype.some`.
  return array.some(iterator, context);
}

function every(array, iterator, context) {
  // [a] -> (a -> Boolean) -> c? -> Boolean
  // Returns true if for all abjects in `array` `iterator` returns a truthy
  // result. Like `Array.prototype.every`.
  return array.every(iterator, context);
}

function equals(array, otherArray) {
  // Returns true iff each element in `array` is equal (`==`) to its
  // corresponding element in `otherArray`
  var len = array.length;
  if (!otherArray || len !== otherArray.length) return false;
  for (var i = 0; i < len; i++) {
    if (array[i] && otherArray[i] && array[i].equals && otherArray[i].equals) {
      if (!array[i].equals(otherArray[i])) {
        return false;
      } else {
        continue;
      }
    }
    if (array[i] != otherArray[i]) return false;
  }
  return true;
}

function deepEquals(array, otherArray) {
  // Returns true iff each element in `array` is structurally equal
  // (`lang.obj.equals`) to its corresponding element in `otherArray`
  var len = array.length;
  if (!otherArray || len !== otherArray.length) return false;
  for (var i = 0; i < len; i++) {
    if (!objectEquals(array[i], otherArray[i])) return false;
  }
  return true;
}

// -=-=-=-=-
// sorting
// -=-=-=-=-

function isSorted(array, descending) {
  if (descending) {
    for (var i = 1; i < array.length; i++)
      if (array[i-1] < array[i]) return false;
  } else {
    for (var i = 1; i < array.length; i++)
      if (array[i-1] > array[i]) return false;
  }
  return true;
}

function sort(array, sortFunc) {
  // [a] -> (a -> Number)? -> [a]
  // Just `Array.prototype.sort`
  return array.sort(sortFunc);
}

function sortBy(array, iterator, context) {
  // Example:
  // arr.sortBy(["Hello", "Lively", "User"], function(ea) {
  //   return ea.charCodeAt(ea.length-1); }) // => ["Hello","User","Lively"]
  return pluck(
    array.map(function(value, index) {
      return {value: value,criteria: iterator.call(context, value, index)};
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
}

function sortByKey(array, key) {
  // Example:
  // lively.lang.arr.sortByKey([{x: 3}, {x: 2}, {x: 8}], "x")
  // // => [{x: 2},{x: 3},{x: 8}]
  return sortBy(array, ea => ea[key]);
}

function reverse(array) { return array.reverse(); }

function reversed(array) { return array.slice().reverse(); }

// -=-=-=-=-=-=-=-=-=-=-=-=-
// RegExp / String matching
// -=-=-=-=-=-=-=-=-=-=-=-=-

function reMatches(arr, re, stringifier) {
  // result might include null items if re did not match (usful for masking)
  // Example:
  //   var morphs = $world.withAllSubmorphsDo(function(x) { return x; ;
  //   morphs.mask(morphs.reMatches(/code/i))
  stringifier = stringifier || String
  return arr.map(ea => stringifier(ea).match(re));
}

// -=-=-=-=-=-
// accessors
// -=-=-=-=-=-

function first(array) { return array[0]; }

function last(array) { return array[array.length - 1]; }

// -=-=-=-=-=-=-=-
// Set operations
// -=-=-=-=-=-=-=-

function intersect(array1, array2) {
  // set-like intersection
  return uniq(array1).filter(item => array2.indexOf(item) > -1);
}

function union(array1, array2) {
  // set-like union
  var result = array1.slice();
  for (var i = 0; i < array2.length; i++) {
    var item = array2[i];
    if (result.indexOf(item) === -1) result.push(item);
  }
  return result;
}

function pushAt(array, item, index) {
  // inserts `item` at `index`, mutating
  array.splice(index, 0, item);
}

function removeAt(array, index) {
  // inserts item at `index`, mutating
  array.splice(index, 1);
}

function remove(array, item) {
  // removes first occurrence of item in `array`, mutating
  var index = array.indexOf(item);
  if (index >= 0) removeAt(array, index);
  return item;
}

function pushAll(array, items) {
  // appends all `items`, mutating
  array.push.apply(array, items);
  return array;
}

function pushAllAt(array, items, idx) {
  // inserts all `items` at `idx`, mutating
  array.splice.apply(array, [idx, 0].concat(items))
}

function pushIfNotIncluded(array, item) {
  // only appends `item` if its not already in `array`, mutating
  if (!array.includes(item)) array.push(item);
}

function replaceAt(array, item, index) {
  // mutating
  array.splice(index, 1, item);
}

function clear(array) {
  // removes all items, mutating
  array.length = 0; return array;
}

function isSubset(list1, list2) {
  // are all elements in list1 in list2?
  for (var i = 0; i < list1.length; i++)
    if (!list2.includes(list1[i]))
    	  return false;
  return true;
}

// -=-=-=-=-=-=-=-=-=-=-=-
// asynchronous iteration
// -=-=-=-=-=-=-=-=-=-=-=-
function doAndContinue(array, iterator, endFunc, context) {
  // Iterates over array but instead of consecutively calling iterator,
  // iterator gets passed in the invocation for the next iteration step
  // as a function as first parameter. This allows to wait arbitrarily
  // between operation steps, great for managing dependencies between tasks.
  // Related is [`fun.composeAsync`]().
  // Example:
  // arr.doAndContinue([1,2,3,4], function(next, n) {
  //   alert("At " + n);
  //   setTimeout(next, 100);
  // }, function() { alert("Done"); })
  // // If the elements are functions you can leave out the iterator:
  // arr.doAndContinue([
  //   function(next) { alert("At " + 1); next(); },
  //   function(next) { alert("At " + 2); next(); }
  // ], null, function() { alert("Done"); });
  endFunc = endFunc || NullFunction;
  context = context || GLOBAL;
  iterator = iterator || function(next, ea, idx) { ea.call(context, next, idx); };
  return array.reduceRight(function(nextFunc, ea, idx) {
    return function() { iterator.call(context, nextFunc, ea, idx); }
  }, endFunc)();
}

function nestedDelay(array, iterator, waitSecs, endFunc, context, optSynchronChunks) {
  // Calls `iterator` for every element in `array` and waits between iterator
  // calls `waitSecs`. Eventually `endFunc` is called. When passing a number n
  // as `optSynchronChunks`, only every nth iteration is delayed.
  endFunc = endFunc || function() {};
  return array.clone().reverse().reduce(function(nextFunc, ea, idx) {
    return function() {
      iterator.call(context || GLOBAL, ea, idx);
      // only really delay every n'th call optionally
      if (optSynchronChunks && (idx % optSynchronChunks !== 0)) {
        nextFunc()
      } else {
        nextFunc.delay(waitSecs);
      }
    }
  }, endFunc)();
}

function forEachShowingProgress(/*array, progressBar, iterator, labelFunc, whenDoneFunc, context or spec*/) {
  // ignore-in-doc
  var args = Array.from(arguments),
    array = args.shift(),
    steps = array.length,
    progressBar, iterator, labelFunc, whenDoneFunc, context,
    progressBarAdded = false;

  // init args
  if (args.length === 1) {
    progressBar = args[0].progressBar;
    iterator = args[0].iterator;
    labelFunc = args[0].labelFunction;
    whenDoneFunc = args[0].whenDone;
    context = args[0].context;
  } else {
    progressBar = args[0];
    iterator = args[1];
    labelFunc = args[2];
    whenDoneFunc = args[3];
    context = args[4];
  }
  if (!context) context = typeof window !== 'undefined' ? window : global;
  if (!labelFunc) labelFunc = function(x) { return x; };

  // init progressbar
  if (!progressBar) {
    progressBarAdded = true;
    var Global = typeof window !== 'undefined' ? window : global;
    var world = Global.lively && lively.morphic && lively.morphic.World.current();
    progressBar = world ? world.addProgressBar() : {
      setValue: function(val) {},
      setLabel: function() {},
      remove: function() {}
    };
  }
  progressBar.setValue(0);

  // nest functions so that the iterator calls the next after a delay
  (array.reduceRight(function(nextFunc, item, idx) {
    return function() {
      try {
        progressBar.setValue(idx / steps);
        if (labelFunc) progressBar.setLabel(labelFunc.call(context, item, idx));
        iterator.call(context, item, idx);
      } catch (e) {
        console.error(
          'Error in forEachShowingProgress at %s (%s)\n%s\n%s',
          idx, item, e, e.stack);
      }
      nextFunc.delay(0);
    };
  }, function() {
    progressBar.setValue(1);
    if (progressBarAdded) (function() { progressBar.remove(); }).delay(0);
    if (whenDoneFunc) whenDoneFunc.call(context);
  }))();

  return array;
}

function swap(array, index1, index2) {
  // mutating
  // Example:
  // var a = [1,2,3,4];
  // arr.swap(a, 3, 1);
  // a // => [1,4,3,2]
  if (index1 < 0) index1 = array.length + index1;
  if (index2 < 0) index2 = array.length + index2;
  var temp = array[index1];
  array[index1] = array[index2];
  array[index2] = temp;
  return array;
}

function rotate(array, times) {
  // non-mutating
  // Example:
  // arr.rotate([1,2,3]) // => [2,3,1]
  times = times || 1;
  return array.slice(times).concat(array.slice(0,times));
}

// -=-=-=-=-
// grouping
// -=-=-=-=-

function groupBy(array, iterator, context) {
  // Applies `iterator` to each element in `array`, and puts the return value
  // into a collection (the group) associated to it's stringified representation
  // (the "hash").
  // See [`Group.prototype`] for available operations on groups.
  // Example:
  // Example 1: Groups characters by how often they occur in a string:
  // var chars = arr.from("Hello World");
  // arr.groupBy(arr.uniq(chars), function(c) {
  //   return arr.count(chars, c); })
  // // => {
  // //   "1": ["H","e"," ","W","r","d"],
  // //   "2": ["o"],
  // //   "3": ["l"]
  // // }
  // // Example 2: Group numbers by a custom qualifier:
  // arr.groupBy([3,4,1,7,4,3,8,4], function(n) {
  //   if (n <= 3) return "small";
  //   if (n <= 7) return "medium";
  //   return "large";
  // });
  // // => {
  // //   large: [8],
  // //   medium: [4,7,4,4],
  // //   small: [3,1,3]
  // // }
  return Group.fromArray(array, iterator, context);
}

function groupByKey(array, key) {
  // var objects = [{x: }]
  // arr.groupBy(arr.uniq(chars), function(c) {
  //   return arr.count(chars, c); })
  // // => {
  // //   "1": ["H","e"," ","W","r","d"],
  // //   "2": ["o"],
  // //   "3": ["l"]
  // // }
  return groupBy(array, ea => ea[key]);
}

function partition(array, iterator, context) {
  // Example:
  // var array = [1,2,3,4,5,6];
  // arr.partition(array, function(ea) { return ea > 3; })
  // // => [[1,2,3,4],[5,6]]
  iterator = iterator || function(x) { return x; };
  var trues = [], falses = [];
  array.forEach(function(value, index) {
    (iterator.call(context, value, index) ? trues : falses).push(value);
  });
  return [trues, falses];
}

function batchify(array, constrainedFunc, context) {
  // Takes elements and fits them into subarrays (= batches) so that for
  // each batch constrainedFunc returns true. Note that contrained func
  // should at least produce 1-length batches, otherwise an error is raised
  // Example:
  // // Assume you have list of things that have different sizes and you want to
  // // create sub-arrays of these things, with each sub-array having if possible
  // // less than a `batchMaxSize` of combined things in it:
  // var sizes = [
  //   Math.pow(2, 15), // 32KB
  //   Math.pow(2, 29), // 512MB
  //   Math.pow(2, 29), // 512MB
  //   Math.pow(2, 27), // 128MB
  //   Math.pow(2, 26), // 64MB
  //   Math.pow(2, 26), // 64MB
  //   Math.pow(2, 24), // 16MB
  //   Math.pow(2, 26)] // 64MB
  // var batchMaxSize = Math.pow(2, 28)/*256MB*/;
  // function batchConstrained(batch) {
  //   return batch.length == 1 || batch.sum() < batchMaxSize;
  // }
  // var batches = sizes.batchify(batchConstrained);
  // batches.pluck('length') // => [4,1,1,2]
  // batches.map(arr.sum).map(num.humanReadableByteSize) // => ["208.03MB","512MB","512MB","128MB"]

  return findBatches([], array);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  function extractBatch(batch, sizes) {
    // ignore-in-doc
    // Array -> Array -> Array[Array,Array]
    // case 1: no sizes to distribute, we are done
    if (!sizes.length) return [batch, []];
    var first = sizes[0], rest = sizes.slice(1);
    // if batch is empty we have to take at least one
    // if batch and first still fits, add first
    var candidate = batch.concat([first]);
    if (constrainedFunc.call(context, candidate)) return extractBatch(candidate, rest);
    // otherwise leave first out for now
    var batchAndSizes = extractBatch(batch, rest);
    return [batchAndSizes[0], [first].concat(batchAndSizes[1])];
  }

  function findBatches(batches, sizes) {
    if (!sizes.length) return batches;
    var extracted = extractBatch([], sizes);
    if (!extracted[0].length)
      throw new Error('Batchify constrained does not ensure consumption '
              + 'of at least one item per batch!');
    return findBatches(batches.concat([extracted[0]]), extracted[1]);
  }
}

function toTuples(array, tupleLength) {
  // Creates sub-arrays with length `tupleLength`
  // Example:
  // arr.toTuples(["H","e","l","l","o"," ","W","o","r","l","d"], 4)
  // // => [["H","e","l","l"],["o"," ","W","o"],["r","l","d"]]
  tupleLength = tupleLength || 1;
  return range(0,Math.ceil(array.length/tupleLength)-1).map(function(n) {
    return array.slice(n*tupleLength, n*tupleLength+tupleLength);
  }, array);
}

var permutations = (function() {
  function computePermutations(restArray, values) {
    return !restArray.length ? [values] :
      flatmap(restArray, function(ea, i) {
        return computePermutations(
          restArray.slice(0, i).concat(restArray.slice(i+1)),
          values.concat([ea]));
      });
  }
  return function(array) { return computePermutations(array, []); }
})();

function combinationsPick(listOfListsOfValues, pickIndices) {
  // Given a "listOfListsOfValues" in the form of an array of arrays and
  // `pickIndices` list with the size of the number of arrays which indicates what
  // values to pick from each of the arrays, return a list with two values:
  // 1. values picked from each of the arrays, 2. the next pickIndices or null if at end
  // Example:
  //  var searchSpace = [["a", "b", "c"], [1,2]];
  //  arr.combinationsPick(searchSpace, [0,1]);
  //    // => [["a",2], [1,0]]
  //  arr.combinationsPick(searchSpace, [1,0]);
  //    // => [["b",1], [1,1]]
  var values = listOfListsOfValues.map(function(subspace, i) {
        return subspace[pickIndices[i]]; }),
      nextState = pickIndices.slice();
  for (var i = listOfListsOfValues.length; i--; i >= 0) {
    var subspace = listOfListsOfValues[i], nextIndex = nextState[i] + 1;
    if (subspace[nextIndex]) { nextState[i] = nextIndex; break; }
    else if (i === 0) { nextState = undefined; break; }
    else { nextState[i] = 0; }
  }
  return [values, nextState];
}

function combinations(listOfListsOfValues) {
  // Given a "listOfListsOfValues" in the form of an array of arrays,
  // retrieve all the combinations by picking one item from each array.
  // This basically creates a search tree, traverses it and gathers all node
  // values whenever a leaf node is reached.
  // Example:
  //   lively.lang.arr.combinations([['a', 'b', 'c'], [1, 2]])
  //    // => [["a", 1], ["a", 2], ["b", 1], ["b", 2], ["c", 1], ["c", 2]]
  var size = listOfListsOfValues.reduce(function(prod, space) { return prod * space.length; }, 1),
      searchState = listOfListsOfValues.map(function(_) { return 0; }),
      results = new Array(size);
  for (var i = 0; i < size; i++) {
    var result = combinationsPick(listOfListsOfValues, searchState);
    results[i] = result[0];
    searchState = result[1];
  }
  return results;
}

function take(arr, n) { return arr.slice(0, n); }

function drop(arr, n) { return arr.slice(n); }

function takeWhile(arr, fun, context) {
  var i = 0;;
  for (; i < arr.length; i++)
    if (!fun.call(context, arr[i], i)) break;
  return arr.slice(0, i);
}

function dropWhile(arr, fun, context) {
  var i = 0;;
  for (; i < arr.length; i++)
    if (!fun.call(context, arr[i], i)) break;
  return arr.slice(i);
}

// -=-=-=-=-=-
// randomness
// -=-=-=-=-=-

function shuffle(array) {
  // Ramdomize the order of elements of array. Does not mutate array.
  // Example:
  // shuffle([1,2,3,4,5]) // => [3,1,2,5,4]
  let unusedIndexes = range(0, array.length-1),
      shuffled = Array(array.length);
  for (let i = 0; i < array.length; i++) {
    var shuffledIndex = unusedIndexes.splice(
      Math.round(Math.random() * (unusedIndexes.length-1)), 1);
    shuffled[shuffledIndex] = array[i];
  }
  return shuffled;
}

// -=-=-=-=-=-=-=-
// Number related
// -=-=-=-=-=-=-=-

function max(array, iterator, context) {
  // Example:
  //   var array = [{x:3,y:2}, {x:5,y:1}, {x:1,y:5}];
  //   arr.max(array, function(ea) { return ea.x; }) // => {x: 5, y: 1}
  iterator = iterator || function(x) { return x; };
  var result;
  array.reduce(function(max, ea, i) {
    var val = iterator.call(context, ea, i);
    if (typeof val !== "number" || val <= max) return max;
    result = ea; return val;
  }, -Infinity);
  return result;
}

function min(array, iterator, context) {
  // Similar to `arr.max`.
  iterator = iterator || (x => x);
  return max(array, (ea, i) => -iterator.call(context, ea, i));
}

function sum(array) {
  // show-in-doc
  var sum = 0;
  for (var i = 0; i < array.length; i++)
    sum += array[i];
  return sum;
}

function count(array, item) {
  return array.reduce(function(count, ea) {
    return ea === item ? count + 1 : count; }, 0);
}

function size(array) { return array.length; }

function histogram(data, binSpec) {
  // ignore-in-doc
  // Without a `binSpec` argument partition the data
  // var numbers = arr.genN(10, num.random);
  // var numbers = arr.withN(10, "a");
  // => [65,73,34,94,92,31,27,55,95,48]
  // => [[65,73],[34,94],[92,31],[27,55],[95,48]]
  // => [[82,50,16],[25,43,77],[40,64,31],[51,39,13],[17,34,87],[51,33,30]]
  if (typeof binSpec === 'undefined' || typeof binSpec === 'number') {
    var binNumber = binSpec || (function sturge() {
      return Math.ceil(Math.log(data.length) / Math.log(2) + 1);
    })(data);
    var binSize = Math.ceil(Math.round(data.length / binNumber));
    return range(0, binNumber-1).map(function(i) {
      return data.slice(i*binSize, (i+1)*binSize);
    });
  } else if (binSpec instanceof Array) {
    // ignore-in-doc
    // bins specifies n threshold values that will create n-1 bins.
    // Each data value d is placed inside a bin i if:
    // threshold[i] >= d && threshold[i+1] < d
    var thresholds = binSpec;
    return data.reduce(function(bins, d) {
      if (d < thresholds[1]) { bins[0].push(d); return bins; }
      for (var i = 1; i < thresholds.length; i++) {
        if (d >= thresholds[i] && (!thresholds[i+1] || d <= thresholds[i+1])) {
          bins[i].push(d); return bins;
        }
      }
      throw new Error(`Histogram creation: Cannot group data ${d} into thresholds ${thresholds}`);
    }, range(1,thresholds.length).map(function() { return []; }))
  }
}

// -=-=-=-=-
// Copying
// -=-=-=-=-

function clone(array) {
  // shallow copy
  return [].concat(array);
}

// -=-=-=-=-=-
// conversion
// -=-=-=-=-=-

function toArray(array) { return from(array); }

// -=-=-=-=-=-
// DEPRECATED
// -=-=-=-=-=-

function each(arr, iterator, context) {
  return arr.forEach(iterator, context);
}

function all(arr, iterator, context) {
  return arr.every(iterator, context);
}

function any(arr, iterator, context) {
  return arr.some(iterator, context);
}

function collect(arr, iterator, context) {
  return arr.map(iterator, context);
}

function findAll(arr, iterator, context) {
  return arr.filter(iterator, context);
}

function inject(array, memo, iterator, context) {
  if (context) iterator = iterator.bind(context);
  return array.reduce(iterator, memo);
}

// asynch methods
function mapAsyncSeries(array, iterator, callback) {
  // Apply `iterator` over `array`. Unlike `mapAsync` the invocation of
  // the iterator happens step by step in the order of the items of the array
  // and not concurrently.

  // ignore-in-doc
  // Could simply be:
  // return exports.arr.mapAsync(array, {parallel: 1}, iterator, callback);
  // but the version below is 2x faster

  var result = [], callbackTriggered = false;
  return array.reduceRight(function(nextFunc, ea, idx) {
    if (callbackTriggered) return;
    return function(err, eaResult) {
      if (err) return maybeDone(err);
      if (idx > 0) result.push(eaResult);
      try {
        iterator(ea, idx, once(nextFunc));
      } catch (e) { maybeDone(e); }
    }
  }, function(err, eaResult) {
    result.push(eaResult);
    maybeDone(err, true);
  })();

  function maybeDone(err, finalCall) {
    if (callbackTriggered || (!err && !finalCall)) return;
    callbackTriggered = true;
    try { callback(err, result); } catch (e) {
      console.error("Error in mapAsyncSeries - callback invocation error:\n" + (e.stack || e));
    }
  }
}

function mapAsync(array, options, iterator, callback) {
  // Apply `iterator` over `array`. In each iterator gets a callback as third
  // argument that should be called when the iteration is done. After all
  // iterators have called their callbacks, the main `callback` function is
  // invoked with the result array.
  // Example:
  // lively.lang.arr.mapAsync([1,2,3,4],
  //   function(n, i, next) { setTimeout(function() { next(null, n + i); }, 20); },
  //   function(err, result) { /* result => [1,3,5,7] */ });

  if (typeof options === "function") {
    callback = iterator;
    iterator = options;
    options = null;
  }
  options = options || {};

  if (!array.length) return callback && callback(null, []);

  if (!options.parallel) options.parallel = Infinity;

  var results = [], completed = [],
      callbackTriggered = false,
      lastIteratorIndex = 0,
      nActive = 0;

  var iterators = array.map(function(item, i) {
    return function() {
      nActive++;
      try {
        iterator(item, i, once(function(err, result) {
          results[i] = err || result;
          maybeDone(i, err);
        }));
      } catch (e) { maybeDone(i, e); }
    }
  });

  return activate();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function activate() {
    while (nActive < options.parallel && lastIteratorIndex < array.length)
      iterators[lastIteratorIndex++]();
  }

  function maybeDone(idx, err) {
    if (completed.indexOf(idx) > -1) return;
    completed.push(idx);
    nActive--;
    if (callbackTriggered) return;
    if (!err && completed.length < array.length) { activate(); return; }
    callbackTriggered = true;
    try { callback && callback(err, results); } catch (e) {
      console.error("Error in mapAsync - main callback invocation error:\n" + (e.stack || e));
    }
  }
}

// poly-filling...
if (!features.from) Array.from = from;
if (!features.filter) Array.prototype.filter = function(it, ctx) { return filter(this, it, ctx); };
if (!features.find) Array.prototype.find = function(it, ctx) { return detect(this, it, ctx); };
if (!features.findIndex) Array.prototype.findIndex = function(it, ctx) { return findIndex(this, it, ctx); };
if (!features.includes) Array.prototype.includes = function(x) { return includes(this, x); };

export {
  range,
  from,
  withN,
  genN,
  filter,
  detect,
  findIndex,
  findAndGet,
  filterByKey,
  grep,
  mask,
  reject,
  rejectByKey,
  without,
  withoutAll,
  uniq,
  uniqBy,
  uniqByKey,
  compact,
  mutableCompact,
  forEach,
  zip,
  flatten,
  flatmap,
  interpose,
  delimWith,
  map,
  invoke,
  pluck,
  reduce,
  reduceRight,
  isArray,
  includes,
  include,
  some,
  every,
  equals,
  deepEquals,
  isSorted,
  sort,
  sortBy,
  sortByKey,
  reverse,
  reversed,
  reMatches,
  first,
  last,
  intersect,
  union,
  pushAt,
  removeAt,
  remove,
  pushAll,
  pushAllAt,
  pushIfNotIncluded,
  replaceAt,
  clear,
  isSubset,
  doAndContinue,
  nestedDelay,
  forEachShowingProgress,
  swap,
  rotate,
  groupBy,
  groupByKey,
  partition,
  batchify,
  toTuples,
  permutations,
  combinationsPick,
  combinations,
  take,
  drop,
  takeWhile,
  dropWhile,
  shuffle,
  max,
  min,
  sum,
  count,
  size,
  histogram,
  clone,
  toArray,
  each,
  all,
  any,
  collect,
  findAll,
  inject,
  mapAsyncSeries,
  mapAsync,
}
