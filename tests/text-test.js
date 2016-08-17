/*global System, declare, it, xit, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";
import { Text, World } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { arr, string } from "lively.lang";

// FIXME! FontMetric should work in nodejs with jsdom as well!!!
var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

function text(string, props) {
  return new Text({
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
      var t = text("hello\n lively\nworld", {});
      expect(t.renderer.pixelPositionFor(t, {row: 0, column: 0})).equals(pt(0,0));
      expect(t.renderer.pixelPositionFor(t, {row: 0, column: 5})).equals(pt(50,0));
      expect(t.renderer.pixelPositionFor(t, {row: 1, column: 0})).equals(pt(0,10));
      expect(t.renderer.pixelPositionFor(t, {row: 1, column: 1})).equals(pt(10,10));
      expect(t.renderer.pixelPositionFor(t, {row: 3, column: 2})).equals(pt(20,20));
      expect(t.renderer.pixelPositionFor(t, {row: 1, column: 100})).equals(pt(70,10));
      expect(t.renderer.pixelPositionFor(t, {row: 100, column: 100})).equals(pt(50,20));
    });

    it("text index -> pixel pos", () => {
      var t = text("hello\n lively\nworld", {});
      expect(t.renderer.pixelPositionForIndex(t, 0)).equals(pt(0,0));
      expect(t.renderer.pixelPositionForIndex(t, 6)).equals(pt(0,10));
      expect(t.renderer.pixelPositionForIndex(t, 7)).equals(pt(10,10));
      expect(t.renderer.pixelPositionForIndex(t, 100)).equals(pt(50,20));
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

  describe("selection", () => {

    xit("uninitialized", () => {
      var t = text("hello\n world", {});
      expect(t.selection).containSubset({start: {row: 0, column: 0}, end: {row: 0, column: 0}})
    });

  });

});


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var world, text;
function createDummyWorld() {
  world = new World({name: "world", extent: pt(300,300), submorphs: [{
    name: "text",
    type: Text,
    position: pt(10.10),
    fill: Color.gray.lighter(2),
    textString: "text\nfor tests"
  }]})
  text = world.get("text");
  return world;
}

describe("rendered text", function () {

  if (!inBrowser) this.timeout(5000);

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



  describe("input events", () => {

    it("text entry via keydown", async () => {
      text.focus();
      env.eventDispatcher.simulateDOMEvents(
        {type: "keydown", key: 'l'},
        {type: "keydown", key: 'o'},
        {type: "keydown", key: 'l'},
        {type: "keydown", key: 'Enter'});
      expect(text).property("textString").equals("lol\ntext\nfor tests");
    });

    it("backspace", async () => {
      text.focus();
      env.eventDispatcher.simulateDOMEvents(
        {type: "keydown", key: 'l'},
        {type: "keydown", key: 'o'},
        {type: "keydown", key: 'l'},
        {type: "keydown", key: 'w'},
        {type: "keydown", key: 'u'},
        {type: "keydown", key: 't'});

      expect(text).property("textString").equals("lolwuttext\nfor tests");
      env.eventDispatcher.simulateDOMEvents(
        {type: "keydown", keyCode: 8},
        {type: "keydown", keyCode: 8},
        {type: "keydown", keyCode: 8},
        {type: "keydown", key: ' '});

      expect(text).property("textString").equals("lol text\nfor tests");
    });

    it("entry clears selection", async () => {
      text.focus();
      text.selection.range = {start: 0, end: 4};
      env.eventDispatcher.simulateDOMEvents(
        {type: "keydown", key: 'w'},
        {type: "keydown", key: 'o'},
        {type: "keydown", key: 'w'});

      expect(text).property("textString").equals("wow\nfor tests");
    });

    it("click sets cursor", () => {
      // text.globalBounds() // => {x: 10.1, y: 0, width: 42.75, height: 28}

      var clickPos = pt(10+15, 0),
          {fontFamily, fontSize, textString} = text;
      expect(text).deep.property("selection.range").deep.equals({start: 0, end: 0});
      env.eventDispatcher.simulateDOMEvents({target: text, type: "click", position: clickPos});

      var clickIndex = env.fontMetric.indexFromPoint(fontFamily, fontSize, textString, text.localize(clickPos));
      expect(clickIndex).not.equal(0);
      expect(text).deep.property("selection.range").deep.equals({start: clickIndex, end: clickIndex});
    });

    it("drag sets selection", () => {
      var dragStartPos = pt(10, 10),
          dragOvershotPos = pt(10+20, 10),
          dragEndPos = pt(10+15, 10),
          {fontFamily, fontSize, textString} = text;
      expect(text).deep.property("selection.range").deep.equals({start: 0, end: 0});
      env.eventDispatcher.simulateDOMEvents(
        {type: "pointerdown", target: text, position: dragStartPos},
        {type: "pointermove", target: text, position: dragOvershotPos}, // simulate overshoot
        {type: "pointermove", target: text, position: dragEndPos},
        {type: "pointerup", target: text, position: dragEndPos}
      );
      var dragEndIndex = env.fontMetric.indexFromPoint(fontFamily, fontSize, textString, text.localize(dragEndPos));
      expect(dragEndIndex).not.equal(0);
      expect(text).deep.property("selection.range").deep.equals({start: 0, end: dragEndIndex});
    });
  });

});
