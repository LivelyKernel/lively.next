/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Text } from "../../text/morph.js";
import { Range } from "../../text/selection.js";
import { expect } from "mocha-es6";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";

function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
}

var text;

describe("undo", () => {

  beforeEach(() => text = new Text({textString: "hello\nworld", fontMetric}));

  it("can undo simple insert", () => {
    text.insertText("foo", {row: 1, column: 0});
    expect(text.textString).equals("hello\nfooworld");
    text.textUndo();
    expect(text.textString).equals("hello\nworld");
    expect(text.selection).stringEquals("Selection(1/0 -> 1/0)");
  });

  it("can undo and redo simple insert", () => {
    text.insertText("foo", {row: 1, column: 0});
    text.textUndo();
    text.textRedo();
    expect(text.textString).equals("hello\nfooworld");
    expect(text.selection).stringEquals("Selection(1/0 -> 1/3)");
  });

  it("undo then redo", () => {
    text.insertText("foo", {row: 1, column: 0});
    text.insertText(" bar", {row: 1, column: 3});
    expect(text.textString).equals("hello\nfoo barworld");

    text.textUndo(); text.textUndo();
    text.textRedo(); text.textRedo();
    expect(text.textString).equals("hello\nfoo barworld");
    expect(text.selection).stringEquals("Selection(1/3 -> 1/7)");
  });

});
