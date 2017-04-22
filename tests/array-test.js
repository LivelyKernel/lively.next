/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import {
  range,
  mapAsync,
  max,
  drop,
  take,
  mask,
  partition,
  groupBy,
  rotate,
  swap,
  forEach,
  flatten,
  flatmap,
  reMatches,
  isSorted,
  pluck,
  zip,
  withN,
  uniq,
  uniqBy,
  without,
  batchify,
  sum,
  min,
  dropWhile,
  takeWhile,
  delimWith,
  permutations,
  histogram,
  combinations,
  mapAsyncSeries,
  mutableCompact,
  combinationsPick
} from "../array.js";
import { curry } from "../function.js";
import { random } from "../number.js";
import { equals } from "../object.js";

describe('arr', function() {

  it('forEach', function() {
    var result = '';
    forEach([4,5,6], function(ea, i) {
      result += '[' + ea + ',' + i + ']'; })
    expect(result).to.equal('[4,0][5,1][6,2]')
  });

  it("range", function() {
    expect(range(1,1)).to.eql([1]);
    expect(range(1,1, 10)).to.eql([1]);
    expect(range(1,5)).to.eql([1,2,3,4,5]);
    expect(range(1,10, 2)).to.eql([1,3,5,7,9]);
    expect(range(10, 1, -2)).to.eql([10,8,6,4,2]);
    expect(range(10, 1, 20)).to.eql([10]);
  });

  it('without', function() {
    var array = ["a"];
    expect([]).to.eql(without(array, "a"));
    expect(["a"]).to.eql(without(array, "c"));
    delete array[0];
    expect([]).to.eql(without(array, "a"));
  });

  it('mutableCompact', function() {
    var a = ["a", "b", "c", undefined];
    delete a[1];
    mutableCompact(a);
    expect(["a", "c", undefined]).to.eql(a);
  });

  it('min', function() {
    var a = [{x:2,y:12},{x:5,y:6},{x:9,y:4}];
    expect(2).to.eql(min(pluck(a, 'x')));
    expect(4).to.eql(min(pluck(a, 'y')));
    expect({x:2,y:12}).to.eql(min(a, function(ea) { return ea.x }));
    expect({x:9,y:4}).to.eql(min(a, function(ea) { return ea.y }));

    expect(2).to.eql(min([5,3,2,6,4,3,2]));
    expect(-10).to.eql(min([-3,-3,-5,-10]));
    expect(-10).to.eql(min([-3,-3,-5,-10]));
    expect(-5).to.eql(min([-3,null,-5,null]));
    expect(0).to.eql(min([0, 10]));
    expect({x: 'foo'}).to.eql(min([{x: 'bar'},{x: 'foo'}, {x: 'baz'}], function(ea) { return ea.x.charCodeAt(2); }));
  });

  it('max', function() {
    var a = [{x:2,y:12},{x:5,y:6},{x:9,y:4}];
    expect(9).to.equal(max(pluck(a, 'x')));
    expect(12).to.equal(max(pluck(a, 'y')));
    expect({x:9,y:4}).to.eql(max(a, function(ea) { return ea.x }));
    expect({x:2,y:12}).to.eql(max(a, function(ea) { return ea.y }));

    expect(6).to.equal(max([5,3,2,6,4,-3,2]));
    expect(-1).to.equal(max([-3,-2,-1,-10]));
    expect(-2).to.equal(max([-3,-2,null,-10]));
    expect(0).to.equal(max([0, -10]));
    expect({x: 'baz'}).to.eql(
      max([{x: 'bar'},{x: 'foo'}, {x: 'baz'}],
      function(ea) { return ea.x.charCodeAt(2); }));
  });

  it('swap', function() {
    var a = ['a', 'b', 'c', 'd', 'e'];
    swap(a, 1,4);
    expect(a).to.eql(['a', 'e', 'c', 'd', 'b']);
    swap(a, 0, -1)
    expect(a).to.eql(['b', 'e', 'c', 'd', 'a']);
  });

  it('rotate', function() {
    var a = ['a', 'b', 'c', 'd', 'e'];
    a = rotate(a);
    expect(a).to.eql(['b', 'c', 'd', 'e', 'a']);
    a = rotate(a, 2);
    expect(a).to.eql(['d', 'e', 'a', 'b', 'c']);
  });

  it('partition', function() {
    expect(partition(range(0,10), function(n) { return n % 2 === 0 }))
      .to.eql([[0,2,4,6,8,10], [1,3,5,7,9]]);
  });

  it('groupBy', function() {
    var elts = [{a: 'foo', b: 1},
                {a: 'bar', b: 2},
                {a: 'foo', b: 3},
                {a: 'baz', b: 4},
                {a: 'foo', b: 5},
                {a: 'bar',b:6}],
        group = groupBy(elts, ea => ea.a),
        expected = {
          foo: [elts[0],elts[2],elts[4]],
          bar: [elts[1],elts[5]],
          baz: [elts[3]]
        };

    expect(group).to.containSubset(group);
    expect([[elts[0],elts[2],elts[4]],[elts[1],elts[5]],[elts[3]]])
      .to.eql(group.toArray(), 'toArray');

    expect(['foo', 'bar', 'baz']).to.eql(group.keys(), 'groupNames');
    expect({foo: 3, bar: 2, baz: 1}).to.eql(group.count(), 'coount');

    var mapGroupsResult = group.mapGroups((groupName, group) => sum(pluck(group, 'b')));
    expect(mapGroupsResult).to.containSubset({foo: 9, bar: 8, baz: 4}, 'mapGroupsResult');

    var mapGroupResult = group.map(function(groupName, groupEl) { return groupEl.b; });
    expect(mapGroupResult).to.containSubset({foo: [1,3,5], bar: [2,6], baz: [4]}, 'mapGroupResult');
  });

  it('uniq', function() {
    expect(uniq([6,3,2,6,4,2])).equals([6,3,2,4]);
    expect(uniq([])).equals([]);
  });

  it('uniqBy', function() {
    var a = [{x:33}, {x: 1}, {x: 2}, {x: 3}, {x: 99}, {x: 1}, {x: 2}, {x:1}, {x: 1}],
        result = pluck(uniqBy(a, function(a,b) { return a.x === b.x; }), 'x'),
        expected = [33, 1,2,3,99];
    expect(expected).to.eql(result);

    expect(uniqBy([
      "edit...", "local", "local",
      "http://localhost:9011/eval", "http://localhost:9011/eval",
      {value: {name: "l2l 28E1E - undefined"}},
      {value: {name: "l2l 28E1E - undefined"}}
    ], (a, b) => {
      let valA = a.value || a;
      let valB = b.value || b;
      return valA == valB || equals(valA, valB)
    })).deep.equals([
      "edit...", "local",
      "http://localhost:9011/eval",
      {value: {name: "l2l 28E1E - undefined"}}
    ])
  });

  it('mask', function() {
    var a = range(1,4),
        bools = [false, true, false, true];
    expect([2,4]).to.eql(mask(a, bools), 'mask');
  });

  it('reMatches', function() {
    var a = ['foo', 'bar', 'zork'],
        result = reMatches(a, /.r.?/i);
    expect(result).containSubset([
        null,
        {'0': 'ar', index: 1, input: 'bar'},
        {'0': 'ork', index: 1, input: 'zork'}]);
  });

  describe("batchify", function() {

    it('splits array ccording to constraint', function() {
      function batchConstrained(batch) { return batch.length == 1 || sum(batch) < batchMaxSize; }
      var batchMaxSize = Math.pow(2, 28)/*256MB*/,
          sizes = [
              Math.pow(2, 15), // 32KB
              Math.pow(2, 29), // 512MB
              Math.pow(2, 29), // 512MB
              Math.pow(2, 27), // 128MB
              Math.pow(2, 26), // 64MB
              Math.pow(2, 26), // 64MB
              Math.pow(2, 24), // 16MB
              Math.pow(2, 26)],// 64MB
          batches = batchify(sizes, batchConstrained);
      expect(flatten(batches)).to.have.length(sizes.length, 'not all batches included?');
      // the sum of each batch should be < 256MB or batch shoudl just have single item
      expect(batches.every(batchConstrained)).to.equal(true);
    });

    it('needs to consume', function() {
      function batchConstrained(batch) { return sum(batch) < batchMaxSize; }
      var batchMaxSize = 3,
          sizes = [1,4,2,3];
      expect(() => batchify(sizes, batchConstrained))
        .throws(/does not ensure consumption of at least one/);
    });
  });

  describe("permutations", function() {
    it("creates them", function() {
      expect(permutations([3,1,2])).to.eql(
        [[3, 1, 2], [3, 2, 1], [1, 3, 2], [1, 2, 3], [2, 3, 1], [2, 1, 3]])
    })
  });

  it("delimWith", function() {
    expect(delimWith(["test", "abc", 444], "aha")).to.eql(["test","aha","abc","aha",444]);
  });

  describe("flatten", function() {

    it("un-nest arrays", function() {
      expect(flatten([1, [2], [3, [4, [[[5]]]]]])).to.eql([1,2,3,4,5]);
    });

    it("un-nest arrays to a certain depth", function() {
      expect(flatten([1, [2], [3, [4, [[[5]]]]]], 2)).to.eql([1,2,3,4,[[[5]]]]);
    });

  });

  describe("flatmap", function() {

    it("flatmaps", function() {
      var result = flatmap([1,2,3], function(ea, i) { return withN(i+1, ea) });
      expect(result).to.eql([1,2,2,3,3,3]);
    });

    it("flatmaps big time", function() {
      // old flatmap version threw stack overlflow errors
      var result = flatmap(range(1,800000), function(ea, i) { return [ea, i] });
      expect(result.length).to.eql(800000*2);
    });

  });

  describe("sorting", function() {

    it("isSorted", function() {
      expect(isSorted([2,4,7,9])).to.equal(true);
      expect(isSorted([2,4,3,9])).to.equal(false);
    });

    it("isSorted descending", function() {
      expect(isSorted([4,2,1], true)).to.equal(true);
      expect(isSorted([4,5,1])).to.equal(false);
    });
  });

  describe("combinations", function() {

    it("combines all elements of lists", function() {
      expect(combinations([['a', 'b', 'c'], [1, 2]]))
        .to.eql([["a", 1], ["a", 2], ["b", 1], ["b", 2], ["c", 1], ["c", 2]]);
    });

    it("retrieves a specific combination", function() {
      var searchSpace = [["a", "b", "c"], [1,2]];
      expect(combinationsPick(searchSpace, [0,1])).to.eql([["a",2], [1,0]]);
      expect(combinationsPick(searchSpace, [1,0])).to.eql([["b",1], [1,1]]);
      expect(combinationsPick(searchSpace, [2,1])).to.eql([["c",2], undefined]);
    });

  });
  it('histogram', function() {
    var data = [0,1,2,3,7,2,1,3,9];

    var hist = histogram(data);
    expect([[0,1], [2,3], [7,2], [1,3], [9]]).to.eql(hist);

    var hist = histogram(data, 3); // 3 bins
    expect([[0,1,2],[3,7,2],[1,3,9]]).to.eql(hist);

    var hist = histogram(data, [0,3,6]); // 3 bins
    expect([[0,1,2,2,1],[3,3],[7,9]]).to.eql(hist);

    var data = [1,2,3,4];
    var hist = histogram(data, [0,3,6]); // 3 bins
    expect([[1,2],[3,4],[]]).to.eql(hist);
  });

  it("zips", function() {
    expect(zip([1,2,3], [4,5,6])).to.eql([[1,4],[2,5],[3,6]]);
  });

  describe("async", function() {

    var numbers = range(1,10);

    describe("mapAsyncSeries()", function() {

      it("iterates in order", function(done) {
        mapAsyncSeries(numbers, function(n, i, next) {
          setTimeout(function() { next(null, i+1); }, random(0,100));
        }, function(err, result) {
          expect(result).to.eql(numbers);
          done();
        });
      });

      it("catches errors", function(done) {
        mapAsyncSeries(numbers, function(n, i, next) {
          if (i === 2) throw new Error("FOO!"); next();
        }, function(err, result) {
          expect(err.message).to.eql("FOO!");
          done();
        });
      });

      it("does not invoke callbacks multiple times", function(done) {
        mapAsyncSeries(numbers, function(n, i, next) {
          if (i === 2) next(null, n);
          setTimeout(curry(next, null, n), 10);
        }, function(err, result) {
          expect(result).to.eql(numbers);
          done();
        });
      });

    });

    describe("mapAsync()", function() {

      it("maps asynchronously", function(done) {
        mapAsync(numbers,
          function(n, i, next) { setTimeout(function() { next(null, n); }, random(0,100)); },
          function(err, result) {
            expect(result).to.eql(numbers);
            done();
          });
      });

      it("maps asynchronously one elem", function(done) {
        mapAsync([1],
          function(n, i, next) { setTimeout(function() { next(null, n); }, random(0,100)); },
          function(err, result) {
            expect(result).to.eql([1]);
            done();
          });
      });

      it("maps asynchronously empty list", function(done) {
        mapAsync([],
          function(n, i, next) { setTimeout(function() { next(null, n); }, random(0,100)); },
          function(err, result) { expect(result).to.eql([]); done(); });
      });

      it("does not invoke callbacks twice", function(done) {
        mapAsync(numbers,
          function(n, i, next) {
            setTimeout(function() { next(null, n); }, random(0,100));
            if (i == 2) next(null, n);
          },
          function(err, result) {
            expect(result).to.eql(numbers);
            done();
          });
      });

      it("catches errors", function(done) {
        mapAsync(numbers,
          function(n, i, next) {
            if (i == 2) throw new Error("FOO!");
            setTimeout(function() { next(null, n); }, random(0,100));
          },
          function(err, result) {
            expect(err.message).to.equal("FOO!");
            done();
          });
      });

      it("can control the number of parallel iterator invocations", function(done) {
        var maxInvocations = 0, invocations = 0;
        mapAsync(numbers, {parallel: 3},
          function(n, i, next) {
            invocations++;
            maxInvocations = Math.max(maxInvocations, invocations);
            setTimeout(function() { invocations--; next(null, n); }, random(0,100));
          },
          function(err, result) {
            expect(maxInvocations).to.equal(3);
            done();
          });
      })
    });

  });

  describe("dropping and taking", function() {

    it("take", function() {
      expect(take([1,2,3,4,5], 3)).to.eql([1,2,3]);
    });

    it("drop", function() {
      expect(drop([1,2,3,4,5], 3)).to.eql([4,5]);
    });

    it("takeWhile", function() {
      expect(takeWhile([1,2,3,4,5], function(n) { return n < 3; })).to.eql([1,2]);
      expect(takeWhile([1,2,3,4,5], function(n) { return true; })).to.eql([1,2,3,4,5]);
      expect(takeWhile([1,2,3,4,5], function(n) { return false; })).to.eql([]);
    });

    it("dropWhile", function() {
      expect(dropWhile([1,2,3,4,5], function(n) { return n < 3; })).to.eql([3, 4,5]);
      expect(dropWhile([1,2,3,4,5], function(n) { return true; })).to.eql([]);
      expect(dropWhile([1,2,3,4,5], function(n) { return false; })).to.eql([1,2,3,4,5]);
    });
  })
});
