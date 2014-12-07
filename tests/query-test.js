/*global process, beforeEach, afterEach, describe, it, expect*/
typeof module !== "undefined" && console.log("foooooo? " + typeof module !== "undefined" && module.require);
if (typeof module !== "undefined" && module.require) module.require("../bundles/chai-bundle.js");
var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var lang = env['lively.lang'], ast = env.isCommonJS ? require('../index') : env['lively.ast'];

describe('ast.query', function() {

  var arr = lang.arr, chain = lang.chain, obj = lang.obj, fun = lang.fun;
  var acorn = ast.acorn;

  it("declsAndRefsInTopLevelScope", function() {
    var code = "var x = 3;\n function baz(y) { var zork; return xxx + zork + x + y; }\nvar y = 4, z;\nbar = 'foo';"
    var parsed = ast.parse(code);
    var declsAndRefs = ast.query.topLevelDeclsAndRefs(parsed);

    var varDecls = declsAndRefs.varDecls;
    var varIds = chain(declsAndRefs.varDecls).pluck('declarations').flatten().pluck("id").pluck("name").value();
    expect(["x", "y", "z"]).deep.equals(varIds, "var ids");

    var funcIds = chain(declsAndRefs.funcDecls).pluck('id').pluck('name').value();
    expect(["baz"]).deep.equals(funcIds, "funIds: " + obj.inspect(funcIds));

    var refs = declsAndRefs.refs;
    var refIds = chain(refs).pluck('name').value();
    expect(["bar", "xxx", "x"]).deep.equals(refIds, "ref ids");
  });

  it("scopes", function() {
    var code = "var x = {y: 3}; function foo(y) { var foo = 3, baz = 5; x = 99; bar = 2; bar; Object.bar = 3; }";
    var parsed = ast.acorn.parse(code);
    var scope = ast.query.scopes(parsed);
    var expected = {
      node: parsed,
      varDecls: [{declarations: [{id: {name: 'x'}}]}],
      funcDecls: [{id: {name: 'foo'}}],
      params: [],
      refs: [],
      subScopes: [{
        node: parsed.body[1],
        varDecls: [{declarations: [{id: {name: 'foo'}}, {id: {name: 'baz'}}]}],
        funcDecls: [],
        params: [{name: "y"}],
        refs: [{name: "x"}, {name: "bar"}, {name: "bar"}, {name: "Object"}],        
      }]
    }

    expect(scope).to.containSubset(expected)

    // top level scope
    var varNames = chain(scope.varDecls).pluck('declarations').flatten().value();
    expect(1).equals(varNames.length, 'root scope vars');
    var funcNames = chain(scope.funcDecls).pluck('id').pluck('name').value();
    expect(1).equals(scope.funcDecls.length, 'root scope funcs');
    expect(0).equals(scope.params.length, 'root scope params');
    expect(0).equals(scope.refs.length, 'root scope refs');

    // sub scope
    expect(1).equals(scope.subScopes.length, 'subscope length');
    var subScope = scope.subScopes[0];
    var varNames = chain(subScope.varDecls).pluck('declarations').flatten().value();
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
    var result = ast.query.findGlobalVarRefs(code);

    var expected = [{start:169,end:172, name:"foo", type:"Identifier"},
                    {start:182,end:185, name:"baz", type:"Identifier"},
                    {start:189,end:192, name:"foo", type:"Identifier"}];

    expect(result).deep.equals(expected);
  });

  it("recognizeFunctionDeclaration", function() {
    var code = "this.addScript(function run(n) { if (n > 0) run(n-1); show('done'); });",
      result = ast.query.topLevelDeclsAndRefs(code),
      expected = ["show"];
    expect(expected).deep.equals(result.undeclaredNames);
  });

  it("recognizeArrowFunctionDeclaration", function() {
    var code = "this.addScript((n, run) => { if (n > 0) run(n-1); show('done'); });",
        result = ast.query.topLevelDeclsAndRefs(code),
        expected = ["show"];
    expect(expected).deep.equals(result.undeclaredNames);
  });

  it("recognizeClassDeclaration", function() {
    var code = "class Foo {\n" + "  constructor(name) { this.name = name; }\n" + "}\n"+ "new Foo();",
      result = ast.query.topLevelDeclsAndRefs(code),
      expected = [];
    expect(expected).deep.equals(result.undeclaredNames);
  });

  it("findNodesIncludingLines", function() {
    var code = "var x = {\n  f: function(a) {\n   return 23;\n  }\n}\n";

    var expected1 = ["Program","VariableDeclaration","VariableDeclarator","ObjectExpression","FunctionExpression","BlockStatement","ReturnStatement","Literal"],
      nodes1 = ast.query.findNodesIncludingLines(null, code, [3]);
    expect(expected1).deep.equals(chain(nodes1).pluck("type").value());

    var expected2 = ["Program","VariableDeclaration","VariableDeclarator","ObjectExpression"],
      nodes2 = ast.query.findNodesIncludingLines(null, code, [3,5]);
    expect(expected2).deep.equals(chain(nodes2).pluck("type").value());
  });

  it("findScopeAtIndex", function() {
    var src = fun.extractBody(function() {
    var x = {
      f: function(a) {
      return function(a) { return a + 1};
      },
      f2: function() {}
    }
    });
    var index = 35; // on first return
    var parsed = ast.acorn.parse(src, {addSource: true});
    var result = ast.query.scopesAtIndex(parsed, index);

    var scopes = ast.query.scopes(parsed);
    var expected = [scopes, scopes.subScopes[0]]
    expect(expected).deep.equals(result);
  });

  it("findScopeAtIndexWhenIndexPointsToFuncDecl", function() {
    var src = 'var x = "fooo"; function bar() { var z = "baz" }';
    var parsed = ast.acorn.parse(src, {addSource: true});
    var scopes = ast.query.scopes(parsed);

    var index = 26; // on bar
    var result = ast.query.scopeAtIndex(parsed, index);
    expect(scopes).deep.equals(result);

    var index = 34; // inside bar body
    var result = ast.query.scopeAtIndex(parsed, index);
    expect(scopes.subScopes[0]).deep.equals(result);
  });

  it("findDeclarationClosestToIndex", function() {
    var src = fun.extractBody(function() {
    var x = 3, yyy = 4;
    var z = function() { yyy + yyy + (function(yyy) { yyy+1 })(); }
    });
    var index = 48; // second yyy of addition
    // show(src.slice(index-1,index+1))
    var parsed = ast.acorn.parse(src);
    var result = ast.query.findDeclarationClosestToIndex(parsed, "yyy", index);
    expect({end:14,name:"yyy",start:11,type:"Identifier"}).deep.equals(result);
  });

  it("findReferencesAndDeclsInScope", function() {
    var src = fun.extractBody(function() {
    var x = 3, y = 4;
    var z = function() { y + y + (function(y) { y+1 })(); }
    });
    var parsed = ast.acorn.parse(src);
    var scope = ast.query.scopes(parsed);
    var result = ast.query.findReferencesAndDeclsInScope(scope, "y");
    var expected = [{end:12,name:"y",start:11,type:"Identifier"},
                    {end:40,name:"y",start:39,type:"Identifier"},
                    {end:44,name:"y",start:43,type:"Identifier"}];
    expect(expected).deep.equals(result);
  });

});
