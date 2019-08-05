"format esm";
/*global beforeEach, afterEach, describe, it, expect, g*/
import { chai, expect } from 'mocha-es6';
import * as ast from 'lively.ast';
import * as Rewriting from '../lib/rewriter.js';
import { escodegen, parse } from "lively.ast";
import { string, arr, obj } from "lively.lang";
import { getCurrentASTRegistry, RecordingRewriter, setCurrentASTRegistry } from "lively.context";
import { stackCaptureMode, asRewrittenClosure } from "../lib/stackReification.js";

chai.use(function(chai, utils) {
  chai.ast = chai.ast || {};

  chai.ast.matchCode = function(ast, code) {
    var genCode = escodegen.generate(ast);
    var match = string.stringMatch(genCode.trim(), code.trim(), { ignoreIndent: true });
    return match;
  };

  chai.Assertion.addChainableMethod('matchCode', function(expected) {
    var actual = this._obj;
    var match = chai.ast.matchCode(actual, expected);

    return this.assert(
      match.matched,
      'expected AST to match with ' + expected + ':\n' + match.error,
      'expected AST of ' + this._obj + ' not to match with ' + expected
    );
  });
});

function tryCatch(level, varMapping, inner, optOuterLevel) {
  level = level || 0;
  optOuterLevel = !isNaN(optOuterLevel) ? optOuterLevel : (level - 1);
  return string.format("try {\n"
    + "var _ = {}, lastNode = undefined, debugging = false, __%s = [], _%s = %s;\n"
    + "__%s.push(_, _%s, %s);\n"
    + "%s"
    + "} catch (e) {\n"
    + "    var ex = e.isUnwindException ? e : new UnwindException(e);\n"
    + "    ex.storeFrameInfo(this, arguments, __%s, lastNode, 'RewriteTests', %s);\n"
    + "    throw ex;\n"
    + "}\n",
    level, level, generateVarMappingString(), level, level,
    optOuterLevel < 0 ? (typeof window !== "undefined" ? 'window' : 'global') : '__' + optOuterLevel,
    inner, level, "__/[0-9]+/__");
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  function generateVarMappingString() {
    if (!varMapping) return '{}';
    var ast = {
      type: "ObjectExpression",
      properties: Object.keys(varMapping).map(function(k) {
        return {
          type: "Property",
          kind: "init",
          key: {type: "Literal",value: k},
          value: {name: varMapping[k],type: "Identifier"}
        }
      })
    };
    return escodegen.generate(ast);
  }
}

function pcAdvance(optionalAstIndex) {
  // like lastNode = 7 <-- the value stored in lastNode is the AST index
  var astIndexMatcher = optionalAstIndex !== undefined ? optionalAstIndex : '__/[0-9]+/__';
  return "lastNode = " + astIndexMatcher;
}

function storeResult(expression, optionalAstIndex) {
  // like _[7] = 42; <-- the value stored in lastNode and the _ object is the AST index
  optionalAstIndex = optionalAstIndex || '__/[0-9]+/__';
  return '_[' + optionalAstIndex + '] = ' + expression;
}

function prefixResult(expression, optionalAstIndex) {
  // like _[lastNode = 7] = 42; <-- the value stored in lastNode and the _ object is the AST index
  return '_[' + pcAdvance(optionalAstIndex) + '] = ' + expression;
}

function postfixResult(expression, optionalAstIndex) {
  // like _[7] = 42, lastNode = 7, _[7]; <-- the value stored in lastNode and the _ object is the AST index
  optionalAstIndex = optionalAstIndex !== undefined ? optionalAstIndex : '__/[0-9]+/__';
  return '_[' + optionalAstIndex + '] = ' + expression + ', ' + pcAdvance(optionalAstIndex) + ', _[' + optionalAstIndex + ']';
}

function intermediateReference(optionalAstIndex) {
  // like _[7] <-- the value stored in the _ object is the AST index
  var astIndexMatcher = optionalAstIndex !== undefined ? optionalAstIndex : "__/[0-9]+/__";
  return "_[" + astIndexMatcher + "]";
}

function setVar(level, varName, inner) {
  return string.format("_%s.%s = %s", level, varName, inner);
}

function getVar(level, varName) {
  return string.format("_%s.%s", level, varName);
}

function closureWrapper(level, name, args, innerVarDecl, inner, optInnerLevel) {
  // something like:
  // __createClosure('AcornRewriteTests', 333, __0, function () {
  //     try {
  //         var _ = {}, _1 = {}, __1 = [_,_1,__0];
  //     ___ DO INNER HERE ___
  //     } catch (e) {...}
  // })
  var argDecl = innerVarDecl || {};
  optInnerLevel = !isNaN(optInnerLevel) ? optInnerLevel : (level + 1);
  args.forEach(function(argName) { argDecl[argName] = argName; });
  return string.format(
    "__createClosure('RewriteTests', __/[0-9]+/__, __%s, function %s(%s) {\n" +
    tryCatch(optInnerLevel, argDecl, inner, level) +
    "})", level, name, args.join(', ')
  );
}

function catchIntro(level, catchVar, storeResult) {
  storeResult = storeResult == null ? true : !!storeResult;
  return string.format("var _%s = { '%s': %s.isUnwindException ? %s.error : %s };\n"
    + "if (_%s['%s'].toString() == 'Debugger' && !(lively.Config && lively.Config.loadRewrittenCode))\n"
    + "    throw %s;\n"
    + (storeResult ? pcAdvance() + ";\n"
      + "__%s = [\n"
      + "    _,\n"
      + "    _%s,\n"
      + "    __%s\n"
      + "];\n" : ""),
    level, catchVar, catchVar, catchVar, catchVar,
    level, catchVar, catchVar, level - 1, level, level - 1);
}

function catchOutro(level) {
  return "__" + (level - 1) + " = __" + (level - 1) + "[2];\n";
}

function debuggerThrow() {
  return "if (lively.lang.Path('lively.Config.enableDebuggerStatements').get(" +
    (typeof window !== "undefined" ? 'window' : 'global') + ")) {\n" +
    "debugging = true;\n" +
    prefixResult('undefined') + ";\n" +
    "throw {\n" +
    "toString: function () {\n" +
    "return 'Debugger';\n" +
    "},\n" +
    "astIndex: __/[0-9]+/__\n" +
    "};\n" +
    "}\n";
}

function finallyWrapper(stmts) {
  return 'if (!debugging) {\n' +
    stmts +
    '}\n';
}

describe('rewriting', function() {
  var parser = ast,
      rewrite,
      astRegistry, oldAstRegistry;

  beforeEach(function() {
    rewrite = function(node) {
      return Rewriting.rewrite(node, astRegistry, 'RewriteTests');
    };
    oldAstRegistry = getCurrentASTRegistry();
    astRegistry = {};
    setCurrentASTRegistry(astRegistry);
  });

  afterEach(function() {
    setCurrentASTRegistry(oldAstRegistry);
  });

  it('creates the wrapper', function() {
    var ast = parser.parse('12345;'),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast);
    expect(result).to.matchCode(tryCatch(0, null, '12345;\n'));
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites local variables', function() {
    var src = 'var i = 0; i;',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {'i': 'undefined'},
          postfixResult(setVar(0, 'i', '0'), 2 /*astIndex*/) + ';\n' +
          getVar(0, 'i') + ';\n');

    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('does not rewrite global variables', function() {
    var src = 'i;',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast);
    expect(result).to.matchCode(tryCatch(0, null, 'i;\n'));
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites variable declaration with multiple variables', function() {
    var src = 'var i = 0, j;',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {'i': 'undefined', 'j': 'undefined'},
            '(' + postfixResult(setVar(0, 'i', '0')) + '), ' + pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites function declarations', function() {
    var src = 'function fn(k, l) {}',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {'fn': closureWrapper(0, 'fn', ['k', 'l'], {}, "")},
          pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites scoped variables correctly', function() {
    var src = 'var i = 0; function fn() {var i = 1;}',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {
            'i': 'undefined',
            'fn': closureWrapper(0, 'fn', [], {i: 'undefined'},
              postfixResult(setVar(1, 'i', '1')) + ';\n')
          },
          postfixResult(setVar(0, 'i', '0')) + ';\n' +
          pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites parent scope variables correctly', function() {
    var src = 'var i = 0; function fn() {i;}',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {
            'i': 'undefined',
            'fn': closureWrapper(0, 'fn', [], {}, getVar(0, 'i') + ';\n')
          },
          postfixResult(setVar(0, 'i', '0')) + ';\n' +
          pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites for with variable declaration', function() {
    var src = 'for (var i = 0; i < 10; i++) {}',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {'i': 'undefined'},
          "for ("
          + postfixResult(setVar(0, 'i', '0')) + '; '
          + getVar(0, 'i') + ' < 10; '
          + prefixResult(getVar(0, 'i') + '++')
          + ") {\n}\n");
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites for-in with variable declaration', function() {
    var src = 'for (var key in obj) {}',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {'key': 'undefined'},
          "for ("
          + getVar(0, 'key') + ' in obj'
          + ") {\n"
          + prefixResult(intermediateReference() + ' || Object.keys(obj)') + ';\n'
          + intermediateReference() + '.shift();\n'
          + "}\n");
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites for-in without block body', function() {
    var src = "for (var key in obj) 1;\n",
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {'key': 'undefined'},
          "for ("
          + getVar(0, 'key') + ' in obj'
          + ") {\n"
          + prefixResult(intermediateReference() + ' || Object.keys(obj)') + ';\n'
          + "1;\n"
          + intermediateReference() + '.shift();\n'
          + "}\n");
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites empty for statements', function() {
    var src = 'for (;;) {}',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {}, "for (;;) {\n}\n");
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites function assignments', function() {
    var src = 'var foo = function bar() {};',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {'foo': 'undefined'},
          postfixResult(setVar(0, 'foo',
            storeResult(closureWrapper(0, 'bar', [], {}, ''))
          )) + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites functions as parameters', function() {
    var src = 'fn(function () {});',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          storeResult(
            'fn(' +
              '(' + postfixResult(closureWrapper(0, '', [], {}, '')) + ')' +
            ')') + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites functions as properties', function() {
    var src = '({fn: function () {}});',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          '({\nfn: '
          + storeResult(closureWrapper(0, '', [], {}, '')) + '\n'
          + '});\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites functions as getters and setters', function() {
    var src = '({get foo() {}, set bar(val) {val++;}});',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          '({\n' +
            'get foo() {\n' + tryCatch(1, {}, '') + '},\n' +
            'set bar(val) {\n' + tryCatch(1, {val: 'val'},
              prefixResult(getVar(1, 'val') + '++') + ';\n') + '}\n' +
          '});\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites functions as return values', function() {
    var src = '(function () {return function() {};});',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          storeResult(
              closureWrapper(0, '', [], {},
              'return ' + storeResult(
                closureWrapper(1, '', [], {}, '')) + ';\n')) + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites functions in conditionals', function() {
    var src = 'true ? function() {} : 23;',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          'true ? ' +
          storeResult(closureWrapper(0, '', [], {}, '')) + ' : 23;\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites closure calls', function() {
    var src = '(function() {})();',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          prefixResult(
            '(' + storeResult(closureWrapper(0, '', [], {}, '')) +
            ')()') + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites member chains', function() {
    var src = 'var lively, ast, morphic; morphic;',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {lively: 'undefined', ast: 'undefined', morphic: 'undefined'},
          pcAdvance() + ', ' +   // for lively
          pcAdvance() + ', ' +   // for ast
          pcAdvance() + ';\n' +  // for morphic
          // FIXME: shouldn't there be a pc advance for morphic?
          // pcAdvance() + ', (' + pcAdvance() + ', ' + getVar(0, 'lively') + '.ast).morphic'
          getVar(0, 'morphic') + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites functions in member chain', function() {
    var src = '(function() {}).toString();',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          prefixResult(
            '('
            + storeResult(closureWrapper(0, '', [], {}, ''))
            + ').toString()') + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites properties referencing variables', function() {
    var src = 'var foo; ({foo: foo});',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {foo: 'undefined'},
          pcAdvance() + ';\n' +
          "({ foo: " + getVar(0, 'foo') + ' });\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites functions in arrays', function() {
    var src = '[function() {}];',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          '[' + storeResult(closureWrapper(0, '', [], {}, '')) + '];\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites call to local function as return', function() {
    // test if the "return g();" is translated to "return _0.g.call();"
    var func = function() { function g() {}; return g(); }, returnStmt;
    stackCaptureMode(func);
    var returns = [];
    ast.withMozillaAstDo(asRewrittenClosure(func).ast, returns, function(next, node, state) {
      if (node.type === 'ReturnStatement') state.push(node); return next();
    });
    expect(returns).to.have.length(1);
    var expected = 'return ' + prefixResult(
      getVar(0, 'g') + '.call(' + (typeof window !== "undefined" ? 'window' : 'global') + ')') + ';';
    expect(returns[0]).to.matchCode(expected);
  });

  it('rewrites call to global function as return', function() {
    var func = function() { return g(); }, returnStmt;
    stackCaptureMode(func);
    ast.acorn.walk.simple(asRewrittenClosure(func).ast, {ReturnStatement: function(n) { returnStmt = n; }})
    var expected = 'return ' + prefixResult('g()') + ';';
    expect(returnStmt).to.matchCode(expected);
  });

  it('rewrites function declarations after use', function() {
    var src = 'foo(); function foo() { }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { 'foo': closureWrapper(0, 'foo', [], {}, '') },
          prefixResult(getVar(0, 'foo') + '.call(' + (typeof window !== "undefined" ? 'window' : 'global') + ')') + ';\n' +
          pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites function re-declarations', function() {
    var src = 'function foo() { 1; } foo(); function foo() { 2; }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { 'foo': closureWrapper(0, 'foo', [], {}, '2;\n') },
          pcAdvance() + ';\n' +
          prefixResult(getVar(0, 'foo') + '.call(' + (typeof window !== "undefined" ? 'window' : 'global') + ')') + ';\n' +
          pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('does not rewrite _NO_REWRITE_ prefixed function declarations', function() {
    var src = 'var a, b; function _NO_REWRITE_foo(a, b) { return a + b; }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {
          'a': 'undefined',
          'b': 'undefined',
          '_NO_REWRITE_foo': 'function _NO_REWRITE_foo(a, b) {\nreturn a + b;\n}'
        }, pcAdvance() + ', ' + pcAdvance() + ';\n' + pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('does not rewrite _NO_REWRITE_ prefixed variable declarations', function() {
    var src = 'var bar = function _NO_REWRITE_foo(a, b) { return a + b; }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { 'bar': 'undefined' },
          postfixResult(setVar(0, 'bar',
            prefixResult('function _NO_REWRITE_foo(a, b) {\nreturn a + b;\n}')
          )) + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites function arguments correctly', function() {
    var src = 'function foo() { arguments; arguments[0]; }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { 'foo': closureWrapper(0, 'foo', [], {},
          'arguments;\n' +
          'arguments[0];\n'
        ) }, pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites re-declaration of arguments correctly', function() {
    var src = 'function foo() { var arguments; }',
        ast = parser.parse(src,
          {sourceType: 'script'}  // neccessary to not have strict mode
        ),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { 'foo': closureWrapper(0, 'foo', [], {},
          pcAdvance() + ';\n'
        ) }, pcAdvance() + ';\n');
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites try and catch', function() {
    var src = 'try { throw Error(); } catch (e) { }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { },
          'try {\n' +
          'throw ' + pcAdvance() + ', ' + prefixResult('Error()') + ';\n' +
          '} catch (e) {\n' +
          catchIntro(1, 'e') +
          catchOutro(1) +
          '}\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites try, catch and finally', function() {
    var src = 'try { debugger; } finally { 1; }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, {},
          'try {\n' +
          debuggerThrow() +
          '} catch (e) {\n' +
          catchIntro(1,'e', false) +
          '} finally {\n' +
          finallyWrapper('1;\n') +
          '}\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites try with debugger statement', function() {
    var src = 'try { debugger; } catch (e) { 1; } finally { 2; }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { },
          'try {\n' +
          debuggerThrow() +
          '} catch (e) {\n' +
          catchIntro(1, 'e') +
          '1;\n' +
          catchOutro(1) +
          '} finally {\n' +
          finallyWrapper('2;\n') +
          '}\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites try with function declaration in finally section', function() {
    var src = 'try { debugger; } catch (e) { (function() { e; }); }',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { },
          'try {\n' +
          debuggerThrow() +
          '} catch (e) {\n' +
          catchIntro(1, 'e') +
          storeResult(closureWrapper(0, '', [], {},
            getVar(1, 'e') + ';\n', 2)) + ';\n\n' +
          catchOutro(1) +
          '}\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites with statement', function() {
    var src = 'var a = 1; with ({ a: 2 }) { a; }',
        ast = parser.parse(src,
          {sourceType: 'script'}  // neccessary to not have strict mode
        ),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { 'a': 'undefined' },
          postfixResult(setVar(0, 'a', '1')) + ';\n' +
          "{\n" +
          "var _1 = { a: 2 };\n" +
          "__0 = [\n" +
          "  _,\n" +
          "  _1,\n" +
          "  __0\n" +
          "];\n" +
          "('a' in _1 ? _1 : _0).a;\n" +
          "__0 = __0[2];\n" +
          "}\n"
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites nested with statements', function() {
    var src = 'var a = 1; with ({ a: 2 }) { with ({ b: 3 }) { a; } }',
        ast = parser.parse(src,
          {sourceType: 'script'}  // neccessary to not have strict mode
        ),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { 'a': 'undefined' },
          postfixResult(setVar(0, 'a', '1')) + ';\n' +
          "{\n" +
          "var _1 = { a: 2 };\n" +
          "__0 = [\n" +
          "  _,\n" +
          "  _1,\n" +
          "  __0\n" +
          "];\n" +
          "{\n" +
          "var _2 = { b: 3 };\n" +
          "__0 = [\n" +
          "  _,\n" +
          "  _2,\n" +
          "  __0\n" +
          "];\n" +
          "('a' in _2 ? _2 : 'a' in _1 ? _1 : _0).a;\n" +
          "__0 = __0[2];\n" +
          "}\n" +
          "__0 = __0[2];\n" +
          "}\n"
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites with statement without matching variable declaration', function() {
    var src = 'with ({ a: 1 }) { a; }',
        ast = parser.parse(src,
          {sourceType: 'script'}  // neccessary to not have strict mode
        ),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { },
          "{\n" +
          "var _1 = { a: 1 };\n" +
          "__0 = [\n" +
          "  _,\n" +
          "  _1,\n" +
          "  __0\n" +
          "];\n" +
          "('a' in _1 ? _1 : { 'a': a }).a;\n" +
          "__0 = __0[2];\n" +
          "}\n"
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites debugger statement in if branch', function() {
    var src = 'if (true) debugger; else 1;',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { },
          'if (true) {\n' +
          debuggerThrow() +
          '} else\n' +
          '1;\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites debugger statement in else branch', function() {
    var src = 'if (true) 1; else debugger;',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { },
          'if (true)\n' +
          '1;\n' +
          'else {\n' +
          debuggerThrow() +
          '}\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites function call without parameter', function() {
    var src = 'fn();',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { },
          prefixResult('fn()', 1) + ';\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites function call with simple parameters', function() {
    var src = 'fn(1, a, b);',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { },
          storeResult('fn(1, a, ' +
            '(' + storeResult('b', 3) + ', ' + pcAdvance(4) + ', ' + intermediateReference(3) + ')' +
          ')', 4) + ';\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites local function call without parameter', function() {
    var src = 'var fn; fn();',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        expected = tryCatch(0, { fn: 'undefined' },
          pcAdvance() + ';\n' +
          prefixResult(getVar(0, 'fn') + '.call(' + (typeof window !== "undefined" ? 'window' : 'global') + ')') + ';\n'
        );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites switch statements', function() {
    var src = 'var a = 1, b; switch (a) { case 1: break; case --b: a++; default: a--; }',
      ast = parser.parse(src),
      astCopy = obj.deepCopy(ast),
      result = rewrite(ast),
      expected = tryCatch(0, { 'a': 'undefined', 'b': 'undefined' },
        '(' + postfixResult(setVar(0, 'a', '1')) + '), ' + pcAdvance() + ';\n' +
        'switch (' + prefixResult(getVar(0, 'a')) + ') {\n' +
        'case 1:\n' +
        'break;\n' +
        'case ' + prefixResult('--' + getVar(0, 'b')) + ':\n' +
        prefixResult(getVar(0, 'a') + '++') + ';\n' +
        'default:\n' +
        prefixResult(getVar(0, 'a') + '--') + ';\n' +
        '}\n'
      );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites do-while statements', function() {
    var src = 'var i = 0; do { i++; } while(i < 3);',
      ast = parser.parse(src),
      astCopy = obj.deepCopy(ast),
      result = rewrite(ast),
      expected = tryCatch(0, { 'i': 'undefined' },
        postfixResult(setVar(0, 'i', '0')) + ';\n' +
        'do {\n' +
        prefixResult(getVar(0, 'i') + '++') + ';\n' +
        '} while (' + getVar(0, 'i') + ' < 3);\n'
      );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites while statements', function() {
    var src = 'var i = 0; while (i < 3) { i++; }',
      ast = parser.parse(src),
      astCopy = obj.deepCopy(ast),
      result = rewrite(ast),
      expected = tryCatch(0, { 'i': 'undefined' },
        postfixResult(setVar(0, 'i', '0')) + ';\n' +
        'while (' + getVar(0, 'i') + ' < 3) {\n' +
        prefixResult(getVar(0, 'i') + '++') + ';\n' +
        '}\n'
      );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites unary expressions', function() {
    var src = 'var i = true; !i;',
      ast = parser.parse(src),
      astCopy = obj.deepCopy(ast),
      result = rewrite(ast),
      expected = tryCatch(0, { 'i': 'undefined' },
        postfixResult(setVar(0, 'i', 'true')) + ';\n' +
        '!' + getVar(0, 'i') + ';\n'
      );
    expect(result).to.matchCode(expected);
    expect(ast).to.shallowDeepEqual(astCopy);
  });

  it('rewrites arrow function with single body node', function() {
    var src = 'var x = foo => ({x: 23});',
        ast = parser.parse(src),
        astCopy = obj.deepCopy(ast),
        result = rewrite(ast),
        sourceResult = escodegen.generate(result);
    expect(sourceResult).to.include("function (foo)", "arrow expr not converted to function?");
    expect(sourceResult).to.include("return { x: 23 };", "arrow result not returning?");
  });

});

(function() {
    function recordIt(exprToRecord, level, optRecorderName) {
        var recorderName = optRecorderName || "__test_recordIt__";
        return string.format(
            "%s(%s, __%s, __/[0-9]+|lastNode/__, 'AcornRewriteTests', %s);",
            recorderName, exprToRecord, level, level)
    }

    function tryCatch(level, varMapping, inner, optOuterLevel, recordArgs) {
        level = level || 0;
        optOuterLevel = !isNaN(optOuterLevel) ? optOuterLevel : (level - 1);

        var argRecordings = arr.compact(Object.keys(varMapping)
                .map(function(argName) { return argName === "this" ? null : recordIt(argName, level); })
            ),
            argRecordingsString = argRecordings.length ? argRecordings.join("\n") + "\n" : "";

        return string.format(
            "var _ = {}, lastNode = undefined, debugging = false, __%s = [], _%s = %s;\n"
            + "__%s.push(_, _%s, %s);\n"
            + (recordArgs ? argRecordingsString : "\n")
            + "%s\n",
            level, level, generateVarMappingString(), level, level,
            optOuterLevel < 0 ? 'Global' : '__' + optOuterLevel,
            inner); //, level, "__/[0-9]+/__");

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

        function generateVarMappingString() {
            if (!varMapping) return '{}';
            var ast = {
                type: "ObjectExpression",
                properties: Object.keys(varMapping).map(function(k) {
                    return {
                        type: "Property",
                        kind: "init",
                        key: {type: "Literal",value: k},
                        value: {name: varMapping[k],type: "Identifier"}
                    }
                })
            };
            return escodegen.generate(ast);
        }
    }

    // TODO: delete duplicate function 'closureWrapper'
    // what about line 'argDecl["this"] = "this";'?
    function closureWrapper(level, name, args, innerVarDecl, inner, optInnerLevel) {
        // something like:
        // __createClosure('AcornRewriteTests', 333, __0, function () {
        //     try {
        //         var _ = {}, _1 = {}, __1 = [_,_1,__0];
        //     ___ DO INNER HERE ___
        //     } catch (e) {...}
        // })
        var argDecl = innerVarDecl || {};
        optInnerLevel = !isNaN(optInnerLevel) ? optInnerLevel : (level + 1);
        args.forEach(function(argName) { argDecl[argName] = argName; });
        argDecl["this"] = "this";
        return string.format(
            "__createClosure('AcornRewriteTests', __/[0-9]+/__, __%s, function %s(%s) {\n"
            + tryCatch(optInnerLevel, argDecl, inner, level, true)
            + "})", level, name, args.join(', '));
    }

    describe('recording', function() {

        it('records function parameters', function () {
            // var t = new tests.RewriterTests.AcornRewrite();
            // t.postfixResult(t.setVar(3, "foo", 23), 10);
            // t.prefixResult("1+2", 10)
            // t.storeResult("1+3", 10);
            // t.closureWrapper(1, "foo", ["n", "m"], {}, "1+2", 3)

            // this.doitContext = new tests.RewriterTests.RewriteForRecording()
            // this.setUp()

            var source = "function foo(n, m) { return n; }";
            // printAst(source, {printIndex: true});


            var recordingAstRegistry = {};
            var recordingRewriter = new RecordingRewriter(recordingAstRegistry, "AcornRewriteTests", "__test_recordIt__");
            // var recordingRewriter = new Rewriter(recordingAstRegistry, "AcornRewriteTests", "__test_recordIt__");
            var ast = parse(source, { addSource: true });
            var recordingRewrite = recordingRewriter.rewrite(ast);
            var result = escodegen.generate(recordingRewrite);

            var expected = tryCatch(0,
                {"this": "this", foo: closureWrapper(
                    0, 'foo', ["n", "m"], {},
                    // "return " + this.recordIt('('+this.postfixResult(this.getVar(1, 'n'), 3)+')', 1))
                    "return " + getVar(1, 'n') + ";")
                }, pcAdvance(6) + ";");

            expect(recordingRewrite).to.matchCode(expected);
        });

        it('records return statement', function () {
            var source = "function foo() { return 1; }";

            var recordingAstRegistry = {};
            var recordingRewriter = new RecordingRewriter(recordingAstRegistry, "AcornRewriteTests", "__test_recordIt__");
            // var recordingRewriter = new Rewriter(recordingAstRegistry, "AcornRewriteTests", "__test_recordIt__");
            var ast = parse(source, { addSource: true });
            var recordingRewrite = recordingRewriter.rewrite(ast);
            var result = escodegen.generate(recordingRewrite);

            var expected = tryCatch(0,
                {"this": "this", foo: closureWrapper(
                    0, 'foo', [], {},
                    // "return " + this.recordIt('('+this.postfixResult("1", 1)+')', 1))
                    "return 1;")
                }, pcAdvance(4) + ";");

            expect(recordingRewrite).to.matchCode(expected);
        });
    });
})();
