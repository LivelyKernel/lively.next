/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var escodegen = env.escodegen, lang = env['lively.lang'], expect, ast;
if (env.isCommonJS) {
  var _chai = module.require('chai');
  _chai.use(require('chai-subset'));
  expect = _chai.expect;
  ast = require('../index');
} else { expect = chai.expect; ast = env['lively.ast']; }

describe('es6', function() {

  it("can be parsed", function() {
    var code = '() => 23;'
    var parsed = ast.parse(code);
    expect(parsed).deep.property("body[0].expression.type")
      .equals("ArrowFunctionExpression");
  });

});
