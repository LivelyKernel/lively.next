/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var escodegen = env.escodegen, lang = env['lively.lang'], expect, ast;
if (env.isCommonJS) {
  var _chai = module.require('chai');
  _chai.use(require('chai-subset'));
  expect = _chai.expect;
  ast = require('../index');
} else { expect = chai.expect; ast = env['lively.ast']; }

describe('jsx', function() {

  it("can be parsed", function() {
    var code = 'var app = <Nav color="blue" />;'
    var parsed = ast.parse(code, {plugins: {jsx: true}});
    expect(parsed).deep.property("body[0].declarations[0].init.type")
      .equals("JSXElement");
  });

});
