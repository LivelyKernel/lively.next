/*global declare, it, xit, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { FontMetric } from "../rendering/renderer.js";
import { Text, morph, Renderer } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";


var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

function text(string, props) {
  return new Text({
    textString: string,
    fontFamily: "Arial",
    fontSize: 10,
    extent: pt(100,100),
    ...props
  });
}

var domEnv;

describe("text", () => {

  beforeEach(async () => {
    domEnv = await createDOMEnvironment();
    FontMetric.initDefault(domEnv.document);
  })

  afterEach(() => {
    FontMetric.removeDefault();
    domEnv.destroy();
  })

  describe("font metric", () => {

    inBrowser("computes font size", () => {
      var {width, height} = FontMetric.default().sizeFor("Arial", 12, "A");
      expect(width).closeTo(8, 1);
      expect(height).closeTo(14, 1);
    });

  });

  inBrowser("computes size on construction", async () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: false});
    expect(height).within(9,12)
    expect(width).within(18,22)
  });

  inBrowser("computes only width", () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: true});
    expect(height).equals(100)
    expect(width).within(18,22)
  });

  inBrowser("computes only height", () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: true, fixedHeight: false});
    expect(height).within(9,12);
    expect(width).equals(100);
  });

  inBrowser("leaves extent as is with fixed sizing", () => {
    var {extent} = text("hello", {fixedWidth: true, fixedHeight: true});
    expect(extent).equals(pt(100,100));
  });

});
