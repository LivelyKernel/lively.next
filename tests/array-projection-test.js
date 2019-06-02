/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import { range } from "../array.js";
import {
  transformToIncludeIndex,
  create,
  toArray,
  originalToProjectedIndex,
  projectedToOriginalIndex
} from "../array-projection.js";

describe("array projection", function() {

  it("creates projection", function() {
    // array = ["A","B","C","D","E","F","G","H","I","J"]
    var array = range(65,74).map(i => String.fromCharCode(i));
    expect({array: array, from: 0, to: 3}).to.eql(create(array, 3));
    expect({array: array, from: 2, to: 5}).to.eql(create(array, 3, 2));
    expect({array: array, from: 7, to: 10}).to.eql(create(array, 3, 9));
  });

  it("gets projection in range", function() {
    // array = ["A","B","C","D","E","F","G","H","I","J"]
    var array = range(65,74).map(i => String.fromCharCode(i)),
        projection = {array: array, from: 5, to: 8},
        result = toArray(projection);
    expect(["F","G","H"]).to.eql(result);
  });

  it("computes projection indices", function() {
    var array = range(65,74).map(i => String.fromCharCode(i)),
        projection = {array: array, from: 5, to: 8},
        result = toArray(projection);
    expect(null).to.equal(originalToProjectedIndex(projection, 2),'orig index to projected 2');
    expect(0).to.equal(originalToProjectedIndex(projection, 5),'orig index to projected 5');
    expect(2).to.equal(originalToProjectedIndex(projection, 7),'orig index to projected 7');
    expect(null).to.equal(originalToProjectedIndex(projection, 9),'orig index to projected 9');
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    expect(7).to.equal(projectedToOriginalIndex(projection, 2),'orig index to projected 2');
    expect(5).to.equal(projectedToOriginalIndex(projection, 0),'orig index to projected 0');
    expect(null).to.equal(projectedToOriginalIndex(projection, 4),'orig index to projected 4');
  });

  it("transforms projection to include index", function() {
    var array = range(65,74).map(i => String.fromCharCode(i)),
        projection = create(array, 3, 2);
    expect(projection).to.eql(transformToIncludeIndex(projection, 3));
    expect({array: array, from: 1, to: 4}).to.eql(transformToIncludeIndex(projection, 1));
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var array = [1,2,3,4,5], projection = create(array, 3);
    expect(array[3]).to.equal(
      toArray(transformToIncludeIndex(projection, 3))
        .slice(-1)[0]);
  });

});
