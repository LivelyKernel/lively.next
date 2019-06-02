/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import { postwalk, prewalk, mapTree, find, filter, map } from "../tree.js";
import { print } from "../string.js";


var testTree = {
  x: 1, children: [
    {x:2, children: [{x: 3, children: [{x:4}]}, {x: 5, children: [{x:6}]}]},
    {x: 7}]
}

function getChildren(n) { return n.children; }

describe('tree', function() {

  it('prewalks', function() {
    var log = []
    prewalk(testTree, function(n) { log.push(n.x); }, getChildren);
    expect(log).to.eql([1,2,3,4,5,6,7]);
  });

  it('poswalks', function() {
    var log = []
    postwalk(testTree, function(n) { log.push(n.x); }, getChildren);
    expect(log).to.eql([4,3,6,5,2,7,1]);
  });

  it('detects nodes', function() {
    var result = find(testTree, n => n.x === 5, getChildren);
    expect({x: 5, children: [{x:6}]}).to.deep.equal(result);
  });

  it('filters nodes', function() {
    var result = filter(testTree,
      function(n) { return n.x >= 5; },
      getChildren);
    expect(result).to.eql([{x: 5, children: [{x:6}]}, {x:6}, {x:7}]);
  });

  it('maps nodes', function() {
    var result = map(testTree,
      function(n) { return n.x; },
      getChildren);
    expect(result).to.eql([1,2,3,4,5,6,7]);
  });

  it('maps trees', function() {
    var result = mapTree(testTree,
      function(n, children) { return children.length ? [n.x, children] : n.x; },
      getChildren);
      console.log(print(result));
    expect(result).to.eql([1,[[2,[[3,[4]],[5,[6]]]],7]]);
  });

});
