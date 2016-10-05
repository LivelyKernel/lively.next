/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import TextDocument from "../../text/document.js";
import { Range } from "../../text/range.js";
import { lessPosition, lessEqPosition, eqPosition } from "../../text/position.js";
import { TextAttribute, TextStyleAttribute } from "../../text/attribute.js";
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

  describe("words", () => {

    var doc;

    beforeEach(() => doc = TextDocument.fromString("Hello world\n 123 3  4\n"));

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

  it("created using text string", () => {
    var doc = TextDocument.fromString("hello\nworld");
    expect(doc.lines).equals(["hello", "world"]);
    expect(doc.textString).equals("hello\nworld");
    doc.textString += "\nfoo"
    expect(doc.lines).equals(["hello", "world", "foo"]);
    expect(doc.textString).equals("hello\nworld\nfoo");
  });

  it("text length", () => {
    expect(TextDocument.fromString("hello\nworld\nfoo").stringLength).equals(15);
  });

  it("end position", () => {
    expect(TextDocument.fromString("hello\nworld\nfoo").endPosition).deep.equals({row: 2, column: 3});
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

    var doc; beforeEach(() => doc = TextDocument.fromString("1 23\n4\n foo\n5  "));

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
    beforeEach(() => doc = TextDocument.fromString("hello\nworld"))

    it("attributes and text access", () => {
      doc.textString = "hello\nworld";
      let attr1 = new TextAttribute({}, range(1,0,1,3)),
          attr2 = new TextAttribute({}, range(1,0,1,4));
      expect(doc.textAttributes).equals([]);
      doc.textAttributes = [attr1, attr2];
      expect(doc.textAttributes).equals([attr1, attr2]);

      expect(doc.textAndAttributes).deep.equals([
        ["hello\n", []],
        ["wor", [attr1, attr2]],
        ["l", [attr2]],
        ["d", []]
      ]);
    });

    it("set attributes and text", () => {
      doc.textString = "";
      let attr1 = new TextAttribute({}),
          attr2 = new TextAttribute({});
      doc.textAndAttributes = [
        ["hello\n", []],
        ["wor", [attr2, attr1]],
        ["l", [attr2]],
        ["d", []]
      ];
      expect(doc.textString).equals("hello\nworld");
      expect(doc.textAttributes).equals([attr1, attr2]);
      expect(doc.textAttributes[0].range).equals(range(1,0,1,3));
      expect(doc.textAttributes[1].range).equals(range(1,0,1,4));
    });

    describe("addition", () => {

      it("of single attribute", () => {
        var [attr] = doc.addTextAttributes([TextAttribute.create({}, 1,2, 1, 5)]);
        expect(doc.textAttributes).equals([attr]);
        expect(doc.textAttributesByLine).equals([undefined, [attr]]);
      });

      it("of single attribute after default style", () => {
        var [attr1] = doc.textAttributes = [TextAttribute.create({}, 0,-1,1,5)],
            attr2 = doc.addTextAttribute(TextAttribute.create({}, 0,0,0,5));
        expect(doc.textAttributes).equals([attr1, attr2]);
        expect(doc.textAttributesByLine).equals([[attr1, attr2], [attr1]]);
        doc.textAttributesByLine[1]
      });

      it("of single attribute on multiple lines", () => {
        var attr = TextAttribute.create({}, 0,2, 1, 5);
        doc.addTextAttributes([attr])
        expect(doc.textAttributes).equals([attr]);
        expect(doc.textAttributesByLine).equals([[attr], [attr]]);
      });

      it("of multiple attribute on single line", () => {
        var attr1 = TextAttribute.create({}, 0,2, 0, 5);
        var attr2 = TextAttribute.create({}, 0,1, 0, 5);
        var attr3 = TextAttribute.create({}, 0,3, 0, 5);
        doc.addTextAttributes([attr1, attr2, attr3])
        expect(doc.textAttributes).equals([attr2, attr1, attr3]);
        expect(doc.textAttributesByLine).equals([[attr2, attr1, attr3]]);
      });

      it("of multiple attribute across lines", () => {
        var attr1 = TextAttribute.create({}, 0,2, 0, 5);
        var attr2 = TextAttribute.create({}, 0,1, 1, 5);
        var attr3 = TextAttribute.create({}, 0,3, 1, 0);
        var attr4 = TextAttribute.create({}, 1,3, 1, 4);
        doc.addTextAttributes([attr1, attr2, attr3, attr4])
        expect(doc.textAttributes).equals([attr2, attr1, attr3, attr4]);
        expect(doc.textAttributesByLine).equals([[attr2, attr1, attr3], [attr2, attr3, attr4]]);
      });

      it("of multiple attributes across lines with existing attributes", () => {
        var [attr1, attr2, attr3] = doc.textAttributes = [
          TextAttribute.create({}, 0,-1, 1, 5),
          TextAttribute.create({}, 1,0, 1, 4),
          TextAttribute.create({}, 1,4, 1, 5)
        ];
        var attr4 = TextAttribute.create({}, 0,2, 0, 5),
            attr5 = TextAttribute.create({}, 0,1, 1, 5),
            attr6 = TextAttribute.create({}, 0,3, 1, 0),
            attr7 = TextAttribute.create({}, 1,3, 1, 4);
        doc.addTextAttributes([attr4, attr5, attr6, attr7]);
        expect(doc.textAttributes).equals([attr1, attr5, attr4, attr6, attr2, attr7, attr3]);
        expect(doc.textAttributesByLine).equals([
          [attr1, attr5, attr4, attr6],
          [attr1, attr5, attr6, attr2, attr7, attr3]
        ]);
      });

    });

    describe("on text deletion", () => {

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
        doc.textString = "hello\nworld";
        let attr1 = new TextAttribute({}, range(0,0,0,5)),
            attr2 = new TextAttribute({}, range(0,0,1,5));
        doc.textAttributes = [attr1, attr2];
  
        doc.insert("X", {row: 0, column: 5});
        expect(doc.textAttributes).equals([attr1, attr2]);
        expect(doc.textAttributes[0].range).stringEquals("Range(0/0 -> 0/6)");
        expect(doc.textAttributes[1].range).stringEquals("Range(0/0 -> 1/5)");
        expect(doc.textAttributesByLine).equals([[attr1, attr2], [attr2]]);
  
        doc.insert("A\nY\nZ", {row: 0, column: 5});
        expect(doc.textAttributes).equals([attr1, attr2]);
        expect(doc.textAttributes[0].range).stringEquals("Range(0/0 -> 2/2)");
        expect(doc.textAttributes[1].range).stringEquals("Range(0/0 -> 3/5)");
        expect(doc.textAttributesByLine).equals([[attr1, attr2], [attr1, attr2], [attr1, attr2], [attr2]]);
      });

      it("are updated even if not directly in modified range 1", () => {
        doc.textString = "a\nb";
        let attr = new TextAttribute({}, range(1,0,1,1));
        doc.textAttributes = [attr];
        doc.insert("\n", {row: 0, column: 1});
        expect(doc.textAttributes[0].range).stringEquals("Range(2/0 -> 2/1)");
        expect(doc.textAttributesByLine).equals([[], [], [attr]]);
      });

    });


    describe("chunking attributes", () => {

      it("empty doc", () => {
        expect(TextDocument.fromString("").textAttributesChunked()).equals([[0,0, []]]);
      });

      it("no attributes doc", () => {
        expect(TextDocument.fromString("hello\nworld").textAttributesChunked()).equals([[0,5, []], [0,5, []]]);
      });

      it("attribute on single line", () => {
        doc.textString = "hello\n  world";
        let attr1 = new TextAttribute({}, range(0,0,0,5));
        doc.textAttributes = [attr1];
        expect(doc.textAttributesChunked()).deep.equals([[0, 5, [attr1]], [0, 7, []]]);
      });

      it("overlapping", () => {
        doc.textString = "hello\n  world";
        let attr1 = new TextAttribute({}, range(0,1,0,5)),
            attr2 = new TextAttribute({}, range(0,2,0,4));
        doc.textAttributes = [attr1, attr2];
        expect(doc.textAttributesChunked()).equals([
          [0,1,[], 1,2, [attr1], 2,4, [attr1, attr2], 4,5, [attr1]],
          [0,7,[]]]);
      });

      it("overlapping lines", () => {
        doc.textString = "hello\n  world";
        let attr1 = new TextAttribute({}, range(0,0,0,5)),
            attr2 = new TextAttribute({}, range(0,0,1,5));
        doc.textAttributes = [attr1, attr2];
        expect(doc.textAttributesChunked()).deep.equals([
          [0, 5, [attr1, attr2]],
          [0, 5, [attr2], 5,7, []]]);
      });

      it("sparse", () => {
        doc.textString = "hello\nworld";
        let attr1 = new TextAttribute({}, range(0,1,0,3)),
            attr2 = new TextAttribute({}, range(0,5,1,5));
        doc.textAttributes = [attr1, attr2];
        expect(doc.textAttributesChunked()).equals([[0,1, [], 1, 3, [attr1], 3,5, []], [0, 5, [attr2]]])
      });

      it("empty line followed by single", () => {
        doc.textString = "\na";
        let attr1 = new TextAttribute({}, range(0,1,1,1)),
            attr2 = new TextAttribute({}, range(1,0,1,1));
        doc.textAttributes = [attr1, attr2];
        expect(doc.textAttributesChunked()).equals([[0,0, []], [0,1, [attr1, attr2]]])
      });

    });
  });

});
