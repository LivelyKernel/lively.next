/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Selection } from "../../text/selection.js";
import TextDocument from "../../text/document.js";
import { Text } from "../../text/morph.js";
import { expect } from "mocha-es6";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
}

var t;

function text(string, props) {
  var t = new Text({
    name: "text",
    textString: string,
    fontFamily: "Monaco, monosonpace",
    fontSize: 10,
    extent: pt(100,100),
    padding: 3,
    fontMetric,
    ...props
  });
  t._selection = new MultiSelection(t);
  return t;
}

describe("text selection", () => {

  beforeEach(() => t = new Text({textString: "hello\nworld", fontMetric}));

  it("has a range", () => {
    expect(new Selection(t).range.toString()).equals("Range(0/0 -> 0/0)");
  });

  it("selection / line string", () => {
    var t = text("hello\n world", {});
    t.selection = range(1,1,1,1);
    expect(t.selectionOrLineString()).equals(" world");
    t.selection = range(1,1,1,3);
    expect(t.selectionOrLineString()).equals("wo");
  });

  it("gets text", () => {
    var sel = new Selection(t);
    expect(sel.text).equals("");
    sel.range = range(0,1,1,1);
    expect(sel.text).equals("ello\nw");
  });

  it("sets text", () => {
    var sel = new Selection(t, range(0,1,1,1));
    sel.text = "foo\nbar";
    expect(sel.text).equals("foo\nbar");
    expect(t.textString).equals("hfoo\nbarorld");
    expect(t.document.textString).equals("hfoo\nbarorld");
  });

  it("growLeft", () => {
    var sel = new Selection(t, range(0,0,1,1));
    sel.growLeft(10);
    expect(sel.range).equals(range(0,0,1,1), "out of bounds 1");
    sel.range = range(0,4,1,1);
    sel.growLeft(3);
    expect(sel.range).equals(range(0,1,1,1), "2");
    sel.growLeft(3);
    expect(sel.range).equals(range(0,0,1,1), "out of bounds 3");
    sel.growLeft(-2);
    expect(sel.range).equals(range(0,2,1,1), "negative 4");
    sel.growLeft(-20);
    expect(sel.range).equals(range(1,1,1,1), "negative 5");
  });

  it("growRight", () => {
    var sel = new Selection(t, range(0,3,0,4));
    sel.growRight(1);
    expect(sel.range).equals(range(0,3,0,5), "1");
    sel.growRight(1);
    expect(sel.range).equals(range(0,3,1,0), "2");
    sel.growRight(1);
    expect(sel.range).equals(range(0,3,1,1), "3");
    sel.growRight(4);
    expect(sel.range).equals(range(0,3,1,5), "4");
    sel.growRight(1);
    expect(sel.range).equals(range(0,3,1,5), "5");
    sel.growRight(-2);
    expect(sel.range).equals(range(0,3,1,3), "6");
    sel.growRight(-20);
    expect(sel.range).equals(range(0,3,0,3), "7");
  });

  it("directed selection", () => {
    var sel = t.selection;
    sel.range = {start: 3, end: 5}
    expect(sel.lead).deep.equals({row: 0, column: 5});
    expect(sel.anchor).deep.equals({row: 0, column: 3});
    expect(t.cursorPosition).deep.equals({row: 0, column: 5});
    sel.reverse();
    expect(sel.lead).deep.equals({row: 0, column: 3});
    expect(sel.anchor).deep.equals({row: 0, column: 5});
    expect(t.cursorPosition).deep.equals({row: 0, column: 3});
  });

  describe("goal column", () => {

    it("jumps to goal column on move", () => {
      t.textString = "1234\n1\n1234"
      t.cursorPosition = {row: 0, column: 3};
      t.selection.goDown();
      expect(t.cursorPosition).deep.equals({row: 1, column: 1});
      t.selection.goDown();
      expect(t.cursorPosition).deep.equals({row: 2, column: 3});
    });

    it("jumps to goal column on select", () => {
      t.textString = "1234\n1\n1234"
      t.cursorPosition = {row: 0, column: 3};
      t.selection.selectDown();
      expect(t.selection).stringEquals("Selection(0/3 -> 1/1)");
      t.selection.selectDown();
      expect(t.selection).stringEquals("Selection(0/3 -> 2/3)");
    });

  });

  describe("select to", () => {

    it("set lead for reverse select", () => {
      var sel = t.selection;
      sel.range = range(0,1,0,3);
      sel.lead = {column: 0, row: 0};
      expect(sel).stringEquals("Selection(0/1 -> 0/0)");
      expect(sel.range).stringEquals("Range(0/0 -> 0/1)");
    });

    it("set lead for reverse select line up", () => {
      var sel = t.selection;
      sel.range = range(1,5,1,2);
      sel.lead = {column: 1, row: 0};
      expect(sel).stringEquals("Selection(1/5 -> 0/1)");
      expect(sel.range).stringEquals("Range(0/1 -> 1/5)");
    });

  });

  describe("is anchored", () => {

    it("moves with insert and delete", () => {
      t.selection = range(0,3, 0, 5);
      expect(t.selection.text).stringEquals("lo", "1 setup");

      t.insertText("abc", {column: 1, row: 0});
      expect(t.textString).equals("habcello\nworld");
      expect(t.selection.text).equals("lo", "2 after insert");
      expect(t.selection).stringEquals("Selection(0/6 -> 0/8)");

      t.deleteText(range(0,0, 0,3));
      expect(t.selection.text).equals("lo", "3 after delete");
      expect(t.selection).stringEquals("Selection(0/3 -> 0/5)");

      t.deleteText(range(0,2, 0,4));
      expect(t.selection.text).equals("o", "4 after delete into");
      expect(t.selection).stringEquals("Selection(0/2 -> 0/3)", "4 after delete into");

      t.deleteText(range(0,1, 1,0));
      expect(t.selection).stringEquals("Selection(0/1 -> 0/1)", " 5after delete crossing selection");
    });

    it("anchor stays when following text is deleted", () => {
      t.textString = "a\nb\nc\nd";
      t.cursorPosition = {row: 1, column: 1};
      t.deleteText({start: {row: 2, column: 0}, end: {row: 3, column: 0}});
      expect(t.textString).equals("a\nb\nd");
      expect(t.selection).stringEquals("Selection(1/1 -> 1/1)");
    });

  });
});


import { MultiSelection } from "lively.morphic/text/selection.js";

describe("multi select", () => {

  it("add range", function() {
    var t = text("foo bar");
    t.selection.addRange(range(0,4,0,4));
    expect(t.selection.ranges).to.have.length(2);
  });

  it("multiselect editing", function() {
    var t = text("a1.a2\n    bb3.b4\n    cc5.c6");
    // t = that
    // t.textString = "a1.a2\n    bb3.b4\n    cc5.c6";
    // t.selectAll()
    t.gotoDocumentEnd();

    t.execCommand("multi select up", null, 3);
    expect(t.selection.ranges).to.have.length(3);
    expect().assert(t.inMultiSelectMode());

    t.execCommand("insertstring", {string: "x"});
    expect(t.textString).equals("a1.a2x\n    bb3.b4x\n    cc5.c6x");
    t.execCommand("delete backwards", null, 2);
    expect(t.textString).equals("a1.a\n    bb3.b\n    cc5.c");

    expect(t.selection.ranges).to.have.length(3);
    t.execCommand("select all");
    expect().assert(!t.inMultiSelectMode());
    expect(t.selection.ranges).to.have.length(1);
  })

});
