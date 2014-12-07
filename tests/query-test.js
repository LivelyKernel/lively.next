/*global process, beforeEach, afterEach, describe, it, expect*/

if (typeof module !== "undefined" && module.require) module.require("../bundles/chai-bundle.js");
var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var lang = env['lively.lang'], ast = env.isCommonJS ? require('../index') : env['lively.ast'];

describe('ast.query', function() {

  var arr = lively.lang.arr, chain = lively.lang.chain, obj = lively.lang.obj;
  var acorn = ast.acorn;
  lively.ast = ast;

  it("declsAndRefsInTopLevelScope", function() {
    var code = "var x = 3;\n function baz(y) { var zork; return xxx + zork + x + y; }\nvar y = 4, z;\nbar = 'foo';"
    var ast = lively.ast.acorn.parse(code);
    var declsAndRefs = lively.ast.query.topLevelDeclsAndRefs(ast);

    var varDecls = declsAndRefs.varDecls;
    var varIds = declsAndRefs.varDecls.pluck('declarations').flatten().pluck("id").pluck("name");
    expect(["x", "y", "z"]).deep.equals(varIds, "var ids");

    var funcIds = chain(declsAndRefs.funcDecls).pluck('id').pluck('name').value();
    expect(["baz"]).deep.equals(funcIds, "funIds: " + obj.inspect(funcIds));

    var refs = declsAndRefs.refs;
    var refIds = chain(refs).pluck('name').value();
    expect(["bar", "xxx", "x"]).deep.equals(refIds, "ref ids");
  });

  it("scopes", function() {
    var code = "var x = {y: 3}; function foo(y) { var foo = 3, baz = 5; x = 99; bar = 2; bar; Object.bar = 3; }";
    var ast = lively.ast.acorn.parse(code);
    var scope = lively.ast.query.scopes(ast);
    var expected = {
      node: ast,
      varDecls: [{declarations: [{id: {name: 'x'}}]}],
      funcDecls: [{id: {name: 'foo'}}],
      params: [],
      refs: [],
      subScopes: [{
        node: ast.body[1],
        varDecls: [{declarations: [{id: {name: 'foo'}}, {id: {name: 'baz'}}]}],
        funcDecls: [],
        params: [{name: "y"}],
        refs: [{name: "x"}, {name: "bar"}, {name: "bar"}, {name: "Object"}],        
      }]
    }

    expect(scope).to.containSubset(expected)

    // top level scope
    var varNames = scope.varDecls.pluck('declarations').flatten();
    expect(1).equals(varNames.length, 'root scope vars');
    var funcNames = scope.funcDecls.pluck('id').pluck('name');
    expect(1).equals(scope.funcDecls.length, 'root scope funcs');
    expect(0).equals(scope.params.length, 'root scope params');
    expect(0).equals(scope.refs.length, 'root scope refs');

    // sub scope
    expect(1).equals(scope.subScopes.length, 'subscope length');
    var subScope = scope.subScopes[0];
    var varNames = subScope.varDecls.pluck('declarations').flatten();
    expect(2).equals(varNames.length, 'subscope vars');
    expect(0).equals(subScope.funcDecls.length, 'subscope funcs');
    expect(4).equals(subScope.refs.length, 'subscope refs');
    expect(1).equals(subScope.params.length, 'subscope params');
  });

  it("findGlobalVars", function() {
    var code = "var margin = {top: 20, right: 20, bottom: 30, left: 40},\n"
         + "    width = 960 - margin.left - margin.right,\n"
         + "    height = 500 - margin.top - margin.bottom;\n"
         + "function blup() {}\n"
         + "foo + String(baz) + foo + height;\n"
    var result = lively.ast.query.findGlobalVarRefs(code);

    var expected = [{start:169,end:172, name:"foo", type:"Identifier"},
                    {start:182,end:185, name:"baz", type:"Identifier"},
                    {start:189,end:192, name:"foo", type:"Identifier"}];

    expect(result).deep.equals(expected);
  });

  it("recognizeFunctionDeclaration", function() {
    var code = "this.addScript(function run(n) { if (n > 0) run(n-1); show('done'); });",
      result = lively.ast.query.topLevelDeclsAndRefs(code),
      expected = ["show"];
    expect(expected).deep.equals(result.undeclaredNames);
  });

  it("recognizeArrowFunctionDeclaration", function() {
    var code = "this.addScript((n, run) => { if (n > 0) run(n-1); show('done'); });",
        result = lively.ast.query.topLevelDeclsAndRefs(code),
        expected = ["show"];
    expect(expected).deep.equals(result.undeclaredNames);
  });

  it("recognizeClassDeclaration", function() {
    var code = "class Foo {\n" + "  constructor(name) { this.name = name; }\n" + "}\n"+ "new Foo();",
      result = lively.ast.query.topLevelDeclsAndRefs(code),
      expected = [];
    expect(expected).deep.equals(result.undeclaredNames);
  });

  it("findNodesIncludingLines", function() {
    var code = "var x = {\n  f: function(a) {\n   return 23;\n  }\n}\n";

    var expected1 = ["Program","VariableDeclaration","VariableDeclarator","ObjectExpression","FunctionExpression","BlockStatement","ReturnStatement","Literal"],
      nodes1 = lively.ast.query.findNodesIncludingLines(null, code, [3]);
    expect(expected1).deep.equals(nodes1.pluck("type"));

    var expected2 = ["Program","VariableDeclaration","VariableDeclarator","ObjectExpression"],
      nodes2 = lively.ast.query.findNodesIncludingLines(null, code, [3,5]);
    expect(expected2).deep.equals(nodes2.pluck("type"));
  });

  it("findScopeAtIndex", function() {
    var src = Functions.extractBody(function() {
    var x = {
      f: function(a) {
      return function(a) { return a + 1};
      },
      f2: function() {}
    }
    });
    var index = 35; // on first return
    var ast = lively.ast.acorn.parse(src, {addSource: true});
    var result = lively.ast.query.scopesAtIndex(ast, index);

    var scopes = lively.ast.query.scopes(ast);
    var expected = [scopes, scopes.subScopes[0]]
    expect(expected).deep.equals(result);
  });

  it("findScopeAtIndexWhenIndexPointsToFuncDecl", function() {
    var src = 'var x = "fooo"; function bar() { var z = "baz" }';
    var ast = lively.ast.acorn.parse(src, {addSource: true});
    var scopes = lively.ast.query.scopes(ast);

    var index = 26; // on bar
    var result = lively.ast.query.scopeAtIndex(ast, index);
    expect(scopes).deep.equals(result);

    var index = 34; // inside bar body
    var result = lively.ast.query.scopeAtIndex(ast, index);
    expect(scopes.subScopes[0]).deep.equals(result);
  });

  it("findDeclarationClosestToIndex", function() {
    var src = Functions.extractBody(function() {
    var x = 3, yyy = 4;
    var z = function() { yyy + yyy + (function(yyy) { yyy+1 })(); }
    });
    var index = 48; // second yyy of addition
    // show(src.slice(index-1,index+1))
    var ast = lively.ast.acorn.parse(src);
    var result = lively.ast.query.findDeclarationClosestToIndex(ast, "yyy", index);
    expect({end:14,name:"yyy",start:11,type:"Identifier"}).deep.equals(result);
  });

  it("findReferencesAndDeclsInScope", function() {
    var src = Functions.extractBody(function() {
    var x = 3, y = 4;
    var z = function() { y + y + (function(y) { y+1 })(); }
    });
    var ast = lively.ast.acorn.parse(src);
    var scope = lively.ast.query.scopes(ast);
debugger;
    var result = lively.ast.query.findReferencesAndDeclsInScope(scope, "y");
    var expected = [{end:12,name:"y",start:11,type:"Identifier"},
                    {end:40,name:"y",start:39,type:"Identifier"},
                    {end:44,name:"y",start:43,type:"Identifier"}];
    expect(expected).deep.equals(result);
  })

});
