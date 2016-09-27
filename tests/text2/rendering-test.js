/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../../rendering/dom-helper.js";
import { World, MorphicEnv } from "../../index.js";
import { Range } from "../../text2/range.js";
import { Text } from "../../text2/morph.js";
import { TextAttribute } from "../../text2/style.js";
import TextDocument from "../../text2/document.js";
import TextLayout from "../../text2/rendering.js";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";
import { Rectangle, Color, pt } from "lively.graphics";
import { obj } from "lively.lang";

const defaultStyle = {
  fontFamily: "Monaco, monospace",
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
    padding: Rectangle.inset(3),
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

async function destroyMorphicEnv() { MorphicEnv.popDefault().uninstall(); }


describe("text rendering", () => {
// 
//   var layout = new TextLayout(fontMetric);
//   var doc = TextDocument.fromString("hello\n  world");
// 
//   layout.updateFromDocumentIfNecessary(doc)
// 
// window.textAttributesChunked(doc, 0, doc.lines.length-1)
// 
//   layout.lines

});
