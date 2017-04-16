/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import Document, { Line } from "../../text/document.js";
import { arr } from "lively.lang";

var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 5, minNodeSize: 2};

describe("lines", () => {

  it("have text and properties", () => {
    let l = new Line({
      parent: {},
      width: 0,
      height: 10,
      textAndAttributes: ["th", null, "is", {foo: 23}, " is", null, " a ", {bar: 24}, "test", null]
    });
    expect(l.height).equals(10);
    expect(l.text).equals("this is a test");
    expect(l.textAttributes).deep.equals([{foo: 23}, {bar: 24}]);
    expect(l.textAndAttributes).deep.equals([
      "th", null,
      "is", {foo: 23},
      " is", null,
      " a ", {bar: 24},
      "test", null]);
  });

});

describe("document as text tree", () => {

  it("finds lines by row", () => {
    var doc = new Document([{text: "a", height: 10}, {text: "b", height: 20}, {text: "c", height: 5}, {text: "d", height: 15}]);
    doc.consistencyCheck();

    var lines = [0,1,2,3].map(n => doc.root.findRow(n));
    expect().assert(lines[0], "line 0 not found");
    expect().assert(lines[1], "line 1 not found");
    expect().assert(lines[2], "line 2 not found");
    expect().assert(lines[3], "line 3 not found");
    expect(lines[0]).containSubset({text: "a", height: 10});
    expect(lines[1]).containSubset({text: "b", height: 20});
    expect(lines[2]).containSubset({text: "c", height: 5});
    expect(lines[3]).containSubset({text: "d", height: 15});

    expect(lines[0].parent).equals(doc.root.children[0], "parent line 0");
    expect(lines[1].parent).equals(doc.root.children[0], "parent line 1");
    expect(lines[2].parent).equals(doc.root.children[1], "parent line 2");
    expect(lines[3].parent).equals(doc.root.children[1], "parent line 3");

    expect(doc.root.children[0].height).equals(30, "height parent[0]");
    expect(doc.root.children[1].height).equals(20, "height parent[1]");
    expect(doc.root.height).equals(50, "height root");

    expect(doc.stringSize).equals(7, "doc.stringSize");
    expect(doc.textString.length).equals(7, "doc.textString.length");
    expect(doc.root.children[0].stringSize).equals(4, "stringSize parent[0]");
    expect(doc.root.children[1].stringSize).equals(4, "stringSize parent[1]");
    expect(doc.root.stringSize).equals(8, "stringSize root");

    expect(lines[0].row).equals(0);
    expect(lines[1].row).equals(1);
    expect(lines[2].row).equals(2);
    expect(lines[3].row).equals(3);

    expect(doc.lines).equals(lines);
  });

  it("balances leaf nodes", () => {
    var doc = new Document(["a", "b", "c", "d"], opts);
    doc.balance();
    expect(doc.print()).equals(
      `root (size: 4 width: 0 height: 0 text length: 8)\n`
    + ` leaf (size: 2 width: 0 height: 0 text length: 4)\n`
    + `  line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
    + `  line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["b",null])\n`
    + ` leaf (size: 2 width: 0 height: 0 text length: 4)\n`
    + `  line 2 (size: 1 width: 0 height: 0 text length: 2 content: ["c",null])\n`
    + `  line 3 (size: 1 width: 0 height: 0 text length: 2 content: ["d",null])`);
  });

  describe("insertion", () => {

    it("appends", () => {
      var doc = new Document();
      doc.insertLine("hello world");
      expect(doc.print()).equals(
        `root (size: 1 width: 0 height: 0 text length: 12)\n`
     + ` line 0 (size: 1 width: 0 height: 0 text length: 12 content: ["hello world",null])`)
    });

    it("inserts", () => {
      var doc = new Document();
      doc.insertLine("c");
      doc.insertLine("a", 0);
      doc.insertLine("b", 1);
      expect(doc.print()).equals(
        `root (size: 3 width: 0 height: 0 text length: 6)\n`
      + ` line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
      + ` line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["b",null])\n`
      + ` line 2 (size: 1 width: 0 height: 0 text length: 2 content: ["c",null])`);
    });

    it("balances leaf nodes after insert", () => {
      var doc = new Document(["a", "b"], opts);
      doc.insertLine("x", 0);
      doc.insertLine("y", 3);
      expect(doc.print()).equals(
        `root (size: 4 width: 0 height: 0 text length: 8)\n`
      + ` leaf (size: 2 width: 0 height: 0 text length: 4)\n`
      + `  line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["x",null])\n`
      + `  line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
      + ` leaf (size: 2 width: 0 height: 0 text length: 4)\n`
      + `  line 2 (size: 1 width: 0 height: 0 text length: 2 content: ["b",null])\n`
      + `  line 3 (size: 1 width: 0 height: 0 text length: 2 content: ["y",null])`);
    });

    it("balances after insert 1", () => {
      var doc = new Document([], opts);
      doc.insertLines(["a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a"])
      doc.insertLine("b");
      doc.insertLine("b");
      doc.consistencyCheck();
    });

    it("balances after insert 2", () => {
      var doc = new Document([], opts);
      doc.insertLines(["a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a"])
      doc.insertLine("b");
      doc.insertLine("b");
      doc.consistencyCheck();
    });

  });


  describe("removal", () => {

    it("removes line", () => {
      var doc = new Document(["a", "b", "c"]);
      doc.removeLine(1);
      expect(doc.print()).equals(
        `root (size: 2 width: 0 height: 0 text length: 4)\n`
      + ` line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
      + ` line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["c",null])`);
      doc.removeLine(1);

      expect(doc.print()).equals(`root (size: 1 width: 0 height: 0 text length: 2)\n line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])`);
      doc.removeLine(0);
      expect(doc.print()).equals(`root (size: 0 width: 0 height: 0 text length: 0)`);
    });

    it("balances leaf nodes after remove 1", () => {
      var doc = new Document(["a", "b", "c", "d"], opts);
      doc.removeLine(3);
      expect(doc.print()).equals(
          `root (size: 3 width: 0 height: 0 text length: 6)\n`
        + ` line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
        + ` line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["b",null])\n`
        + ` line 2 (size: 1 width: 0 height: 0 text length: 2 content: ["c",null])`);
      doc.removeLine(1);
      expect(doc.print()).equals(
          `root (size: 2 width: 0 height: 0 text length: 4)\n`
        + ` line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
        + ` line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["c",null])`);
    });

    it("balances leaf nodes after remove 2", () => {
      var doc = new Document(["a", "b", "c", "d"], opts);
      doc.removeLine(1);
      expect(doc.print()).equals(
          `root (size: 3 width: 0 height: 0 text length: 6)\n`
        + ` line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
        + ` line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["c",null])\n`
        + ` line 2 (size: 1 width: 0 height: 0 text length: 2 content: ["d",null])`);
      doc.removeLine(1);
      expect(doc.print()).equals(
          `root (size: 2 width: 0 height: 0 text length: 4)\n`
        + ` line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
        + ` line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["d",null])`);
    });

    it("balances by stealing values to be consistent", () => {
      // steal lines from the second leaf node so that node one is OK
      //                   node (size: 4)
      //              •••••               •••••
      // node (leaf, size: 1)          node (leaf, size: 3)
      //       •                       ••••      •      ••••
      // line (2)                line (3)    line (4)    line (5)
      var t = new Document(["1", "2", "3", "4", "5"], opts);
      t.removeLine(0);
      t.consistencyCheck();
    });

    it("remove many lines", () => {
      var doc = new Document(["a", "b", "c", "d"], opts);
      doc.removeLines(1, 2);
      doc.consistencyCheck();
      expect(doc.print()).equals(
          `root (size: 2 width: 0 height: 0 text length: 4)\n`
        + ` line 0 (size: 1 width: 0 height: 0 text length: 2 content: ["a",null])\n`
        + ` line 1 (size: 1 width: 0 height: 0 text length: 2 content: ["d",null])`);
    });

  });


  describe("bugs", () => {

    it("all nodes have correct size", () => {

      var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 3, minNodeSize: 2},
          doc = new Document([], opts);
      for (var i = 0; i < 10; i++) doc.insertLine("" + i);
      expect(doc.lines.map(ea => ea.text)).equals(arr.range(0, 9))

      doc.removeLines(1,3);
      expect(doc.lines.map(ea => ea.text)).equals(["0", "4", "5", "6", "7", "8", "9"]);
      doc.print();
      doc.removeLines(1,3);
      expect(doc.lines.map(ea => ea.text)).equals(["0", "7", "8", "9"]);
      doc.consistencyCheck();
    });

    it("inserts followed by removes not conistent", () => {
      var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 3, minNodeSize: 2},
          doc = new Document([], opts);
      for (var i = 0; i < 7; i++) doc.insertLine("" + i);
      doc.print();
      doc.removeLines(1,3);
      doc.consistencyCheck();
      doc.print();
    });

  });

  it("survives fuzzy testing", function() {
    this.timeout(6000);
    let {doc, actions, error} = Document.fuzzyTest();
    if (error) {
      System.global.lastDocumentFuzzyTest = {doc, actions, error};
      expect().assert(false, `Document fuzzy test failed: ${error}. Results are stored in global.lastDocumentFuzzyTest`);
    }
  })
});

describe("geometry", () => {

  let doc, lines;
  beforeEach(() => {
    doc = new Document([
      {text: "a", width: 10, height: 10},
      {text: "b", width: 20, height: 20},
      {text: "c", width: 5, height: 5},
      {text: "d", width: 15, height: 15}]);
    lines = doc.lines;
  });

  it("updates height", () => {
    lines[2].changeExtent(0, 12);
    expect(lines[2]).containSubset({text: "c", height: 12});
    expect(doc.root.children[1].height).equals(15+12, "height parent[1]");
    expect(doc.root.height).equals(30+15+12, "height root");
  });

  it("computes y position", () => {
    expect(doc.computeVerticalOffsetOf(0)).equals(0, "1");
    expect(doc.computeVerticalOffsetOf(1)).equals(10, "2");
    expect(doc.computeVerticalOffsetOf(2)).equals(30, "3");
    expect(doc.computeVerticalOffsetOf(3)).equals(35, "4");
  });

  describe("width", () => {

    it("updates on changeExtent", () => {
      expect(doc.width).equals(20, "doc");
      lines[2].changeExtent(16, 16);
      expect(doc.root.children[1].width).equals(16, "width parent[1]");
      expect(doc.root.width).equals(20, "width root");
      expect(doc.width).equals(20, "doc after update");
    });

    it("updates on removal", () => {
      doc.removeLines(1,2);
      doc.print()
      expect(doc.width).equals(15, "doc");
      expect(doc.height).equals(25, "doc");
    });

  });
});


function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
}

describe("text document", () => {

  it("line access", () => {
    var doc = Document.fromString("hello\nworld");
    expect(doc.getLine(0).text).equals("hello");
    expect(doc.getLine(1).text).equals("world");
    expect(doc.getLine(3).text).equals("world");
    expect(doc.getLine(-2).text).equals("hello");
  });


  it("created using text string", () => {
    var doc = Document.fromString("hello\nworld");
    expect(doc.lines).containSubset([{text: "hello", text: "world"}]);
    expect(doc.textString).equals("hello\nworld");
    doc.textString += "\nfoo"
    expect(doc.lines).containSubset([{text: "hello"}, {text: "world"}, {text: "foo"}]);
    expect(doc.textString).equals("hello\nworld\nfoo");
  });

  describe("words", () => {

    var doc;

    beforeEach(() => doc = Document.fromString("Hello world\n 123 3  4\n"));

    it("of line", () => {
      expect(doc.wordsOfLine(1)).deep.equals([
        {index: 0, range: range(1,1,1,4), string: "123"},
        {index: 1, range: range(1,5,1,6), string: "3" },
        {index: 2, range: range(1,8,1,9), string: "4"}
      ]);
    });

    it("word at", () => {
      expect(doc.wordAt({column: 2, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "inside");
      expect(doc.wordAt({column: 1, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "at beginning");
      expect(doc.wordAt({column: 4, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "at end");
      expect(doc.wordAt({column: 5, row: 1})).deep.equals({index: 1, range: range(1,5,1,6), string: "3"}, "at beginning 2");
      expect(doc.wordAt({column: 0, row: 1})).deep.equals({          range: range(1,0,1,0), string: ""}, "at line beginning");
      expect(doc.wordAt({column: 9, row: 1})).deep.equals({index: 2, range: range(1,8,1,9), string: "4"}, "at line end");
      expect(doc.wordAt({column: 7, row: 1})).deep.equals({          range: range(1,7,1,7), string: ""}, "empty");
    });

    it("word left", () => {
      expect(doc.wordLeft({column: 0, row: 1})).deep.equals({index: 1, range: range(0,6,0,11), string: "world"}, "line start");
      expect(doc.wordLeft({column: 1, row: 1})).deep.equals({index: 1, range: range(0,6,0,11), string: "world"}, "beginning of word");
      expect(doc.wordLeft({column: 2, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "in word");
      expect(doc.wordLeft({column: 4, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "at end of word");
      expect(doc.wordLeft({column: 5, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "at beginning of second word");
      expect(doc.wordLeft({column: 7, row: 1})).deep.equals({index: 1, range: range(1,5,1,6), string: "3"}, "in emptiness");
      expect(doc.wordLeft({column: 0, row: 0})).deep.equals({          range: range(0,0,0,0), string: ""}, "at text start");
    });

    it("word right", () => {
      expect(doc.wordRight({column: 0, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "line start");
      expect(doc.wordRight({column: 1, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "at beginning of first word");
      expect(doc.wordRight({column: 2, row: 1})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "in first word");
      expect(doc.wordRight({column: 4, row: 1})).deep.equals({index: 1, range: range(1,5,1,6), string: "3"}, "at end of first word");
      expect(doc.wordRight({column: 7, row: 1})).deep.equals({index: 2, range: range(1,8,1,9), string: "4"}, "in emptiness");
      expect(doc.wordRight({column: 11, row: 0})).deep.equals({index: 0, range: range(1,1,1,4), string: "123"}, "at line end");
      expect(doc.wordRight({column: 9, row: 1})).deep.equals({           range: range(1,9,1,9), string: ""}, "at text end");
    });

  });

  it("text length", () => {
    expect(Document.fromString("hello\nworld\nfoo").stringSize).equals(15);
  });

  it("end position", () => {
    expect(Document.fromString("hello\nworld\nfoo").endPosition).deep.equals({row: 2, column: 3});
  });

  it("position to index", () => {
    var doc = Document.fromString("hello\nworld\nfoo");
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
    var doc = Document.fromString("hello\nworld\nfoo");
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

    var doc; beforeEach(() => doc = Document.fromString("hello\nworld"));

    it("into empty doc", () => {
      doc = new Document();
      doc.insertText("test", {row: 0, column: 0});
      expect(doc.textString).equals("test");
    });

    it("simple", () => {
      doc.insertText("test", {row: 0, column: 2});
      expect(doc.textString).equals("hetestllo\nworld");
    });

    it("nothing", () => {
      doc.insertText("", {row: 0, column: 2});
      expect(doc.textString).equals("hello\nworld");
    });

    it("behind end", () => {
      doc.insertText("test", {row: 5, column: 0});
      doc.textString
      expect(doc.textString).equals("hello\nworld\n\n\n\ntest");
    });

    it("after last column", () => {
      doc.insertText("test", {row: 0, column: 10});
      expect(doc.textString).equals("hello     test\nworld");
    });

    it("at end of line", () => {
      doc.insertText("test", {row: 0, column: 5});
      expect(doc.textString).equals("hellotest\nworld");
    });

    it("at beginning of line", () => {
      doc.insertText("test", {row: 1, column: 0});
      expect(doc.textString).equals("hello\ntestworld");
    });

    it("new line", () => {
      doc.insertText("\ntest\n", {row: 0, column: 5});
      expect(doc.textString).equals("hello\ntest\n\nworld");
      expect(doc.lines).containSubset([{text: "hello"}, {text: "test"}, {text: ""}, {text: "world"}]);
    });

    it("just new line", () => {
      doc.insertText("\n", {row: 0, column: 2});
      expect(doc.textString).equals("he\nllo\nworld");
      expect(doc.lines).containSubset([{text: "he"}, {text: "llo"}, {text: "world"}]);
    });

  });

  describe("remove", () => {

    var doc; beforeEach(() => doc = Document.fromString("hello\nworld"));

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

    var doc; beforeEach(() => doc = Document.fromString("hello\nworld\n123"));

    it("single line",           () => expect(doc.textInRange(range(0,1,0,5))).equals("ello"));
    it("empty range",           () => expect(doc.textInRange(range(0,1,0,1))).equals("") .equals(""));
    it("reverse",               () => expect(doc.textInRange(range(0,5,0,1))).equals("ello"));
    it("across one lines",      () => expect(doc.textInRange(range(0,4,1,2))).equals("o\nwo"));
    it("across mulitple lines", () => expect(doc.textInRange(range(0,4,2,2))).equals("o\nworld\n12"));
    it("including newline",     () => expect(doc.textInRange(range(0,4,1,0))).equals("o\n"));

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

  describe("char-wise scanning", () => {

    var doc; beforeEach(() => doc = Document.fromString("1 23\n4\n foo\n5  "));

    it("scans forward", () => {
      var seen = [];
      expect(doc.scanForward({row: 0, column: 3}, (char, pos) => {
        seen.push(char);
        return char === "f" ? {pos, char} : null;
      })).deep.equals({pos: {row: 2, column: 1}, char: "f"});
      expect(seen).equals(["3", "4", " ", "f"]);
    });

    it("scans forward failing", () => {
      expect(doc.scanForward({row: 0, column: 3}, (char, pos) => char === "x" ? 1 : 0)).equals(null);
    });

    it("scans backwards", () => {
      var seen = [];
      expect(doc.scanBackward({row: 2, column: 1}, (char, pos) => {
        seen.push(char);
        return char === "2" ? {pos, char} : null;
      })).deep.equals({pos: {row: 0, column: 2}, char: "2"});
      expect(seen).equals([" ", "4", "3", "2"]);
    });

    it("scans backward failing", () => {
      expect(doc.scanBackward({row: 0, column: 3}, (char, pos) => char === "x" ? 1 : 0)).equals(null);
    });

  });

  describe("attributes", () => {

    var doc;
    beforeEach(() => doc = Document.fromString("hello\nworld"))

    describe("access", () => {
    
      it("attributes and text access", () => {
        doc.textString = "hello\nworld";
        expect(doc.textAndAttributes).deep.equals(["hello\nworld", null]);
        doc.mixinTextAttribute({foo: 23}, range(1,1,1,3));
        expect(doc.textAndAttributes).deep.equals([
          "hello\nw", null,
          "or", {foo: 23},
          "ld", null
        ]);
      });
  
      it("and text access in range simple", () => {
        doc.textString = "xxx\nyyy\nfoo\n";
        expect(doc.textAndAttributesInRange(range(0,0,0,2)))
          .deep.equals(["xx", null]);
        expect(doc.textAndAttributesInRange(range(0,0,2,0)))
          .deep.equals(["xxx\nyyy\n", null]);
        expect(doc.textAndAttributesInRange(range(1,1,2,2)))
          .deep.equals(["yy\nfo", null]);
      });

      it("and text access in range with attributes", () => {
        doc.textAndAttributes = ["xxx\nyyy\nfoo\n", {foo: 23}]
        expect(doc.textAndAttributesInRange(range(0,0,0,2)))
          .deep.equals(["xx", {foo: 23}]);
        expect(doc.textAndAttributesInRange(range(0,0,2,0)))
          .deep.equals(["xxx\nyyy\n", {foo: 23}]);
        expect(doc.textAndAttributesInRange(range(1,1,2,2)))
          .deep.equals(["yy\nfo", {foo: 23}]);
      });

    })

    it("set attributes and text", () => {
      doc.textString = "";
      let attr1 = {foo: 23},
          attr2 = {bar: 99},
          textAndAttributes = doc.textAndAttributes = [
            "hello\n", null,
            "wor", {...attr2, ...attr1},
            "l", attr2,
            "d", null
          ]

      expect(doc.textString).equals("hello\nworld");
      expect(doc.textAndAttributes).deep.equals(textAndAttributes);

      expect(doc.getLine(0).textAndAttributes).deep.equals(["hello", null]);
      expect(doc.getLine(1).textAndAttributes).deep.equals([
        "wor", {...attr2, ...attr1},
        "l", attr2,
        "d", null
      ]);
    });

    it("set attributes of line", () => {
      doc.textString = "hello\nworld";
      doc.setTextAndAttributesOfLine(1, ["ho", {foo: 23}, "hu", null]);
      expect(doc.textString).equals("hello\nhohu");
      expect(doc.textAndAttributes).deep.equals([
        "hello\n", null,
        "ho", {foo: 23},
        "hu", null,
      ]);
    });

    it("reset attributes", () => {
      doc.textString = "hello\nworld";
      doc.setTextAndAttributesOfLine(1, ["ho", {foo: 23}, "hu", null]);
      expect(doc.textString).equals("hello\nhohu");
      doc.resetTextAttributes();
      expect(doc.textAndAttributes).deep.equals(["hello\nhohu", null]);
      expect(doc.getLine(1).textAndAttributes).deep.equals(["hohu", null]);
    });

    describe("mixin", () => {

      it("attributes mixin", () => {
        doc.textString = "hello\nworld";
        expect(doc.textAndAttributes).deep.equals(["hello\nworld", null]);
        doc.mixinTextAttribute({foo: 23}, range(1,1,1,3));
        expect(doc.textAndAttributes).deep.equals([
          "hello\nw", null,
          "or", {foo: 23},
          "ld", null
        ], "1");

        doc.mixinTextAttribute({bar: 99}, range(1,2,1,4));
        expect(doc.textAndAttributes).deep.equals([
          "hello\nw", null,
          "o", {foo: 23},
          "r", {foo: 23, bar: 99},
          "l", {bar: 99},
          "d", null
        ], "2");
      });

      it("attributes mixin multiline", () => {
        doc.textString = "hello\nworld";
        expect(doc.textAndAttributes).deep.equals(["hello\nworld", null]);
        doc.mixinTextAttribute({foo: 23}, range(0,1,1,3));
        expect(doc.textAndAttributes).deep.equals([
          "h", null,
          "ello\nwor", {foo: 23},
          "ld", null
        ]);
      });

    });


    describe("on text deletion", () => {

      it("are updated", () => {
        doc.textAndAttributes = [
          "hello\n", {a: 1},
          "w", null,
          "orld\n", {b: 1},
          "12", null,
          "3", {c: 1}
        ];

        doc.remove(range(0,1,0,2));
        expect(doc.textAndAttributes).deep.equals([
          "hllo\n", {a: 1},
          "w", null,
          "orld\n", {b: 1},
          "12", null,
          "3", {c: 1}
        ]);

        doc.remove(range(0,0,0,5));
        expect(doc.textAndAttributes).deep.equals([
          "\nw", null,
          "orld\n", {b: 1},
          "12", null,
          "3", {c: 1}
        ]);

        doc.remove(range(0,0,2,0));
        expect(doc.textAndAttributes).deep.equals([
          "12", null,
          "3", {c: 1}
        ]);
      });

      it("of line break are updated", () => {
        doc.textAndAttributes = ["a\n", {a: 1}, "b", {b: 1}];
        doc.remove(range(0,1,1,0));
        expect(doc.textAndAttributes).deep.equals(["a", {a: 1}, "b", {b: 1}]);
      });

      it("are updated even if not directly in modified range", () => {
        doc.textAndAttributes = ["a\n\n", {a: 1}, "b", {b: 1}];
        doc.remove(range(0,1,1,0));
        expect(doc.textAndAttributes).deep.equals(["a\n", {a: 1}, "b", {b: 1}]);
      });

      it("are completely removed", () => {
        doc.textAndAttributes = ["a\n", {a: 1}, "b\n", {b: 1}, "c", {c: 1}];
        doc.remove(range(0,0,2,1));
        expect(doc.textAndAttributes).deep.equals([]);
      });

      it("completely rplaced", () => {
        doc.remove({start: {row: 0, column: 0}, end: doc.endPosition})
        doc.textAndAttributes = ["a\n", {a: 1}, "b\n", {b: 1}, "c", {c: 1}];
        expect(doc.lines).to.have.length(3);
        doc.remove({start: {row: 0, column: 0}, end: doc.endPosition})
        doc.textAndAttributes = ["a\n", {a: 1}, "b\n", {b: 1}, "c", {c: 1}];
        expect(doc.lines).to.have.length(3);
      });

    });

    describe("on text insertion", () => {

      it("are updated", () => {
        doc.textAndAttributes = [
          "hello\n", {a: true},
          "w", null,
          "orld", {b: true}
        ];

        doc.insertText("Y", {row: 0, column: 3}, false/*don't extend attrs*/);

        expect(doc.textAndAttributes).deep.equals([
          "hel", {a: true},
          "Y", null,
          "lo\n", {a: true},
          "w", null,
          "orld", {b: true}
        ], 1);

        doc.insertText("X", {row: 0, column: 3}, true);

        expect(doc.textAndAttributes).deep.equals([
          "helX", {a: true},
          "Y", null,
          "lo\n", {a: true},
          "w", null,
          "orld", {b: true}
        ], 2);
      });

      it("are updated even if not directly in modified range 1", () => {
        doc.textAndAttributes = [
          "aaa\n", {a: true},
          "bbb", {b: true},
        ];
        doc.insertText("X\n", {row: 0, column: 1}, false);
        expect(doc.lines.map(l => l.textAndAttributes)).deep.equals([
          ["a", { "a": true }, "X", null],
          ["aa", { "a": true }],
          ["bbb", { "b": true }]
        ])
      });

      it("newline behind char creates new line below", () => {
        doc.textAndAttributes = [
          "aax\n", {a: true},
          "bb", {b: true},
        ];
        doc.insertText("\n", {row: 0, column: 2}, false);
        expect(doc.lines.map(l => l.textAndAttributes)).deep.equals([
          ["aa", { "a": true }],
          ["x", { "a": true }],
          ["bb", { "b": true }]
        ])
      });

    });

    describe("merging", () => {

      it("merges attributes", () => {

        doc.textAndAttributes = [
          "aaa", {fontColor: "red"},
          "bbb\n", {fontColor: "red"},
          "ccc", {fontColor: "red"},
        ];
        expect(doc.textAndAttributes).deep.equals([
          "aaabbb\nccc", {fontColor: "red"}
        ]);
      });

    });

    describe("insert with attributes", () => {

      it("works", () => {
        doc.textAndAttributes = ["hello", {a: 1}];
        doc.insertTextAndAttributes(["b", {b: 1}, "cc", {c: 1}], {row: 0, column: 2});
        expect(doc.textAndAttributes).deep.equals([
          "he", {a: 1},
          "b", {b: 1},
          "cc", {c: 1},
          "llo", {a: 1}
        ]);
      });

      it("just newline", () => {
        doc.textAndAttributes = ["hello", {a: 1}];
        doc.insertTextAndAttributes(["\n", null], {row: 0, column: 2});
        expect(doc.textAndAttributes).deep.equals(["he\nllo", {a: 1}]);
      });

      it("trailing newline", () => {
        doc.textAndAttributes = ["hello", {a: 1}];
        doc.insertTextAndAttributes(["foo\n", null], {row: 0, column: 2});
        expect(doc.textAndAttributes).deep.equals(["he", {a: 1}, "foo\n", null, "llo", {a: 1}]);
      });

      it("leading newline", () => {
        doc.textAndAttributes = ["hello", {a: 1}];
        doc.insertTextAndAttributes(["\nfoo", null], {row: 0, column: 2});
        expect(doc.textAndAttributes).deep.equals([
          "he\n", {a: 1},
          "foo", null,
          "llo", {a: 1}
        ]);
      });

      it("newline behind char creates new line below", () => {
        doc.textAndAttributes = [
          "aax\n", {a: true},
          "bb", {b: true},
        ];
        doc.insertTextAndAttributes(["\n", null], {row: 0, column: 2});
        expect(doc.lines.map(l => l.textAndAttributes)).deep.equals([
          ["aa", { "a": true }],
          ["x", { "a": true }],
          ["bb", { "b": true }]
        ])
      });

    });

    describe("setting text attributes", () => {
    
      it("in a single line", () => {
        doc.textAndAttributes = ["aax\n", {a: true}, "bb", {b: true}];
        doc.setTextAttributesWithSortedRanges([range(0, 1, 0, 2), {c: true}]);
        expect(doc.textAndAttributes).deep.equals([
          "a", {"a": true},
          "a", {"c": true},
          "x\n", {a: true},
          "bb", {"b": true}
        ]);
      });
      
      it("over two lines", () => {
        doc.textAndAttributes = ["aax\n", {a: true}, "bb", {b: true}];
        doc.setTextAttributesWithSortedRanges([range(0, 2, 1, 1), {c: true}]);
        expect(doc.textAndAttributes).deep.equals([
          "aa", {"a": true},
          "x\nb", {c: true},
          "b", {"b": true}
        ]);
      });
    
    });

  });

});

function fooo() {

  var doc = new Document(["a", "b", "c", "d"], {maxLeafSize: 3, minLeafSize: 2});


  doc.insertLines(["hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", ])
  doc.print2()
}