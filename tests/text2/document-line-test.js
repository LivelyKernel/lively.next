/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import TextTree, { Line } from "../../text2/document-tree.js";
import { arr } from "lively.lang";

var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 5, minNodeSize: 2};

describe("lines", () => {

  it("have text and properties", () => {
    let l = new Line({}, 10, "this is a test", [2,4, {foo: 23}, 7,10, {bar: 24}]);
    expect(l.height).equals(10);
    expect(l.text).equals("this is a test");
    expect(l.props).deep.equals([{foo: 23}, {bar: 24}]);
    expect(l.textAndProps).deep.equals([
      0, 2, "th", null,
      2, 4, "is", {foo: 23},
      4, 7, " is", null,
      7, 10, " a ", {bar: 24},
      10, 14, "test", null]);
  });

});
