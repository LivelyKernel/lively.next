/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { morph, Renderer, Text } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

function text(string, props) {
  return new Text(Object.assign({
    textString: string,
    fontFamily: "Arial",
    fontSize: 10,
    extent: pt(100,100)
  }, props));
}

describe("text", () => {

  it("computes size on construction", () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: false});
    expect(height).within(9,12)
    expect(width).within(18,22)
  });

  it("computes only width", () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: true});
    expect(height).equals(100)
    expect(width).within(18,22)
  });

  it("computes only height", () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: true, fixedHeight: false});
    expect(height).within(9,12);
    expect(width).equals(100);
  });

  it("leaves extent as is with fixed sizing", () => {
    var {extent} = text("hello", {fixedWidth: true, fixedHeight: true});
    expect(extent).equals(pt(100,100));
  });

});
