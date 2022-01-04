/* global System, global */

/**
 * Methods to make working with arrays more convenient and collection-like
 * abstractions for groups, intervals, grids.
 * @module lively.lang/array 
 */

import { equals as objectEquals } from './object.js';
import { delay, once, Null as NullFunction } from './function.js';
import Group from './Group.js';

const GLOB = typeof System !== 'undefined'
  ? System.global
  : (typeof window !== 'undefined' ? window : global);

const features = {
  from: !!Array.from,
  filter: !!Array.prototype.filter,
  find: !!Array.prototype.find,
  findIndex: !!Array.prototype.findIndex,
  includes: !!Array.prototype.includes
};

// -=-=-=-=-=-=-=-
// array creations
// -=-=-=-=-=-=-=-

function range (begin, end, step) {
  // Examples:
  //   arr.range(0,5) // => [0,1,2,3,4,5]
  //   arr.range(0,10,2) // => [0,2,4,6,8,10]
  step = step || 0;
  const result = [];
  if (begin <= end) {
    if (step <= 0) step = -step || 1;
    for (var i = begin; i <= end; i += step) result.push(i);
  } else {
    if (step >= 0) step = -step || -1;
    for (var i = begin; i >= end; i += step) result.push(i);
  }
  return result;
}

/**
 * Makes JS arrays out of array like objects like `arguments` or DOM `childNodes`
 * @function
 * @name from
 */
const from = features.from ? Array.from : function (iterable) {
  if (!iterable) return [];
  if (Array.isArray(iterable)) return iterable;
  if (iterable.toArray) return iterable.toArray();
  let length = iterable.length;
  const results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
};

/** 
 * ```
 * arr.withN(3, "Hello") => ["Hello","Hello","Hello"]
 * ``` 
 */
function withN (n, obj) {
  const result = new Array(n);
  while (n > 0) result[--n] = obj;
  return result;
}

/**
 * Number -> Function -> Array
 * 
 * Takes a generator function that is called for each `n`.
 * 
 * ```
 * arr.genN(3, num.random) // => [46,77,95]
 * ```
 */
function genN (n, generator) {
  const result = new Array(n);
  while (n > 0) result[--n] = generator(n);
  return result;
}

// -=-=-=-=-
// filtering
// -=-=-=-=-

/**
 * [a] -> (a -> Boolean) -> c? -> [a]
 * 
 * Calls `iterator` for each element in `array` and returns a subset of it 
 * including the elements for which `iterator` returned a truthy value.
 * 
 * Like `Array.prototype.filter`.
 */
function filter (array, iterator, context) {
  const res = [];
  for (let idx = 0; idx < array.length; idx++) {
    const currentItem = array[idx];
    if (iterator.call(context, currentItem)) {
      res.push(currentItem);
    }
  }
  return res;
}

/**
 * [a] -> (a -> Boolean) -> c? -> a
 * 
 * returns the first occurrence of an element in `arr` for which iterator
 * returns a truthy value
 * @function
 * @name detect
 */
const detect = features.find
  ? function (arr, iterator, context) { return arr.find(iterator, context); }
  : function (arr, iterator, context) {
    for (var value, i = 0, len = arr.length; i < len; i++) {
      value = arr[i];
      if (iterator.call(context, value, i)) return value;
    }
    return undefined;
  };

/**
 * 
 * Returns the element equal to the given search value or undefined
 * 
 * If defined, a converter function will be applied to compare an
 * array element with the search value
 * 
 * If returnClosestElement is true, the element closest to the search value will be returned,
 * even if it is not equal
 * 
 * If false, only an exact match will be returned, otherwise undefined
 * 
 * @see {@link https://en.wikipedia.org/wiki/Binary_search_algorithm}
 */
function binarySearchFor (array, searchValue, converter, returnClosestElement = false) {
  if (!array || !isArray(array)) return;

  let leftLimit = 0;
  let rightLimit = array.length - 1;

  while (leftLimit <= rightLimit) {
    const pivot = leftLimit + Math.floor((rightLimit - leftLimit) / 2);

    const compareValue = !converter ? array[pivot] : converter(array[pivot]);

    if (compareValue === searchValue) {
      return array[pivot];
    } else {
      if (compareValue > searchValue) {
        rightLimit = pivot - 1;
      } else {
        leftLimit = pivot + 1;
      }
    }
  }

  if (returnClosestElement) {
    // left and right limit point to two elements
    //   of which one must be the elemnt closest to the search value
    if (!array[leftLimit]) return array[rightLimit];
    if (!array[rightLimit]) return array[leftLimit];
    const compareValueL = !converter ? array[leftLimit] : converter(array[leftLimit]);
    const compareValueR = !converter ? array[rightLimit] : converter(array[rightLimit]);
    const diffOfElementL = Math.abs(compareValueL - searchValue);
    const diffOfElementR = Math.abs(compareValueR - searchValue);
    return diffOfElementL - diffOfElementR < 0 ? array[leftLimit] : array[rightLimit];
  }

  return undefined;
}

const findIndex = features.findIndex
  ? function (arr, iterator, context) { return arr.findIndex(iterator, context); }
  : function (arr, iterator, context) {
    let i = -1;
    return arr.find(function (ea, j) { i = j; return iterator.call(ea, context); }) ? i : -1;
  };

/**
 * find the first occurence for which `iterator` returns a truthy value and
 * return *this* value, i.e. unlike `find` the iterator result and not the
 * element of the list is returned
 */
function findAndGet (arr, iterator) {
  let result;
  arr.find(function (ea, i) { return result = iterator(ea, i); });
  return result;
}

/**
 * [a] -> String -> [a]
 * 
 * ```
 * var objects = [{x: 3}, {y: 4}, {x:5}]
 * arr.filterByKey(objects, "x") // => [{x: 3},{x: 5}]
 * ```
 */
function filterByKey (arr, key) {
  return arr.filter(function (ea) { return !!ea[key]; });
}

/**
 * [a] -> String|RegExp -> [a]
 * 
 * `filter` can be a String or RegExp. Will stringify each element in the array
 * ```
 * ["Hello", "World", "Lively", "User"].grep("l") // => ["Hello","World","Lively"]
 * ``` 
*/
function grep (arr, test, context) {
  if (typeof test === 'string') test = new RegExp(test, 'i');
  return filter(arr, filter.test.bind(test));
}

/**
 * select every element in array for which array's element is truthy
 * 
 * ```
 * [1,2,3].mask([false, true, false]) => [2]
 * ``` 
*/
function mask (array, mask) {
  return filter(array, function (_, i) { return !!mask[i]; });
}

function reject (array, func, context) {
  function iterator (val, i) { return !func.call(context, val, i); }
  return filter(array, iterator);
}

function rejectByKey (array, key) {
  return filter(array, function (ea) { return !ea[key]; });
}

/**
 *  non-mutating
 * ```
 * arr.without([1,2,3,4,5,6], 3) => [1,2,4,5,6]
 * ```
 */
function without (array, elem) {
  return filter(array, val => val !== elem);
}

/**
 *  non-mutating
 * ```
 * arr.withoutAll([1,2,3,4,5,6], [3,4]) => [1,2,5,6]
 * ```
 */
function withoutAll (array, otherArr) {
  return filter(array, val => otherArr.indexOf(val) === -1);
}

/**
 *  non-mutating
 * 
 * Removes duplicates from array.
 * 
 * if sorted == true then assume array is sorted which allows `uniq` to be more efficient
 * ```
 * arr.uniq([3,5,6,2,3,4,2,6,4]) => [3,5,6,2,4]
 * ```
 */
function uniq (array, sorted) {
  if (!array.length) return array;

  const result = [array[0]];
  if (sorted) {
    for (let i = 1; i < array.length; i++) {
      const val = array[i];
      if (val !== result[result.length]) { result.push(val); }
    }
  } else {
    for (let i = 1; i < array.length; i++) {
      const val = array[i];
      if (result.indexOf(val) === -1) { result.push(val); }
    }
  }
  return result;
}

/**
 * like `arr.uniq` but with custom equality: `comparator(a,b)` returns
 * BOOL. True if a and be should be regarded equal, false otherwise.
 */
function uniqBy (array, comparator, context) { 
  const result = array.slice();
  for (let i = result.length; i--;) {
    const item = array[i];
    for (let j = i + 1; j < result.length; j++) {
      if (comparator.call(context, item, result[j])) { result.splice(j--, 1); }
    }
  }
  return result;
}

/**
 * like `arr.uniq` but with equality based on item[key]
 */
function uniqByKey (array, key) {
  const seen = {}; const result = [];
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    if (!seen[item[key]]) {
      seen[item[key]] = true;
      result.push(item);
    }
  }
  return result;
}

/**
 * removes falsy values
 * ```
 * arr.compact([1,2,undefined,4,0]) // => [1,2,4]
 * ```
 */
function compact (array) {
  return filter(array, Boolean);
}

function mutableCompact (array) {
  // fix gaps that were created with 'delete'
  let i = 0; let j = 0; const len = array.length;
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

/**
 * [a] -> (a -> Undefined) -> c? -> Undefined
 * 
 * `iterator` is called on each element in `array` for side effects. 
 * Like `Array.prototype.forEach`.
 */
function forEach (array, iterator, context) {
  return array.forEach(iterator, context);
}

/**
 * Takes any number of lists as arguments. Combines them elment-wise.
 * ```
 * arr.zip([1,2,3], ["a", "b", "c"], ["A", "B"])
 * => [[1,"a","A"],[2,"b","B"],[3,"c",undefined]]
 * ```
 */
function zip (/* arr, arr2, arr3 */) {
  const args = Array.from(arguments);
  const array = args.shift();
  const iterator = typeof last(args) === 'function'
    ? args.pop()
    : function (x) { return x; };
  const collections = [array].concat(args).map(function (ea) { return Array.from(ea); });
  return array.map(function (value, index) {
    return iterator(pluck(collections, index), index);
  });
}

/**
 * Turns a nested collection into a flat one.
 * ```
 * arr.flatten([1, [2, [3,4,5], [6]], 7,8])
 * => [1,2,3,4,5,6,7,8]
 * ```
 */
function flatten (array, optDepth) {
  if (typeof optDepth === 'number') {
    if (optDepth <= 0) return array;
    optDepth--;
  }
  return array.reduce(function (flattened, value) {
    return flattened.concat(Array.isArray(value)
      ? flatten(value, optDepth)
      : [value]);
  }, []);
}

function flatmap (array, it, ctx) {
  // the simple version
  // Array.prototype.concat.apply([], array.map(it, ctx));
  // causes stack overflows with really big arrays
  const results = [];
  for (let i = 0; i < array.length; i++) {
    results.push.apply(results, it.call(ctx, array[i], i));
  }
  return results;
}

/**
 * Injects delim between elements of array
 * ```
 * lively.lang.arr.interpose(["test", "abc", 444], "aha"));
 * => ["test","aha","abc","aha",444]
 * ```
 */
function interpose (array, delim) {
  return array.reduce(function (xs, x) {
    if (xs.length > 0) xs.push(delim);
    xs.push(x); return xs;
  }, []);
}

function delimWith (array, delim) {
  // ignore-in-doc
  // previously used, use interpose now!
  return interpose(array, delim);
}

// -=-=-=-=-
// mapping
// -=-=-=-=-

/**
 * [a] -> (a -> b) -> c? -> [b]
 * pplies `iterator` to each element of `array` and returns a new Array
 * with the results of those calls. Like `Array.prototype.some`.
 */
function map (array, iterator, context) {
  return array.map(iterator, context);
}

/**
 * Calls `method` on each element in `array`, passing all arguments.
 * Often a handy way to avoid verbose `map` calls.
 * ```
 * arr.invoke(["hello", "world"], "toUpperCase") // => ["HELLO","WORLD"]
 * ```
 */
function invoke (array, method, arg1, arg2, arg3, arg4, arg5, arg6) {
  return array.map(function (ea) {
    return ea[method](arg1, arg2, arg3, arg4, arg5, arg6);
  });
}

/**
 * Returns `property` or undefined from each element of array. For quick `map`s and similar to `invoke`.
 * ```
 * arr.pluck(["hello", "world"], 0) // => ["h","w"]
 * ```
 * @param {*} array 
 * @param {*} property 
 */
function pluck (array, property) {
  return array.map(ea => ea[property]);
}

// -=-=-=-=-
// folding
// -=-=-=-=-

/**
 * Array -> Function -> Object? -> Object? -> Object?
 * 
 * Applies `iterator` to each element of `array` and returns a new Array
 * with the results of those calls. Like `Array.prototype.some`.
 * @param {*} array 
 * @param {*} iterator 
 * @param {*} memo 
 * @param {*} context 
 */
function reduce (array, iterator, memo, context) {
  return array.reduce(iterator, memo, context);
}

/**
 * 
 * @param {*} array 
 * @param {*} iterator 
 * @param {*} memo 
 * @param {*} context 
 */
function reduceRight (array, iterator, memo, context) {
  return array.reduceRight(iterator, memo, context);
}

// -=-=-=-=-
// testing
// -=-=-=-=-

const isArray = Array.isArray;

const includes = features.includes
  ? function (array, object) { return array.includes(object); }
  : function (array, object) {
    // Example: arr.include([1,2,3], 2) // => true
    return array.indexOf(object) !== -1;
  };

const include = includes;

/**
 * [a] -> (a -> Boolean) -> c? -> Boolean
 * 
 * Returns true if there is at least one abject in `array` for which
 * `iterator` returns a truthy result. Like `Array.prototype.some`.
 * @param {*} array 
 * @param {*} iterator 
 * @param {*} context 
 */
function some (array, iterator, context) {
  return array.some(iterator, context);
}

/**
 * [a] -> (a -> Boolean) -> c? -> Boolean
 * 
 * Returns true if for all abjects in `array` `iterator` returns a truthy
 * result. Like `Array.prototype.every`.
 * @param {*} array 
 * @param {*} iterator 
 * @param {*} context 
 */
function every (array, iterator, context) {
  return array.every(iterator, context);
}

/**
 * Returns true if each element in `array` is equal (`==`) to its
 * corresponding element in `otherArray`
 * @param {*} array 
 * @param {*} otherArray 
 */
function equals (array, otherArray) {
  const len = array.length;
  if (!otherArray || len !== otherArray.length) return false;
  for (let i = 0; i < len; i++) {
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

/**
 * Returns true if each element in `array` is structurally equal
 * (`lang.obj.equals`) to its corresponding element in `otherArray`
 * @param {*} array 
 * @param {*} otherArray 
 */
function deepEquals (array, otherArray) { 
  const len = array.length;
  if (!otherArray || len !== otherArray.length) return false;
  for (let i = 0; i < len; i++) {
    if (!objectEquals(array[i], otherArray[i])) return false;
  }
  return true;
}

// -=-=-=-=-
// sorting
// -=-=-=-=-

/**
 * 
 * @param {*} array 
 * @param {*} descending 
 * @returns {Boolean} wether `array` is sorted or not.
 */
function isSorted (array, descending) {
  if (descending) {
    for (var i = 1; i < array.length; i++) { if (array[i - 1] < array[i]) return false; }
  } else {
    for (var i = 1; i < array.length; i++) { if (array[i - 1] > array[i]) return false; }
  }
  return true;
}

function sort (array, sortFunc) {
  // [a] -> (a -> Number)? -> [a]
  // Just `Array.prototype.sort`
  return array.sort(sortFunc);
}
/**
 * ```
 * arr.sortBy(["Hello", "Lively", "User"], function(ea) {
 *   return ea.charCodeAt(ea.length-1); })
 * => ["Hello","User","Lively"]
 * ```
 */
function sortBy (array, iterator, context) {
  return pluck(
    array.map(function (value, index) {
      return { value: value, criteria: iterator.call(context, value, index) };
    }).sort(function (left, right) {
      const a = left.criteria; const b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
}

/**
 * ```
 * lively.lang.arr.sortByKey([{x: 3}, {x: 2}, {x: 8}], "x")
 * => [{x: 2},{x: 3},{x: 8}]
 * ```
 */
function sortByKey (array, key) {
  return sortBy(array, ea => ea[key]);
}

function reverse (array) { return array.reverse(); }

function reversed (array) { return array.slice().reverse(); }

// -=-=-=-=-=-=-=-=-=-=-=-=-
// RegExp / String matching
// -=-=-=-=-=-=-=-=-=-=-=-=-

function reMatches (arr, re, stringifier) {
  // result might include null items if re did not match (usful for masking)
  // Example:
  //   var morphs = $world.withAllSubmorphsDo(function(x) { return x; ;
  //   morphs.mask(morphs.reMatches(/code/i))
  stringifier = stringifier || String;
  return arr.map(ea => stringifier(ea).match(re));
}

// -=-=-=-=-=-
// accessors
// -=-=-=-=-=-

function first (array) { return array[0]; }

function last (array) { return array[array.length - 1]; }

// -=-=-=-=-=-=-=-
// Set operations
// -=-=-=-=-=-=-=-

/**
 * set-like intersection
 */
function intersect (array1, array2) {
  return filter(uniq(array1), item => array2.indexOf(item) > -1);
}

/**
 * set-like union
 */
function union (array1, array2) {
  const result = array1.slice();
  for (let i = 0; i < array2.length; i++) {
    const item = array2[i];
    if (result.indexOf(item) === -1) result.push(item);
  }
  return result;
}

/**
 * inserts `item` at `index`, mutating
 * @param {*} array 
 * @param {*} item 
 * @param {*} index 
 */
function pushAt (array, item, index) {
  array.splice(index, 0, item);
}

/**
 * inserts item at `index`, mutating
 * @param {*} array 
 * @param {*} index 
 */
function removeAt (array, index) {
  array.splice(index, 1);
}

/**
 * removes first occurrence of item in `array`, mutating
 * @param {*} array 
 * @param {*} item 
 * @returns {*} item
 */
function remove (array, item) {
  const index = array.indexOf(item);
  if (index >= 0) removeAt(array, index);
  return item;
}

/**
 * appends all `items`, mutating
 * @param {*} array 
 * @param {*} items 
 * @returns {array} array
 */
function pushAll (array, items) {
  array.push.apply(array, items);
  return array;
}

/**
 * inserts all `items` at `idx`, mutating
 * @param {*} array 
 * @param {*} items 
 * @param {*} idx 
 */
function pushAllAt (array, items, idx) {
  array.splice.apply(array, [idx, 0].concat(items));
}

/**
 * only appends `item` if its not already in `array`, mutating
 * @param {*} array 
 * @param {*} item 
 */
function pushIfNotIncluded (array, item) {
  if (!array.includes(item)) array.push(item);
}

/**
 * mutating
 * @param {*} array 
 * @param {*} item 
 * @param {*} index 
 */
function replaceAt (array, item, index) {
  array.splice(index, 1, item);
}

/**
 * removes all items, mutating
 * @param {*} array 
 * @returns {array} array
 */
function clear (array) {
  array.length = 0; return array;
}

/**
 * are all elements in list1 in list2?
 * @param {*} list1 
 * @param {*} list2 
 * @returns {boolean}
 */
function isSubset (list1, list2) {
  for (let i = 0; i < list1.length; i++) {
    if (!list2.includes(list1[i])) { return false; }
  }
  return true;
}

// -=-=-=-=-=-=-=-=-=-=-=-
// asynchronous iteration
// -=-=-=-=-=-=-=-=-=-=-=-

/**
 * Iterates over array but instead of consecutively calling iterator,
 * iterator gets passed in the invocation for the next iteration step
 * as a function as first parameter. This allows to wait arbitrarily
 * between operation steps, great for managing dependencies between tasks.
 * Related is [`fun.composeAsync`]().
 * ```
 * arr.doAndContinue([1,2,3,4], function(next, n) {
 *   alert("At " + n);
 *   setTimeout(next, 100);
 * }, function() { alert("Done"); })
 * ```
 * If the elements are functions you can leave out the iterator:
 * ```
 * arr.doAndContinue([
 *   function(next) { alert("At " + 1); next(); },
 *   function(next) { alert("At " + 2); next(); }
 * ], null, function() { alert("Done"); }); 
 ``` 
 */
function doAndContinue (array, iterator, endFunc, context) {
  endFunc = endFunc || NullFunction;
  context = context || GLOB;
  iterator = iterator || function (next, ea, idx) { ea.call(context, next, idx); };
  return array.reduceRight(function (nextFunc, ea, idx) {
    return function () { iterator.call(context, nextFunc, ea, idx); };
  }, endFunc)();
}

function nestedDelay (array, iterator, waitSecs, endFunc, context, optSynchronChunks) {
  // Calls `iterator` for every element in `array` and waits between iterator
  // calls `waitSecs`. Eventually `endFunc` is called. When passing a number n
  // as `optSynchronChunks`, only every nth iteration is delayed.
  endFunc = endFunc || function () {};
  return array.clone().reverse().reduce(function (nextFunc, ea, idx) {
    return function () {
      iterator.call(context || GLOB, ea, idx);
      // only really delay every n'th call optionally
      if (optSynchronChunks && (idx % optSynchronChunks !== 0)) {
        nextFunc();
      } else {
        nextFunc.delay(waitSecs);
      }
    };
  }, endFunc)();
}

function forEachShowingProgress (/* array, progressBar, iterator, labelFunc, whenDoneFunc, context or spec */) {
  // ignore-in-doc
  const args = Array.from(arguments);
  const array = args.shift();
  const steps = array.length;
  let progressBar; let iterator; let labelFunc; let whenDoneFunc; let context;
  let progressBarAdded = false;

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
  if (!context) context = typeof window !== 'undefined' ? window : GLOB;
  if (!labelFunc) labelFunc = function (x) { return x; };

  // init progressbar
  if (!progressBar) {
    progressBarAdded = true;
    const Global = typeof window !== 'undefined' ? window : GLOB;
    const world = Global.lively && lively.morphic && lively.morphic.World.current();
    progressBar = world
      ? world.addProgressBar()
      : {
          value: null,
          label: null,
          remove: function () {}
        };
  }
  progressBar.value = 0;

  // nest functions so that the iterator calls the next after a delay
  (array.reduceRight(function (nextFunc, item, idx) {
    return function () {
      try {
        progressBar.value = (idx / steps);
        if (labelFunc) progressBar.label = (labelFunc.call(context, item, idx));
        iterator.call(context, item, idx);
      } catch (e) {
        console.error(
          'Error in forEachShowingProgress at %s (%s)\n%s\n%s',
          idx, item, e, e.stack);
      }
      delay(nextFunc, 0);
    };
  }, function () {
    progressBar.value = 1;
    if (progressBarAdded) (function () { progressBar.remove(); }).delay(0);
    if (whenDoneFunc) whenDoneFunc.call(context);
  }))();

  return array;
}

function swap (array, index1, index2) {
  // mutating
  // Example:
  // var a = [1,2,3,4];
  // arr.swap(a, 3, 1);
  // a // => [1,4,3,2]
  if (index1 < 0) index1 = array.length + index1;
  if (index2 < 0) index2 = array.length + index2;
  const temp = array[index1];
  array[index1] = array[index2];
  array[index2] = temp;
  return array;
}

function rotate (array, times) {
  // non-mutating
  // Example:
  // arr.rotate([1,2,3]) // => [2,3,1]
  times = times || 1;
  return array.slice(times).concat(array.slice(0, times));
}

// -=-=-=-=-
// grouping
// -=-=-=-=-

function groupBy (array, iterator, context) {
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

function groupByKey (array, key) {
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

function partition (array, iterator, context) {
  // Example:
  // var array = [1,2,3,4,5,6];
  // arr.partition(array, function(ea) { return ea > 3; })
  // // => [[1,2,3,4],[5,6]]
  iterator = iterator || function (x) { return x; };
  const trues = []; const falses = [];
  array.forEach(function (value, index) {
    (iterator.call(context, value, index) ? trues : falses).push(value);
  });
  return [trues, falses];
}

function batchify (array, constrainedFunc, context) {
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
  function extractBatch (batch, sizes) {
    // ignore-in-doc
    // Array -> Array -> Array[Array,Array]
    // case 1: no sizes to distribute, we are done
    if (!sizes.length) return [batch, []];
    const first = sizes[0]; const rest = sizes.slice(1);
    // if batch is empty we have to take at least one
    // if batch and first still fits, add first
    const candidate = batch.concat([first]);
    if (constrainedFunc.call(context, candidate)) return extractBatch(candidate, rest);
    // otherwise leave first out for now
    const batchAndSizes = extractBatch(batch, rest);
    return [batchAndSizes[0], [first].concat(batchAndSizes[1])];
  }

  function findBatches (batches, sizes) {
    if (!sizes.length) return batches;
    const extracted = extractBatch([], sizes);
    if (!extracted[0].length) {
      throw new Error('Batchify constrained does not ensure consumption ' +
              'of at least one item per batch!');
    }
    return findBatches(batches.concat([extracted[0]]), extracted[1]);
  }
}

function toTuples (array, tupleLength) {
  // Creates sub-arrays with length `tupleLength`
  // Example:
  // arr.toTuples(["H","e","l","l","o"," ","W","o","r","l","d"], 4)
  // // => [["H","e","l","l"],["o"," ","W","o"],["r","l","d"]]
  tupleLength = tupleLength || 1;
  return range(0, Math.ceil(array.length / tupleLength) - 1).map(function (n) {
    return array.slice(n * tupleLength, n * tupleLength + tupleLength);
  }, array);
}

const permutations = (function () {
  function computePermutations (restArray, values) {
    return !restArray.length
      ? [values]
      : flatmap(restArray, function (ea, i) {
        return computePermutations(
          restArray.slice(0, i).concat(restArray.slice(i + 1)),
          values.concat([ea]));
      });
  }
  return function (array) { return computePermutations(array, []); };
})();

function combinationsPick (listOfListsOfValues, pickIndices) {
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
  const values = listOfListsOfValues.map(function (subspace, i) {
    return subspace[pickIndices[i]];
  });
  let nextState = pickIndices.slice();
  for (let i = listOfListsOfValues.length; i--; i >= 0) {
    const subspace = listOfListsOfValues[i]; const nextIndex = nextState[i] + 1;
    if (subspace[nextIndex]) { nextState[i] = nextIndex; break; } else if (i === 0) { nextState = undefined; break; } else { nextState[i] = 0; }
  }
  return [values, nextState];
}

function combinations (listOfListsOfValues) {
  // Given a "listOfListsOfValues" in the form of an array of arrays,
  // retrieve all the combinations by picking one item from each array.
  // This basically creates a search tree, traverses it and gathers all node
  // values whenever a leaf node is reached.
  // Example:
  //   lively.lang.arr.combinations([['a', 'b', 'c'], [1, 2]])
  //    // => [["a", 1], ["a", 2], ["b", 1], ["b", 2], ["c", 1], ["c", 2]]
  const size = listOfListsOfValues.reduce(function (prod, space) { return prod * space.length; }, 1);
  let searchState = listOfListsOfValues.map(function (_) { return 0; });
  const results = new Array(size);
  for (let i = 0; i < size; i++) {
    const result = combinationsPick(listOfListsOfValues, searchState);
    results[i] = result[0];
    searchState = result[1];
  }
  return results;
}

function take (arr, n) { return arr.slice(0, n); }

function drop (arr, n) { return arr.slice(n); }

function takeWhile (arr, fun, context) {
  let i = 0;
  for (; i < arr.length; i++) { if (!fun.call(context, arr[i], i)) break; }
  return arr.slice(0, i);
}

function dropWhile (arr, fun, context) {
  let i = 0;
  for (; i < arr.length; i++) { if (!fun.call(context, arr[i], i)) break; }
  return arr.slice(i);
}

// -=-=-=-=-=-
// randomness
// -=-=-=-=-=-

function shuffle (array) {
  // Ramdomize the order of elements of array. Does not mutate array.
  // Example:
  // shuffle([1,2,3,4,5]) // => [3,1,2,5,4]
  const unusedIndexes = range(0, array.length - 1);
  const shuffled = Array(array.length);
  for (let i = 0; i < array.length; i++) {
    const shuffledIndex = unusedIndexes.splice(
      Math.round(Math.random() * (unusedIndexes.length - 1)), 1);
    shuffled[shuffledIndex] = array[i];
  }
  return shuffled;
}

// -=-=-=-=-=-=-=-
// Number related
// -=-=-=-=-=-=-=-

function max (array, iterator, context) {
  // Example:
  //   var array = [{x:3,y:2}, {x:5,y:1}, {x:1,y:5}];
  //   arr.max(array, function(ea) { return ea.x; }) // => {x: 5, y: 1}
  iterator = iterator || function (x) { return x; };
  let result;
  array.reduce(function (max, ea, i) {
    const val = iterator.call(context, ea, i);
    if (typeof val !== 'number' || val <= max) return max;
    result = ea; return val;
  }, -Infinity);
  return result;
}

function min (array, iterator, context) {
  // Similar to `arr.max`.
  iterator = iterator || (x => x);
  return max(array, (ea, i) => -iterator.call(context, ea, i));
}

function sum (array) {
  // show-in-doc
  let sum = 0;
  for (let i = 0; i < array.length; i++) { sum += array[i]; }
  return sum;
}

function count (array, item) {
  return array.reduce(function (count, ea) {
    return ea === item ? count + 1 : count;
  }, 0);
}

function size (array) { return array.length; }

function histogram (data, binSpec) {
  // ignore-in-doc
  // Without a `binSpec` argument partition the data
  // var numbers = arr.genN(10, num.random);
  // var numbers = arr.withN(10, "a");
  // => [65,73,34,94,92,31,27,55,95,48]
  // => [[65,73],[34,94],[92,31],[27,55],[95,48]]
  // => [[82,50,16],[25,43,77],[40,64,31],[51,39,13],[17,34,87],[51,33,30]]
  if (typeof binSpec === 'undefined' || typeof binSpec === 'number') {
    const binNumber = binSpec || (function sturge () {
      return Math.ceil(Math.log(data.length) / Math.log(2) + 1);
    })(data);
    const binSize = Math.ceil(Math.round(data.length / binNumber));
    return range(0, binNumber - 1).map(function (i) {
      return data.slice(i * binSize, (i + 1) * binSize);
    });
  } else if (binSpec instanceof Array) {
    // ignore-in-doc
    // bins specifies n threshold values that will create n-1 bins.
    // Each data value d is placed inside a bin i if:
    // threshold[i] >= d && threshold[i+1] < d
    const thresholds = binSpec;
    return data.reduce(function (bins, d) {
      if (d < thresholds[1]) { bins[0].push(d); return bins; }
      for (let i = 1; i < thresholds.length; i++) {
        if (d >= thresholds[i] && (!thresholds[i + 1] || d <= thresholds[i + 1])) {
          bins[i].push(d); return bins;
        }
      }
      throw new Error(`Histogram creation: Cannot group data ${d} into thresholds ${thresholds}`);
    }, range(1, thresholds.length).map(function () { return []; }));
  }
}

// -=-=-=-=-
// Copying
// -=-=-=-=-

function clone (array) {
  // shallow copy
  return [].concat(array);
}

// -=-=-=-=-=-
// conversion
// -=-=-=-=-=-

function toArray (array) { return from(array); }

// -=-=-=-=-=-
// DEPRECATED
// -=-=-=-=-=-

function each (arr, iterator, context) {
  return arr.forEach(iterator, context);
}

function all (arr, iterator, context) {
  return arr.every(iterator, context);
}

function any (arr, iterator, context) {
  return arr.some(iterator, context);
}

function collect (arr, iterator, context) {
  return arr.map(iterator, context);
}

function findAll (arr, iterator, context) {
  return filter(arr, iterator, context);
}

function inject (array, memo, iterator, context) {
  if (context) iterator = iterator.bind(context);
  return array.reduce(iterator, memo);
}

// asynch methods
function mapAsyncSeries (array, iterator, callback) {
  // Apply `iterator` over `array`. Unlike `mapAsync` the invocation of
  // the iterator happens step by step in the order of the items of the array
  // and not concurrently.

  // ignore-in-doc
  // Could simply be:
  // return exports.arr.mapAsync(array, {parallel: 1}, iterator, callback);
  // but the version below is 2x faster

  const result = []; let callbackTriggered = false;
  return array.reduceRight(function (nextFunc, ea, idx) {
    if (callbackTriggered) return;
    return function (err, eaResult) {
      if (err) return maybeDone(err);
      if (idx > 0) result.push(eaResult);
      try {
        iterator(ea, idx, once(nextFunc));
      } catch (e) { maybeDone(e); }
    };
  }, function (err, eaResult) {
    result.push(eaResult);
    maybeDone(err, true);
  })();

  function maybeDone (err, finalCall) {
    if (callbackTriggered || (!err && !finalCall)) return;
    callbackTriggered = true;
    try { callback(err, result); } catch (e) {
      console.error('Error in mapAsyncSeries - callback invocation error:\n' + (e.stack || e));
    }
  }
}

function mapAsync (array, options, iterator, callback) {
  // Apply `iterator` over `array`. In each iterator gets a callback as third
  // argument that should be called when the iteration is done. After all
  // iterators have called their callbacks, the main `callback` function is
  // invoked with the result array.
  // Example:
  // lively.lang.arr.mapAsync([1,2,3,4],
  //   function(n, i, next) { setTimeout(function() { next(null, n + i); }, 20); },
  //   function(err, result) { /* result => [1,3,5,7] */ });

  if (typeof options === 'function') {
    callback = iterator;
    iterator = options;
    options = null;
  }
  options = options || {};

  if (!array.length) return callback && callback(null, []);

  if (!options.parallel) options.parallel = Infinity;

  const results = []; const completed = [];
  let callbackTriggered = false;
  let lastIteratorIndex = 0;
  let nActive = 0;

  const iterators = array.map(function (item, i) {
    return function () {
      nActive++;
      try {
        iterator(item, i, once(function (err, result) {
          results[i] = err || result;
          maybeDone(i, err);
        }));
      } catch (e) { maybeDone(i, e); }
    };
  });

  return activate();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function activate () {
    while (nActive < options.parallel && lastIteratorIndex < array.length) { iterators[lastIteratorIndex++](); }
  }

  function maybeDone (idx, err) {
    if (completed.indexOf(idx) > -1) return;
    completed.push(idx);
    nActive--;
    if (callbackTriggered) return;
    if (!err && completed.length < array.length) { activate(); return; }
    callbackTriggered = true;
    try { callback && callback(err, results); } catch (e) {
      console.error('Error in mapAsync - main callback invocation error:\n' + (e.stack || e));
    }
  }
}

// poly-filling...
if (!features.from) Array.from = from;
if (!features.filter) Array.prototype.filter = function (it, ctx) { return filter(this, it, ctx); };
if (!features.find) Array.prototype.find = function (it, ctx) { return detect(this, it, ctx); };
if (!features.findIndex) Array.prototype.findIndex = function (it, ctx) { return findIndex(this, it, ctx); };
if (!features.includes) Array.prototype.includes = function (x) { return includes(this, x); };

export {
  range,
  from,
  withN,
  genN,
  filter,
  detect,
  binarySearchFor,
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
  mapAsync
};
