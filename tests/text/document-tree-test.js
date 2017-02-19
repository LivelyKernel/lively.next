/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import TextTree from "../../text/document-tree.js";

describe("text tree", () => {

  it("appends", () => {
    var textTree = new TextTree();
    textTree.appendLine("hello world");
    expect(textTree.print()).equals(`root (size: 1)\n line 0 (height: 0, text: "hello world")`)
  });

  it("inserts", () => {
    var textTree = new TextTree();
    textTree.appendLine("c");
    textTree.insertLine("a", 0);
    textTree.insertLine("b", 1);
    expect(textTree.print()).equals(
      `root (size: 3)\n`
    + ` line 0 (height: 0, text: "a")\n`
    + ` line 1 (height: 0, text: "b")\n`
    + ` line 2 (height: 0, text: "c")`);
  });

  it("balances", () => {
    var textTree = new TextTree(["a", "b", "c", "d"], {maxLeafSize: 3});
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

});
