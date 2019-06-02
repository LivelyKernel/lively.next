/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Text } from "../../text/morph.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { arr, string } from "lively.lang";

var t;
function text(string, props) {
  return new Text({
    name: "text",
    textString: string,
    fontFamily: "Monaco, monospace",
    fontSize: 10,
    extent: pt(100,100),
    cursorPosition: {row: 0, column: 0},
    ...props
  });
}

describe("text key input", () => {

  beforeEach(() => t = text("hello\n world", {}));

  describe("key handler invocation", () => {

    it("input event", () => {
      t.onTextInput({type: "input", data: "x"});
      expect(t.textString).equals("xhello\n world");
      t.onTextInput({type: "input", data: "X"});
      expect(t.textString).equals("xXhello\n world");
    });

    it("no input event", () => {
      t.onKeyDown({type: "input", data: "x"});
      expect(t.textString).equals("hello\n world");
    });

  });


  it("key input", async () => {
    await t.simulateKeys("a");
    expect(t.textString).equals("ahello\n world");
    await t.simulateKeys("b");
    expect(t.textString).equals("abhello\n world");
    await t.simulateKeys("Right c d");
    expect(t.textString).equals("abhcdello\n world");
    expect(t.cursorPosition).deep.equals({row: 0, column: 5});
  });

  it("key input with count", async () => {
    await t.simulateKeys("Ctrl-3 a");
    expect(t.textString).equals("aaahello\n world");
  });

});
