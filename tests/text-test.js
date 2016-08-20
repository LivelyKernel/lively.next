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

function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
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


describe("text selection", () => {

  it("selection / line string", () => {
    var t = text("hello\n world", {});
    
    t.selection = range(1,1,1,1);
    expect(t.selectionOrLineString()).equals(" world");
    t.selection = range(1,1,1,3);
    expect(t.selectionOrLineString()).equals("wo");
  });

//   xit("uninitialized", () => {
//     var t = text("hello\n world", {});
//     expect(t.selection).containSubset({start: {row: 0, column: 0}, end: {row: 0, column: 0}})
//   });

});


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


describe("rendered text", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  inBrowser("only renders visible part of scrolled text", async () => {
    var lineHeight = sut.renderer.chunks[0].height;
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
    sut.selection = range(0,0,0,4);
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

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");
    env.eventDispatcher.simulateDOMEvents({target: sut, type: "click", position: clickPos});

    var clickIndex = sut.document.positionToIndex({row: 1, column: 3});
    expect(clickIndex).equals(8);
    expect(sut.selection).stringEquals("Selection(1/3 -> 1/3)");
  });

  it("drag sets selection", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        {width: charW, height: charH} = fontMetric;

    var dragStartPos =    pt(charW-2, charH-2),
        dragOvershotPos = pt(3*charW+10, charH*2+10),
        dragEndPos =      pt(3*charW+2, charH*2-charH/2);

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", target: sut, position: dragStartPos},
      {type: "pointermove", target: sut, position: dragOvershotPos}, // simulate overshoot
      {type: "pointermove", target: sut, position: dragEndPos},
      {type: "pointerup", target: sut, position: dragEndPos}
    );

    var dragEndIndex = sut.document.positionToIndex({row: 1, column: 1});
    expect(dragEndIndex).equals(6);
    expect(sut.selection).stringEquals("Selection(0/0 -> 1/1)");
  });

});
