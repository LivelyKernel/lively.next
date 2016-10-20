/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";
import { World } from "../index.js";
import { Text } from "../text/morph.js";
import { expect, chai } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { dummyFontMetric as fontMetric, expectSelection } from "./test-helpers.js";
import { TextAttribute } from "../text/attribute.js";
import { Range } from "../text/range.js";

expectSelection(chai);

var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

const defaultStyle = {
  fontFamily: "Monaco, monospace",
  fontSize: 10,
  fontWeight: "normal",
  fontColor: "black",
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


describe("text attributes", () => {

  beforeEach(() => sut = text("hello", {}))

  it("begins with default style range", () => {
    var textAttributes = sut.document.textAttributesByLine[0],
        computedDefaultStyle = {...defaultStyle, link: undefined, nativeCursor: "auto", textStyleClasses: undefined};
    expect(textAttributes).property("length").equals(1);
    expect(textAttributes[0].range).stringEquals("Range(0/-1 -> 0/5)");
    expect(textAttributes[0].data).deep.equals(computedDefaultStyle);
    expect(sut.defaultTextStyle).deep.equals(computedDefaultStyle);
  });

  it("default style range always reaches to end", () => {
    sut.insertText("foo", {row: 2, column: 1});
    expect(sut.defaultTextStyleAttribute.end).deep.equals({row: 2, column: 4});
  });

  it("addTextAttribute merges style ranges", () => {
    var style_a = { fontSize: 12, fontStyle: "italic" },
        style_b = { fontSize: 14, fontWeight: "bold" },
        a = TextAttribute.create(style_a, 0, 1, 0, 3),
        b = TextAttribute.create(style_b, 0, 2, 0, 4),
        textAttributes;

    var computedDefaultStyle = {...defaultStyle, link: undefined, nativeCursor: "auto", textStyleClasses: undefined};
    sut.addTextAttribute(a);
    var textAttributes = sut.document.textAttributesByLine[0];

    expect(textAttributes).property("length").equals(2);
    expect(textAttributes[0].range).stringEquals("Range(0/-1 -> 0/5)");
    expect(textAttributes[1].range).stringEquals("Range(0/1 -> 0/3)");
    expect(textAttributes[0].data).deep.equals(computedDefaultStyle);
    expect(textAttributes[1].data).deep.equals(style_a);

    sut.addTextAttribute(b);
    textAttributes = sut.document.textAttributesByLine[0];

    expect(textAttributes).property("length").equals(3);
    expect(textAttributes[0].range).stringEquals("Range(0/-1 -> 0/5)");
    expect(textAttributes[1].range).stringEquals("Range(0/1 -> 0/3)");
    expect(textAttributes[2].range).stringEquals("Range(0/2 -> 0/4)");
    expect(textAttributes[0].data).deep.equals(computedDefaultStyle);
    expect(textAttributes[1].data).deep.equals(style_a);
    expect(textAttributes[2].data).deep.equals(style_b);
  });


  it("attributes at position", () => {
    var t = text("abcdef", {padding: Rectangle.inset(0), borderWidth: 0}),
        attr = t.addTextAttribute({fontColor: "green"}, Range.create(0,0,0,6));
    expect(t.textAttributesAt(pt(3,3))[1]).equals(attr);
    expect(t.styleAt(pt(3,3))).containSubset({fontColor: "green"});
    expect(t.textAttributesAtScreenPos({row: 0, column: 1})[1]).equals(attr);
    expect(t.styleAtScreenPos({row: 0, column: 1})).containSubset({fontColor: "green"});
  });

  describe("text range styling", () => {

    it("creates text attributes", () => {
      sut.setStyleInRange({fontSize: 40}, range(0,1,0,3));
      expect(sut.textAttributes).to.have.length(2);
      expect(sut.textAttributes[0]).containSubset({...range(0,-1,0,5), data: {fontSize: 10}})
      expect(sut.textAttributes[1]).containSubset({...range(0,1,0,3), data: {fontSize: 40}})
    });

    it("resets text attributes in range", () => {
      sut.setStyleInRange({fontSize: 40}, range(0,1,0,3));
      sut.resetStyleInRange(range(0,1,0,2));
      expect(sut.textAttributes).to.have.length(2);
      expect(sut.textAttributes[0]).containSubset({...range(0,-1,0,5), data: {fontSize: 10}})
      expect(sut.textAttributes[1]).containSubset({...range(0,2,0,3), data: {fontSize: 40}})
    });

    it("style attributes are cleaned up / coalesced", () => {
      sut.setStyleInRange({fontWeight: "bold"}, range(0,1,0,3));
      sut.setStyleInRange({fontSize: 40}, range(0,2,0,5));

      sut.setStyleInRange({fontSize: 10}, range(0,2,0,5));
      var attrsOfLine = sut.document._textAttributesByLine[0];
      expect(attrsOfLine).to.have.length(2);
      expect(attrsOfLine[0]).containSubset({...range(0,-1,0,5), data: {fontWeight: "normal", fontSize: 10}});
      expect(attrsOfLine[1]).containSubset({...range(0,1,0,3), data: {fontWeight: "bold"}});
    });

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

  it("insertion stay behavior", () => {
    var t = text("hello\nworld", {}),
        a = t.addAnchor({id: "test", column: 1, row: 1, insertBehavior: "stay"});
    t.insertText("abc", {row: 1, column: 0});
    expect(a.position).deep.equals({row: 1, column: 4}, "1 before anchor");
    t.insertText("xy", {row: 1, column: 4});
    expect(a.position).deep.equals({row: 1, column: 4}, "2 directly before anchor");
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


describe("scroll", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it("cursor into view", () => {
    var lineHeight = fontMetric.height,
        padTop = sut.padding.top(),
        padBot = sut.padding.bottom();
    Object.assign(sut, {
      clipMode: "auto",
      borderWidth: 0,
      extent: pt(100,2*lineHeight),
      textString: [0,1,2,3,4,5,6,7,8,9].join("\n"),
    });
    expect(sut.scrollExtent).equals(pt(100, sut.document.lines.length * lineHeight + padTop+padBot, "scrollExtent not as expected"));
    sut.cursorPosition = { column: 0, row: 3 }
    sut.scrollCursorIntoView();
    expect(sut.scroll).equals(pt(0,2*lineHeight+padTop));
    sut.cursorPosition = {column: 0, row: 0};
    sut.scrollCursorIntoView();
    expect(sut.scroll).equals(pt(0,padTop))
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

  var padLeft, padRight, padTop, padBot;
  beforeEach(async () => {
    await createMorphicEnv();
    padLeft = sut.padding.left();
    padRight = sut.padding.right();
    padTop = sut.padding.top();
    padBot = sut.padding.bottom();
  });
  afterEach(() => destroyMorphicEnv());

  it("click sets cursor", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*3 + 2 + padLeft, y+fontMetric.height*2 - 5 + padTop); // second line

    expect(sut.selection).selectionEquals("Selection(0/0 -> 0/0)");
    env.eventDispatcher.simulateDOMEvents({target: sut, type: "click", position: clickPos});

    var clickIndex = sut.document.positionToIndex({row: 1, column: 3});
    expect(clickIndex).equals(8);
    expect(sut.selection).selectionEquals("Selection(1/3 -> 1/3)");
  });

  it("double-click selects word", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padLeft, y+fontMetric.height*2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).selectionEquals("Selection(1/0 -> 1/3)");
  });

  it("triple-click selects line", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padLeft, y+fontMetric.height*2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).selectionEquals("Selection(1/0 -> 1/9)");
  });

  it("4-click sets cursor", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padLeft, y+fontMetric.height*2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).selectionEquals("Selection(1/2 -> 1/2)");
  });

  it("5-click selects word", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padLeft, y+fontMetric.height*2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).selectionEquals("Selection(1/0 -> 1/3)");
  });

  it("6-click selects line", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        clickPos = pt(x+fontMetric.width*2 + 2 + padLeft, y+fontMetric.height*2 - 5 + padTop); // second line, second char

    expect(sut.selection).selectionEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos},
      {target: sut, type: "click", position: clickPos});

    expect(sut.selection).selectionEquals("Selection(1/0 -> 1/9)");
  });

  it("drag sets selection", () => {
    var {position: {x,y}, fontFamily, fontSize, textString} = sut,
        {width: charW, height: charH} = fontMetric;

    var dragStartPos =    pt(charW+padLeft-2, charH+padTop-2),
        dragOvershotPos = pt(3*charW+padLeft+10, charH*2+padTop+10),
        dragEndPos =      pt(3*charW+padLeft+2, charH*2+padTop-charH/2);

    expect(sut.selection).selectionEquals("Selection(0/0 -> 0/0)");

    env.eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", target: sut, position: dragStartPos},
      {type: "pointermove", target: sut, position: dragOvershotPos}, // simulate overshoot
      {type: "pointermove", target: sut, position: dragEndPos},
      {type: "pointerup", target: sut, position: dragEndPos}
    );

    var dragEndIndex = sut.document.positionToIndex({row: 1, column: 1});
    expect(dragEndIndex).equals(6);
    expect(sut.selection).selectionEquals("Selection(0/0 -> 1/2)");
  });

});

describe("saved marks", () => {

  var t; beforeEach(() => t = text("hello\n world"));

  it("activates mark to select", () => {
    t.cursorPosition = t.activeMark = {row: 0, column: 1};
    t.execCommand("go right"); t.execCommand("go right");
    expect(t.selection).selectionEquals("Selection(0/1 -> 0/3)");
  });

  it("reverse selection with mark", () => {
    t.saveMark({row: 0, column: 1});
    t.cursorPosition = {row: 0, column: 4};
    t.execCommand("reverse selection");
    expect(t.selection).selectionEquals("Selection(0/4 -> 0/1)");
  });

  it("activate mark by setting mark", () => {
    t.execCommand("go right"); t.execCommand("toggle active mark");
    t.execCommand("go right"); t.execCommand("go right");
    expect(t.activeMarkPosition).deep.equals({row: 0, column: 1})
    expect(t.selection).selectionEquals("Selection(0/1 -> 0/3)");
  });

  it("toggle active mark deactivates selection", () => {
    t.selection = range(0,1,0,4);
    t.execCommand("toggle active mark");
    expect(t.activeMark).equals(null);
    expect(t.selection).selectionEquals("Selection(0/4 -> 0/4)");
    expect(t.lastSavedMark.position).deep.equals({row: 0, column: 1});
  });

});

describe("clipboard buffer / kill ring", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  var t, browserExtension;
  beforeEach(async () => {
    await createMorphicEnv();
    t = text("a\nb\nc\n");
    browserExtension = lively.browserExtension;
    delete lively.browserExtension;
  });
  afterEach(() => {
    lively.browserExtension = browserExtension;
    return destroyMorphicEnv();
  })

  inBrowser("copy saves to clipboard buffer", async () => {
    t = text("a\nb\nc\n")
    t.selection = range(0,0,0,1);
    t.execCommand("manual clipboard copy");
    t.selection = range(1,0,1,1);
    t.execCommand("manual clipboard copy");
    t.selection = range(2,0,2,1);
    t.execCommand("manual clipboard copy");

    t.selection = range(3,0,3,0);
    await t.execCommand("manual clipboard paste");
    expect(t.selection.text).equals("c");
    await t.execCommand("manual clipboard paste", {killRingCycleBack: true});
    expect(t.selection.text).equals("b");
    await t.execCommand("manual clipboard paste", {killRingCycleBack: true});
    expect(t.selection.text).equals("a");
    await t.execCommand("manual clipboard paste");
    expect(t.selection.text).equals("a");

    t.selection = range(2,0,2,1);
    t.execCommand("manual clipboard copy");
    await t.execCommand("manual clipboard paste");
    expect(t.selection.text).equals("c");
  });

});

describe("text movement and selection commands", () => {

  it("selection / line string", () => {
    var t = text("hello\n world", {});
    t.selection = range(0,2,0,4);
    t.withSelectedLinesDo((line, range) => t.insertText(" ", range.start));
    expect(t.textString).equals(" hello\n world");
    expect(t.selection.text).equals("ll");
  });

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
      expect(t.selection).selectionEquals("Selection(0/0 -> 0/0)");
      t.execCommand("goto paragraph below");
      expect(t.selection).selectionEquals("Selection(3/0 -> 3/0)");
    });

  });

  it("get position above and below with line wrapping", () => {

    var {width: charWidth,height: charHeight} = fontMetric;
    var padding = Rectangle.inset(3);
    var t = text("a\ncdefg\n", {
      extent: pt(3*charWidth + padding.left() + padding.right(), 200),
      lineWrapping: true,
      clipMode: "hidden"
    });

    t.cursorPosition = {column: 5,row: 1};
    expect(t.cursorScreenPosition).deep.equals({row: 2, column: 2}, "before 1");

    t.selection.goUp(1, true);
    expect(t.cursorScreenPosition).deep.equals({row: 1, column: 2}, "up wrapped line 1");
    expect(t.cursorPosition).deep.equals({row: 1, column: 2}, "up wrapped line 2");

    t.selection.goUp(1, true);
    expect(t.cursorScreenPosition).deep.equals({row: 0, column: 1}, "upped simple line ");

    t.selection.goDown(3, true);
    expect(t.cursorScreenPosition).deep.equals({row: 3, column: 0}, "down into wrapped");

    t.selection.goUp(1, true);
    expect(t.cursorScreenPosition).deep.equals({row: 2, column: 2}, "up again from empty line");

    t.cursorPosition = {row: 3, column: 0}
    t.selection.goUp(1, true);
    expect(t.cursorScreenPosition).deep.equals({row: 2, column: 0}, "up from empty line with goal column set to it");

    t.cursorScreenPosition = {row: 2, column: 1}
    t.selection.goUp(1, true);
    expect(t.cursorScreenPosition).deep.equals({row: 1, column: 1}, "up from wrapped line with goal column set to it");
  })

});
