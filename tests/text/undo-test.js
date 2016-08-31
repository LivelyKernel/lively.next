/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { promise } from "lively.lang";
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

  it("groups undos", () => {
    expect(text.undoManager.undos).have.length(1);
    text.groupTextUndoChanges();
    text.insertText("a"); text.insertText("b"); text.insertText("c");
    text.groupTextUndoChanges();
    expect(text.undoManager.undos).have.length(2);
    text.textUndo();
    expect(text.textString).equals("hello\nworld");
    text.textRedo();
    expect(text.textString).equals("abchello\nworld");
    expect(text.selection).stringEquals("Selection(0/0 -> 0/3)");
  });

  it("groups debounced", async () => {
    text.groupTextUndoChanges();
    text.insertText("a");
    text.undoManager.groupLater();
    setTimeout(() => text.insertText("b"), 5);
    setTimeout(() => text.insertText("c"), 10);
    await promise.delay(text.undoManager.grouping.debounceTime);
    expect(text.undoManager.undos).have.length(2);
  });

  it("groups debounced cancel", async () => {
    text.groupTextUndoChanges();
    text.insertText("a");
    text.undoManager.groupLater();
    setTimeout(() => text.insertText("b"), 5);
    setTimeout(() => text.insertText("c"), 10);
    setTimeout(() => text.undoManager.groupLaterCancel(), 15);
    await promise.delay(text.undoManager.grouping.debounceTime);
    expect(text.undoManager.undos).have.length(1+3);
  });

});
