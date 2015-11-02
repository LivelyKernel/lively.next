/*global process, beforeEach, afterEach, describe, it*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var escodegen = env.escodegen, lang = env['lively.lang'], expect, ast;
if (env.isCommonJS) {
  var chai = module.require('chai');
  chai.use(require('chai-subset'));
  expect = chai.expect;
  ast = require('../index');
} else { expect = window.chai.expect; ast = env['lively.ast']; }

function categorize(code) {
  var parsed = ast.parse(code),
      result = ast.codeCategorizer.findDecls(parsed);
  return {ast: parsed, decls: result};
}

describe('code categorizer', function() {

  describe('finding code entities', function() {

    it("finds decls", function() {
      var result = categorize("var x = 23,\n    y = 24");
      expect(result.decls).to.deep.equal([
        {name: "x", type: "var-decl", node: result.ast.body[0].declarations[0]},
        {name: "y", type: "var-decl", node: result.ast.body[0].declarations[1]}
      ]);
    });

    it("test02FindFuncDecls", function() {
      var result = categorize("3 + 4;\nfunction test() { return 23; }");
      expect(result.decls).to.deep.equal([
        {name: "test", type: "function-decl", node: result.ast.body[1]},
      ]);
    });

    it("test03FindDeclsInsideModule", function() {
      var result = categorize("module('foo.bar').requires().toRun(function() {\nfunction test() { return 23; }\n});");
      expect(result.decls).to.deep.equal([{
        name: "test", type: "function-decl",
        node: result.ast.body[0].expression.arguments[0].body.body[0],
        parent: {name: "foo.bar", node: result.ast.body[0]}
      }]);
    });

    it("test04FindDeclsInsideFunctionWrapper", function() {
      var result = categorize("(function() {\nfunction test() { return 23; }\n})();");
      expect(result.decls).to.deep.equal([{
        name: "test", type: "function-decl", node: result.ast.body[0].expression.callee.body.body[0],
        parent: {node: result.ast.body[0], name: null}
      }]);
    });

    it("test05FindMethodAndPropertiessOfClass", function() {
      var result = categorize("Object.subclass('Foo', {foo: function() { return 23; }, bar: 24});"),
          expected = [
            {name: "Foo", type: "lively-class-definition", node: result.ast.body[0]},
            {name: "foo", type: "lively-class-instance-method", node: result.ast.body[0].expression.arguments[1].properties[0], get parent() { return expected[0]; }},
            {name: "bar", type: "lively-class-instance-property", node: result.ast.body[0].expression.arguments[1].properties[1], get parent() { return expected[0]; }}];
      expect(result.decls).to.deep.equal(expected, "1");
  
      var result = categorize("Object.subclass('Foo', 'test', {foo: function() { return 23; }, bar: 24}, 'baz');"),
          expected = [
            {name: "Foo", type: "lively-class-definition", node: result.ast.body[0]},
            {name: "foo", type: "lively-class-instance-method", node: result.ast.body[0].expression.arguments[2].properties[0], get parent() { return expected[0]; }},
            {name: "bar", type: "lively-class-instance-property", node: result.ast.body[0].expression.arguments[2].properties[1], get parent() { return expected[0]; }}];
      expect(result.decls).to.deep.equal(expected, "2mm");
    }),
  
    it("test06FindMethodAndPropertiessOfObject", function() {
      // lively.ast.printAst("var x = {foo: function() { return 23; }, bar: 24};")
      var result = categorize("var x = {foo: function() { return 23; }, bar: 24};"),
          expected = [
            {name: "x", type: "var-decl", node: result.ast.body[0].declarations[0]},
            {name: "foo", type: "object-method", node: result.ast.body[0].declarations[0].init.properties[0], get parent() { return expected[0]; }},
            {name: "bar", type: "object-property", node: result.ast.body[0].declarations[0].init.properties[1], get parent() { return expected[0]; }}];
      expect(result.decls).to.deep.equal(expected, result.decls);
    });

  });

});
