/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../../rendering/dom-helper.js";
import { World, MorphicEnv } from "../../index.js";
import { Text } from "../../text2/morph.js";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";
import { Rectangle, Color, pt } from "lively.graphics";
import { obj, promise } from "lively.lang";

var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

const defaultStyle = {
  fontFamily: "Monaco, monospace",
  fontSize: 10,
  fontWeight: "normal",
  fontColor: Color.black,
  fontStyle: "normal",
  textDecoration: "none"
}

var padding = Rectangle.inset(3);

function text(string, props) {
  return new Text({
    name: "text",
    textString: string,
    extent: pt(100,100),
    padding,
    // fontMetric,
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
  await promise.delay(20);
}

async function destroyMorphicEnv() { MorphicEnv.popDefault().uninstall(); }

function printStyleNormalized(style) { return obj.inspect(style).replace(/ /g, ""); }

function getRenderedTextNodes(morph) {
  let root = env.renderer.getNodeForMorph(morph),
      textLayer = root.getElementsByClassName("text-layer")[0],
      lines = Array.from(textLayer.childNodes).slice(1); // index 0 is spacer
  return lines
}

describe("text rendering", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  inBrowser("only renders visible part of scrolled text", async () => {
    var lineHeight = sut.document.lines[0].height,
        padTop = sut.padding.top(),
        padBot = sut.padding.bottom();
    Object.assign(sut, {
      clipMode: "auto",
      extent: pt(100,2*lineHeight), position: pt(0,0),
      textString: [0,1,2,3,4,5,6,7,8,9].join("\n"),
      scroll: pt(0, lineHeight*2+padTop-1),
      borderWidth: 0
    });

    await sut.whenRendered();

    var node = sut.env.renderer.getNodeForMorph(sut),
        b = node.querySelector(".newtext-text-layer").getBoundingClientRect(),
        textBounds = new Rectangle(b.left, b.top, b.width, b.height);

    expect(textBounds.top()).equals(-sut.scroll.y, "text layer not scrolled");
    expect(textBounds.height).equals(lineHeight*10 + padTop+padBot, "text layer does not have size of all lines");
    expect(node.querySelector(".newtext-text-layer").textContent).equals("123", "text  layer renders more than necessary");
  });

  inBrowser("can resize on content change", async () => {

    sut.clipMode = "visible";
    sut.lineWrapping = false;
    sut.fixedWidth = false;
    var padLeft = sut.padding.left(),
        padRight = sut.padding.right(),
        {width: cWidth, height: cHeight} = sut.fontMetric.defaultCharExtent({defaultTextStyle: sut.defaultTextStyle});
    sut.textString = "Hello hello";

    await sut.whenRendered();
    let expectedWidth = 11*cWidth + padLeft + padRight;
    expect(sut.width).within(expectedWidth-1, expectedWidth+1);

    sut.textString = "foo";
    await sut.whenRendered();
    expectedWidth = 3*cWidth + padLeft + padRight;
    expect(sut.width).within(expectedWidth-1, expectedWidth+1);
  });

//   describe("rich text", () => {
//     
//     var style_a = { fontSize: 12, fontStyle: "italic" },
//         style_b = { fontSize: 14, fontWeight: "bold" },
//         a = TextAttribute.create(style_a, 0, 1, 0, 3),
//         b = TextAttribute.create(style_b, 0, 2, 0, 4),
//         textAttributes;
// 
//     it("renders styles", async () => {
//       sut.addTextAttribute(a);
//       sut.addTextAttribute(b);
//   
//       await sut.whenRendered();
//   
//       let lines = getRenderedTextNodes(sut),
//           chunks = lines[0].childNodes;
//   
//       expect(chunks).property("length").equals(5);
//   
//       let styles = Array.from(chunks).map(ea => {
//         let jsStyle =        env.domEnv.window.getComputedStyle(ea),
//             fontFamily =     jsStyle.getPropertyValue("font-family"),
//             fontSize =       parseInt(jsStyle.getPropertyValue("font-size").slice(0, -2)),
//             fontWeight =     jsStyle.getPropertyValue("font-weight"),
//             fontStyle =      jsStyle.getPropertyValue("font-style"),
//             textDecoration = jsStyle.getPropertyValue("text-decoration");
//         // note: when running the tests on Firefox "fontWeight" is differently
//         // reported than on Chrome
//         if (fontWeight == "400") fontWeight = "normal";
//         if (fontWeight == "700") fontWeight = "bold";
//         if (textDecoration == "") textDecoration = "none";
//         return { fontFamily, fontSize, fontWeight, fontStyle, textDecoration };
//       });
//   
//       let strings = Array.from(chunks).map(ea => ea.textContent);
//   
//       expect(printStyleNormalized(styles[0])).equals(printStyleNormalized(obj.dissoc(defaultStyle,                                 ["fontColor", "fixedCharacterSpacing"])));
//       expect(printStyleNormalized(styles[1])).equals(printStyleNormalized(obj.dissoc({...defaultStyle, ...style_a},                ["fontColor", "fixedCharacterSpacing"])));
//       expect(printStyleNormalized(styles[2])).equals(printStyleNormalized(obj.dissoc({...defaultStyle, ...style_a, ...style_b},    ["fontColor", "fixedCharacterSpacing"])));
//       expect(printStyleNormalized(styles[3])).equals(printStyleNormalized(obj.dissoc({...defaultStyle, ...style_b},                ["fontColor", "fixedCharacterSpacing"])));
//       expect(printStyleNormalized(styles[4])).equals(printStyleNormalized(obj.dissoc(defaultStyle,                                 ["fontColor", "fixedCharacterSpacing"])));
//   
//       expect(strings).equals(["h", "e", "l", "l", "o"]);
//     });
// 
//     it("renders css classes", async () => {
//       sut.addTextAttribute(TextAttribute.create({textStyleClasses: ["class1", "class2"]}, 0, 1, 0, 2));
//       await sut.whenRendered();
//  
//       let chunks = getRenderedTextNodes(sut)[0].childNodes;
//       expect(chunks[1].className).equals("class1 class2");
//     });
// 
//     it("links", async () => {
//       sut.addTextAttribute({link: "http://foo"}, Range.create(0, 0, 0, 5));
//       await sut.whenRendered();
//       let chunks = getRenderedTextNodes(sut)[0].childNodes;
//       chunks[0].tagName
//       expect(obj.select(chunks[0], ["tagName", "href", "target"])).deep.equals({tagName:"A", href: "http://foo/", target: "_blank"});
//     });
// 
//   });
// 
//   describe("visible line detection", () => {
// 
//     it("determines last and first full visible line based on padding and scroll", () => {
//       var {width: w, height: h} = fontMetric;
//       Object.assign(sut, {
//         textString: "111111\n222222\n333333\n444444\n555555",
//         padding, borderWidth: 0, fill: Color.lightGray,
//         lineWrapping: false, clipMode: "auto",
//         extent: pt(4*w+padding.left() + padding.right(), 3*h+padding.top()+padding.bottom())
//       });
// 
//       var l = sut.textLayout;
//       sut.render(sut.env.renderer);
//       expect(l.firstFullVisibleLine(sut)).equals(0);
//       expect(l.lastFullVisibleLine(sut)).equals(2);
// 
//       sut.scroll = sut.scroll.addXY(0, padding.top()+h);
//       sut.render(sut.env.renderer);
// 
//       expect(l.firstFullVisibleLine(sut)).equals(1);
//       expect(l.lastFullVisibleLine(sut)).equals(3);
//     });
// 
//   });

});
