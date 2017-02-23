/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import TextTree from "../../text/document-tree.js";
import { arr } from "lively.lang";

var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 5, minNodeSize: 2};

describe("text tree", () => {

  it("finds lines by row", () => {
    var textTree = new TextTree(["a", "b", "c", "d"]);
    textTree.consistencyCheck();
    
    var lines = [0,1,2,3,4].map(n => textTree.root.findRow(n));
    expect().assert(lines[0], "line 0 not found");
    expect().assert(lines[1], "line 1 not found");
    expect().assert(lines[2], "line 2 not found");
    expect().assert(lines[3], "line 3 not found");
    expect(lines[0]).containSubset({text: "a"});
    expect(lines[1]).containSubset({text: "b"});
    expect(lines[2]).containSubset({text: "c"});
    expect(lines[3]).containSubset({text: "d"});

    expect(lines[0].parent).equals(textTree.root.children[0], "parent line 0");
    expect(lines[1].parent).equals(textTree.root.children[0], "parent line 1");
    expect(lines[2].parent).equals(textTree.root.children[1], "parent line 2");
    expect(lines[3].parent).equals(textTree.root.children[1], "parent line 3");

    expect(lines[0].row).equals(0);
    expect(lines[1].row).equals(1);
    expect(lines[2].row).equals(2);
    expect(lines[3].row).equals(3);
  });


  it("balances leaf nodes", () => {
    var textTree = new TextTree(["a", "b", "c", "d"], opts);
    textTree.balance();
    expect(textTree.print()).equals(
      `root (size: 4)\n`
    + ` leaf (size: 2)\n`
    + `  line 0 (height: 0, text: "a")\n`
    + `  line 1 (height: 0, text: "b")\n`
    + ` leaf (size: 2)\n`
    + `  line 2 (height: 0, text: "c")\n`
    + `  line 3 (height: 0, text: "d")`);
  });

  describe("insertion", () => {

    it("appends", () => {
      var textTree = new TextTree();
      textTree.insertLine("hello world");
      expect(textTree.print()).equals(`root (size: 1)\n line 0 (height: 0, text: "hello world")`)
    });

    it("inserts", () => {
      var textTree = new TextTree();
      textTree.insertLine("c");
      textTree.insertLine("a", 0);
      textTree.insertLine("b", 1);
      expect(textTree.print()).equals(
        `root (size: 3)\n`
      + ` line 0 (height: 0, text: "a")\n`
      + ` line 1 (height: 0, text: "b")\n`
      + ` line 2 (height: 0, text: "c")`);
    });

    it("balances leaf nodes after insert", () => {
      var textTree = new TextTree(["a", "b"], opts);
      textTree.insertLine("x", 0);
      textTree.insertLine("y", 3);
      expect(textTree.print()).equals(
        `root (size: 4)\n`
      + ` leaf (size: 2)\n`
      + `  line 0 (height: 0, text: "x")\n`
      + `  line 1 (height: 0, text: "a")\n`
      + ` leaf (size: 2)\n`
      + `  line 2 (height: 0, text: "b")\n`
      + `  line 3 (height: 0, text: "y")`);
    });

    it("balances after insert 1", () => {
      var textTree = new TextTree([], opts);
      textTree.insertLines(["a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a"])
      textTree.insertLine("b");
      textTree.insertLine("b");
      textTree.consistencyCheck();
    });

    it("balances after insert 2", () => {
      var textTree = new TextTree([], opts);
      textTree.insertLines(["a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a"])
      textTree.insertLine("b");
      textTree.insertLine("b");
      textTree.consistencyCheck();
    });

  });


  describe("removal", () => {

    it("removes line", () => {
      var textTree = new TextTree(["a", "b", "c"]);
      textTree.removeLine(1);
      expect(textTree.print()).equals(`root (size: 2)\n line 0 (height: 0, text: "a")\n line 1 (height: 0, text: "c")`);
      textTree.removeLine(1);
      textTree.print2()

      expect(textTree.print()).equals(`root (size: 1)\n line 0 (height: 0, text: "a")`);
      textTree.removeLine(0);
      expect(textTree.print()).equals(`root (size: 0)`);
    });

    it("balances leaf nodes after remove 1", () => {
      var textTree = new TextTree(["a", "b", "c", "d"], opts);
      textTree.removeLine(3);
      expect(textTree.print()).equals(
          `root (size: 3)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "b")\n`
        + ` line 2 (height: 0, text: "c")`);
      textTree.removeLine(1);
      expect(textTree.print()).equals(
          `root (size: 2)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "c")`);
    });

    it("balances leaf nodes after remove 2", () => {
      var textTree = new TextTree(["a", "b", "c", "d"], opts);
      textTree.removeLine(1);
      expect(textTree.print()).equals(
          `root (size: 3)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "c")\n`
        + ` line 2 (height: 0, text: "d")`);
      textTree.removeLine(1);
      expect(textTree.print()).equals(
          `root (size: 2)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "d")`);
    });

    it("balances by stealing values to be consistent", () => {
      // steal lines from the second leaf node so that node one is OK
      //                   node (size: 4)                          
      //              •••••               •••••                    
      // node (leaf, size: 1)          node (leaf, size: 3)        
      //       •                       ••••      •      ••••       
      // line (2)                line (3)    line (4)    line (5)  
      var t = new TextTree(["1", "2", "3", "4", "5"], opts);
      t.removeLine(0);
      t.consistencyCheck();
    });

    it("remove many lines", () => {
      var textTree = new TextTree(["a", "b", "c", "d"], opts);
      textTree.removeLines(1, 2);
      textTree.consistencyCheck();
      expect(textTree.print()).equals(
          `root (size: 2)\n`
        + ` line 0 (height: 0, text: "a")\n`
        + ` line 1 (height: 0, text: "d")`);
    });

  });


  describe("bugs", () => {
  
    it("all nodes have correct size", () => {

      var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 3, minNodeSize: 2},
          textTree = new TextTree([], opts);
      for (var i = 0; i < 10; i++) textTree.insertLine("" + i);
      expect(textTree.lines().map(ea => ea.text)).equals(arr.range(0, 9))

      textTree.removeLines(1,3);
      expect(textTree.lines().map(ea => ea.text)).equals(["0", "4", "5", "6", "7", "8", "9"]);
      textTree.print();
      textTree.removeLines(1,3);
      expect(textTree.lines().map(ea => ea.text)).equals(["0", "7", "8", "9"]);
      textTree.consistencyCheck();
    });

    it("inserts followed by removes not conistent", () => {
      var opts = {maxLeafSize: 3, minLeafSize: 2, maxNodeSize: 3, minNodeSize: 2},
          textTree = new TextTree([], opts);
      for (var i = 0; i < 7; i++) textTree.insertLine("" + i);
      textTree.print();
      textTree.removeLines(1,3);
      textTree.consistencyCheck();
      textTree.print();
    });

  });

});


function fooo() {

  var textTree = new TextTree(["a", "b", "c", "d"], {maxLeafSize: 3, minLeafSize: 2});


  textTree.insertLines(["hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", "hello", "world", ])
  textTree.print2()
}