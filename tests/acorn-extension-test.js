/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { withMozillaAstDo, rematchAstWithSource } from "../lib/mozilla-ast-visitor-interface.js";
import { parse } from "../lib/parser.js";
import { arr } from "lively.lang";
import { acorn, walk, findSiblings, findNodeByAstIndex, findStatementOfNode, copy } from "../lib/acorn-extension.js";
import stringify from "../lib/stringify.js";

describe('walk extension', function() {

  it("finds siblings", function() {
    var src = 'function foo() {\nvar a;\nvar b;\nvar c;\nvar d;\n}';
    var parsed = parse(src);
    var decls = Array.prototype.slice.call(parsed.body[0].body.body);
    var a = decls[0];
    var b = decls[1];
    var c = decls[2];
    var d = decls[3];

    expect(arr.without(decls, b)).deep.equals(findSiblings(parsed, b));
    expect([a]).deep.equals(findSiblings(parsed, b, 'before'));
    expect([c,d]).deep.equals(findSiblings(parsed, b, 'after'));

  });

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  it("findNodeByAstIndex", function() {
    var src = 'var x = 3; function foo() { var y = 3; return y }; x + foo();',
        parsed = parse(src),
        expected = parsed.body[1].body.body[1].argument, // the y in "return y"
        found = findNodeByAstIndex(parsed, 9);
    expect(expected).equals(found, 'node not found');
  });

  it("findNodeByAstIndexNoReIndex", function() {
    var src = 'var x = 3; function foo() { var y = 3; return y }; x + foo();',
        parsed = parse(src),
        found = findNodeByAstIndex(parsed, 9, false);
    expect(null).equals(found, 'node found (but should not add index)');
  });

  it("findStatementOfNode", function() {
    var tests = [{
      src: 'var x = 3; function foo() { var y = 3; return y + 2 }; x + foo();',
      target: function(ast) { return ast.body[1].body.body[1].argument.left; },
      expected: function(ast) { return ast.body[1].body.body[1]; }
    }, {
      src: 'var x = 1; x;',
      target: function(ast) { return ast.body[1]; },
      expected: function(ast) { return ast.body[1]; }
    }, {
      src: 'switch (123) { case 123: debugger; }',
      target: function(ast) { return ast.body[0].cases[0].consequent[0]; },
      expected: function(ast) { return ast.body[0].cases[0].consequent[0]; }
    }, {
      src: 'if (true) { var a = 1; }',
      target: function(ast) { return ast.body[0].consequent.body[0].declarations[0]; },
      expected: function(ast) { return ast.body[0].consequent.body[0]; }
    }, {
      src: 'if (true) var a = 1;',
      target: function(ast) { return ast.body[0].consequent.declarations[0]; },
      expected: function(ast) { return ast.body[0].consequent; }
    }, {
      src: 'if (true) var a = 1; else var a = 2;',
      target: function(ast) { return ast.body[0].alternate.declarations[0]; },
      expected: function(ast) { return ast.body[0].alternate; }
    }, {
      src: 'a;', // testing scenario where node is not found
      target: function(ast) { return { type: 'EmptyStatement' } },
      expected: function(ast) { return undefined; }
    }];

    tests.forEach(function(test, i) {
      var parsed = parse(test.src),
          found = findStatementOfNode(parsed, test.target(parsed));
      expect(test.expected(parsed)).equals(found, 'node not found ' + (i + 1));
    });
  });

  it("updateSourceCodePositions", function() {
    var src = 'var x = { z: 3 }; function foo() { var y = 3; return y; } x.z + foo();',
        prettySrc = 'var x = { z: 3 };\nfunction foo() {\n  var y = 3;\n  return y;\n}\nx.z + foo();',
        parsed = parse(src),
        genSrc = stringify(parsed),
        genAst = parse(genSrc);

    expect(prettySrc).equals(genSrc, 'pretty printed source and generated source do not match');
    rematchAstWithSource(parsed, genSrc);
    expect(parsed).to.deep.equal(genAst, 'source code positions were not corrected');
  });

  it("updateSourceCodePositionsInSubTree", function() {
    var src1 = 'function foo() { var y = 3; return y; }',
      src2 = 'var x = { z: 3 };\nfunction foo() {\n   var y = 3;\n   return y;\n}\nx.z + foo();',
      ast1 = parse(src1).body[0],
      ast2 = parse(src2),
      genSrc = stringify(ast2),
      genAst = parse(genSrc);

    rematchAstWithSource(ast1, genSrc, null, 'body.1');
    expect(ast1).to.deep.equal(genAst.body[1], 'source code positions were not corrected');
  });

  it("updateSourceCodeLocations", function() {
    var src = 'var x = { z: 3 }; function foo() { var y = 3; return y; } x.z + foo();',
        prettySrc = 'var x = { z: 3 };\nfunction foo() {\n  var y = 3;\n  return y;\n}\nx.z + foo();',
        parsed = parse(src),
        genSrc = stringify(parsed),
        genAst = parse(genSrc);

    expect(prettySrc).equals(genSrc, 'pretty printed source and generated source do not match');
    rematchAstWithSource(parsed, genSrc, true);

    // sample some locations
    var tests = [{  // var = x = { z: 3 };
      expected: { start: { line: 1, column: 0 }, end: { line: 1, column: 17 } },
      subject: parsed.body[0].loc
    }, { // function foo() { ... }
      expected: { start: { line: 2, column: 0 }, end: { line: 5, column: 1 } },
      subject: parsed.body[1].loc
    }, { // var y = 3;
      expected: { start: { line: 3, column: 2 }, end: { line: 3, column: 12 } },
      subject: parsed.body[1].body.body[0].loc
    }, { // y  in  return y;
      expected: { start: { line: 4, column: 9 }, end: { line: 4, column: 10 } },
      subject: parsed.body[1].body.body[1].argument.loc
    }, { // x.z + foo();
      expected: { start: { line: 6, column: 0 }, end: { line: 6, column: 12 } },
      subject: parsed.body[2].loc
    }];

    tests.forEach(function(test, i) {
      expect(test.subject).to.containSubset(test.expected, 'incorrect location for test ' + (i+1));
    });

    // compare withour considering locations
    withMozillaAstDo(parsed, {}, function(next, node) { delete node.loc; next(); })
    expect(parsed).to.deep.equal(genAst, 'source code positions were not corrected');
  });

  it("parseWithComments", function() {
    var src = '// comment1\n\n//comment2\nvar x = 3; // comment3\n// comment3\nfunction foo() { var y = 3; /*comment4*/ return y }; x + foo();',
        parsed = parse(src, {withComments: true}),
        comments = parsed.comments,
        expectedTopLevelComments = [{
          column: undefined, line: undefined, isBlock: false,
          start: 0, end: 11,
          node: null, text: " comment1"
        },{
          column: undefined, line: undefined, isBlock: false,
          start: 13, end: 23,
          node: null, text: "comment2"
        },{
          column: undefined, line: undefined, isBlock: false,
          start: 35, end: 58,
          node: null, text: " comment3\n comment3"
        }],
        expectedScopedComments = [{
          node: null,
          column: undefined, line: undefined, 
          start: 87,end: 99,
          isBlock: true, text: "comment4"
        }];

    expect(parsed.comments).to.deep.equal(expectedTopLevelComments, 'topLevel');
    expect(parsed.body[1].body.comments).to.deep.equal(expectedScopedComments, 'scoped');
  });

  it("should deep copy ast", function() {
    var parsed = parse('var x = 3;', {addSource: true, addAstIndex: true}),
        parsedCopy = copy(parsed);

    // FIXME: sourceType should be copied too
    delete parsed.sourceType;

    expect(parsed).to.containSubset(parsedCopy);
    parsed.body[0].declarations[0].init.value = 'foo';
    expect(parsed).not.to.containSubset(parsedCopy);
  });

});
