/**
 * Methods to make working with arrays more convenient and collection-like.
 * @module lively.lang/array
 */

import { equals as objectEquals } from './object.js';
import { Null as NullFunction } from './function.js';
import Group from './Group.js';

/**
 * Creates an array containing elements from `begin` until `end` with `step`-sized steps.
 * @param {number} begin - First element
 * @param {number} end  - Last element
 * @param {number} step - step size
 * @returns {number[]}
 */
function range (begin, end, step) {
  step = step || 0;
  const result = [];
  if (begin <= end) {
    if (step <= 0) step = -step || 1;
    for (let i = begin; i <= end; i += step) result.push(i);
  } else {
    if (step >= 0) step = -step || -1;
    for (let i = begin; i >= end; i += step) result.push(i);
  }
  return result;
}

/**
 * Returns an array filled with `obj` for `n` times.
 * @param {number} n - Length of the array to create
 * @param {Object} obj - Object with which the array is to be filled
 * @returns {any[]}
 */
function withN (n, obj) {
  const result = new Array(n);
  while (n > 0) result[--n] = obj;
  return result;
}

/**
 * Creates an array with the result of `generator` called `n` times.
 *
 * `arr.genN(3, num.random) => [46,77,95]`
 * @param {number} n
 * @param {function} generator
 * @returns {any[]}
*/
function genN (n, generator) {
  const result = new Array(n);
  while (n > 0) result[--n] = generator(n);
  return result;
}

/**
 * Returns the element equal to the given search value or undefined.
 *
 * If defined, a converter function will be applied to compare an
 * array element with the search value
 *
 * If `returnClosestElement` is `true`, the element closest to the search value will be returned,
 * even if it is not equal.
 *
 * If `false`, only an exact match will be returned, otherwise undefined will be returned.
 * @param {any[]} array - The array in which to search
 * @param {Object} searchValue - The value to search for in `array`
 * @param {function} converter - The function used to compare array elements with `searchValue`
 * @param {Boolean} returnClosestElement - Whether only exact matches should be returned
 * @returns {Object}
 * @see {@link https://en.wikipedia.org/wiki/Binary_search_algorithm}
 */
function binarySearchFor (array, searchValue, converter, returnClosestElement = false) {
  if (!array || !Array.isArray(array)) return;

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

/**
 * Find the first occurence for which `iterator` returns a truthy value and
 * return *this* value, i.e. unlike `find` the iterator result and not the
 * element of the list is returned.
 * @param {any[]} arr
 * @param {function} iterator
 * @returns {Object}
 */
function findAndGet (arr, iterator) {
  let result;
  arr.find(function (ea, i) { return result = iterator(ea, i); });
  return result;
}

/**
 * Returns only the Objects in `arr` that have `key` as property.
 * @param {any[]} arr
 * @param {string} key
 * @returns {any[]}
 */
function filterByKey (arr, key) {
  return arr.filter(function (ea) { return !!ea[key]; });
}

/**
 * Returns an array that contains all elements of `arr` that contain/satisfy `test`.
 * `grep` stringifies all elements in `arr`.
 * @param {any[]} arr
 * @param {String|RegEx} test
 * @returns {any[]}
 */
function grep (arr, test) {
  if (typeof test === 'string') test = new RegExp(test, 'i');
  return arr.filter(e => String(e).match(test));
}

/**
 * Return an array containing all elements or `array` for which `mask` contains a truthy value at the same index.
 * @param {any[]} array - The array which should be subsetted.
 * @param {Boolean[]} mask - Array used for masking `array`.
 * @returns {any[]}
 */
function mask (array, mask) {
  return array.filter(function (_, i) { return !!mask[i]; });
}

/**
 * Returns an array of all elements of `array` for which `func` is falsy.
 * @param {Obejct[]} array - The array which should be subsetted.
 * @param {function} func - Function that is used for testing.
 * @param {Object} context - Acts as `this` when calling `func`.
 * @returns {any[]}
 */
function reject (array, func, context) {
  function iterator (val, i) { return !func.call(context, val, i); }
  return array.filter(iterator);
}

/**
 * Returns an array of all elements of `array` that do not have `key` as property.
 * @param {any[]} array
 * @param {string} key
 * @returns {any[]}
 */
function rejectByKey (array, key) {
  return array.filter(function (ea) { return !ea[key]; });
}

/**
 * Returns a copy of `array` without `elem`.
 * @param {any[]} array
 * @param {Object} elem
 * @returns {any[]}
 */
function without (array, elem) {
  return array.filter(val => val !== elem);
}

/**
 * Returns a copy of `array` without all elements in `otherArr`.
 * @param {any[]} array
 * @param {any[]} otherArr
 * @returns {any[]}
 */
function withoutAll (array, otherArr) {
  return array.filter(val => otherArr.indexOf(val) === -1);
}

/**
 * Returns `array` without duplicates.
 * @param {any[]} array
 * @param {boolean} sorted - Wether `array` is sorted. Used for optimizations.
 * @returns {any[]}
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
 * Like `arr.uniq` but with custom equality `comparator(a,b)`.
 * @param {any[]} array
 * @param {function} comparator - Function used to determine if a equals b
 * @param {Object} context - Used as `this` when calling `comparator`.
 * @returns {any[]}
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
 * Like `arr.uniq` but with equality based on `array[index].key`.
 * @param {any[]} array
 * @param {string} key
 * @returns {any[]}
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
 * Returns a copy of `array` with falsy values removed.
 * @param {any[]} array
 * @returns {any[]}
 */
function compact (array) {
  return array.filter(Boolean);
}

/**
 * Returns `array` with falsy values removed.
 * @param {any[]} array
 * @returns {any[]}
 */
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

/**
 * Takes any number of lists as arguments. Combines them elment-wise.
 * ```
 * arr.zip([1,2,3], ["a", "b", "c"], ["A", "B"])
 * => [[1,"a","A"],[2,"b","B"],[3,"c",undefined]]
 * ```
 * @param arguments - Any number of lists
 * @returns {any[]}
 */
function zip (/* arr, arr2, arr3 */) {
  const args = Array.from(arguments);
  const array = args.shift();
  const iterator = typeof last(args) === 'function' // eslint-disable-line no-use-before-define
    ? args.pop()
    : function (x) { return x; };
  const collections = [array].concat(args).map(function (ea) { return Array.from(ea); });
  return array.map(function (value, index) {
    return iterator(pluck(collections, index), index); // eslint-disable-line no-use-before-define
  });
}
/**

/**
 * Returns a new array that contains an element of `arra` and `delim` alternating.
 * @param {any[]} array
 * @param {any} delim
 * @returns {any[]}
 */
function interpose (array, delim) {
  return array.reduce(function (xs, x) {
    if (xs.length > 0) xs.push(delim);
    xs.push(x); return xs;
  }, []);
}

/**
 * Calls `method` on each element in `array`, passing all arguments.
 * Often a handy way to avoid verbose `map` calls.
 * @param {any[]} array
 * @param {function} method - The method to invoke on all elements of `array`
 * @param {any} arg1
 * @param {any} arg2
 * @param {any} arg3
 * @param {any} arg4
 * @param {any} arg5
 * @param {any} arg6
 */
function invoke (array, method, arg1, arg2, arg3, arg4, arg5, arg6) {
  return array.map(function (ea) {
    return ea[method](arg1, arg2, arg3, arg4, arg5, arg6);
  });
}

/**
 * Returns `property` or undefined from each element of array. For quick `map`s and similar to `invoke`.
 * @param {any[]} array
 * @param {string} property - The property to return
 */
function pluck (array, property) {
  return array.map(ea => ea[property]);
}

/**
 * Returns true if each element in `array` is equal (`==`) to its
 * corresponding element in `otherArray`.
 * @param {any[]} array
 * @param {any[]} otherArray
 * @returns {boolean}
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
    if (array[i] !== otherArray[i]) return false;
  }
  return true;
}

/**
 * Returns true if each element in `array` is structurally equal
 * (`lang.obj.equals`) to its corresponding element in `otherArray`.
 * @param {any[]} array
 * @param {any[]} otherArray
 * @returns {boolean}
 */
function deepEquals (array, otherArray) {
  const len = array.length;
  if (!otherArray || len !== otherArray.length) return false;
  for (let i = 0; i < len; i++) {
    if (!objectEquals(array[i], otherArray[i])) return false;
  }
  return true;
}

/**
 * Returns a boolean indicating whether or not `array` is sorted.
 * @param {any[]} array
 * @param {boolean} descending - indicating if `array` should be checked for descending or ascending order
 * @returns {boolean} wether `array` is sorted or not
 */
function isSorted (array, descending) {
  if (descending) {
    for (let i = 1; i < array.length; i++) { if (array[i - 1] < array[i]) return false; }
  } else {
    for (let i = 1; i < array.length; i++) { if (array[i - 1] > array[i]) return false; }
  }
  return true;
}

/**
 * Sorts `array` according to the elements value of `iterator`.
 * @param {any[]} array - the array to sort
 * @param {function} iterator - the function to use to sort `array`
 * @param {Object} context - Used as `this` when calling `iterator`
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
 * Sorts array by the values of a given key.
 * @param {any[]} array - the array to sort
 * @param {string} key - the key to sort by
 */
function sortByKey (array, key) {
  return sortBy(array, ea => ea[key]);
}

function reversed (array) { return array.slice().reverse(); }

/**
 * Returns the matches of `re` for the elements in `arr`. Might include null items if `re` did not match.
 * @param {any[]} arr
 * @param {*} re - The refular expression to use
 * @param {*} stringifier - Used to stringify the elements of `arr`. Defaults to `String`.
 */
function reMatches (arr, re, stringifier) {
  // result might include null items if re did not match (usful for masking)
  // Example:
  //   var morphs = $world.withAllSubmorphsDo(function(x) { return x; ;
  //   morphs.mask(morphs.reMatches(/code/i))
  stringifier = stringifier || String;
  return arr.map(ea => stringifier(ea).match(re));
}

/**
 * Returns the first element of an array.
 */
function first (array) { return array[0]; }

/**
 * Returns the last element of an array.
 */
function last (array) { return array[array.length - 1]; }

/**
 * Rerturns the intersection of `array1` and `array2` according to set semantic.
 * @param {any[]} array1
 * @param {any[]} array2
 */
function intersect (array1, array2) {
  return uniq(array1).filter(item => array2.indexOf(item) > -1);
}

/**
 * Rerturns the union of `array1` and `array2` according to set semantic.
 * @param {any[]} array1
 * @param {any[]} array2
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
 * Inserts `item` at `index`. Mutating.
 * @param {any[]} array
 * @param {any} item
 * @param {number} index
 */
function pushAt (array, item, index) {
  array.splice(index, 0, item);
}

/**
 * Remove the element of `array` at `index`. Mutating.
 * @param {any[]} array
 * @param {number} index
 */
function removeAt (array, index) {
  array.splice(index, 1);
}

/**
 * Removes the first occurrence of `item` in `array`. Mutating.
 * @param {any[]} array
 * @param {any} item
 * @returns {any} item
 */
function remove (array, item) {
  const index = array.indexOf(item);
  if (index >= 0) removeAt(array, index);
  return item;
}

/**
 * Appends all `items` to `array`. Mutating.
 * @param {any[]} array
 * @param {any[]} items
 * @returns {any[]} array
 */
function pushAll (array, items) {
  array.push.apply(array, items);
  return array;
}

/**
 * Inserts all `items` at `idx`. Mutating.
 * @param {any[]} array
 * @param {anu[]} items
 * @param {number} idx
 */
function pushAllAt (array, items, idx) {
  array.splice.apply(array, [idx, 0].concat(items));
}

/**
 * Only appends `item` if its not already in `array`. Mutating.
 * @param {any[]} array
 * @param {any} item
 */
function pushIfNotIncluded (array, item) {
  if (!array.includes(item)) array.push(item);
}

/**
 * Replace the element `array[index]` with `item`. Mutating.
 * @param {any[]} array
 * @param {any} item
 * @param {number} index
 */
function replaceAt (array, item, index) {
  array.splice(index, 1, item);
}

/**
 * Removes all items. Mutating.
 * @param {any[]} array
 */
function clear (array) {
  array.length = 0; return array;
}

/**
 * Returns wether all elements in `list1` are in `list2`.
 * @param {any[]} list1
 * @param {any[]} list2
 * @returns {boolean}
 */
function isSubset (list1, list2) {
  for (let i = 0; i < list1.length; i++) {
    if (!list2.includes(list1[i])) { return false; }
  }
  return true;
}

/**
 * Iterates over array but instead of consecutively calling `iterator`,
 * `iterator` gets passed in the invocation for the next iteration step
 * as a function as first parameter. This allows to wait arbitrarily
 * between operation steps, great for managing dependencies between tasks.
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
 * @param {any[]} array - The array to iterate over
 * @param {function} iterator - The function that is called for each element of `array`
 * @param {function} endFunc - A function called once after iterating over `array`
 * @param {Object} context - Bound to `this` in `iterator`
 */
function doAndContinue (array, iterator, endFunc, context) {
  endFunc = endFunc || NullFunction;
  context = context;
  iterator = iterator || function (next, ea, idx) { ea.call(context, next, idx); };
  return array.reduceRight(function (nextFunc, ea, idx) {
    return function () { iterator.call(context, nextFunc, ea, idx); };
  }, endFunc)();
}

/**
 * Calls `iterator` for every element in `array` and waits between iterator
 * calls `waitSecs`. Eventually `endFunc` is called. When passing a number n
 * as `optSynchronChunks`, only every nth iteration is delayed.
 * @param {any[]} array - The array to iterate
 * @param {function} iterator
 * @param {number} waitSecs - The number of seconds to wait between invocations of `iterator`
 * @param {function} endFunc - A function called once after iterating over `array`
 * @param {Object} context - Bound to `this` in `iterator`
 * @param {number} optSynchronChunks - Only wait after each `n`th element
 */
function nestedDelay (array, iterator, waitSecs, endFunc, context, optSynchronChunks) {
  endFunc = endFunc || function () {};
  return array.clone().reverse().reduce(function (nextFunc, ea, idx) {
    return function () {
      iterator.call(context, ea, idx);
      // only really delay every n'th call optionally
      if (optSynchronChunks && (idx % optSynchronChunks !== 0)) {
        nextFunc();
      } else {
        nextFunc.delay(waitSecs);
      }
    };
  }, endFunc)();
}

// FIXME: progress bar would is to be loaded from the parts bin, which is retired a long time ago
// Would need to fix the progress bar functionality of the world before fixing this
// function forEachShowingProgress (/* array, progressBar, iterator, labelFunc, whenDoneFunc, context or spec */) {
//
//   const args = Array.from(arguments);
//   const array = args.shift();
//   const steps = array.length;
//   let progressBar; let iterator; let labelFunc; let whenDoneFunc; let context;
//   let progressBarAdded = false;
//
//   // init args
//   if (args.length === 1) {
//     progressBar = args[0].progressBar;
//     iterator = args[0].iterator;
//     labelFunc = args[0].labelFunction;
//     whenDoneFunc = args[0].whenDone;
//     context = args[0].context;
//   } else {
//     progressBar = args[0];
//     iterator = args[1];
//     labelFunc = args[2];
//     whenDoneFunc = args[3];
//     context = args[4];
//   }
//   if (!context) context = typeof window !== 'undefined' ? window : GLOB;
//   if (!labelFunc) labelFunc = function (x) { return x; };
//
//   // init progressbar
//   if (!progressBar) {
//     progressBarAdded = true;
//     const Global = typeof window !== 'undefined' ? window : GLOB;
//     progressBar = $world
//       ? $world.addProgressBar()
//       : {
//           value: null,
//           label: null,
//           remove: function () {}
//         };
//   }
//   progressBar.value = 0;
//
//   // nest functions so that the iterator calls the next after a delay
//   (array.reduceRight(function (nextFunc, item, idx) {
//     return function () {
//       try {
//         progressBar.value = (idx / steps);
//         if (labelFunc) progressBar.label = (labelFunc.call(context, item, idx));
//         iterator.call(context, item, idx);
//       } catch (e) {
//         console.error(
//           'Error in forEachShowingProgress at %s (%s)\n%s\n%s',
//           idx, item, e, e.stack);
//       }
//       delay(nextFunc, 0);
//     };
//   }, function () {
//     progressBar.value = 1;
//     if (progressBarAdded) (function () { progressBar.remove(); }).delay(0);
//     if (whenDoneFunc) whenDoneFunc.call(context);
//   }))();
//
//   return array;
// }

/**
 * Swap the element at `array[index1]` with the one at `array[index2]`. Mutating.
 * @param {any[]} array
 * @param {number} index1
 * @param {number} index2
 */
function swap (array, index1, index2) {
  if (index1 < 0) index1 = array.length + index1;
  if (index2 < 0) index2 = array.length + index2;
  const temp = array[index1];
  array[index1] = array[index2];
  array[index2] = temp;
  return array;
}

/**
 * Shift the elements in `array` to the left `times` times.
 * @param {any[]} array
 * @param {number} times
 * @returns {any[]} - A copy of `array` rotated `times` times
 */
function rotate (array, times) {
  times = times || 1;
  return array.slice(times).concat(array.slice(0, times));
}

/**
 * Applies `iterator` to each element in `array` and puts the return value into a collection
 * associated to its stringified representation.
 * ```
 * // Example: Groups characters by how often they occur in a string
 * var chars = arr.from("Hello World");
 * arr.groupBy(arr.uniq(chars), function(c) {
 * return arr.count(chars, c); })
 * => {
 *   "1": ["H","e"," ","W","r","d"],
 *   "2": ["o"],
 *   "3": ["l"]
 * }
 * ```
 * @see lively.lang/Group
 * @param {any[]} array
 * @param {function} iterator
 * @param {Object} context - Bound to `this` when calling `iterator`
 */
function groupBy (array, iterator, context) {
  return Group.fromArray(array, iterator, context);
}

/**
 * @see lively.lang/array~groupBy
 * @param {any[]} array
 * @param {string} key
 */
function groupByKey (array, key) {
  return groupBy(array, ea => ea[key]);
}

/**
 * Partition `array` according to a condition specified in `iterator`.
 * Creates two partitions (condition is either `true` or `false`).
 * @param {any[]} array
 * @param {function} iterator
 * @param {Object} context - bound to `this` when calling `iterator`
 */
function partition (array, iterator, context) {
  iterator = iterator || function (x) { return x; };
  const trues = []; const falses = [];
  array.forEach(function (value, index) {
    (iterator.call(context, value, index) ? trues : falses).push(value);
  });
  return [trues, falses];
}

/**
 * Takes elements and fits them into subarrays (= batches) so that for
 * each batch `constrainedFunc` returns `true`. Note that `contrainedFunc`
 * should at least produce 1-length batches, otherwise an error is raised.
 * @param {any[]} array
 * @param {function} constrainedFunc
 * @param {Object} context - bound to `this` when calling `constrainedFunc`
 */
function batchify (array, constrainedFunc, context) {
  return findBatches([], array); // eslint-disable-line no-use-before-define

  function extractBatch (batch, sizes) {
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

/**
 * Decomposes `array` into sub-arrays with at most `tupleLength` elements.
 * @param {any[]} array
 * @param {number} tupleLength - description
 */
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

/**
 * Returns the number of permutations of the elements in `array`.
 * @function
 * @name permutations
 * @param {any[]} array
 * @returns number
 */
const permutations = (function () {
  function computePermutations (restArray, values) {
    return !restArray.length
      ? [values]
      : restArray.flatMap(function (ea, i) {
        return computePermutations(
          restArray.slice(0, i).concat(restArray.slice(i + 1)),
          values.concat([ea]));
      });
  }
  return function (array) { return computePermutations(array, []); };
})();

/**
 * Can be used to recursively create all combinations of elements in `n` arrays.
 * Given a "listOfListsOfValues" in the form of an array of arrays and
 * `pickIndices` list with the size of the number of arrays which indicates what
 * values to pick from each of the arrays. Returns a list with two lists:
 * 1. values picked from each of the arrays, 2. the next pickIndices or null if at end (no more combinations possible).
 * Needs to be called recursively to enumerate alls combinations.
 * ```
 * // Example:
 * var searchSpace = [["a", "b", "c"], [1,2]];
 * arr.combinationsPick(searchSpace, [0,1]);
 * // => [["a",2], [1,0]]
 * arr.combinationsPick(searchSpace, [1,0]);
 * // => [["b",1], [1,1]]
 * ```
 * @param {any[][]} listOfListsOfValues
 * @param {number[]} pickIndices
 */
function combinationsPick (listOfListsOfValues, pickIndices) {
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

/**
 * Given a "listOfListsOfValues" in the form of an array of arrays,
 * retrieve all the combinations by picking one item from each array.
 * This basically creates a search tree, traverses it and gathers all node
 * values whenever a leaf node is reached.
 * @param {any[][]} listOfListsOfValues
 * @returns {any[][]}
 */
function combinations (listOfListsOfValues) {
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

/**
 * @function
 * @name take
 * @param {any[]} arr
 * @param {number} n
 * @returns {any[]} The first `n` elements of `arr`.
 */
function take (arr, n) { return arr.slice(0, n); }

/**
 * @function
 * @name drop
 * @param {any[]} arr
 * @param {number} n
 * @returns {any[]} `arr` without the first `n` elements.
 */
function drop (arr, n) { return arr.slice(n); }

/**
 * Return elements from `arr` in a list until `fun` is falsy while iterating over `arr`.
 * @param {any[]} arr
 * @param {function} fun
 * @param {Object} context - bound to `this` when calling `fun`
 */
function takeWhile (arr, fun, context) {
  let i = 0;
  for (; i < arr.length; i++) { if (!fun.call(context, arr[i], i)) break; }
  return arr.slice(0, i);
}

/**
 * Return elements from `arr` in a list starting from `fun` being falsy while iterating over `arr`.
 * @param {any[]} arr
 * @param {function} fun
 * @param {Object} context - bound to `this` when calling `fun`
 */
function dropWhile (arr, fun, context) {
  let i = 0;
  for (; i < arr.length; i++) { if (!fun.call(context, arr[i], i)) break; }
  return arr.slice(i);
}

/**
 * Randomizes the order of elements in `array`. Non-mutating.
 * @param {any[]} array
 */
function shuffle (array) {
  const unusedIndexes = range(0, array.length - 1);
  const shuffled = Array(array.length);
  for (let i = 0; i < array.length; i++) {
    const shuffledIndex = unusedIndexes.splice(
      Math.round(Math.random() * (unusedIndexes.length - 1)), 1);
    shuffled[shuffledIndex] = array[i];
  }
  return shuffled;
}

/**
 * Return the element of `array` which has the highest value according to `iterator`.
 * @param {any[]} array
 * @param {function} iterator
 * @param {Object} context - bound to `this` when calling `iterators`
 */
function max (array, iterator, context) {
  iterator = iterator || function (x) { return x; };
  let result;
  array.reduce(function (max, ea, i) {
    const val = iterator.call(context, ea, i);
    if (typeof val !== 'number' || val <= max) return max;
    result = ea; return val;
  }, -Infinity);
  return result;
}

/**
 * Return the element of `array` which has the smallest value according to `iterator`.
 * @param {any[]} array
 * @param {function} iterator
 * @param {Object} context - bound to `this` when calling `iterators`
 */
function min (array, iterator, context) {
  iterator = iterator || (x => x);
  return max(array, (ea, i) => -iterator.call(context, ea, i));
}

/**
 * Return the sum of the elements of `array`.
 * @param {number[]} array
 */
function sum (array) {
  let sum = 0;
  for (let i = 0; i < array.length; i++) { sum += array[i]; }
  return sum;
}

/**
 * Returns the number of times `item` occurs in `array`.
 * @param {any[]} array
 * @param {any} item
 */
function count (array, item) {
  return array.reduce(function (count, ea) {
    return ea === item ? count + 1 : count;
  }, 0);
}

/**
 * When called without `binspec`, returns `data` partitioned into lists containing two elements each.
 * `binspec` can be an array of `n` numbers. If given, `histogram` will create `n-1` bins, using the provided values in `binspec` as threshholds.
 * The `n-1` bins will be returned as a list. T
 * @param {number[]} data - The data to be partitioned
 * @param {number[]} binSpec - The threshholds used to partition the data. `binspec` should be sorted ascending.
 */
function histogram (data, binSpec) {
  if (typeof binSpec === 'undefined' || typeof binSpec === 'number') {
    const binNumber = binSpec || (function sturge () {
      return Math.ceil(Math.log(data.length) / Math.log(2) + 1);
    })(data);
    const binSize = Math.ceil(Math.round(data.length / binNumber));
    return range(0, binNumber - 1).map(function (i) {
      return data.slice(i * binSize, (i + 1) * binSize);
    });
  } else if (binSpec instanceof Array) {
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

/**
 * Returns a shallow copy of `array`.
 * @param {any[]} array
 */
function clone (array) {
  return [].concat(array);
}

/* -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
Enable chaining (lively.lang) for methods on Array.prototype.
Do not use these directly, use the methods provided by Array.prototype instead.
-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=- */

function filter (array, iterator, context) {
  return array.filter(iterator, context);
}

function find (array, iterator, context) {
  return array.find(iterator, context);
}

function map (array, iterator, context) {
  return array.map(iterator, context);
}

function flat (array, optDepth) {
  return array.flat(optDepth);
}

function flatMap (array, iterator, context) {
  return array.flatMap(iterator, context);
}

function slice (array, start, end) {
  return array.slice(start, end);
}

export {
  range,
  withN,
  genN,
  binarySearchFor,
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
  zip,
  interpose,
  invoke,
  pluck,
  equals,
  deepEquals,
  isSorted,
  sortBy,
  sortByKey,
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
  histogram,
  clone,
  flat,
  filter,
  find,
  map,
  flatMap,
  slice
};
