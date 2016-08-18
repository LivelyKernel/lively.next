/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv, World } from "../index.js";
import { string, arr } from "lively.lang";
import { Text2 } from "../text2/morph.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

// FIXME! FontMetric should work in nodejs with jsdom as well!!!
var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

function text(string, props) {
  return new Text2({
    textString: string,
    fontFamily: "Arial",
    fontSize: 10,
    extent: pt(100,100),
    fontMetric: fontMetricForTest,
    ...props
  });
}

var env;

var fontMetricForTest = {
  height: 10, width: 10,
  sizeForStr(fontFamily, fontSize, text) {
    // ea char 10*10
    var lines = string.lines(text),
        maxCols = arr.max(lines, line => line.length).length;
    return {width: maxCols*this.width, height: lines.length*this.height}
  },
  sizeFor(fontFamily, fontSize, text) {
    return {width: this.width, height: this.height}
  }
}

describe("text", () => {

  describe("fit", () => {

    it("computes size on construction", () => {
      var t = text("hello", {fixedWidth: false, fixedHeight: false}),
          {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: false});
      expect(height).equals(10);
      expect(width).equals(5*10);
    });

    it("computes only width", () => {
      var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: true});
      expect(height).equals(100);
      expect(width).equals(5*10);
    });

    it("computes only height", () => {
      var {extent: {x: width, y: height}} = text("hello", {fixedWidth: true, fixedHeight: false});
      expect(height).equals(10);
      expect(width).equals(100);
    });

    it("leaves extent as is with fixed sizing", () => {
      var {extent} = text("hello", {fixedWidth: true, fixedHeight: true});
      expect(extent).equals(pt(100,100));
    });

  });

  describe("compute pixel positions", () => {

    it("text pos -> pixel pos", () => {
      var t = text("hello\n world", {});
      expect(t.renderer.pixelPositionFor(t, {row: 0, column: 0})).equals(pt(0,0));
      expect(t.renderer.pixelPositionFor(t, {row: 1, column: 0})).equals(pt(0,10));
      expect(t.renderer.pixelPositionFor(t, {row: 1, column: 1})).equals(pt(10,10));
    });

    it("text index -> pixel pos", () => {
      var t = text("hello\n world", {});
      expect(t.renderer.pixelPositionForIndex(t, 0)).equals(pt(0,0));
      expect(t.renderer.pixelPositionForIndex(t, 6)).equals(pt(0,10));
      expect(t.renderer.pixelPositionForIndex(t, 7)).equals(pt(10,10));
    });

  });

  describe("compute text positions", () => {

    it("pixel pos -> text pos", () => {
      var t = text("hello\n world", {});
      expect(t.renderer.textPositionFor(t, pt(0,0), {row: 0, column: 0}));
      expect(t.renderer.textPositionFor(t, pt(5,7), {row: 0, column: 0}));
      expect(t.renderer.textPositionFor(t, pt(15,17), {row: 1, column: 1}));
    });

  });

  xdescribe("selection", () => {

    it("uninitialized", () => {
      var t = text("hello\n world", {});
      expect(t.selection).containSubset({start: {row: 0, column: 0}, end: {row: 0, column: 0}})
    });

  });

});


var world, text;
function createDummyWorld() {
  world = new World({name: "world", extent: pt(300,300), submorphs: [{
    name: "text",
    type: Text2,
    position: pt(10.10),
    fill: Color.gray.lighter(2),
    textString: "text\nfor tests"
  }]})
  text = world.get("text");
  return world;
}

describe("rendered text", () => {

  beforeEach(async () => {
    env = new MorphicEnv(await createDOMEnvironment());
    env.domEnv.document.body.style = "margin: 0";
    MorphicEnv.pushDefault(env);
    await env.setWorld(createDummyWorld());
  });

  afterEach(() =>
    MorphicEnv.popDefault().uninstall()
    );

  describe("clipped", () => {

    it("only renders visible part of scrolled text", async () => {
      var lineHeight = text.renderer.lines[0].height;
      Object.assign(text, {
        clipMode: "auto",
        extent: pt(100,2*lineHeight), position: pt(0,0),
        textString: [0,1,2,3,4,5,6,7,8,9].join("\n"),
        scroll: pt(0, lineHeight*2-1)
      });

      await text.whenRendered();

      var node = env.renderer.getNodeForMorph(text),
          b = node.querySelector(".text-layer").getBoundingClientRect(),
          textBounds = new Rectangle(b.left, b.top, b.width, b.height);

      expect(textBounds.top()).equals(-2*lineHeight+1, "text layer not scrolled");
      expect(textBounds.height).equals(lineHeight*10, "text layer does not have size of all lines");
      expect(node.querySelector(".text-layer").textContent).equals("123", "text  layer renders more than necessary");
    });

  });
});

// xdescribe("rendered text", () => {

//   var world, text;
//   function createDummyWorld() {
//     world = new World({name: "world", extent: pt(300,300), submorphs: [
//       {name: "a text", type: "text", extent: pt(50,50), position: pt(200,200), fill: Color.white, textString: "text"}
//     ]})
//     text = world.get("a text");
//     return world;
//   }

//   beforeEach(async () => (env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()))).setWorld(createDummyWorld()));
//   afterEach(() =>  MorphicEnv.popDefault().uninstall());


//   describe("rendering", () => {

//     it("scrolls", () => {

//     });

//   });


//   describe("input events", () => {

//     it("text entry via keydown", async () => {
//       expect(text).property("textString").equals("text");
//       env.eventDispatcher.simulateDOMEvents({target: text, type: "focus" });
//       await text.whenRendered();
//       env.eventDispatcher.simulateDOMEvents(
//         {target: text, type: "keydown", key: 'l'},
//         {target: text, type: "keydown", key: 'o'},
//         {target: text, type: "keydown", key: 'l'},
//         {target: text, type: "keydown", key: 'Enter'}
//       );
//       expect(text).property("textString").equals("lol\ntext");
//     });

//     it("backspace", async () => {
//       expect(text).property("textString").equals("text");
//       env.eventDispatcher.simulateDOMEvents({target: text, type: "focus" });
//       await text.whenRendered();
//       env.eventDispatcher.simulateDOMEvents(
//         {target: text, type: "keydown", key: 'l'},
//         {target: text, type: "keydown", key: 'o'},
//         {target: text, type: "keydown", key: 'l'},
//         {target: text, type: "keydown", key: 'w'},
//         {target: text, type: "keydown", key: 'u'},
//         {target: text, type: "keydown", key: 't'}
//       );
//       expect(text).property("textString").equals("lolwuttext");
//       env.eventDispatcher.simulateDOMEvents(
//         {target: text, type: "keydown", keyCode: 8},
//         {target: text, type: "keydown", keyCode: 8},
//         {target: text, type: "keydown", keyCode: 8},
//         {target: text, type: "keydown", key: ' '}
//       );
//       expect(text).property("textString").equals("lol text");
//     });

//     it("entry clears selection", async () => {
//       expect(text).property("textString").equals("text");
//       env.eventDispatcher.simulateDOMEvents({target: text, type: "focus" });
//       await text.whenRendered();
//       text.selection.range = { start: 0, end: 4 };
//       env.eventDispatcher.simulateDOMEvents(
//         {target: text, type: "keydown", key: 'w'},
//         {target: text, type: "keydown", key: 'o'},
//         {target: text, type: "keydown", key: 'w'}
//       );
//       expect(text).property("textString").equals("wow");
//     });

//     it("click sets cursor", () => {
//       var clickPos = pt(215, 200),
//           { fontFamily, fontSize, textString } = text;
//       expect(text).property("selection").property("range").deep.equals({ start: 0, end: 0 });
//       env.eventDispatcher.simulateDOMEvents(
//         {target: text, type: "click", position: clickPos }
//       );
//       var clickIndex = env.fontMetric.indexFromPoint(fontFamily, fontSize, textString, text.localize(clickPos));
//       expect(clickIndex).not.equal(0);
//       expect(text).property("selection").property("range").deep.equals({ start: clickIndex, end: clickIndex });
//     });

//     it("drag sets selection", () => {
//         var dragEndPos = pt(215, 200),
//           { fontFamily, fontSize, textString } = text;
//       expect(text).property("selection").property("range").deep.equals({ start: 0, end: 0 });
//       env.eventDispatcher.simulateDOMEvents(
//         {target: text, type: "pointerdown", position: pt(200, 200)},
//         {target: text, type: "pointermove", position: pt(220, 200)}, // simulate overshoot
//         {target: text, type: "pointermove", position: dragEndPos},
//         {target: text, type: "pointerup", position: dragEndPos}
//       );
//       var dragEndIndex = env.fontMetric.indexFromPoint(fontFamily, fontSize, textString, text.localize(dragEndPos));
//       expect(dragEndIndex).not.equal(0);
//       expect(text).property("selection").property("range").deep.equals({ start: 0, end: dragEndIndex });
//     });
//   });

// });
