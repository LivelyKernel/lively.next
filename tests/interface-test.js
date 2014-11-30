/*global process, beforeEach, afterEach, describe, it*/

var expect = typeof module !== "undefined" && module.require ? module.require('chai').expect : chai.expect;
var expect = typeof module !== "undefined" && module.require ? module.require('chai').expect : chai.expect;
var env = module && module.require ? module.require("../env") : lively['lively.lang_env'];
var ast = env['lively.ast'];

describe('interface', function() {
  it('parses JavaScript code', function() {
    expect(ast.parse("1 + 2")).deep.property("body[0].type")
      .equals("ExpressionStatement");
  });

});
