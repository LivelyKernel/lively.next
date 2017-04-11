/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { World, MorphicEnv, Label } from "../../index.js";
import { createDOMEnvironment } from "../../rendering/dom-helper.js";
import { Renderer } from "../../rendering/renderer.js";
import { expect } from "mocha-es6";
import { pt, rect, Color, Rectangle, Transform } from "lively.graphics";
import { arr, promise } from "lively.lang";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";
import { create as createElement } from "virtual-dom";

var env;
async function createMorphicEnv() {
  env = new MorphicEnv(await createDOMEnvironment());
  env.domEnv.document.body.style = "margin: 0";
  MorphicEnv.pushDefault(env);
  await env.setWorld(new World({name: "world", extent: pt(300,300), submorphs: []}));
}

async function destroyMorphicEnv() { MorphicEnv.popDefault().uninstall(); }


describe("label", function() {

  this.timeout(7000);

  before(createMorphicEnv);
  after(destroyMorphicEnv);

  it("renders text", () => {
    var l = new Label({textString: "foo", fontSize: 20, fontMetric});
    expect(l.render(env.renderer).children[0]).containSubset({
      properties: {style: {}},
      children: [{text: "foo"}]
    });
  });

  it("renders richt text", () => {
    var l = new Label({
      textAndAttributes: [
        "foo", {fontSize: 11},
        "bar", {fontSize: 12}],
      fontSize: 20, fontMetric
    });
    expect(l.render(env.renderer).children).containSubset([{
      properties: {style: {fontSize: "11px",}},
      children: [{text: "foo"}]
    }, {
      properties: {style: {fontSize: "12px",}},
      children: [{text: "bar"}]
    }]);
  });

  it("textAndAttributesOfLines", () => {
    var l = new Label({
      textAndAttributes: ["1", null, "2", null, "\n", null, "bar", null],
      fontSize: 20});
    expect(l.textAndAttributesOfLines).deep.equals([
      ["1", null, "2", null],
      ["bar", null]
    ]);
  })

  it("computes text bounds", () => {
    var {height: charHeight, width: charWidth} = fontMetric,
        l = new Label({
          textAndAttributes: ["1", null,"2", null,"\n\n", null," bar", null],
          fontMetric});
    expect(l.textBounds()).equals(new Rectangle(0,0,4*charWidth, 3*charHeight))
  });

  it("makes icon labels", () => {
    var l = Label.icon("plus");
    expect(l.value).deep.equals(["\uf067", {fontFamily: "", textStyleClasses: ["fa"]}]);
  });

});
