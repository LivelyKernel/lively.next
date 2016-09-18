/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { promise } from "lively.lang";
import { Text } from "../../text/morph.js";
import { Range } from "../../text/selection.js";
import { expect } from "mocha-es6";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";
import config from "../../config.js";

function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
}

var text;

describe("undo", function() {

  this.timeout(config.text.undoGroupDelay*2);

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
    expect(text.undoManager.undos).have.length(0);
    text.undoManager.group();
    text.insertText("a"); text.insertText("b"); text.insertText("c");
    text.undoManager.group();
    expect(text.undoManager.undos).have.length(1);
    text.textUndo();
    expect(text.textString).equals("hello\nworld");
    text.textRedo();
    expect(text.textString).equals("abchello\nworld");
    expect(text.selection).stringEquals("Selection(0/0 -> 0/3)");
  });

  it("groups debounced", async () => {
    text.undoManager.group();
    text.insertText("a");
    text.undoManager.groupLater();
    setTimeout(() => text.insertText("b"), 5);
    setTimeout(() => text.insertText("c"), 10);
    await promise.delay(text.undoManager.grouping.debounceTime);
    expect(text.undoManager.undos).have.length(1);
  });

  it("groups debounced cancel", async () => {
    text.undoManager.group();
    text.insertText("a");
    text.undoManager.groupLater();
    setTimeout(() => text.insertText("b"), 5);
    setTimeout(() => text.insertText("c"), 10);
    setTimeout(() => text.undoManager.groupLaterCancel(), 15);
    await promise.delay(text.undoManager.grouping.debounceTime);
    expect(text.undoManager.undos).have.length(3);
  });

  it("creates a new undo group and does stuff with it", () => {
    var undo = text.undoManager.ensureNewGroup(text);
    expect(text.undoManager.undos).equals([undo], "pre undos");
    expect(text.undoManager.grouping.current).equals([undo], "pre grouping");
    text.insertText("a");
    text.insertText("b");
    text.undoManager.group(undo);
    expect(text.undoManager.undos[0]).equals(undo, "undo not in undos");
    expect(text.undoManager.undos).to.have.length(1, "undos");
    expect(text.undoManager.undos[0].changes).to.have.length(2, "changes");
    expect(text.undoManager.undos[0]).containSubset(
      {changes: [{selector: "insertText"}, {selector: "insertText"}]}, "change details")
  });

  it("can group previous undo", () => {
    // text = new Text({textString: "hello\nworld", fontMetric})
    text.undoManager.group();
    text.insertText("a");
    text.undoManager.group();
    text.insertText("b");
    text.undoManager.group(text.undoManager.undos[0]);
    expect(text.undoManager.undos).to.have.length(1);
    expect(text.undoManager.undos[0].changes).to.have.length(2);
    expect(text.undoManager.undos[0]).containSubset(
      {changes: [{selector: "insertText"}, {selector: "insertText"}]})
  });

});
