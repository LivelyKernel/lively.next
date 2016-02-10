/*global process, require, beforeEach, afterEach, describe, it*/

if (typeof window !== "undefined") {
  var chai = window.chai;
  var expect = window.expect;
  var lang = window.lively.lang;
  var ast = window.lively.ast;
} else {
  var chai = require('chai');
  var expect = chai.expect;
  var lang = require("lively.lang");
  var ast = require('../index');
  chai.use(require('chai-subset'));
}
var escodegen = ast.escodegen;

describe('es6', function() {

  it("arrow function", function() {
    var code = '() => 23;'
    var parsed = ast.parse(code);
    expect(parsed).deep.property("body[0].expression.type")
      .equals("ArrowFunctionExpression");
  });

});
