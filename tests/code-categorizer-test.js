/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { parse } from "../lib/parser.js";
import { findDecls } from "../lib/code-categorizer.js";

function categorize(code) {
  var parsed = parse(code),
      result = findDecls(parsed);
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

    it("finds exported decls", function() {
      var result = categorize("export var x = 23,\n    y = 24");
      expect(result.decls).to.deep.equal([
        {name: "x", type: "var-decl", node: result.ast.body[0].declaration.declarations[0]},
        {name: "y", type: "var-decl", node: result.ast.body[0].declaration.declarations[1]}
      ]);
    });

    it("find func decls", function() {
      var result = categorize("3 + 4;\nfunction test() { return 23; }");
      expect(result.decls).to.deep.equal([
        {name: "test", type: "function-decl", node: result.ast.body[1]},
      ]);
    });

    it("find export default func decls", function() {
      var result = categorize("export default function test() { return 23; }");
      expect(result.decls).to.deep.equal([
        {name: "test", type: "function-decl", node: result.ast.body[0].declaration},
      ]);
    });

    it("find decls inside function wrapper", function() {
      var result = categorize("(function() {\nfunction test() { return 23; }\n})();");
      expect(result.decls).to.deep.equal([{
        name: "test", type: "function-decl", node: result.ast.body[0].expression.callee.body.body[0],
        parent: {node: result.ast.body[0], name: null}
      }]);
    });

    it("find method and properties of object", function() {
      // lively.ast.printAst("var x = {foo: function() { return 23; }, bar: 24};")
      var result = categorize("var x = {foo: function() { return 23; }, bar: 24};"),
          expected = [
            {name: "x", type: "object-decl", node: result.ast.body[0].declarations[0]},
            {name: "foo", type: "object-method", node: result.ast.body[0].declarations[0].init.properties[0], get parent() { return expected[0]; }},
            {name: "bar", type: "object-property", node: result.ast.body[0].declarations[0].init.properties[1], get parent() { return expected[0]; }}];
      expect(result.decls).containSubset(expected);
    });

    it("finds classes", function() {
      var result = categorize("class Foo {constructor(xxx) {} foo() {} static bar() {} get zork() {}}"),
          expected = [
            {name: "Foo", type: "class-decl", node: result.ast.body[0]},
            {name: "constructor", type: "class-constructor", node: result.ast.body[0].body.body[0]},
            {name: "foo", type: "class-instance-method", node: result.ast.body[0].body.body[1]},
            {name: "bar", type: "class-class-method", node: result.ast.body[0].body.body[2]},
            {name: "zork", type: "class-instance-getter", node: result.ast.body[0].body.body[3]}
          ];

      expect(result.decls).containSubset(expected, result.decls);
    });

  });

});
