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

var arr = lang.arr;

function _testVarTfm(descr, code, expected, only) {
  if (typeof expected === "undefined") {
    expected = code; code = descr;
  }
  return (only ? it.only : it)(descr, () => {
    // var result = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(
    //   code, {name: "_rec", type: "Identifier"});
    var result = ast.capturing.rewriteToCaptureTopLevelVariables(
      code, {name: "_rec", type: "Identifier"});
    expect(result.source).equals(expected);
  });
}

function testVarTfm(descr, code, expected) { return _testVarTfm(descr, code, expected, false); }
function only_testVarTfm(descr, code, expected) { return _testVarTfm(descr, code, expected, true); }

function _testExportTfm(descr, code, expected, only) {
  if (typeof expected === "undefined") {
    expected = code; code = descr;
  }
  return (only ? it.only : it)(descr, () => {
    var result = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(
      code, {name: "_rec", type: "Identifier"}, {es6ExportId: "_exports", es6ModulesId: "_modules"});
    expect(result.source).equals(expected);
  });
}
function testExportTfm(descr, code, expected) { return _testExportTfm(descr, code, expected, false); }
function only_testExportTfm(descr, code, expected) { return _testExportTfm(descr, code, expected, true); }

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

    describe("capturing", function() {

      testVarTfm("transformTopLevelVarDeclsForCapturing",
                 "var y, z = foo + bar; baz.foo(z, 3)",
                 "_rec.y = _rec['y'] || undefined;\n_rec.z = _rec.foo + _rec.bar;\n_rec.baz.foo(_rec.z, 3);");

      testVarTfm("transformTopLevelVarAndFuncDeclsForCapturing",
                 "var z = 3, y = 4; function foo() { var x = 5; }",
                 "_rec.foo = foo;\n_rec.z = 3;\n_rec.y = 4; function foo() { var x = 5; }")

      testVarTfm("transformTopLevelVarDeclsAndVarUsageForCapturing",
                 "var z = 3, y = 42, obj = {a: '123', b: function b(n) { return 23 + n; }};\n"
               + "function foo(y) { var x = 5 + y.b(z); }\n",
                 "_rec.foo = foo;\n"
               + "_rec.z = 3;\n"
               + "_rec.y = 42;\n"
               + "_rec.obj = {\n"
               + "    a: '123',\n"
               + "    b: function b(n) {\n"
               + "        return 23 + n;\n"
               + "    }\n"
               + "};\n"
               + "function foo(y) { var x = 5 + y.b(_rec.z); }\n");

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

      testVarTfm("transformTopLevelVarDeclsAndVarUsageInCatch",
                 "try { throw {} } catch (e) { e }\n",
                 "try { throw {} } catch (e) { e }\n");

      describe("for statement", function() {

        testVarTfm("standard for won't get rewritten",
                   "for (var i = 0; i < 5; i ++) { i; }",
                   "for (var i = 0; i < 5; i ++) { i; }");

        testVarTfm("for-in won't get rewritten",
                   "for (var x in {}) { x; }",
                   "for (var x in {}) { x; }");

      });

      describe("labels", function() {

        testVarTfm("ignores continue",
                   "loop1:\nfor (var i = 0; i < 3; i++) continue loop1;",
                   "loop1:\nfor (var i = 0; i < 3; i++) continue loop1;");

        testVarTfm("ignores break",
                   "loop1:\nfor (var i = 0; i < 3; i++) break loop1;",
                   "loop1:\nfor (var i = 0; i < 3; i++) break loop1;");
      });

      describe("es6", () => {

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

        describe("let + const", () => {

          testVarTfm("captures let as var (...for now)",
                     "let x = 23, y = x + 1;",
                     "_rec.x = 23;\n_rec.y = _rec.x + 1;");

          testVarTfm("captures const as var (...for now)",
                     "const x = 23, y = x + 1;",
                     "_rec.x = 23;\n_rec.y = _rec.x + 1;");
        });

        describe("exports", () => {

          testVarTfm("does not rewrite exports but adds capturing statement",
                     "var a = 23;\n"
                   + "export var x = a + 1, y = x + 2;"
                   + "export default function f() {}\n",
                     "_rec.f = f;\n"
                   + "_rec.a = 23;\n"
                   + "export var x = _rec.a + 1, y = x + 2;\n"
                   + "_rec.x = x;\n"
                   + "_rec.y = y;export default function f() {}\n");

        });
        
        describe("import", () => {

          testVarTfm("import x from './some-es6-module.js';",
                     "import x from './some-es6-module.js';\n_rec.x = x;");

          testVarTfm("import * as name from 'module-name';",
                     "import * as name from 'module-name';\n_rec.name = name;");

          testVarTfm("import { member } from 'module-name';",
                     "import { member } from 'module-name';\n_rec.member = member;");

          testVarTfm("import { member as alias } from 'module-name';",
                     "import { member as alias } from 'module-name';\n_rec.alias = alias;");

          testVarTfm("import { member1 , member2 } from 'module-name';",
                     "import {\n    member1,\n    member2\n} from 'module-name';\n_rec.member1 = member1;\n_rec.member2 = member2;");

          testVarTfm("import { member1 , member2 as alias} from 'module-name';",
                     "import {\n    member1,\n    member2 as alias\n} from 'module-name';\n_rec.member1 = member1;\n_rec.alias = alias;");

          testVarTfm("import defaultMember, { member } from 'module-name';",
                     "import defaultMember, { member } from 'module-name';\n_rec.defaultMember = defaultMember;\n_rec.member = member;");

          testVarTfm("import defaultMember, * as name from 'module-name';",
                     "import defaultMember, * as name from 'module-name';\n_rec.defaultMember = defaultMember;\n_rec.name = name;");

          testVarTfm("import 'module-name';",
                     "import 'module-name';");
        });

        describe("export", () => {

          testVarTfm("var x = 23; export { x as y };",
                     "_rec.x = 23; var x = _rec.x;\n export {\n    x as y\n};");

          testExportTfm("export default 23;",
                        "_exports['default'] = 23;");

          testExportTfm("export default function () {};",
                        "_exports['default'] = function () {\n};;");

          testExportTfm("export default function* () {};",
                        "_exports['default'] = function* () {\n};;");

          testExportTfm("export default class Foo {a() { return 23; }};",
                        "_exports['default'] = class Foo {\n    a() {\n        return 23;\n    }\n};;");

          testExportTfm("export { name1, name2 };",
                        "var name2 = _rec.name2;\nvar name1 = _rec.name1;\n_exports['name1'] = name1;\n_exports['name2'] = name2;");

          testExportTfm("export var x = 34, y = x + 3;",
                        "var x = 34, y = x + 3;\n_rec.x = x;\n_rec.y = y;\n_exports['x'] = 34;\n_exports['y'] = x + 3;");

          testExportTfm("export let x = 34;",
                        "let x = 34;\n_rec.x = x;\n_exports['x'] = 34;");

          testExportTfm("export let x = 34;",
                        "let x = 34;\n_rec.x = x;\n_exports['x'] = 34;");

          testExportTfm("export { name1 as default };",
                        "var name1 = _rec.name1;\n_exports['default'] = name1;");

          testExportTfm("export * from 'foo';",
                        "for (var name in _modules['foo'])\n    _exports[name] = _modules['foo'][name];");

          // export * from …;
          // export { name1, name2, …, nameN } from …;
          // export { import1 as name1, import2 as name2, …, nameN } from …;
        });

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
