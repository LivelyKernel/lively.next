/* global it, describe, beforeEach */
import { expect } from 'mocha-es6';
import { Text } from 'lively.morphic';
import JavaScriptEditorPlugin from 'lively.ide/js/editor-plugin.js';
import JSNavigator from 'lively.ide/js/navigator.js';

describe('js code navigator expression movements', () => {
  let nav = new JSNavigator();

  it('forward sexp', () => {
    let src = 'this.foo(bar, 23);';
    expect(4).equals(nav._forwardSexp(src, 0)); // "|this" -> "this|"
    expect(8).equals(nav._forwardSexp(src, 4)); // "|.foo" -> ".foo|"
    expect(17).equals(nav._forwardSexp(src, 8)); // "|(bar, 23)" -> "(bar, 23)|"
    expect(12).equals(nav._forwardSexp(src, 9));
    expect(18).equals(nav._forwardSexp(src, 17));
    expect(18).equals(nav._forwardSexp(src, 18));
  });

  it('forwardSexpInlcudesSiblings', function () {
    let src = 'function foo() {\nvar x;\nvar y;\n}\n';
    expect(23).equals(nav._forwardSexp(src, 18)); // "function foo() {\n|var x;\nvar y;\n}\n" -> "function foo() {\nvar x;|\nvar y;\n}\n"
    expect(24).equals(nav._forwardSexp(src, 23)); // "function foo() {\nvar x;|\nvar y;\n}\n" -> "function foo() {\nvar x;\n|var y;\n}\n"
  });

  it('backwardSexp', function () {
    let src = 'this.foo(bar, 23);';
    // this.foo(bar, 23);
    // lively.ast.stringify(lively.ast.query.nodesAt(5, src).last())
    // lively.ast.printAst(src)
    // lively.ast.acorn.walk.findNodesIncluding(lively.ast.parse(src), 8)
    expect(0).equals(nav._backwardSexp(src, 18));
    expect(5).equals(nav._backwardSexp(src, 8));
    expect(0).equals(nav._backwardSexp(src, 4));
    expect(0).equals(nav._backwardSexp(src, 17));
    // expect(12).equals(nav._backwardSexp(src, 14));
  });

  it('backwardSexpIncludesSiblings', function () {
    let src = 'function foo() {\nvar x;\nvar y;\n}\n';
    expect(23).equals(nav._backwardSexp(src, 24)); // "function foo() {\nvar x;|\nvar y;\n}\n" -> "function foo() {\nvar x;\n|var y;\n}\n"
  });

  it('forwardDownSexp', function () {
    let src = 'var x = function() { return function(foo) {}; }';
    expect(4).equals(nav._forwardDownSexp(src, 0));
    expect(8).equals(nav._forwardDownSexp(src, 4));
  });

  it('containingFunctionRange', function () {
    let src = 'x = function() { return function(foo) {}; };';
    expect([4, 43]).equals(nav.rangeForFunctionOrDefinition(src, [10, 10]));
    expect([24, 40]).equals(nav.rangeForFunctionOrDefinition(src, [28, 28]));
    expect(null).equals(nav.rangeForFunctionOrDefinition(src, [43, 43]));
    expect([0, 43]).equals(nav.rangeForFunctionOrDefinition(src, [4, 43]));
    expect(null).equals(nav.rangeForFunctionOrDefinition(src, [0, 43]));
  });
});

describe('js code navigator definitions', () => {
  let editor, nav;

  beforeEach(() => {
    editor = new Text({ plugins: [new JavaScriptEditorPlugin()], readOnly: false });
    nav = editor.pluginInvokeFirst('getNavigator');
  });

  it('identifier at point', () => {
    editor.textString = 'var xxx = 23; xxx + 3; function foo() { xxx + 2; }';
    expect(nav.resolveIdentifierAt(editor, { row: 0, column: 16 }))
      .containSubset({
        name: 'xxx',
        decl: { start: 4, end: 7 },
        refs: [{ start: 14, end: 17 }, { start: 40, end: 43 }]
      });
  });

  it('identifier at point inside subscope', () => {
    editor.textString = 'var xxx = 23; xxx + 3; function foo(xxx) { xxx + 2; }';
    nav.resolveIdentifierAt(editor, { row: 0, column: 44 }).refs;
    expect(nav.resolveIdentifierAt(editor, { row: 0, column: 44 }))
      .containSubset({
        name: 'xxx',
        decl: { start: 36 },
        refs: [{ start: 43, end: 46 }]
      });
  });
});

function assertExpansionOrContraction (editor, expander, method, cursorIndexOrRangeOrState, expectedSelectedString) {
  let state = Array.isArray(cursorIndexOrRangeOrState)
    ? { range: cursorIndexOrRangeOrState }
    : typeof cursorIndexOrRangeOrState === 'object'
      ? cursorIndexOrRangeOrState
      : { range: [cursorIndexOrRangeOrState, cursorIndexOrRangeOrState] };
  let expanded = expander[method](editor, editor.textString, null, state);
  let text = editor.textInRange({
    start: editor.indexToPosition(expanded.range[0]),
    end: editor.indexToPosition(expanded.range[1])
  });
  expect(expectedSelectedString).equals(text);
}

function assertExpansion (editor, expander, cursorIndexOrRange, expectedSelectedString) {
  assertExpansionOrContraction(editor, expander, 'expandRegion', cursorIndexOrRange, expectedSelectedString);
}

function assertContraction (editor, expander, cursorIndexOrRange, expectedSelectedString) {
  assertExpansionOrContraction(editor, expander, 'contractRegion', cursorIndexOrRange, expectedSelectedString);
}

let editor, nav;

describe('js code navigator expand and contract', () => {
  beforeEach(() => {
    editor = new Text({ plugins: [new JavaScriptEditorPlugin()], readOnly: false });
    nav = editor.pluginInvokeFirst('getNavigator');
    editor.plugins[0].requestHighlight(true);
  });

  it('expandRegion', function () {
    let src = editor.textString = "a + 'foo bar'";

    expect({ prev: { range: [10, 10] }, range: [5, 12] }).deep.equals(
      nav.expandRegion(editor, src, null, { range: [10, 10] }));
    assertExpansion(editor, nav, [4, 13], "a + 'foo bar'");
    assertContraction(editor, nav, { range: [9, 13], prev: { range: [4, 13] } }, "'foo bar'");

    // src = this.editor.textString = "a.b.c";
    assertExpansion(editor, nav, 4, "'foo bar'");
    assertExpansion(editor, nav, [4, 5], "'foo bar'");
  });

  it('expandOnKeyStringLiteral', function () {
    editor.textString = 'var x = {foo: 234}';
    assertExpansion(editor, nav, 9, 'foo');
    assertExpansion(editor, nav, 10, 'foo');
    assertExpansion(editor, nav, 8, '{foo: 234}');
  });

  it('expandOnString', function () {
    editor.textString = "var x = 'hello world'";
    assertExpansion(editor, nav, 12, 'hello world');
    assertExpansion(editor, nav, 8, "'hello world'");
    assertExpansion(editor, nav, 21, "'hello world'");
  });
});
