/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../../rendering/dom-helper.js";
import { MorphicEnv } from "../../index.js";
import { Text, World } from "../../index.js";
import { Range } from "../../text/range.js";
import { StyleRange } from "../../text/style.js";
import { Color, pt } from "lively.graphics";
import { obj } from "lively.lang";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";

const padding = 20;

const defaultStyle = { fontFamily: "Monaco, monospace",
                       fontSize: 10,
                       fontWeight: "normal",
                       fontColor: Color.black,
                       fontStyle: "normal",
                       textDecoration: "none",
                       fixedCharacterSpacing: false
                      }

function text(string, props) {
  return new Text({
    name: "text",
    textString: string,
    extent: pt(100,100),
    padding,
    fontMetric,
    ...defaultStyle,
    ...props
  });
}

var world, sut;
function createDummyWorld() {
  world = new World({name: "world", extent: pt(300,300), submorphs: [
    text("hello", {
      position: pt(10.10),
      fill: Color.gray.lighter(2)
    })]})
  sut = world.get("text");
  return world;
}

var env;
async function createMorphicEnv() {
  env = new MorphicEnv(await createDOMEnvironment());
  env.domEnv.document.body.style = "margin: 0";
  MorphicEnv.pushDefault(env);
  await env.setWorld(createDummyWorld());
}
async function destroyMorphicEnv() {
  MorphicEnv.popDefault().uninstall();
}


describe("rich text", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  var style_a = { fontSize: 12, fontStyle: "italic" },
      style_b = { fontSize: 14, fontWeight: "bold" },
      merged_a = obj.merge(defaultStyle, style_a),
      merged_b = obj.merge(defaultStyle, style_b),
      merged_ab = obj.merge(merged_a, style_b),
      a = StyleRange.create(style_a, 0, 1, 0, 3),
      b = StyleRange.create(style_b, 0, 2, 0, 4),
      styleRanges;

    it("begins with default style range", () => {
      styleRanges = sut.document.styleRangesByLine[0];

      expect(styleRanges).property("length").equals(1);
      expect(styleRanges).property(0).property("range")
          .stringEquals("Range(0/0 -> 0/5)");
      expect(styleRanges).property(0).property("style")
          .deep.equals(defaultStyle);
    });

    it("addStyleRange merges style ranges", () => {
      sut.addStyleRange(a);
      styleRanges = sut.document.styleRangesByLine[0];

      expect(styleRanges).property("length").equals(3);
      expect(styleRanges).property(0).property("range")
          .stringEquals("Range(0/0 -> 0/1)");
      expect(styleRanges).property(1).property("range")
          .stringEquals("Range(0/1 -> 0/3)");
      expect(styleRanges).property(2).property("range")
          .stringEquals("Range(0/3 -> 0/5)");
      expect(styleRanges).property(0).property("style")
          .deep.equals(defaultStyle);
      expect(styleRanges).property(1).property("style")
          .deep.equals(merged_a);
      expect(styleRanges).property(2).property("style")
          .deep.equals(defaultStyle);

      sut.addStyleRange(b);
      styleRanges = sut.document.styleRangesByLine[0];

      expect(styleRanges).property("length").equals(5);
      expect(styleRanges).property(0).property("range")
          .stringEquals("Range(0/0 -> 0/1)");
      expect(styleRanges).property(1).property("range")
          .stringEquals("Range(0/1 -> 0/2)");
      expect(styleRanges).property(2).property("range")
          .stringEquals("Range(0/2 -> 0/3)");
      expect(styleRanges).property(3).property("range")
          .stringEquals("Range(0/3 -> 0/4)");
      expect(styleRanges).property(4).property("range")
          .stringEquals("Range(0/4 -> 0/5)");
      expect(styleRanges).property(0).property("style")
          .deep.equals(defaultStyle);
      expect(styleRanges).property(1).property("style")
          .deep.equals(merged_a);
      expect(styleRanges).property(2).property("style")
          .deep.equals(merged_ab);
      expect(styleRanges).property(3).property("style")
          .deep.equals(merged_b);
      expect(styleRanges).property(4).property("style")
          .deep.equals(defaultStyle);
    });

    it("renders styles", async () => {
      sut.addStyleRange(a);
      sut.addStyleRange(b);

      await sut.whenRendered();

      var root = env.renderer.getNodeForMorph(sut),
          textLayer = root.getElementsByClassName("text-layer")[0],
          line = textLayer.childNodes[1], // index 0 is spacer
          chunks = line.childNodes;

      expect(chunks).property("length").equals(5);

      var styles = Array.from(chunks).map(ea => {
        let jsStyle = env.domEnv.window.getComputedStyle(ea),
            fontFamily = jsStyle.getPropertyValue("font-family"),
            fontSize = parseInt(jsStyle.getPropertyValue("font-size").slice(0, -2)),
            fontWeight = jsStyle.getPropertyValue("font-weight"),
            fontStyle = jsStyle.getPropertyValue("font-style"),
            textDecoration = jsStyle.getPropertyValue("text-decoration");
        return { fontFamily, fontSize, fontWeight, fontStyle, textDecoration };
      });

      var strings = Array.from(chunks).map(ea => ea.textContent);

      expect(styles[0]).deep.equals(obj.dissoc(defaultStyle, ["fontColor", "fixedCharacterSpacing"]));
      expect(styles[1]).deep.equals(obj.dissoc(merged_a, ["fontColor", "fixedCharacterSpacing"]));
      expect(styles[2]).deep.equals(obj.dissoc(merged_ab, ["fontColor", "fixedCharacterSpacing"]));
      expect(styles[3]).deep.equals(obj.dissoc(merged_b, ["fontColor", "fixedCharacterSpacing"]));
      expect(styles[4]).deep.equals(obj.dissoc(defaultStyle, ["fontColor", "fixedCharacterSpacing"]));

      expect(strings[0]).equals("h");
      expect(strings[1]).equals("e");
      expect(strings[2]).equals("l");
      expect(strings[3]).equals("l");
      expect(strings[4]).equals("o");
    });
});
