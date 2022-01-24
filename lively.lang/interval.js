/* global System, global */
import { range } from './array.js';
import { timeToRunN } from './function.js';

/**
 * Intervals are arrays whose first two elements are numbers and the
 * first element should be less or equal to the second element, see
 * [`interval.isInterval`](). This abstraction is useful when working with text
 * ranges in rich text, for example.
 * @module lively.lang/interval
 */

/**
 * An interval defining an upper and a lower bound.
 * @typedef { number[] } Interval
 * @property {number} 0 - The lower bound of the interval. 
 * @property {number} 1 - The upper bound of the interval.
 */

const GLOB = typeof System !== 'undefined'
  ? System.global
  : (typeof window !== 'undefined' ? window : global);

/**
 * Returns wether the given `object` is an interval or not.
 * @param { object } object - The object to check.
 * @returns { boolean } Wether or not the given `object` is an interval.
 * @example
 * interval.isInterval([1,12]) // => true
 * interval.isInterval([1,12, {property: 23}]) // => true
 * interval.isInterval([1]) // => false
 * interval.isInterval([12, 1]) // => false
 */
function isInterval (object) {
  return Array.isArray(object) &&
      object.length >= 2 &&
      object[0] <= object[1];
}

/**
 * Sorts intervals according to rules defined in [`interval.compare`]().
 * @param { Interval[] } intervals - The collection of intervals to sort.
 * @returns { Interval[] } The sorted list of intervals.
 */
function sort (intervals) {
  return intervals.sort(compare);
}

/**
 * How [`interval.sort`]() compares.
 * We assume that `a[0] <= a[1] and b[0] <= b[1]` according to `isInterval`.
 * ````
 * -3: a < b and non-overlapping, e.g [1,2] and [3,4]
 * -2: a < b and intervals border at each other, e.g [1,3] and [3,4]
 * -1: a < b and overlapping, e.g, [1,3] and [2,4] or [1,3] and [1,4]
 *  0: a = b, e.g. [1,2] and [1,2]
 *  1: a > b and overlapping, e.g. [2,4] and [1,3]
 *  2: a > b and share border, e.g [1,4] and [0,1]
 *  3: a > b and non-overlapping, e.g [2,4] and [0,1]
 * ```
 * @param { Interval } a
 * @param { Interval } b
 * @returns { number }
 */
function compare (a, b) {
  if (a[0] < b[0]) { // -3 || -2 || -1
    if (a[1] < b[0]) return -3;
    if (a[1] === b[0]) return -2;
    return -1;
  }
  if (a[0] === b[0]) { // -1 || 0 || 1
    if (a[1] === b[1]) return 0;
    return a[1] < b[1] ? -1 : 1;
  }
  // we know a[0] > b[0], 1 || 2 || 3
  return -1 * compare(b, a);
}

/**
 * Turns two interval into one iff compare(interval1, interval2) ∈ [-2,
 * -1,0,1, 2] (see [`inerval.compare`]()).
 * Otherwise returns null. Optionally uses merge function.
 * @param { Interval } interval1
 * @param { Interval } interval2
 * @param { function } [optMergeCallback] - Optional callback that is invoked upon coalescing.
 * @param { Interval|null } The coalesced interval or `null` if the intervals are disjunct.
 * @example
 *   interval.coalesce([1,4], [5,7]) // => null
 *   interval.coalesce([1,2], [1,2]) // => [1,2]
 *   interval.coalesce([1,4], [3,6]) // => [1,6]
 *   interval.coalesce([3,6], [4,5]) // => [3,6]
 */
function coalesce (interval1, interval2, optMergeCallback) {
  const cmpResult = this.compare(interval1, interval2);
  let temp;
  switch (cmpResult) {
    case -3:
    case 3: return null;
    case 0:
      optMergeCallback && optMergeCallback(interval1, interval2, interval1);
      return interval1;
    case 2:
    case 1: temp = interval1; interval1 = interval2; interval2 = temp; // swap
    case -2:
    case -1:
      let coalesced = [interval1[0], Math.max(interval1[1], interval2[1])];
      optMergeCallback && optMergeCallback(interval1, interval2, coalesced);
      return coalesced;
    default: throw new Error('Interval compare failed');
  }
}

/**
 * This is essentially a lifted version of `coalesce` and accepts an array of intervals.
 * @param { Interval[] } intervals - A list of intervals to coalesce.
 * @param { function } [optMergeCallback] - Optional callback that is invoked upon coalescing.
 * @param { Interval[] } The set of coalesced intervals.
 * @example
 *   interval.coalesceOverlapping([[9,10], [1,8], [3, 7], [15, 20], [14, 21]])
 *   // => [[1,8],[9,10],[14,21]]
 */
function coalesceOverlapping (intervals, optMergeCallback) {
  const condensed = []; let len = intervals.length;
  while (len > 0) {
    let ival = intervals.shift(); len--;
    for (let i = 0; i < len; i++) {
      const otherInterval = intervals[i];
      const coalesced = coalesce(ival, otherInterval, optMergeCallback);
      if (coalesced) {
        ival = coalesced;
        intervals.splice(i, 1);
        len--; i--;
      }
    }
    condensed.push(ival);
  }
  return this.sort(condensed);
}

/**
 * Merges a set of potentially overlapping intervals.
 * @param { Intervals[] } intervalsA - The first set of intervals to merge.
 * @param { Intervals[] } intervalsB - The second set of intervals to merge.
 * @param { function } mergeFunc - The function that given to overlapping intervals returns a single *resolved* interval.
 * @returns { Interval[] } The set of merged intervals.
 */
function mergeOverlapping (intervalsA, intervalsB, mergeFunc) {
  const result = [];
  while (intervalsA.length > 0) {
    let intervalA = intervalsA.shift();

    const toMerge = intervalsB.map(function (intervalB) {
      const cmp = compare(intervalA, intervalB);
      return cmp === -1 || cmp === 0 || cmp === 1;
    });

    result.push(mergeFunc(intervalA, toMerge[0]));

    result.push(intervalA);
  }
  return result;
}

/**
 * Merges and iterates through sorted intervals. Will "fill up"
 * intervals. This is currently used for computing text chunks in
 * `lively.morphic/text`
 * @param {number} start - The lower bound for the intervals to be considered.
 * @param {number} end - The upper bound for the intervals to be considered.
 * @param {Interval[]} intervals - The collection of intervals to iterate over and fill up as needed.
 * @param {function} iterator - The iterator to call for each interval and also the inserted ones.
 * @param {function} mergeFunc - Callback to handle overlapping intervals.
 * @param {object} [context] - The context the callback functions `iterator` and `mergeFunc` are bound to.
 * @returns { Interval[] } The collected intervals returned by `iterator` or `mergeFunc`.
 * @example
 * interval.intervalsInRangeDo(
 *   2, 10, [[0, 1], [5,8], [2,4]],
 *   function(i, isNew) { i.push(isNew); return i; })
 * // => [[2,4,false],[4,5,true],[5,8,false],[8,10,true]]
 */
function intervalsInRangeDo (start, end, intervals, iterator, mergeFunc, context) {
  context = context || GLOB;
  // need to be sorted for the algorithm below
  intervals = this.sort(intervals);
  let nextInterval; const collected = [];
  // merged intervals are already sorted, simply "negate" the interval array;
  while ((nextInterval = intervals.shift())) {
    if (nextInterval[1] < start) continue;
    if (nextInterval[0] < start) {
      nextInterval = Array.prototype.slice.call(nextInterval);
      nextInterval[0] = start;
    }
    const nextStart = end < nextInterval[0] ? end : nextInterval[0];
    if (start < nextStart) {
      collected.push(iterator.call(context, [start, nextStart], true));
    }
    if (end < nextInterval[1]) {
      nextInterval = Array.prototype.slice.call(nextInterval);
      nextInterval[1] = end;
    }
    // special case, the newly constructed interval has length 0,
    // happens when intervals contains doubles at the start
    if (nextInterval[0] === nextInterval[1]) {
      let prevInterval;
      if (mergeFunc && (prevInterval = collected.slice(-1)[0])) {
        // arguments: a, b, merged, like in the callback of #merge
        mergeFunc.call(context, prevInterval, nextInterval, prevInterval);
      }
    } else {
      collected.push(iterator.call(context, nextInterval, false));
    }
    start = nextInterval[1];
    if (start >= end) break;
  }
  if (start < end) collected.push(iterator.call(context, [start, end], true));
  return collected;
}

/**
 * Computes "free" intervals between the intervals given in range start - end
 * currently used for computing text chunks in lively.morphic/text
 * @param { number } start - The lower bound for the intervals to be considered.
 * @param { number } end - The upper bound for the intervals to be considered.
 * @param { Interval[] } intervals - The collection of intervals to be filtered.
 * @returns { Interval[] } The list of free intervals between the ranges and confined by the set of `intervals`.
 * @example
 * interval.intervalsInbetween(0, 10,[[1,4], [5,8]])
 * // => [[0,1],[4,5],[8,10]]
 */
function intervalsInbetween (start, end, intervals) {
  return intervalsInRangeDo(start, end,
    coalesceOverlapping(Array.prototype.slice.call(intervals)),
    (interval, isNew) => isNew ? interval : null)
    .filter(Boolean);
}

/**
 * Returns an array of indexes of the items in intervals that match
 * items in `intervalsToFind`.
 * We expect intervals and intervals to be sorted according to [`interval.compare`]()!
 * This is the optimized version of:
 * @example
 * return intervalsToFind.collect(function findOne(toFind) {
 *    var startIdx, endIdx;
 *    var start = intervals.detect(function(ea, i) {
 *       startIdx = i; return ea[0] === toFind[0]; });
 *    if (start === undefined) return [];
 *    var end = intervals.detect(function(ea, i) {
 *       endIdx = i; return ea[1] === toFind[1]; });
 *    if (end === undefined) return [];
 *    return Array.range(startIdx, endIdx);
 * });
 * @param { Intervals[] } intervals - The intervals considered the "candidates" for matches.
 * @param { Intervals[] } intervalsToFind - The set of intervals to match up.
 * @returns { number[] } The list of matching indices.
 */
function mapToMatchingIndexes (intervals, intervalsToFind) {
  let startIntervalIndex = 0; let endIntervalIndex; let currentInterval;
  return intervalsToFind.map(function (toFind) {
    while ((currentInterval = intervals[startIntervalIndex])) {
      if (currentInterval[0] < toFind[0]) { startIntervalIndex++; continue; }
      break;
    }
    if (currentInterval && currentInterval[0] === toFind[0]) {
      endIntervalIndex = startIntervalIndex;
      while ((currentInterval = intervals[endIntervalIndex])) {
        if (currentInterval[1] < toFind[1]) { endIntervalIndex++; continue; }
        break;
      }
      if (currentInterval && currentInterval[1] === toFind[1]) {
        return range(startIntervalIndex, endIntervalIndex);
      }
    }
    return [];
  });
}

/* eslint-disable no-unused-vars */
function benchmark () {
  /* eslint-enable no-unused-vars */
  // Used for developing the code above. If you change the code, please
  // make sure that you don't worsen the performance!
  // See also lively.lang.tests.ExtensionTests.IntervallTest

  function benchmarkFunc (func, args, n) {
    return `${func.name} ${timeToRunN(() => func.apply(null, args, 100000), n)}ms`;
  }
  return [
    'Friday, 20. July 2012:',
    'coalesceOverlapping: 0.0003ms',
    'intervalsInbetween: 0.002ms',
    'mapToMatchingIndexes: 0.02ms',
    'vs.\n' + new Date() + ':',
    benchmarkFunc(coalesceOverlapping, [[[9, 10], [1, 8], [3, 7], [15, 20], [14, 21]]], 100000),
    benchmarkFunc(intervalsInbetween, [0, 10, [[8, 10], [0, 2], [3, 5]]], 100000),
    benchmarkFunc(mapToMatchingIndexes, [range(0, 1000).map(n => [n, n + 1]), [[4, 8], [500, 504], [900, 1004]]], 1000)
  ].join('\n');
}

export {
  isInterval,
  sort,
  compare,
  coalesce,
  coalesceOverlapping,
  mergeOverlapping,
  intervalsInRangeDo,
  intervalsInbetween,
  mapToMatchingIndexes
};
