/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import Closure from "lively.lang/closure.js";

describe("closure", function() {

  it("captures values", function() {
    var f = Closure.fromFunction(function() { return y + 3 }, {y: 2}).recreateFunc();
    expect(f()).to.equal(5);
  });

});
