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

var arr = lang.arr;

describe('ast.transform', function() {

  describe("helper", function() {

    it("replaceNode", function() {
      var source = "var x = 3,\n"
                   + "    y = x + x;\n"
                   + "y + 2;\n";
      var parsed = ast.parse(source);
      var target = parsed.body[0].declarations[0].init;
      var hist = ast.transform.helper.replaceNode(target,
                   function() { return {type: "Literal", value: "foo"}; },
                   {changes: [], source: source});

      var expected = {
        changes: [{type: 'del', pos: 8, length: 1},
             {type: 'add', pos: 8, string: "'foo'"}],
        source: source.replace('3', "'foo'")
      }

      expect(hist).deep.equals(expected);

    });

    it("replaceNodesInformsAboutChangedNodes", function() {
      var source = "var x = 3;\n"
      var parsed = ast.parse(source);

      var replacement1 = {type: "Literal", value: 23},
        replacement2 = {type: "VariableDeclarator", id: {type: "Identifier", name: "zzz"}, init: {type: "Literal", value: 24}},
        wasChanged1, wasChanged2;

      var hist = ast.transform.helper.replaceNodes([
        {target: parsed.body[0].declarations[0].init, replacementFunc: function(node, source, wasChanged) { wasChanged1 = wasChanged; return replacement1; }},
        {target: parsed.body[0].declarations[0], replacementFunc: function(node, source, wasChanged) { wasChanged2 = wasChanged; return replacement2; }}],
        {changes: [], source: source});

      expect(!wasChanged1).equals(true, "wasChanged1");
      expect(wasChanged2).equals(true, "wasChanged2");

      expect(hist.source).deep.equals("var zzz = 24;\n");
    });

    it("sortNodesForReplace", function() {
      var source = "var x = 3,\n"
                 + "    y = x + x;\n"
                 + "y + 2;\n";
      var parsed = ast.parse(source);
      var result = [
        parsed.body[0],
        parsed.body[0].declarations[1].init.right,
        parsed.body[0].declarations[1].init.left,
        parsed.body[1]].sort(ast.transform.helper._compareNodesForReplacement);
      var expected = [
        parsed.body[0].declarations[1].init.left,
        parsed.body[0].declarations[1].init.right,
        parsed.body[0],
        parsed.body[1]];
      expect(result).deep.equals(expected, arr.pluck(expected, 'type') + ' !== ' + arr.pluck(result, 'type'))
    });

    it("replaceNestedNodes", function() {
      var source = "var x = 3,\n"
           + "    y = x + x;\n"
           + "y + 2;\n";
      var parsed = ast.parse(source);
      var replaceSource1, replaceSource2;
      var hist = ast.transform.helper.replaceNodes([
        {target: parsed.body[0], replacementFunc: function(n, source) { replaceSource1 = source; return {type: "Literal", value: "foo"}; }},
        {target: parsed.body[0].declarations[1].init.right, replacementFunc: function(n, source) { replaceSource2 = source; return {type: "Literal", value: "bar"}; }}],
        {changes: [], source: source});

      var expected = {
        changes: [{type: 'del', pos: 23, length: 1},
             {type: 'add', pos: 23, string: "'bar'"},
             {type: 'del', pos: 0, length: 29},
             {type: 'add', pos: 0, string: "'foo'"}],
        source: "'foo'\ny + 2;\n"
      }

      expect(hist).deep.equals(expected);

      expect(replaceSource1).equals(source.split(";")[0].replace('x + x', 'x + \'bar\'') + ';');
      expect(replaceSource2).equals("x");

    });

    it("replaceNestedAndSubsequentNodes", function() {
      var source = "var x = 3,\n"
           + "    y = x + x;\n"
           + "y + 2;\n";
      var parsed = ast.parse(source),
          hist = ast.transform.helper.replaceNodes([
            {target: parsed.body[0], replacementFunc: function(node, source) { return {type: "Literal", value: "foo"}; }},
            {target: parsed.body[0].declarations[1].init.right, replacementFunc: function() { return {type: "Literal", value: "bar"}; }}],
            {changes: [], source: source});

      var expected = {
        changes: [{type: 'del', pos: 23, length: 1},
                  {type: 'add', pos: 23, string: "'bar'"},
                  {type: 'del', pos: 0, length: 29},
                  {type: 'add', pos: 0, string: "'foo'"}],
        source: "'foo'\ny + 2;\n"
      }

      expect(hist).deep.equals(expected);

    });

  });

  // interface tests
  describe("interface", function() {

    describe("replacement", function() {

      it("manual", function() {

        var code              = 'var x = 3 + foo();',
            parsed            = ast.parse(code),
            toReplace         = parsed.body[0].declarations[0].init.left,
            replacement       = function() { return {type: "Literal", value: "baz"}; },
            result            = ast.transform.replace(parsed, toReplace, replacement),
            transformedString = result.source,
            expected          = 'var x = \'baz\' + foo();'

        expect(transformedString).equals(expected);

        expect(result.changes).deep.equals([{length: 1, pos: 8, type: "del"},{pos: 8, string: "'baz'", type: "add"}]);
      });

      it("replaceNodeKeepsSourceFormatting", function() {
        var code              = 'var x = 3\n+ foo();',
            parsed               = ast.parse(code, {addSource: true}),
            toReplace         = parsed.body[0].declarations[0].init.left,
            replacement       = function() { return {type: "Literal", value: "baz"}; },
            result            = ast.transform.replace(parsed, toReplace, replacement),
            expected          = 'var x = \'baz\'\n+ foo();';

        expect(result.source).equals(expected);
      });

      it("replaceNodeWithMany", function() {
        var code = 'var x = 3, y = 2;',
            parsed = ast.parse(code),
            toReplace = parsed.body[0],
            replacement1 = ast.parse("Global.x = 3").body[0],
            replacement2 = ast.parse("Global.y = 2").body[0],
            replacement = function() { return [replacement1, replacement2]; },
            result = ast.transform.replace(parsed, toReplace, replacement),
            expected = 'Global.x = 3;\nGlobal.y = 2;'

        expect(result.source).equals(expected);
      });

      it("replaceNodeWithManyKeepsSource", function() {
        var code = '/*bla\nbla*/\n  var x = 3,\n      y = 2;',
            parsed = ast.parse(code, {}),
            toReplace = parsed.body[0],
            replacement = function() {
              return [ast.parse("Global.x = 3").body[0],
                  ast.parse("Global.y = 2").body[0]];
            },
            result = ast.transform.replace(code, toReplace, replacement),
            expected = '/*bla\nbla*/\n  Global.x = 3;\n  Global.y = 2;'

        expect(result.source).equals(expected);
      });

    });

    describe("simplify var decls", function() {

      it("oneVarDeclaratorPerDeclaration", function() {
        var code = '/*test*/var x = 3, y = 2; function foo() { var z = 1, u = 0; }',
            result = ast.transform.oneDeclaratorPerVarDecl(code),
            expected = '/*test*/var x = 3;\nvar y = 2; function foo() { var z = 1;\n var u = 0; }'
        expect(result.source).equals(expected);

        var code = "var x = 3, y = (function() { var y = 3, z = 2; })(); ",
            result = ast.transform.oneDeclaratorPerVarDecl(code),
            expected = "var x = 3;\nvar y = function () {\n    var y = 3;\n    var z = 2;\n}(); "
        expect(result.source.replace(/\s/g,"")).equals(expected.replace(/\s/g, ''));
      });

    });

  });

  describe("return last statement", () => {
    it("transforms last statement into return", () =>
      expect(ast.transform.returnLastStatement("var z = foo + bar; baz.foo(z, 3)"))
        .equals("var z = foo + bar; return baz.foo(z, 3)"));
  });

  describe("wrapInFunction", () => {
    it("wraps statements into a function", () =>
      expect(ast.transform.wrapInFunction("var z = foo + bar; baz.foo(z, 3);"))
        .equals("function() {\nvar z = foo + bar; return baz.foo(z, 3);\n}"));
  });

});
