/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import { sortByReference, hull, reduce, invert, subgraphReachableBy } from "../graph.js";


describe('graph', function() {

  var testGraph = {
    "a": ["b", "c"],
    "b": ["c", "d", "e", "f"],
    "d": ["c", "f"],
    "e": ["a", "f"],
    "f": []
  }

  describe('hull', function() {

    it("can be computed", function() {
      expect(hull(testGraph, "d")).to.eql(["c", "f"]);
      expect(hull(testGraph, "e")).to.eql(['a', 'f', 'b', 'c', 'd', 'e']);
      expect(hull(testGraph, "e", ["b"])).to.eql(["a", "f", "c"]);
      expect(hull(testGraph, "e", [], 2)).to.eql(['a', 'f', 'b', 'c']);
    });

    it("reachable subgraph", function() {
      expect(subgraphReachableBy(testGraph, "d", []))
        .to.eql({"d": ["c", "f"], "c": [], "f": []});
      expect(subgraphReachableBy(testGraph, "e", [], 2))
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

  });

});
