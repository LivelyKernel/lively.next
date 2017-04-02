/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import Document from "../../text2/document-tree.js";
import { arr } from "lively.lang";

var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 5, minNodeSize: 2};

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

  it("updates height", () => {
    let doc = new Document([{text: "a", height: 10}, {text: "b", height: 20}, {text: "c", height: 5}, {text: "d", height: 15}]),
        lines = doc.lines;
    lines[2].changeHeight(12);
    expect(lines[2]).containSubset({text: "c", height: 12});
    expect(doc.root.children[1].height).equals(15+12, "height parent[1]");
    expect(doc.root.height).equals(30+15+12, "height root");
  });


  it("balances leaf nodes", () => {
    var doc = new Document(["a", "b", "c", "d"], opts);
    doc.balance();
    expect(doc.print()).equals(
      `root (size: 4, height: 0, stringSize: 8)\n`
    + ` leaf (size: 2, height: 0, stringSize: 4)\n`
    + `  line 0 (height: 0, stringSize: 2, text: "a")\n`
    + `  line 1 (height: 0, stringSize: 2, text: "b")\n`
    + ` leaf (size: 2, height: 0, stringSize: 4)\n`
    + `  line 2 (height: 0, stringSize: 2, text: "c")\n`
    + `  line 3 (height: 0, stringSize: 2, text: "d")`);
  });

  describe("insertion", () => {

    it("appends", () => {
      var doc = new Document();
      doc.insertLine("hello world");
      expect(doc.print()).equals(
        `root (size: 1, height: 0, stringSize: 12)\n`
     + ` line 0 (height: 0, stringSize: 12, text: "hello world")`)
    });

    it("inserts", () => {
      var doc = new Document();
      doc.insertLine("c");
      doc.insertLine("a", 0);
      doc.insertLine("b", 1);
      expect(doc.print()).equals(
        `root (size: 3, height: 0, stringSize: 6)\n`
      + ` line 0 (height: 0, stringSize: 2, text: "a")\n`
      + ` line 1 (height: 0, stringSize: 2, text: "b")\n`
      + ` line 2 (height: 0, stringSize: 2, text: "c")`);
    });

    it("balances leaf nodes after insert", () => {
      var doc = new Document(["a", "b"], opts);
      doc.insertLine("x", 0);
      doc.insertLine("y", 3);
      expect(doc.print()).equals(
        `root (size: 4, height: 0, stringSize: 8)\n`
      + ` leaf (size: 2, height: 0, stringSize: 4)\n`
      + `  line 0 (height: 0, stringSize: 2, text: "x")\n`
      + `  line 1 (height: 0, stringSize: 2, text: "a")\n`
      + ` leaf (size: 2, height: 0, stringSize: 4)\n`
      + `  line 2 (height: 0, stringSize: 2, text: "b")\n`
      + `  line 3 (height: 0, stringSize: 2, text: "y")`);
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
        `root (size: 2, height: 0, stringSize: 4)\n`
      + ` line 0 (height: 0, stringSize: 2, text: "a")\n`
      + ` line 1 (height: 0, stringSize: 2, text: "c")`);
      doc.removeLine(1);
      doc.print2()

      expect(doc.print()).equals(`root (size: 1, height: 0, stringSize: 2)\n line 0 (height: 0, stringSize: 2, text: "a")`);
      doc.removeLine(0);
      expect(doc.print()).equals(`root (size: 0, height: 0, stringSize: 0)`);
    });

    it("balances leaf nodes after remove 1", () => {
      var doc = new Document(["a", "b", "c", "d"], opts);
      doc.removeLine(3);
      expect(doc.print()).equals(
          `root (size: 3, height: 0, stringSize: 6)\n`
        + ` line 0 (height: 0, stringSize: 2, text: "a")\n`
        + ` line 1 (height: 0, stringSize: 2, text: "b")\n`
        + ` line 2 (height: 0, stringSize: 2, text: "c")`);
      doc.removeLine(1);
      expect(doc.print()).equals(
          `root (size: 2, height: 0, stringSize: 4)\n`
        + ` line 0 (height: 0, stringSize: 2, text: "a")\n`
        + ` line 1 (height: 0, stringSize: 2, text: "c")`);
    });

    it("balances leaf nodes after remove 2", () => {
      var doc = new Document(["a", "b", "c", "d"], opts);
      doc.removeLine(1);
      expect(doc.print()).equals(
          `root (size: 3, height: 0, stringSize: 6)\n`
        + ` line 0 (height: 0, stringSize: 2, text: "a")\n`
        + ` line 1 (height: 0, stringSize: 2, text: "c")\n`
        + ` line 2 (height: 0, stringSize: 2, text: "d")`);
      doc.removeLine(1);
      expect(doc.print()).equals(
          `root (size: 2, height: 0, stringSize: 4)\n`
        + ` line 0 (height: 0, stringSize: 2, text: "a")\n`
        + ` line 1 (height: 0, stringSize: 2, text: "d")`);
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
          `root (size: 2, height: 0, stringSize: 4)\n`
        + ` line 0 (height: 0, stringSize: 2, text: "a")\n`
        + ` line 1 (height: 0, stringSize: 2, text: "d")`);
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
      doc.insertString("test", {row: 0, column: 0});
      expect(doc.textString).equals("test");
    });

    it("simple", () => {
      doc.insertString("test", {row: 0, column: 2});
      expect(doc.textString).equals("hetestllo\nworld");
    });

    it("nothing", () => {
      doc.insertString("", {row: 0, column: 2});
      expect(doc.textString).equals("hello\nworld");
    });

    it("behind end", () => {
      doc.insertString("test", {row: 5, column: 0});
      doc.textString
      expect(doc.textString).equals("hello\nworld\n\n\n\ntest");
    });

    it("after last column", () => {
      doc.insertString("test", {row: 0, column: 10});
      expect(doc.textString).equals("hello     test\nworld");
    });

    it("at end of line", () => {
      doc.insertString("test", {row: 0, column: 5});
      expect(doc.textString).equals("hellotest\nworld");
    });

    it("at beginning of line", () => {
      doc.insertString("test", {row: 1, column: 0});
      expect(doc.textString).equals("hello\ntestworld");
    });

    it("new line", () => {
      doc.insertString("\ntest\n", {row: 0, column: 5});
      expect(doc.textString).equals("hello\ntest\n\nworld");
      expect(doc.lines).containSubset([{text: "hello"}, {text: "test"}, {text: ""}, {text: "world"}]);
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

      expect(doc.getLine(0).textAndAttributes).deep.equals([0, 5, "hello", null]);
      expect(doc.getLine(1).textAndAttributes).deep.equals([
        0, 3, "wor", {...attr2, ...attr1},
        3, 4, "l", attr2,
        4, 5, "d", null
      ]);
      expect(doc.getLine(0).attributesWithOffsets).deep.equals([0, 5, null]);
      expect(doc.getLine(1).attributesWithOffsets).deep.equals([
        0, 3, {...attr2, ...attr1},
        3, 4, attr2,
        4, 5, null
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
      expect(doc.getLine(1).attributesWithOffsets).equals(null);
      expect(doc.getLine(1).textAndAttributes).deep.equals([0,4, "hohu", null]);
    });

    describe("mixin", () => {

      it("attributes mixin", () => {
        doc.textString = "hello\nworld";
        expect(doc.textAndAttributes).deep.equals(["hello\nworld", null]);
        doc.mixinTextAttribute({foo: 23}, range(1,1,1,3));
        doc.mixinTextAttribute({bar: 99}, range(1,2,1,4));
        expect(doc.textAndAttributes).deep.equals([
          "hello\nw", null,
          "o", {foo: 23},
          "r", {foo: 23, bar: 99},
          "l", {bar: 99},
          "d", null
        ]);
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


    xdescribe("on text deletion", () => {
    
      it("are updated", () => {
        doc.textString = "hello\nworld\n123";
        let attr1 = new TextAttribute({}, range(0,0,0,5)),
            attr2 = new TextAttribute({}, range(0,0,1,5)),
            attr3 = new TextAttribute({}, range(0,0,2,3));
        doc.textAttributes = [attr1, attr2, attr3];
        doc.remove(range(0,1,0,2));
        expect(doc.textAttributes).equals([attr1, attr2, attr3]);
        expect(doc.textAttributes[0].range).stringEquals("Range(0/0 -> 0/4)");
        expect(doc.textAttributes[1].range).stringEquals("Range(0/0 -> 1/5)");
        expect(doc.textAttributes[2].range).stringEquals("Range(0/0 -> 2/3)");
        expect(doc.textAttributesByLine).equals([[attr1, attr2, attr3], [attr2, attr3], [attr3]]);
    
        doc.remove(range(0,0,0,5));
        expect(doc.textAttributes).equals([attr2, attr3]);
        expect(doc.textAttributes[0].range).stringEquals("Range(0/0 -> 1/5)");
        expect(doc.textAttributes[1].range).stringEquals("Range(0/0 -> 2/3)");
        expect(doc.textAttributesByLine).equals([[attr2, attr3], [attr2, attr3], [attr3]]);
    
        doc.remove(range(0,0,2,0));
        expect(doc.textAttributes).equals([attr3]);
        expect(doc.textAttributes[0].range).stringEquals("Range(0/0 -> 0/3)");
        expect(doc.textAttributesByLine).equals([[attr3]]);
      });
    
      it("of line break are updated", () => {
        doc.textString = "a\nb";
        let attr = new TextAttribute({}, range(1,0,1,1));
        doc.textAttributes = [attr];
        doc.remove(range(0,1,1,0));
        expect(doc.textAttributes).equals([attr]);
        expect(doc.textAttributes[0].range).stringEquals("Range(0/1 -> 0/2)");
        expect(doc.textAttributesByLine).equals([[attr]]);
      });
    
      it("are updated even if not directly in modified range", () => {
        doc.textString = "a\n\nb";
        let attr = new TextAttribute({}, range(2,0,2,1));
        doc.textAttributes = [attr];
        doc.remove(range(0,1,1,0));
        expect(doc.textAttributes[0].range).stringEquals("Range(1/0 -> 1/1)");
        expect(doc.textAttributesByLine).equals([undefined, [attr]]);
      });
    
      it("are completely removed", () => {
        doc.textString = "a\nb\nc";
        let attr = new TextAttribute({}, range(1,0,1,1));
        doc.textAttributes = [attr];
        doc.remove(range(0,0,2,1));
        expect(doc.textAttributes).equals([]);
        expect(doc.textAttributesByLine).equals([undefined]);
      });
    
    });

    describe("on text insertion", () => {
    
      it("are updated", () => {
        doc.textAndAttributes = [
          "hello\n", {a: true},
          "w", null,
          "orld", {b: true}
        ];

        doc.insertString("Y", {row: 0, column: 3}, false/*don't extend attrs*/);

        expect(doc.textAndAttributes).deep.equals([
          "hel", {a: true},
          "Y", null,
          "lo\n", {a: true},
          "w", null,
          "orld", {b: true}
        ]);

        doc.insertString("X", {row: 0, column: 3}, true);

        expect(doc.textAndAttributes).deep.equals([
          "hel", {a: true},
          "X", {a: true},
          "Y", null,
          "lo\n", {a: true},
          "w", null,
          "orld", {b: true}
        ]);
      });
    
      it("are updated even if not directly in modified range 1", () => {
        doc.textAndAttributes = [
          "aaa\n", {a: true},
          "bbb", {b: true},
        ];
        doc.insertString("X\n", {row: 0, column: 1}, false);
        expect(doc.lines.map(l => l.textAndAttributes)).deep.equals([
          [0, 1, "a", { "a": true }, 1, 2, "X", null],
          [0, 2, "aa", { "a": true }],
          [0, 3, "bbb", { "b": true }]
        ])
      });
    
    });

    xdescribe("chunking attributes by lines", () => {
    
      it("empty doc", () => {
        expect(Document.fromString("").textAttributesChunkedByLine()).equals([[0,0, []]]);
      });
    
      it("no attributes doc", () => {
        expect(Document.fromString("hello\nworld").textAttributesChunkedByLine()).equals([[0,5, []], [0,5, []]]);
      });
    
      it("attribute on single line", () => {
        doc.textString = "hello\n  world";
        let attr1 = new TextAttribute({}, range(0,0,0,5));
        doc.textAttributes = [attr1];
        expect(doc.textAttributesChunkedByLine()).deep.equals([[0, 5, [attr1]], [0, 7, []]]);
      });
    
      it("overlapping", () => {
        doc.textString = "hello\n  world";
        let attr1 = new TextAttribute({}, range(0,1,0,5)),
            attr2 = new TextAttribute({}, range(0,2,0,4));
        doc.textAttributes = [attr1, attr2];
        expect(doc.textAttributesChunkedByLine()).equals([
          [0,1,[], 1,2, [attr1], 2,4, [attr1, attr2], 4,5, [attr1]],
          [0,7,[]]]);
      });
    
      it("overlapping lines", () => {
        doc.textString = "hello\n  world";
        let attr1 = new TextAttribute({}, range(0,0,0,5)),
            attr2 = new TextAttribute({}, range(0,0,1,5));
        doc.textAttributes = [attr1, attr2];
        expect(doc.textAttributesChunkedByLine()).deep.equals([
          [0, 5, [attr1, attr2]],
          [0, 5, [attr2], 5,7, []]]);
      });
    
      it("sparse", () => {
        doc.textString = "hello\nworld";
        let attr1 = new TextAttribute({}, range(0,1,0,3)),
            attr2 = new TextAttribute({}, range(0,5,1,5));
        doc.textAttributes = [attr1, attr2];
        expect(doc.textAttributesChunkedByLine()).equals([[0,1, [], 1, 3, [attr1], 3,5, []], [0, 5, [attr2]]])
      });
    
      it("empty line followed by single", () => {
        doc.textString = "\na";
        let attr1 = new TextAttribute({}, range(0,1,1,1)),
            attr2 = new TextAttribute({}, range(1,0,1,1));
        doc.textAttributes = [attr1, attr2];
        expect(doc.textAttributesChunkedByLine()).equals([[0,0, []], [0,1, [attr1, attr2]]])
      });
    
    });

    xdescribe("chunked across lines", () => {
    
      let attr1, attr2;
      beforeEach(() => {
        // doc = TextDocument.fromString("hello\nworld")
        doc.textString = "hello\n  world";
        attr1 = new TextAttribute({}, range(0,2,0,5));
        attr2 = new TextAttribute({}, range(0,2,1,2));
        doc.textAttributes = [attr1, attr2];
      });
    
    
      it("overlapping lines, whole doc", () => {
        expect(doc.textAttributesChunked()).deep.equals([
          [{row: 0, column: 0}, {row: 0, column: 2}, []],
          [{row: 0, column: 2}, {row: 0, column: 5}, [attr1, attr2]],
          [{row: 0, column: 5}, {row: 1, column: 2}, [attr2]],
          [{row: 1, column: 2}, {row: 1, column: 7}, []],
        ]);
      });
    
      it("overlapping lines, filtered", () => {
        expect(doc.textAttributesChunked(undefined, undefined, attr => attr !== attr1)).deep.equals([
          [{row: 0, column: 0}, {row: 0, column: 2}, []],
          [{row: 0, column: 2}, {row: 1, column: 2}, [attr2]],
          [{row: 1, column: 2}, {row: 1, column: 7}, []],
        ]);
      });
    
      it("overlapping lines, range", () => {
        expect(doc.textAttributesChunked({row: 0, column: 5}, {row: 1, column: 2})).deep.equals([
          [{row: 0, column: 5}, {row: 1, column: 2}, [attr2]],
        ]);
      });
    });

    xdescribe("style attributes", () => {
    
      let attr1, attr2;
      beforeEach(() => {
        // doc = TextDocument.fromString("hello\nworld")
        doc.textString = "hello\n  world";
        attr1 = new TextStyleAttribute({fontSize: 20, fontColor: "red"}, range(0,-1,1,7));
        attr2 = new TextStyleAttribute({fontSize: 10}, range(0,2,1,2));
        doc.textAttributes = [attr1, attr2];
      });
    
    
      it("retrieves style in chunks", () => {
        expect(doc.stylesChunked()).deep.equals([
          [{row: 0, column: 0}, {row: 0, column: 2}, {fontSize: 20, fontColor: "red"}],
          [{row: 0, column: 2}, {row: 1, column: 2}, {fontSize: 10, fontColor: "red"}],
          [{row: 1, column: 2}, {row: 1, column: 7}, {fontSize: 20, fontColor: "red"}],
        ]);
        expect(doc.stylesChunked({start: {row: 1, column: 0}, end: {row: 1, column: 7}})).deep.equals([
          [{row: 1, column: 0}, {row: 1, column: 2}, {fontSize: 10, fontColor: "red"}],
          [{row: 1, column: 2}, {row: 1, column: 7}, {fontSize: 20, fontColor: "red"}],
        ]);
      });
    
      it("modifies style in range", () => {
        doc.setStyleInRange(
          {fontSize: 15},
          {start: {row: 1, column: 0}, end: {row: 1, column: 7}},
          attr1);
        expect(doc.textAttributesChunked()).containSubset([
          [{row: 0, column: 0}, {row: 0, column: 2}, [attr1]],
          [{row: 0, column: 2}, {row: 1, column: 0}, [attr1, {data: {fontSize: 10}}]],
          [{row: 1, column: 0}, {row: 1, column: 7}, [attr1, {data: {fontSize: 15}}]],
        ], "merge didn't work");
      });
    
    });

  });

});

function fooo() {

  var doc = new Document(["a", "b", "c", "d"], {maxLeafSize: 3, minLeafSize: 2});


  doc.insertLines(["hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", ])
  doc.print2()
}