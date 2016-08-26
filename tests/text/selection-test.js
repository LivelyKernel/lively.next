/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Selection } from "../../text/selection.js";
import TextDocument from "../../text/document.js";
import { Text } from "../../text/morph.js";
import { expect } from "mocha-es6";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";

function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
}


var text;

describe("text selection", () => {

  beforeEach(() => text = new Text({textString: "hello\nworld", fontMetric}));

  it("has a range", () => {
    var doc = TextDocument.fromString("hello\nworld");
    expect(new Selection({document: doc}).range.toString()).equals("Range(0/0 -> 0/0)");
  });

  it("gets text", () => {
    var doc = TextDocument.fromString("hello\nworld");
    expect(new Selection({document: doc}).text).equals("");
    expect(new Selection({document: doc}, range(0,1,1,1)).text).equals("ello\nw");
  });

  it("sets text", () => {
    var sel = new Selection(text, range(0,1,1,1));
    sel.text = "foo\nbar";
    expect(sel.text).equals("foo\nbar");
    expect(text.textString).equals("hfoo\nbarorld");
    expect(text.document.textString).equals("hfoo\nbarorld");
  });

  it("growLeft", () => {
    var sel = new Selection(text, range(0,0,1,1));
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
    var sel = new Selection(text, range(0,3,0,4));
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
    var sel = text.selection;
    sel.range = {start: 3, end: 5}
    expect(sel.lead).deep.equals({row: 0, column: 5});
    expect(sel.anchor).deep.equals({row: 0, column: 3});
    expect(text.cursorPosition).deep.equals({row: 0, column: 5});
    sel.reverse();
    expect(sel.lead).deep.equals({row: 0, column: 3});
    expect(sel.anchor).deep.equals({row: 0, column: 5});
    expect(text.cursorPosition).deep.equals({row: 0, column: 3});
  });

  describe("goal column", () => {

    it("jumps to goal column on move", () => {
      text.textString = "1234\n1\n1234"
      text.cursorPosition = {row: 0, column: 3};
      text.selection.goDown();
      expect(text.cursorPosition).deep.equals({row: 1, column: 1});
      text.selection.goDown();
      expect(text.cursorPosition).deep.equals({row: 2, column: 3});
    });

    it("jumps to goal column on select", () => {
      text.textString = "1234\n1\n1234"
      text.cursorPosition = {row: 0, column: 3};
      text.selection.selectDown();
      expect(text.selection).stringEquals("Selection(0/3 -> 1/1)");
      text.selection.selectDown();
      expect(text.selection).stringEquals("Selection(0/3 -> 2/3)");
    });

  });

  describe("select to", () => {

    it("set lead for reverse select", () => {
      var sel = text.selection;
      sel.range = range(0,1,0,3);
      sel.lead = {column: 0, row: 0};
      expect(sel).stringEquals("Selection(0/1 -> 0/0)");
      expect(sel.range).stringEquals("Range(0/0 -> 0/1)");
    });

    it("set lead for reverse select line up", () => {
      var sel = text.selection;
      sel.range = range(1,5,1,2);
      sel.lead = {column: 1, row: 0};
      expect(sel).stringEquals("Selection(1/5 -> 0/1)");
      expect(sel.range).stringEquals("Range(0/1 -> 1/5)");
    });

  });
});
