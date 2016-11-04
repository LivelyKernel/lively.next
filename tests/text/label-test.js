/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { Label } from "../../text/label.js";
import { expect } from "mocha-es6";
import { pt, rect, Color, Rectangle, Transform } from "lively.graphics";
import { arr } from "lively.lang";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";
import { create as createElement } from "virtual-dom";

describe("label", () => {

  it("renders text", () => {
    var l = new Label({textString: "foo", fontSize: 20, fontMetric});
    expect(l.render(l.env.renderer).children[0]).containSubset({
      properties: {style: {}},
      children: [{text: "foo"}]
    });
  });

  it("renders richt text", () => {
    var l = new Label({textAndAttributes: [["foo", {fontSize: 11}], ["bar", {fontSize: 12}]], fontSize: 20, fontMetric});
    expect(l.render(l.env.renderer).children).containSubset([{
      properties: {style: {fontSize: "11px",}},
      children: [{text: "foo"}]
    }, {
      properties: {style: {fontSize: "12px",}},
      children: [{text: "bar"}]
    }]);
  });

  it("textAndAttributesOfLines", () => {
    var l = new Label({textAndAttributes: [["1"], ["2"],["\n"],[" bar"]], fontSize: 20});
    expect(l.textAndAttributesOfLines).deep.equals([
      [["1", {}], ["2", {}]],
      [[" bar", {}]]
    ]);
  })

  it("computes text bounds", () => {
    var {height: charHeight, width: charWidth} = fontMetric,
        l = new Label({textAndAttributes: [["1"], ["2"],["\n\n"],[" bar"]], fontMetric});
    expect(l.textBounds()).equals(new Rectangle(0,0,4*charWidth, 3*charHeight))
  });

  it("makes icon labels", () => {
    var l = Label.icon("plus");
    expect(l.value).deep.equals([["\uf067", {fontFamily: "", textStyleClasses: "fa"}]])
  })
});
