/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import { sortByReference, hull, reduce, invert, subgraphReachableBy } from "../graph.js";

var testGraph = {
  "a": ["b", "c"],
  "b": ["c", "d", "e", "f"],
  "d": ["c", "f"],
  "e": ["a", "f"],
  "f": []
}

describe('graph', function() {


  describe('hull', function() {

    it("can be computed", function() {
      expect(hull(testGraph, "d")).to.eql(["c", "f"], "1");
      expect(hull(testGraph, "e")).to.eql(['a', 'f', 'b', 'c', 'd', 'e'], "2");
      expect(hull(testGraph, "e", ["b"])).to.eql(["a", "f", "c"], "ignore issue");
      expect(hull(testGraph, "e", [], 2)).to.eql(['a', 'f', 'b', 'c'], "max depth issue");
    });

    it("reachable subgraph", function() {      
      expect(subgraphReachableBy(testGraph, "d", []))
        .to.eql({"d": ["c", "f"], "c": [], "f": []});
      expect(subgraphReachableBy(testGraph, "e", [], 3))
        .to.eql({e: [ 'a', 'f' ], a: [ 'b', 'c' ], f: []});
      expect(subgraphReachableBy(testGraph, "e", ["a"], 2))
        .to.eql({e: ['f' ], f: []});
    });

  });
  
  describe("invert", (arg) => {
    it("inverts references", () => {
      var g = {"a": ["b", "c"], "b": ["c"], "c": ["a"]},
          expected = {"a": ["c"], "b": ["a"], "c": ["a", "b"]};
      expect(invert(g)).to.eql(expected);
    });
  });

  describe("reduce", () => {

    it("works", () => {
      var depGraph = {a: ["b", "c"],b: ["c"]},
          result = reduce((akk, ea, i) => akk + ` ${ea} ${i}`, depGraph, "a", "");
      expect(result).to.equal(" a 0 b 1 c 2");
    });

  });

  describe("sort", () => {

    it("sorts into groups", () => {
      var depGraph = {a: ["b", "c"], b: ["c"], c: ["b"]};
      expect(sortByReference(depGraph, "a")).to.eql([["c"], ["b"], ["a"]]);
    });

    it("puts keys with zero deps in same group", () => {
      expect(sortByReference({a: ["b"], c: ["b"], b: []}, "a")).to.eql([["b"], ["a", "c"]]);
      expect(sortByReference({a: ["b"], c: ["d"], b: [], d: []}, "a")).to.eql([["b", "d"], ["a", "c"]]);
      expect(sortByReference({a: ["c", "d"], b: ["c", "d"], c: ["d"], d: []}, "a")).to.eql([["d"], ["c"], ["a", "b"]]);
    });

    it("breaks cycles", () => {
      expect(sortByReference({a: ["b"], b: ["a"]}, "a")).to.eql([["b"], ["a"]]);
      expect(sortByReference({a: ["a"]}, "a")).to.eql([["a"]]);
    });

    it("won't get confused in more complex cases'", () => {
      // example from a bug
      expect(sortByReference({
        "a": ["a1", "a3"], "a1": ["a2"], "a3": ["b"], "a2": ["b"],
        "b": ["b_3","b_1","b_2"], "b_1": ["b_2"], "b_2": [], "b_3": []
      }, "a")).to.eql([["b_3", "b_2"], ["b_1"], ["b"], ["a3", "a2"], ["a1"], ["a"]]);
    });

  });

});
