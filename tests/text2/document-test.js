/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import TextDocument from "../../text2/document.js";
import { arr } from "lively.lang";

describe("text document", () => {

  it("has text as string", () => {
    var d = new TextDocument("Hello\nworld\n");
    expect(d.textString).equals("Hello\nworld\n");
    expect(d.lines).equals(["Hello", "world", ""]);
    d.textString = "Foo\nbar"
    expect(d.textString).equals("Foo\nbar");
    expect(d.lines).equals(["Foo", "bar"]);
  });

});