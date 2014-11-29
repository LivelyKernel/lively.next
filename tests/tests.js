/*global process, beforeEach, afterEach, describe, it*/

var expect = typeof module !== "undefined" && module.require ? module.require('chai').expect : chai.expect;
var ast = typeof lively !== "undefined" ? lively.ast : module.require("../index.js");

// var ast = lively.ast2;

describe('interface', function() {
  it('parses JavaScript code', function() {
    expect(ast.parse("1 + 2")).deep.property("body[0].type")
      .equals("ExpressionStatement");
  });

});
