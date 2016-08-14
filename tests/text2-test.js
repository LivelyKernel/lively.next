/*global System, declare, it, xit, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
// import { MorphicEnv } from "../index.js";
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
  sizeForStr(fontFamily, fontSize, text) {
    // ea char 10*10
    var lines = string.lines(text),
        maxCols = arr.max(lines, line => line.length).length;
    return {width: maxCols*10, height: lines.length*10}
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

  describe("document pos -> pixel pos", () => {
    
  })
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




