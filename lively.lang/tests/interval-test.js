/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import {
  mapToMatchingIndexes,
  isInterval,
  sort,
  compare,
  coalesce,
  intervalsInRangeDo,
  intervalsInbetween,
  mergeOverlapping,
  coalesceOverlapping
} from "../interval.js";


describe('interval', function() {

  it("tests for interval type", function() {
    expect(isInterval([1,2])).to.equal(true);
    expect(isInterval([1,2,'some addition'])).to.equal(true);
    expect(isInterval([1,1])).to.equal(true);
    expect(isInterval([1,0])).to.equal(false);
  })

  it("compares intervals", function() {
    var inputAndExpected = [
      [1,2], [3,4], -3,
      // less and at border
      [1,2], [2,3], -2,
      // less and overlapping
      [1,3], [2,4], -1,
      [1,5], [2,4], -1,
      [1,5], [2,4], -1,
      [1,5], [1,6], -1,
      // // equal
      [1,1], [1,1], 0,
      // // greater and pverlapping
      [2,4], [1,3], 1,
      // // greater and at border
      [3,4], [1,3], 2,
      // // greater and non-overlapping
      [2,4], [0,1], 3];

    for (var i = 0; i < inputAndExpected.length; i += 3) {
      var expected = inputAndExpected[i+2],
        a = inputAndExpected[i+0],
        b = inputAndExpected[i+1];
      expect(expected).to.equal(compare(a, b),expected + ' not result of cmp ' + a + ' vs ' + b);
    }

    // // less and non-overlapping
    // expect(-2).to.equal(Interval.compare([1,2], [3,4]),'< n-o');
    // // less and overlapping
    // expect(-1).to.equal(Interval.compare([1,2], [2,3]),'< o');
    // expect(-1).to.equal(Interval.compare([1,3], [2,4]),'< o');
    // expect(-1).to.equal(Interval.compare([1,5], [2,4]),'< o');
    // expect(-1).to.equal(Interval.compare([1,5], [2,4]),'< o');
    // expect(-1).to.equal(Interval.compare([1,5], [1,6]),'< o');
    // // // equal
    // expect(0).to.equal(Interval.compare([1,1], [1,1]),'=');
    // // // greater and overlapping
    // expect(1).to.equal(Interval.compare([3,4], [1,3]),'> o');
    // expect(1).to.equal(Interval.compare([2,4], [1,3]),'> o');
    // // // greater and non-overlapping
    // expect(2).to.equal(Interval.compare([2,4], [0,1]),'> n-o');

  })

  it("sorts intervals", function() {
    expect([]).to.eql(sort([]));
    expect([[1,2], [2,3]]).to.eql(sort([[1, 2], [2, 3]]));
    expect([[1,2], [1,3]]).to.eql(sort([[1, 3], [1, 2]]));
    expect([[1,2], [4,6], [5,9]]).to.eql(sort([[4,6], [1,2], [5,9]]));
  })

  it("coalesces two overlapping intervals", function() {
    expect(null).to.eql(coalesce([1,4], [5,7]));
    expect([1, 5]).to.eql(coalesce([1,3], [2, 5]));
    expect([1, 5]).to.eql(coalesce([3, 5], [1,3]));
    // this.assertEqualState([1, 5], Interval.coalesce([1, 5], [2,3]));
    // this.assertEqualState([3,6], Interval.coalesce([3,6], [4,5]));

    // var callbackArgs;
    // Interval.coalesce([3,6], [4,5], function() { callbackArgs = Array.from(arguments); })
    // this.assertEqualState([[3,6], [4,5], [3,6]], callbackArgs, 'callback');
  });

  it("coalesces any number of overlapping intervals", function() {
    expect([]).to.eql(coalesceOverlapping([]));
    expect([[1, 5]]).to.eql(coalesceOverlapping([[1,3], [2, 4], [2, 5]]));
    expect([[1, 3], [5, 10]]).to.eql(coalesceOverlapping([[1,3], [5,9 ], [6, 10]]));
    expect([[1, 8], [9, 10], [14, 21]]).to.eql(coalesceOverlapping([[9,10], [1,8], [3, 7], [15, 20], [14, 21]]));

    // with merge func
    var result = coalesceOverlapping(
      [[3,5, 'b'], [1,4, 'a'], [8, 10, 'c']],
      function(a, b, merged) { merged.push(a[2] + b[2]) });
    expect([[1,5, 'ab'], [8, 10, 'c']]).to.eql(result);
  });

  it("coalesces identical intervals", function() {
    expect([[1,3]]).to.eql(coalesceOverlapping([[1,3], [1, 3]]));
  });

  it("finds free intervals inbetween", function() {
    expect([[0,10]]).to.eql(intervalsInbetween(0, 10, []));
    expect([[5,10]]).to.eql(intervalsInbetween(0, 10, [[0, 5]]));
    expect([[0,3], [5,10]]).to.eql(intervalsInbetween(0, 10, [[3, 5]]));
    expect([[1,3], [5,8]]).to.eql(intervalsInbetween(0, 10, [[0, 1], [3, 5], [8, 10]]));
    expect([[5,8]]).to.eql(intervalsInbetween(0, 10, [[0, 1], [1, 5], [8, 10]]));
    expect([[0,5]]).to.eql(intervalsInbetween(0, 5, [[8, 10]]));
    expect([[0,3]]).to.eql(intervalsInbetween(0, 5, [[3, 10]]));
    expect([]).to.eql(intervalsInbetween(0, 5, [[0, 6]]));
  });

  it("enumerates intervals using withIntervalsInRangeDo", function() {
    expect([[0,2, false], [2,3, true], [3,5, false], [5,8, true], [8,10, false]]).to.eql(intervalsInRangeDo(
        0, 10, [[8, 10], [0, 2], [3, 5]],
        function(interval, isNew) { interval.push(isNew); return interval; }));

    expect([[0,3, true], [3,5, 'x', false]]).to.eql(intervalsInRangeDo(
        0, 5, [[3, 6, 'x'], [6, 20, 'y']],
        function(interval, isNew) { interval.push(isNew); return interval; }),"slice interval in back");

    expect([[1,2, 'x', false], [2,5, true]]).to.eql(intervalsInRangeDo(
        1, 5, [[-4,0, 'y'], [0, 2, 'x']],
        function(interval, isNew) { interval.push(isNew); return interval; }),"slice interval in front");

    expect([[0,1, 'ab'], [1,2, 'c']]).to.eql(intervalsInRangeDo(
        0, 2, [[0,1, 'a'], [0,1, 'b'], [1,2, 'c']],
        function(interval, isNew) { return interval; },
        function(a, b, merged) { merged[2] = a[2] + b[2] }),"identical intervals not merged");
  });

  it("finds matching intervals", function() {
    var existingIntervals = [[1,4], [4,5], [5,8], [9,20]];
    var test = this, testTable = [
      {expected: [[0]],            input: [[1,4]]},
      {expected: [[0], [0]],      input: [[1,4], [1,4]]},
      {expected: [[]],        input: [[2,4]]},
      {expected: [[]],        input: [[4,6]]},
      {expected: [[1,2], [2,3], []],  input: [[4,8], [5,20], [10,20]]}
    ]

    testTable.forEach(function(ea) {
      expect(ea.expected).to.eql(
        mapToMatchingIndexes(existingIntervals, ea.input),
        'On input: ' + ea.input);
    });
  });

  it("merges overlapping intervals", function() {
    return; // WIP
    var inputsAndExpected = [
      {a: [[1,6, 'a'], [7,9, 'b']],
      b: [],
      expected: [[1,6, 'a'], [7,9, 'b']]},
      {a: [[1,6, 'a'], [6,9, 'b']],
      b: [[1,3, 'c']],
      expected: [[1,3, 'ac'], [3,6, 'a'], [7,9, 'b']]},
      // {a: [[1,3, 'a'], [6,9, 'b']],
      //  b: [[1,6, 'c']],
      //  expected: [[1,3, 'ac'], [3,6, 'c'], [6,9, 'b']]},
      // {a: [[1,3, 'a'], [3,8, 'b']],
      // b: [[1,6, 'c']],
      //  expected: [[1,3, 'ac'], [3,8, 'bc'], [6,8, 'b']]},
      // {a: [[1,3, 'a'], [3,4, 'b']],
      //  b: [[1,2, 'c'], [1,5, 'd']],
      //  expected: [[1,2, 'acd'], [2,3, 'ad'], [3,4, 'bd'], [4,5, 'd']]}
    ];

    function merge(a,b) {
      return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), a[2] + b[2]]
    }
    for (var i = 0; i < inputsAndExpected.length; i++) {
      var expected = inputsAndExpected[i].expected,
        a = inputsAndExpected[i].a,
        b = inputsAndExpected[i].b;
      expect(expected).to.eql(mergeOverlapping(a, b, merge),expected + ' not result of merge ' + a + ' vs ' + b);
    }


    // nothing happens without a merge func
    // this.assertEqualState([], Interval.mergeOverlapping([]));
    // this.assertEqualState([[1,2, 'a'], [1,2, 'b']],
    //                       Interval.mergeOverlapping([[1,2, 'a'], [1,2, 'b']]));

    // this.assertEqualState(
    //     [[1,2, 'ab']],
    //     Interval.mergeOverlapping(
    //         [[1,2, 'a'], [1,2, 'b']],
    //         function(a, b) { return [[a[0], a[1], a[2] + b[2]]]; }));

    // this.assertEqualState(
    //     [[1,2, 'abc']],
    //     Interval.mergeOverlapping(
    //         [[1,2, 'a'], [1,2, 'b'], [1,2, 'c']],
    //         function(a, b) { return [[a[0], a[1], a[2] + b[2]]]; }));

    // this.assertEqualState(
    //     [[1,3, 'ab'], [3,6, 'b']],
    //     Interval.mergeOverlapping(
    //         [[1,3, 'a'], [1,6, 'b']],
    //         function(a, b) { return [[a[0], a[1], a[2] + b[2]]]; }));

    // this.assertEqualState(
    //     [[1,2, 'ac'], [2,3, 'abc'], [3, 4, 'bc'], [4, 6, 'c']],
    //     Interval.mergeOverlapping(
    //         [[1,3, 'a'], [2,4, 'b'], [1,6, 'c']],
    //         function(a, b) { return [[a[0], a[1], a[2] + b[2]]]; }));

    // this.assertEqualState([[1, 5]], Interval.mergeOverlapping([[1,3], [2, 4], [2, 5]]));
    // this.assertEqualState(
    //     [[1, 3], [5, 10]],
    //     Interval.mergeOverlapping([[1,3], [5,9 ], [6, 10]]));
    // this.assertEqualState(
    //     [[1, 8], [9, 10], [14, 21]],
    //     Interval.mergeOverlapping([[9,10], [1,8], [3, 7], [15, 20], [14, 21]]));

    // // with merge func
    // var result = Interval.mergeOverlapping(
    //     [[3,5, 'b'], [1,4, 'a'], [8, 10, 'c']],
    //     function(a, b, merged) { merged.push(a[2] + b[2]) });
    // this.assertEqualState([[1,5, 'ab'], [8, 10, 'c']], result);
  });


});
