/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";
import { Text, World } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { dummyFontMetric as fontMetric } from "./test-helpers.js";

// FIXME! FontMetric should work in nodejs with jsdom as well!!!
var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

var describeInBrowser = System.get("@system-env").browser ? describe :
  (title, fn) => { console.warn(`Suite ${title} is currently only supported in a browser`); return xdescribe(title, fn); }

const padding = 20;

function text(string, props) {
  return new Text({
    name: "text",
    textString: string,
    fontFamily: "Monaco, monosonpace",
    fontSize: 10,
    extent: pt(100,100),
    padding,
    fontMetric,
    ...props
  });
}

function range(startRow, startCol, endRow, endCol) {
  return {start: {row: startRow, column: startCol}, end: {row: endRow, column: endCol}}
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

describe("text operations", () => {

  it("selection / line string", () => {
    var t = text("hello\n world", {});
    t.selection = range(0,2,0,4);
    t.withSelectedLinesDo((line, range) => t.insertText(" ", range.start));
    expect(t.textString).equals(" hello\n world");
    expect(t.selection.text).equals("ll");
  });

});

describe("anchors", () => {

  it("adds anchor by id", () => {
    var t = text("hello\nworld", {}),
        a = t.addAnchor({id: "test", column: 1, row: 1});
    expect(t.anchors).to.have.length(1);
    expect(t.addAnchor({id: "test"})).equals(a);
    expect(t.anchors).to.have.length(1);
    t.removeAnchor(a);
    expect(t.anchors).to.have.length(0);
    t.addAnchor({id: "test"})
    expect(t.anchors).to.have.length(1);
    t.removeAnchor("test");
    expect(t.anchors).to.have.length(0);
  });

  it("insert moves anchors around", () => {
    var t = text("hello\nworld", {}),
        a = t.addAnchor({id: "test", column: 1, row: 1});
    t.insertText("abc", {row: 1, column: 0});
    expect(a.position).deep.equals({row: 1, column: 4}, "1 before anchor");
    t.insertText("xy", {row: 1, column: 4});
    expect(a.position).deep.equals({row: 1, column: 6}, "2 directly before anchor");
    t.insertText("123", {row: 1, column: 7});
    expect(a.position).deep.equals({row: 1, column: 6}, "3 after anchor");
    t.insertText("123", {row: 0, column: 0});
    expect(a.position).deep.equals({row: 1, column: 6}, "4 line before anchor");
    t.insertText("123\n456", {row: 0, column: 0});
    expect(a.position).deep.equals({row: 2, column: 6}, "5 new line before anchor");
  });

  it("delete moves anchors around", () => {
    var t = text("hello\nworld", {}),
        a = t.addAnchor({id: "test", column: 1, row: 1});
    t.deleteText(range(1,0,1,1));
    expect(a.position).deep.equals({row: 1, column: 0}, "1 before anchor");
    t.deleteText(range(0,2,1,0));
    expect(a.position).deep.equals({row: 0, column: 2}, "2 line before");
    t.deleteText(range(0,2,0,5));
    expect(a.position).deep.equals({row: 0, column: 2}, "3 after anchor");
    t.deleteText(range(0,1,0,5));
    expect(a.position).deep.equals({row: 0, column: 1}, "4 crossing anchor");
  });

});


describe("rendered text", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  inBrowser("only renders visible part of scrolled text", async () => {
    var lineHeight = sut.renderer.chunks[0].height;
    Object.assign(sut, {
      clipMode: "auto",
      extent: pt(100,2*lineHeight), position: pt(0,0),
      textString: [0,1,2,3,4,5,6,7,8,9].join("\n"),
      scroll: pt(0, lineHeight*2+padding-1)
    });

    await sut.whenRendered();

    var node = env.renderer.getNodeForMorph(sut),
        b = node.querySelector(".text-layer").getBoundingClientRect(),
        textBounds = new Rectangle(b.left, b.top, b.width, b.height);

    expect(textBounds.top()).equals(-2*lineHeight-padding+1, "text layer not scrolled");
    expect(textBounds.height).equals(lineHeight*10 + 2*padding, "text layer does not have size of all lines");
    expect(node.querySelector(".text-layer").textContent).equals("123", "text  layer renders more than necessary");
  });

  it("can resize on content change", async () => {
    sut.textString = "Hello hello";
    await sut.whenRendered();
    expect(sut.width).equals(11*fontMetric.width + 2*padding);
    sut.textString = "foo";
    await sut.whenRendered();
    expect(sut.width).equals(3*fontMetric.width + 2*padding);
  });

});


describe("scroll", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it("cursor into view", () => {
    var lineHeight = fontMetric.height;
    Object.assign(sut, {
      clipMode: "auto",
      extent: pt(100,2*lineHeight+2*padding),
      textString: [0,1,2,3,4,5,6,7,8,9].join("\n"),
    });
    expect(sut.scrollExtent).equals(pt(100, sut.document.lines.length * lineHeight + 2*padding, "scrollExtent not as expected"));
    sut.cursorPosition = { column: 0, row: 3 }
    sut.scrollCursorIntoView();
    expect(sut.scroll).equals(pt(0,lineHeight*2-padding));
    sut.cursorPosition = {column: 0, row: 0};
    sut.scrollCursorIntoView();
    expect(sut.scroll).equals(pt(0,0))
  });

});

describe("text key events", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it("text entry via keydown", async () => {
    sut.focus();
    await env.eventDispatcher.simulateDOMEvents(
      {type: "input", data: 'l'},
      {type: "input", data: 'o'},
      {type: "input", data: 'l'},
      {type: "keydown", key: "Enter"});
    expect(sut).property("textString").equals("lol\ntext\nfor tests");
  });

  it("backspace", async () => {
    sut.focus();
    env.eventDispatcher.simulateDOMEvents(
      {type: "input", data: 'l'},
      {type: "input", data: 'o'},
      {type: "input", data: 'l'},
      {type: "input", data: 'w'},
      {type: "input", data: 'u'},
      {type: "input", data: 't'});

    expect(sut).property("textString").equals("lolwuttext\nfor tests");
    env.eventDispatcher.simulateDOMEvents(
      {type: "keydown", key: "Backspace"},
      {type: "keydown", key: "Backspace"},
      {type: "keydown", key: "Backspace"},
      {type: "input", data: ' '});

    expect(sut).property("textString").equals("lol text\nfor tests");
  });

  it("entry clears selection", async () => {
    sut.focus();
    sut.selection = range(0,0,0,4);
    env.eventDispatcher.simulateDOMEvents(
      {type: "input", data: 'w'},
      {type: "input", data: 'o'},
      {type: "input", data: 'w'});
    expect(sut).property("textString").equals("wow\nfor tests");
  });

});


describe("text mouse events", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it("click sets cursor", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*3 + 2 + padding, y+fontMetric.height*2 - 5 + padding); // second line

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");
    env.eventDispatcher.simulateDOMEvents({target: sut, type: "click", position: clickPos});

    var clickIndex = sut.document.positionToIndex({row: 1, column: 3});
    expect(clickIndex).equals(8);
    expect(sut.selection).stringEquals("Selection(1/3 -> 1/3)");
  });

  it("double-click selects word", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padding, y+fontMetric.height*2 - 5 + padding); // second line, second char

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).stringEquals("Selection(1/0 -> 1/3)");
  });

  it("triple-click selects line", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padding, y+fontMetric.height*2 - 5 + padding); // second line, second char

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).stringEquals("Selection(1/0 -> 1/9)");
  });

  it("4-click sets cursor", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padding, y+fontMetric.height*2 - 5 + padding); // second line, second char

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).stringEquals("Selection(1/2 -> 1/2)");
  });

  it("5-click selects word", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padding, y+fontMetric.height*2 - 5 + padding); // second line, second char

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).stringEquals("Selection(1/0 -> 1/3)");
  });

  it("6-click selects line", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padding, y+fontMetric.height*2 - 5 + padding); // second line, second char

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).stringEquals("Selection(1/0 -> 1/9)");
  });

  it("drag sets selection", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        {width: charW, height: charH} = fontMetric;

    var dragStartPos =    pt(charW+padding-2, charH+padding-2),
        dragOvershotPos = pt(3*charW+padding+10, charH*2+padding+10),
        dragEndPos =      pt(3*charW+padding+2, charH*2+padding-charH/2);

    expect(sut.selection).stringEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", target: sut, position: dragStartPos},
      {type: "pointermove", target: sut, position: dragOvershotPos}, // simulate overshoot
      {type: "pointermove", target: sut, position: dragEndPos},
      {type: "pointerup", target: sut, position: dragEndPos}
    );

    var dragEndIndex = sut.document.positionToIndex({row: 1, column: 1});
    expect(dragEndIndex).equals(6);
    expect(sut.selection).stringEquals("Selection(0/0 -> 1/2)");
  });

});

describe("saved marks", () => {

  var t; beforeEach(() => t = text("hello\n world"));

  it("activates mark to select", () => {
    t.cursorPosition = t.activeMark = {row: 0, column: 1};
    t.execCommand("go right"); t.execCommand("go right");
    expect(t.selection).stringEquals("Selection(0/1 -> 0/3)");
  });

  it("reverse selection with mark", () => {
    t.saveMark({row: 0, column: 1});
    t.cursorPosition = {row: 0, column: 4};
    t.execCommand("reverse selection");
    expect(t.selection).stringEquals("Selection(0/4 -> 0/1)");
  });

  it("activate mark by setting mark", () => {
    t.execCommand("go right"); t.execCommand("toggle active mark");
    t.execCommand("go right"); t.execCommand("go right");
    expect(t.activeMarkPosition).deep.equals({row: 0, column: 1})
    expect(t.selection).stringEquals("Selection(0/1 -> 0/3)");
  });

  it("toggle active mark deactivates selection", () => {
    t.selection = range(0,1,0,4);
    t.execCommand("toggle active mark");
    expect(t.activeMark).equals(null);
    expect(t.selection).stringEquals("Selection(0/4 -> 0/4)");
    expect(t.lastSavedMark.position).deep.equals({row: 0, column: 1});
  });

});

describe("text movement and selection commands", () => {

  
  describe("paragraphs", () => {

    var t;
    beforeEach(() => t = text("\n\naaa\n\nbbbb\n\n\n\nccc\nccc\n\n\n"));
    // 0 = empty
    // 1 = empty
    // 2 = aaa
    // 3 = empty
    // 4 = bbbb
    // 5 = empty
    // 6 = empty
    // 7 = empty
    // 8 = ccc
    // 9 = ccc
    // 10-12 = empty

    it("moves to paragraph borders", () => {
      t.cursorPosition = {row: 0, column: 0};
      t.execCommand("goto paragraph above");
      expect(t.selection).stringEquals("Selection(0/0 -> 0/0)");
      t.execCommand("goto paragraph below");
      expect(t.selection).stringEquals("Selection(3/0 -> 3/0)");
    });

  });

});