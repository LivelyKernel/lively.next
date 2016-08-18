/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";
import { Text, World } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { arr, string } from "lively.lang";

// FIXME! FontMetric should work in nodejs with jsdom as well!!!
var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

var describeInBrowser = System.get("@system-env").browser ? describe :
  (title, fn) => { console.warn(`Suite ${title} is currently only supported in a browser`); return xdescribe(title, fn); }

function text(string, props) {
  return new Text({
    name: "text",
    textString: string,
    fontFamily: "Monaco, monospace",
    fontSize: 10,
    extent: pt(100,100),
    fontMetric,
    ...props
  });
}


var fontMetric = {
  height: 14, width: 6,
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


var world, sut;
function createDummyWorld() {
  world = new World({name: "world", extent: pt(300,300), submorphs: [
    text("text\nfor tests", {
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

describe("text layout", () => {

  describe("fit", () => {

    it("computes size on construction", () => {
      var t = text("hello", {fixedWidth: false, fixedHeight: false}),
          {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: false});
      expect(height).equals(fontMetric.height);
      expect(width).equals(5*fontMetric.width);
    });

    it("computes only width", () => {
      var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: true});
      expect(height).equals(100);
      expect(width).equals(5*fontMetric.width);
    });

    it("computes only height", () => {
      var {extent: {x: width, y: height}} = text("hello", {fixedWidth: true, fixedHeight: false});
      expect(height).equals(fontMetric.height);
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
      var {height:h, width:w} = fontMetric;
      expect(t.renderer.pixelPositionFor(t, {row: 0, column: 0}))    .equals(pt(0,   0));
      expect(t.renderer.pixelPositionFor(t, {row: 0, column: 5}))    .equals(pt(5*w, 0));
      expect(t.renderer.pixelPositionFor(t, {row: 1, column: 0}))    .equals(pt(0,   h));
      expect(t.renderer.pixelPositionFor(t, {row: 1, column: 1}))    .equals(pt(1*w, h));
      expect(t.renderer.pixelPositionFor(t, {row: 3, column: 2}))    .equals(pt(2*w, 2*h));
      expect(t.renderer.pixelPositionFor(t, {row: 1, column: 100}))  .equals(pt(7*w, h));
      expect(t.renderer.pixelPositionFor(t, {row: 100, column: 100})).equals(pt(5*w, 2*h));
    });

    it("text index -> pixel pos", () => {
      var t = text("hello\n lively\nworld", {});
      var {height:h, width:w} = fontMetric;
      expect(t.renderer.pixelPositionForIndex(t, 0)).equals(pt(0,0));
      expect(t.renderer.pixelPositionForIndex(t, 6)).equals(pt(0,h));
      expect(t.renderer.pixelPositionForIndex(t, 7)).equals(pt(w,h));
      expect(t.renderer.pixelPositionForIndex(t, 100)).equals(pt(5*w,2*h));
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


describe("rendered text", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  inBrowser("only renders visible part of scrolled text", async () => {
    var lineHeight = sut.renderer.lines[0].height;
    Object.assign(sut, {
      clipMode: "auto",
      extent: pt(100,2*lineHeight), position: pt(0,0),
      textString: [0,1,2,3,4,5,6,7,8,9].join("\n"),
      scroll: pt(0, lineHeight*2-1)
    });

    await sut.whenRendered();

    var node = env.renderer.getNodeForMorph(sut),
        b = node.querySelector(".text-layer").getBoundingClientRect(),
        textBounds = new Rectangle(b.left, b.top, b.width, b.height);

    expect(textBounds.top()).equals(-2*lineHeight+1, "text layer not scrolled");
    expect(textBounds.height).equals(lineHeight*10, "text layer does not have size of all lines");
    expect(node.querySelector(".text-layer").textContent).equals("123", "text  layer renders more than necessary");
  });

});


describe("text key events", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it("text entry via keydown", async () => {
    sut.focus();
    env.eventDispatcher.simulateDOMEvents(
      {type: "keydown", key: 'l'},
      {type: "keydown", key: 'o'},
      {type: "keydown", key: 'l'},
      {type: "keydown", key: 'Enter'});
    expect(sut).property("textString").equals("lol\ntext\nfor tests");
  });

  it("backspace", async () => {
    sut.focus();
    env.eventDispatcher.simulateDOMEvents(
      {type: "keydown", key: 'l'},
      {type: "keydown", key: 'o'},
      {type: "keydown", key: 'l'},
      {type: "keydown", key: 'w'},
      {type: "keydown", key: 'u'},
      {type: "keydown", key: 't'});

    expect(sut).property("textString").equals("lolwuttext\nfor tests");
    env.eventDispatcher.simulateDOMEvents(
      {type: "keydown", keyCode: 8},
      {type: "keydown", keyCode: 8},
      {type: "keydown", keyCode: 8},
      {type: "keydown", key: ' '});

    expect(sut).property("textString").equals("lol text\nfor tests");
  });

  it("entry clears selection", async () => {
    sut.focus();
    sut.selection.range = {start: 0, end: 4};
    env.eventDispatcher.simulateDOMEvents(
      {type: "keydown", key: 'w'},
      {type: "keydown", key: 'o'},
      {type: "keydown", key: 'w'});
    expect(sut).property("textString").equals("wow\nfor tests");
  });

});


describe("text mouse events", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it("click sets cursor", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*3+2, y+fontMetric.height*2 - 5); // second line

    expect(sut.selection.range).deep.equals({start: 0, end: 0});
    env.eventDispatcher.simulateDOMEvents({target: sut, type: "click", position: clickPos});

    var clickIndex = sut.document.positionToIndex({row: 1, column: 3});
    expect(clickIndex).not.equal(0);
    expect(sut.selection.range).deep.equals({start: clickIndex, end: clickIndex});
  });

  it("drag sets selection", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        {width: charW, height: charH} = fontMetric;

// destroyMorphicEnv()
// createMorphicEnv()

    var dragStartPos =    pt(charW-2, charH-2),
        dragOvershotPos = pt(3*charW+10, charH*2+10),
        dragEndPos =      pt(3*charW+2, charH*2-charH/2);

    expect(sut.selection.range).deep.equals({start: 0, end: 0});

    env.eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", target: sut, position: dragStartPos},
      {type: "pointermove", target: sut, position: dragOvershotPos}, // simulate overshoot
      {type: "pointermove", target: sut, position: dragEndPos},
      {type: "pointerup", target: sut, position: dragEndPos}
    );

    var dragEndIndex = sut.document.positionToIndex({row: 1, column: 1});
    expect(dragEndIndex).not.equal(0);
    expect(sut.selection.range).deep.equals({start: 0, end: dragEndIndex});
  });

});
