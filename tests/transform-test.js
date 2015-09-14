/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var escodegen = env.escodegen, lang = env['lively.lang'], expect, ast;
if (env.isCommonJS) {
  var chai = module.require('chai');
  chai.use(require('chai-subset'));
  expect = chai.expect;
  ast = require('../index');
} else {
  // expect = chai.expect; ast = env['lively.ast']; 
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

      expect(!wasChanged1).to.be.true("wasChanged1");
      expect(wasChanged2).to.be.true("wasChanged2");

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
      var parsed = ast.parse(source);
      var hist = ast.transform.helper.replaceNodes([
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

    describe("capturing", function() {

      it("transformTopLevelVarDeclsForCapturing", function() {
        var code     = "var y, z = foo + bar; baz.foo(z, 3)",
            expected = "Global.y = Global['y'] || undefined;\nGlobal.z = Global.foo + Global.bar; Global.baz.foo(Global.z, 3)",
            recorder = {name: "Global", type: "Identifier"},
            result   = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(code, recorder);
        expect(result.source).equals(expected);
      });

      it("transformTopLevelVarAndFuncDeclsForCapturing", function() {
        var code     = "var z = 3, y = 4; function foo() { var x = 5; }",
            expected = "Global.foo = foo;\nGlobal.z = 3;\nGlobal.y = 4; function foo() { var x = 5; }",
            recorder = {name: "Global", type: "Identifier"},
            result   = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(code, recorder);
        expect(result.source).equals(expected);
      });

      it("transformTopLevelVarDeclsAndVarUsageForCapturing", function() {
        var code              = "var z = 3, y = 42, obj = {a: '123', b: function b(n) { return 23 + n; }};\n"
                              + "function foo(y) { var x = 5 + y.b(z); }\n",
            parsed               = ast.parse(code, {addSource: true}),
            expected          = "Global.foo = foo;\n"
                              + "Global.z = 3;\n"
                              + "Global.y = 42;\n"
                              + "Global.obj = {\n"
                              + "    a: '123',\n"
                              + "    b: function b(n) {\n"
                              + "        return 23 + n;\n"
                              + "    }\n"
                              + "};\n"
                              + "function foo(y) { var x = 5 + y.b(Global.z); }\n",
            recorder          = {name: "Global", type: "Identifier"},
            result            = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(code, recorder);


        expect(result.source).equals(expected);
      });

      it("transformTopLevelVarDeclsForCapturingWithoutGlobals", function() {
        var code     = "var x = 2; y = 3; z = 4; baz(x, y, z)",
            expected = "foo.x = 2; foo.y = 3; z = 4; baz(foo.x, foo.y, z)",
            recorder = {name: "foo", type: "Identifier"},
            result   = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(
              code, recorder, {exclude: ['baz', 'z']});
        expect(result.source).equals(expected);
      });

      it("transformTopLevelVarDeclsAndCaptureDefRanges", function() {
        var code     = "var y = 1, x = 2;\nvar y = 3; z = 4; baz(x, y, z); function baz(a,b,c) {}",
            expected = {
             baz: [{end: 72, start: 50, type: "FunctionDeclaration"}],
             x: [{end: 16, start: 11, type: "VariableDeclarator"}],
             y: [{end: 9, start: 4, type: "VariableDeclarator"},
               {end: 27, start: 22, type: "VariableDeclarator"}]},
            recorder = {name: "foo", type: "Identifier"},
            result   = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(
              code, recorder, {recordDefRanges: true});
        expect(result.defRanges).deep.equals(expected);
      });

      describe("for statement", function() {

        it("transformTopLevelVarDeclsAndVarUsageInCatch", function() {
          var code              = "try { throw {} } catch (e) { e }\n",
              parsed               = ast.parse(code, {addSource: true}),
              recorder          = {name: "Global", type: "Identifier"},
              result            = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(code, recorder);

          expect(result.source).equals(code);
        });

        it("transformTopLevelVarDeclsAndVarUsageInForLoop", function() {
          var code     = "for (var i = 0; i < 5; i ++) { i; }",
              parsed      = ast.parse(code, {addSource: true}),
              recorder = {name: "Global", type: "Identifier"},
              result   = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(code, recorder);

          expect(result.source).equals(code);
        });

      });
      
      describe("destructuring", function() {

        describe("object notation", function() {

          it("object literal into var decls", function() {
            var code = "var {y, z} = {y: 3, z: 4};",
                result = ast.transform.oneDeclaratorForVarsInDestructoring(code),
                expected = "var __temp = {\n    y: 3,\n    z: 4\n};\nvar y = __temp.y;\nvar z = __temp.z;";
            expect(result.source).equals(expected);
          });

          it("expression into var decls", function() {
            var code = "var {y, z} = foo;",
                result = ast.transform.oneDeclaratorForVarsInDestructoring(code),
                expected = "var __temp = foo;\nvar y = __temp.y;\nvar z = __temp.z;"
            expect(result.source).equals(expected);
          });

          it("nested", function() {
            var code = "var {x, y: [{z}]} = {x: 3, y: [{z: 4}]};",
                result = ast.transform.oneDeclaratorForVarsInDestructoring(code),
                expected = "var __temp = {\n    x: 3,\n    y: [{ z: 4 }]\n};\nvar x = __temp.x;\nvar y = __temp.y;\nvar z = __temp.y[0].z;";
            expect(result.source).equals(expected);
          });
          
        })

        xit("transformTopLevelVarAndFuncDeclsForCapturing", function() {
          var code     = "var {y, z} = {y: 3, z: 4}; function foo() { var x = 5; }",
              expected = "Global.foo = foo;\nGlobal.z = 4;\nGlobal.y = 3; function foo() { var x = 5; }",
              recorder = {name: "Global", type: "Identifier"},
              result   = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(code, recorder);
          expect(result.source).equals(expected);
        });

      });

    });

  });

  describe("return last statement", function() {

    it("transformToReturnLastStatement", function() {
      var code = "var z = foo + bar; baz.foo(z, 3)",
          expected = "var z = foo + bar; return baz.foo(z, 3)",
          transformed = ast.transform.returnLastStatement(code);
      expect(transformed).equals(expected);
    });

  });

  describe("wrapInFunction", function() {

    it("wrapInFunction", function() {
      var code = "var z = foo + bar; baz.foo(z, 3);",
          expected = "function() {\nvar z = foo + bar; return baz.foo(z, 3);\n}",
          transformed = ast.transform.wrapInFunction(code);
      expect(transformed).equals(expected);
    });

  });

});
