/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import TextDocument from "../../text/document.js";
import { expect } from "mocha-es6";

function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
}

describe("text doc", () => {

  it("line access", () => {
    var doc = TextDocument.fromString("hello\nworld");
    expect(doc.getLine(0)).equals("hello");
    expect(doc.getLine(1)).equals("world");
    expect(doc.getLine(3)).equals("world");
    expect(doc.getLine(-2)).equals("hello");
  });

  it("created using text string", () => {
    var doc = TextDocument.fromString("hello\nworld");
    expect(doc.lines).equals(["hello", "world"]);
    expect(doc.textString).equals("hello\nworld");
    doc.textString += "\nfoo"
    expect(doc.lines).equals(["hello", "world", "foo"]);
    expect(doc.textString).equals("hello\nworld\nfoo");
  });

  it("text length", () => {
    var doc = TextDocument.fromString("hello\nworld\nfoo");
    expect(doc.stringLength).equals(15);
  });

  it("end position", () => {
    var doc = TextDocument.fromString("hello\nworld\nfoo");
    expect(doc.endPosition).deep.equals({row: 2, column: 3});
  });

  it("position to index", () => {
    var doc = TextDocument.fromString("hello\nworld\nfoo");
    expect(doc.positionToIndex({row:-4, column: 0})).equals(0);
    expect(doc.positionToIndex({row: 0, column: 0})).equals(0);
    expect(doc.positionToIndex({row: 0, column: 5})).equals(5);
    expect(doc.positionToIndex({row: 0, column: 6})).equals(5);
    expect(doc.positionToIndex({row: 1, column:-3})).equals(6);
    expect(doc.positionToIndex({row: 1, column: 0})).equals(6);
    expect(doc.positionToIndex({row: 1, column: 5})).equals(11);
    expect(doc.positionToIndex({row: 2, column: 0})).equals(12);
    expect(doc.positionToIndex({row: 2, column: 2})).equals(14);
    expect(doc.positionToIndex({row: 2, column: 3})).equals(15);
    expect(doc.positionToIndex({row: 2, column: 4})).equals(15);
  });

  it("index to position", () => {
    var doc = TextDocument.fromString("hello\nworld\nfoo");
    expect(doc.indexToPosition(-10)).deep.equals({row: 0, column: 0});
    expect(doc.indexToPosition(0)).deep.equals({row: 0, column: 0});
    expect(doc.indexToPosition(5)).deep.equals({row: 0, column: 5});
    expect(doc.indexToPosition(6)).deep.equals({row: 1, column: 0});
    expect(doc.indexToPosition(11)).deep.equals({row: 1, column: 5});
    expect(doc.indexToPosition(12)).deep.equals({row: 2, column: 0});
    expect(doc.indexToPosition(14)).deep.equals({row: 2, column: 2});
    expect(doc.indexToPosition(15)).deep.equals({row: 2, column: 3});
    expect(doc.indexToPosition(16)).deep.equals({row: 2, column: 3});
  });

  describe("insertion", () => {

    var doc; beforeEach(() => doc = TextDocument.fromString("hello\nworld"));

    it("into empty doc", () => {
      doc = new TextDocument();
      doc.insert("test", {row: 0, column: 0});
      expect(doc.textString).equals("test");
    });

    it("simple", () => {
      doc.insert("test", {row: 0, column: 2});
      expect(doc.textString).equals("hetestllo\nworld");
    });

    it("nothing", () => {
      doc.insert("", {row: 0, column: 2});
      expect(doc.textString).equals("hello\nworld");
    });

    it("behind end", () => {
      doc.insert("test", {row: 5, column: 0});
      expect(doc.textString).equals("hello\nworld\n\n\n\ntest");
    });

    it("after last column", () => {
      doc.insert("test", {row: 0, column: 10});
      expect(doc.textString).equals("hello     test\nworld");
    });

    it("at end of line", () => {
      doc.insert("test", {row: 0, column: 5});
      expect(doc.textString).equals("hellotest\nworld");
    });

    it("at beginning of line", () => {
      doc.insert("test", {row: 1, column: 0});
      expect(doc.textString).equals("hello\ntestworld");
    });

    it("new line", () => {
      doc.insert("\ntest\n", {row: 0, column: 5});
      expect(doc.textString).equals("hello\ntest\n\nworld");
      expect(doc.lines).equals(["hello", "test", "", "world"]);
    });

  });

  describe("remove", () => {

    var doc; beforeEach(() => doc = TextDocument.fromString("hello\nworld"));

    it("nothing", () => {
      doc.remove(range(0, 2, 0, 2));
      expect(doc.textString).equals("hello\nworld");
    });

    it("one char", () => {
      doc.remove(range(0, 1, 0, 2));
      expect(doc.textString).equals("hllo\nworld");
    });

    it("at beginning of line", () => {
      doc.remove(range(0, 0, 0, 2));
      expect(doc.textString).equals("llo\nworld");
    });

    it("with too large column", () => {
      doc.remove(range(0, 4, 0, 20));
      expect(doc.textString).equals("hell\nworld");
    });

    it("with too small column", () => {
      doc.remove(range(0, -3, 0, 1));
      expect(doc.textString).equals("ello\nworld");
    });

    it("line content", () => {
      doc.remove(range(0, 0, 0, 5));
      expect(doc.textString).equals("\nworld");
    });

    it("line end", () => {
      doc.remove(range(0, 4, 1, 1));
      expect(doc.textString).equals("hellorld");
    });

    it("entire line", () => {
      doc.remove(range(0, 0, 1, 0));
      expect(doc.textString).equals("world");
    });

    it("multiple lines", () => {
      doc.textString = "hello\ntest\n\nworld";
      doc.remove(range(0, 2, 3, 2));
      expect(doc.textString).equals("herld");
    });

    it("reversed, same line", () => {
      doc.remove(range(0, 4, 0, 2));
      expect(doc.textString).equals("heo\nworld");
    });

    it("reversed, cross lines", () => {
      doc.remove(range(0, 2, 1, 4));
      expect(doc.textString).equals("hed");
    });

  });

  describe("text in range", () => {

    var doc; beforeEach(() => doc = TextDocument.fromString("hello\nworld\n123"));

    it("single line", () => expect(doc.textInRange(range(0,1,0,5))).equals("ello"));
    it("empty range", () => expect(doc.textInRange(range(0,1,0,1))).equals("") .equals(""));
    it("reverse", () => expect(doc.textInRange(range(0,5,0,1))).equals("ello"));
    it("across one lines", () => expect(doc.textInRange(range(0,4,1,2))).equals("o\nwo"));
    it("across mulitple lines", () => expect(doc.textInRange(range(0,4,2,2))).equals("o\nworld\n12"));
    it("including newline", () => expect(doc.textInRange(range(0,4,1,0))).equals("o\n"));

    it("replaces text range single line", () => {
      var newRange = doc.setTextInRange("foo\nbar", range(0,2,0,4));
      expect(doc.textString).equals("hefoo\nbaro\nworld\n123");
      expect(newRange).deep.equals(range(0,2,1,3));
    });

    it("replaces text range across multiple lines", () => {
      var newRange = doc.setTextInRange("foo\nbar", range(0,4,2,2));
      expect(doc.textString).equals("hellfoo\nbar3");
      expect(newRange).deep.equals(range(0,4,1,3));
    });

  });
});
