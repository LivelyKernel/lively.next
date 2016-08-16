/*global System, declare, it, xit, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";
import { Text, World } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

// FIXME! FontMetric should work in nodejs with jsdom as well!!!
var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

function text(string, props) {
  return new Text({
    textString: string,
    fontFamily: "Arial",
    fontSize: 10,
    extent: pt(100,100),
    padding: Rectangle.inset(1,1,1,1),
    ...props
  });
}

var env;

describe("text", () => {

  beforeEach(async () => {
    env = new MorphicEnv(await createDOMEnvironment());
  })

  afterEach(() => {
    env && env.uninstall();
  });

  describe("font metric", () => {

    inBrowser("computes font size", () => {
      var {width, height} = env.fontMetric.sizeFor("Arial", 12, "A");
      expect(width).closeTo(8, 1);
      expect(height).closeTo(14, 1);
    });

  });

  inBrowser("computes size on construction", async () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: false});
    expect(height).within(11,14)
    expect(width).within(20,24)
  });

  inBrowser("computes only width", () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: true});
    expect(height).equals(100)
    expect(width).within(20,24)
  });

  inBrowser("computes only height", () => {
    var {extent: {x: width, y: height}} = text("hello", {fixedWidth: true, fixedHeight: false});
    expect(height).within(11,14);
    expect(width).equals(100);
  });

  inBrowser("leaves extent as is with fixed sizing", () => {
    var {extent} = text("hello", {fixedWidth: true, fixedHeight: true});
    expect(extent).equals(pt(100,100));
  });

});


describe("rendered text", () => {

  var world, text;
  function createDummyWorld() {
    world = new World({name: "world", extent: pt(300,300), submorphs: [{
      name: "a text", type: "text",
      extent: pt(50,50), position: pt(10,10),
      fill: Color.gray.lighter(2),
      textString: "text"
    }]});
    text = world.get("a text");
    return world;
  }

  beforeEach(async () => (env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()))).setWorld(createDummyWorld()));
  afterEach(() =>  MorphicEnv.popDefault().uninstall());


  describe("rendering", () => {

    it("scrolls", () => {
      
    });

  });


  describe("input events", () => {
  
    it("text entry via keydown", async () => {
      expect(text).property("textString").equals("text");
      text.focus();
      env.eventDispatcher.simulateDOMEvents(
        {type: "keydown", key: 'l'},
        {type: "keydown", key: 'o'},
        {type: "keydown", key: 'l'},
        {type: "keydown", key: 'Enter'});
      expect(text).property("textString").equals("lol\ntext");
    });
  
    it("backspace", async () => {
      expect(text).property("textString").equals("text");
      text.focus();
      env.eventDispatcher.simulateDOMEvents(
        {type: "keydown", key: 'l'},
        {type: "keydown", key: 'o'},
        {type: "keydown", key: 'l'},
        {type: "keydown", key: 'w'},
        {type: "keydown", key: 'u'},
        {type: "keydown", key: 't'});

      expect(text).property("textString").equals("lolwuttext");
      env.eventDispatcher.simulateDOMEvents(
        {type: "keydown", keyCode: 8},
        {type: "keydown", keyCode: 8},
        {type: "keydown", keyCode: 8},
        {type: "keydown", key: ' '});

      expect(text).property("textString").equals("lol text");
    });
  
    it("entry clears selection", async () => {
      expect(text).property("textString").equals("text");
      text.focus();
      text.selection.range = {start: 0, end: 4};
      env.eventDispatcher.simulateDOMEvents(
        {type: "keydown", key: 'w'},
        {type: "keydown", key: 'o'},
        {type: "keydown", key: 'w'});

      expect(text).property("textString").equals("wow");
    });
  
    it("click sets cursor", () => {
      var clickPos = pt(215, 200), {fontFamily, fontSize, textString} = text;
      expect(text).property("selection").property("range").deep.equals({ start: 0, end: 0 });
      env.eventDispatcher.simulateDOMEvents({target: text, type: "click", position: clickPos});

      var clickIndex = env.fontMetric.indexFromPoint(fontFamily, fontSize, textString, text.localize(clickPos));
      expect(clickIndex).not.equal(0);
      expect(text).property("selection").property("range").deep.equals({start: clickIndex, end: clickIndex});
    });
  
    it("drag sets selection", () => {
      var dragEndPos = pt(10+15, 10),
          {fontFamily, fontSize, textString} = text;
      expect(text).deep.property("selection.range").deep.equals({start: 0, end: 0});
      env.eventDispatcher.simulateDOMEvents(
        {target: text, type: "pointerdown", position: pt(10, 10)},
        {target: text, type: "pointermove", position: pt(10+20, 10)}, // simulate overshoot
        {target: text, type: "pointermove", position: dragEndPos},
        {target: text, type: "pointerup", position: dragEndPos});

      var dragEndIndex = env.fontMetric.indexFromPoint(
        fontFamily, fontSize, textString, text.localize(dragEndPos));
      expect(dragEndIndex).not.equal(0);
      expect(text).deep.property("selection.range").deep.equals({start: 0, end: dragEndIndex});
    });
  });

});
