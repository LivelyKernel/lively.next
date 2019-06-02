/*global process, require, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { parse } from "../lib/parser.js";

describe('es6', function() {

  it("arrow function", function() {
    var code = '() => 23;'
    var parsed = parse(code);
    expect(parsed).deep.property("body[0].expression.type")
      .equals("ArrowFunctionExpression");
  });

});
