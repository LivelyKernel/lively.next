/*global declare, it, xit, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";
import { Text } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

// FIXME! FontMetric should work in nodejs with jsdom as well!!!
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

var env;

describe("text", () => {

  beforeEach(async () => {
    env = new MorphicEnv(await createDOMEnvironment());
  })

  afterEach(() => {
    env && env.uninstall();
  })

  describe("font metric", () => {

    inBrowser("computes font size", () => {
      var {width, height} = env.fontMetric.sizeFor("Arial", 12, "A");
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
