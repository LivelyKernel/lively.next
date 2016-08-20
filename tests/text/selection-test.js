/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Selection } from "../../text/selection.js";
import TextDocument from "../../text/document.js";
import { Text } from "../../text/morph.js";
import { expect } from "mocha-es6";

function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
}

describe("text selection", () => {

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
    var text = new Text({textString: "hello\nworld"}),
        sel = new Selection(text, range(0,1,1,1));
    sel.text = "foo\nbar";
    expect(sel.text).equals("foo\nbar");
    expect(text.textString).equals("hfoo\nbarorld");
    expect(text.document.textString).equals("hfoo\nbarorld");
  });

  it("growLeft", () => {
    var doc = TextDocument.fromString("hello\nworld"),
        sel = new Selection({document: doc}, range(0,0,1,1));
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
    var doc = TextDocument.fromString("hello\nworld"),
        sel = new Selection({document: doc}, range(0,3,0,4));
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

});
