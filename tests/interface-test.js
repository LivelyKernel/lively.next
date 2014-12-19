/*global process, beforeEach, afterEach, describe, it*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var escodegen = env.escodegen, lang = env['lively.lang'], expect, ast;
if (env.isCommonJS) {
  var chai = module.require('chai');
  chai.use(require('chai-subset'));
  expect = chai.expect;
  ast = require('../index');
} else { expect = chai.expect; ast = env['lively.ast']; }

describe('interface', function() {
  it('parses JavaScript code', function() {
    expect(ast.parse("1 + 2")).deep.property("body[0].type")
      .equals("ExpressionStatement");
  });

});
