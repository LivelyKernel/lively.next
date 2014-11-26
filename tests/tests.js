/*global process, beforeEach, afterEach, describe, it*/

var expect = typeof module !== "undefined" ? module.require('chai').expect : chai.expect;
var ast = typeof lively !== "undefined" ? lively.ast : this["lively.ast"] || require("../index.js");

describe('interface', function() {

  it('parses JavaScript code', function() {
    expect(ast.parse("1 + 2")).deep.property("body[0].type").to.equal("ExpressionStatement");
  });

});
