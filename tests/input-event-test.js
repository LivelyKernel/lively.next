/*global declare, it, describe, beforeEach, afterEach*/
import { expect } from "mocha-es6";
import { promise } from "lively.lang";
import { pt, Color } from "lively.graphics";
import { morph, World, show } from "../index.js";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";

function wait(n) {
  return n ? promise.delay(n*1000) : Promise.resolve();
}

function installEventLogger(morph, log) {
  var loggedEvents = [
    "onMouseDown","onMouseUp","onMouseMove",
    "onDragStart", "onDrag", "onDragEnd",
    "onGrab", "onDrop",
    "onHoverIn", "onHoverOut",
    "onFocus", "onBlur",
    "onKeyDown", "onKeyUp"]
  loggedEvents.forEach(name => {
    morph[name] = function(evt) {
      log.push(name + "-" + morph.name);
      this.constructor.prototype[name].call(this, evt);
    }
  });
}

var env, world, submorph1, submorph2, submorph3, submorph4, eventLog;
function createDummyWorld() {
  world = new World({name: "world", extent: pt(300,300)})
  world.submorphs = [{
      name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
      submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
    },
    {name: "submorph3", extent: pt(50,50), position: pt(200,20), fill: Color.yellow},
    {name: "submorph4", type: "text", extent: pt(50,50), position: pt(200,200), fill: Color.blue, textString: "text"}];

  submorph1 = world.submorphs[0];
  submorph2 = world.submorphs[0].submorphs[0];
  submorph3 = world.submorphs[1];
  submorph4 = world.submorphs[2];

  eventLog = [];
  [world,submorph1,submorph2,submorph3,submorph4].forEach(ea => installEventLogger(ea, eventLog));
  
  return world;
}


function assertEventLogContains(stuff) {
  expect(stuff).equals(eventLog)
  eventLog.length = 0;
}

describe("events", function() {

  // jsdom sometimes takes its time to initialize...
  if (System.get("@system-env").node)
    this.timeout(10000);


  beforeEach(async () => (env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()))).setWorld(createDummyWorld()));
  afterEach(() =>  MorphicEnv.popDefault().uninstall());

  it("mousedown on submorph", () => {
    env.eventDispatcher.simulateDOMEvents({type: "pointerdown", target: submorph2});
    assertEventLogContains(["onMouseDown-world", "onMouseDown-submorph1", "onMouseDown-submorph2"]);
  });

  it("stop event", () => {
    submorph1.onMouseDown = function(evt) {
      evt.stop();
      eventLog.push("onMouseDown-submorph1");
    }
    env.eventDispatcher.simulateDOMEvents({type: "pointerdown", target: submorph2});
    assertEventLogContains(["onMouseDown-world", "onMouseDown-submorph1"]);
  });

  it("world has hand and moves it", () => {
    env.eventDispatcher.simulateDOMEvents({type: "pointermove", target: submorph2, position: pt(120,130)});
    expect(world.submorphs[0]).property("isHand", true);
  });

  it("drag morph", () => {
    submorph2.grabbable = false;
    env.eventDispatcher.simulateDOMEvents({type: "pointerdown", target: submorph2, position: pt(20, 25)});
    assertEventLogContains(["onMouseDown-world", "onMouseDown-submorph1", "onMouseDown-submorph2"]);

    env.eventDispatcher.simulateDOMEvents({type: "pointermove", target: submorph2, position: pt(30, 33)});
    assertEventLogContains(["onMouseMove-world", "onDragStart-submorph2"]);

    env.eventDispatcher.simulateDOMEvents({type: "pointermove", target: submorph2, position: pt(34, 36)});
    assertEventLogContains(["onMouseMove-world", "onDrag-submorph2"]);

    env.eventDispatcher.simulateDOMEvents({type: "pointerup", target: submorph2, position: pt(34, 36)});
    assertEventLogContains(["onMouseUp-world", "onDragEnd-submorph2"]);
  });

  it("drag computes drag delta", async () => {
    var m = world.addMorph(morph({extent: pt(50,50), fill: Color.pink, grabbable: false}));
    await m.whenRendered()
    var dragStartEvent, dragEvent, dragEndEvent;
    m.onDragStart = evt => dragStartEvent = evt;
    m.onDrag = evt => dragEvent = evt;
    m.onDragEnd = evt => dragEndEvent = evt;
    env.eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", position: pt(20, 25)},
      {type: "pointermove", position: pt(20, 25)},
      {type: "pointermove", position: pt(30, 35)},
      {type: "pointermove", position: pt(40, 50)});
    expect(dragEvent.state.dragDelta).equals(pt(10,15))
    env.eventDispatcher.simulateDOMEvents({type: "pointerup", target: m, position: pt(40, 51)});
    expect(dragEndEvent.state.dragDelta).equals(pt(0, 1))
  });

  it("grab and drop morph", async () => {
    submorph2.grabbable = true;
    var morphPos = submorph2.globalPosition;

    // grab
    env.eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", target: submorph2, position: morphPos.addXY(5,5)},
      {type: "pointermove", target: submorph2, position: morphPos.addXY(10,10)});
    assertEventLogContains([
      "onMouseDown-world", "onMouseDown-submorph1", "onMouseDown-submorph2",
      "onMouseMove-world", "onGrab-submorph2"]);
    expect(world.hands[0].carriesMorphs()).equals(true);
    var offsetWhenGrabbed = submorph2.position;

    // drop
    env.eventDispatcher.simulateDOMEvents(
      {type: "pointermove", target: submorph2, position: morphPos.addXY(15,15)},
      {type: "pointermove", target: submorph2, position: morphPos.addXY(20,20)},
      {type: "pointerup", target: world, position: morphPos.addXY(20,20)});
    assertEventLogContains(["onMouseMove-world", "onMouseMove-world", "onMouseUp-world", "onDrop-world"]);
    expect(world.hands[0].carriesMorphs()).equals(false);
    expect(submorph2.owner).equals(world);
    expect(submorph2.position).equals(morphPos.addXY(10,10));
  });

  it("dropped morph has correct position", async () => {
    world.submorphs = [
      {position: pt(10,10), extent: pt(100,100), fill: Color.red,
       rotation: -45,
       origin: pt(50,50)
       },
      {position: pt(60,60), extent: pt(20,20), fill: Color.green, grabbable: true, origin: pt(10,10)
      }];
    var [m1, m2] = world.submorphs;
    var prevGlobalPos = m2.globalPosition;

    world.renderAsRoot(env.renderer);
    env.eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", target: m2, position: pt(60,60)},
      {type: "pointermove", target: m2, position: (pt(65,65))});
    expect(m2.globalPosition).equals(prevGlobalPos);
    expect(m2.owner).not.equals(world);
    env.eventDispatcher.simulateDOMEvents(
      {type: "pointermove", target: m2, position: pt(50,50)});
    expect(m2.globalPosition).equals(pt(45,45));
    env.eventDispatcher.simulateDOMEvents(
      {type: "pointerup", target: m1, position: (pt(2,2))});
    expect(m2.owner).equals(m1);
    expect(m2.globalPosition).equals(pt(45,45));
  });

  describe("text", () => {

    it("text entry via keydown", () => {
      expect(submorph4).property("textString").equals("text");
      env.eventDispatcher.simulateDOMEvents(
        {target: submorph4, type: "keydown", key: 'l'},
        {target: submorph4, type: "keydown", key: 'o'},
        {target: submorph4, type: "keydown", key: 'l'},
        {target: submorph4, type: "keydown", key: 'Enter'}
      );
      expect(submorph4).property("textString").equals("lol\ntext");
    });

    it("backspace", () => {
      expect(submorph4).property("textString").equals("text");
      env.eventDispatcher.simulateDOMEvents(
        {target: submorph4, type: "keydown", key: 'l'},
        {target: submorph4, type: "keydown", key: 'o'},
        {target: submorph4, type: "keydown", key: 'l'},
        {target: submorph4, type: "keydown", key: 'w'},
        {target: submorph4, type: "keydown", key: 'u'},
        {target: submorph4, type: "keydown", key: 't'}
      );
      expect(submorph4).property("textString").equals("lolwuttext");
      env.eventDispatcher.simulateDOMEvents(
        {target: submorph4, type: "keydown", keyCode: 8},
        {target: submorph4, type: "keydown", keyCode: 8},
        {target: submorph4, type: "keydown", keyCode: 8},
        {target: submorph4, type: "keydown", key: ' '}
      );
      expect(submorph4).property("textString").equals("lol text");
    });

    it("entry clears selection", () => {
      expect(submorph4).property("textString").equals("text");
      submorph4.selection.range = { start: 0, end: 4 };
      env.eventDispatcher.simulateDOMEvents(
        {target: submorph4, type: "keydown", key: 'w'},
        {target: submorph4, type: "keydown", key: 'o'},
        {target: submorph4, type: "keydown", key: 'w'}
      );
      expect(submorph4).property("textString").equals("wow");
    });

    it("click sets cursor", () => {
      var clickPos = pt(215, 200),
          { fontFamily, fontSize, textString } = submorph4;
      expect(submorph4).property("selection").property("range").deep.equals({ start: 0, end: 0 });
      env.eventDispatcher.simulateDOMEvents(
        {target: submorph4, type: "click", position: clickPos }
      );
      var clickIndex = env.fontMetric.indexFromPoint(fontFamily, fontSize, textString, submorph4.localize(clickPos));
      expect(clickIndex).not.equal(0);
      expect(submorph4).property("selection").property("range").deep.equals({ start: clickIndex, end: clickIndex });
    });

    it("drag sets selection", () => {
        var dragEndPos = pt(215, 200),
          { fontFamily, fontSize, textString } = submorph4;
      expect(submorph4).property("selection").property("range").deep.equals({ start: 0, end: 0 });
      env.eventDispatcher.simulateDOMEvents(
        {target: submorph4, type: "pointerdown", position: pt(200, 200)},
        {target: submorph4, type: "pointermove", position: pt(220, 200)}, // simulate overshoot
        {target: submorph4, type: "pointermove", position: dragEndPos},
        {target: submorph4, type: "pointerup", position: dragEndPos}
      );
      var dragEndIndex = env.fontMetric.indexFromPoint(fontFamily, fontSize, textString, submorph4.localize(dragEndPos));
      expect(dragEndIndex).not.equal(0);
      expect(submorph4).property("selection").property("range").deep.equals({ start: 0, end: dragEndIndex });
    });
  })

  describe("hover", () => {

    it("into world", async () => {
      await env.eventDispatcher.simulateDOMEvents({target: world, type: "pointerover", position: pt(50,50)}).whenIdle();
      assertEventLogContains(["onHoverIn-world"]);
    });

    it("in and out world", async () => {
      await env.eventDispatcher.simulateDOMEvents(
        {target: world, type: "pointerover", position: pt(50,50)},
        {target: world, type: "pointerout", position: pt(50,50)}).whenIdle();
      assertEventLogContains(["onHoverIn-world", "onHoverOut-world"]);
    });

    it("in and out single morph", async () => {
      await env.eventDispatcher.simulateDOMEvents(
        {target: submorph3, type: "pointerover", position: pt(50,50)},
        {target: submorph3, type: "pointerout", position: pt(50,50)}).whenIdle();;
      assertEventLogContains(["onHoverIn-world", "onHoverIn-submorph3", "onHoverOut-world","onHoverOut-submorph3"]);
    });

    it("hover in and out with submorph", async () => {
      // simulate the over/out dom events when moving
      // - into submorph1 => into submorph2 (contained in 1) => out of submorph2 => out of submorph1
      await env.eventDispatcher.simulateDOMEvents({type: "pointerover", target: submorph1, position: pt(10,10)}).whenIdle();

      await env.eventDispatcher.simulateDOMEvents(
        {type: "pointerout", target: submorph1, position: pt(15,20)},
        {type: "pointerover", target: submorph2, position: pt(15,20)}).whenIdle();

      await env.eventDispatcher.simulateDOMEvents(
        {type: "pointerout", target: submorph2, position: pt(15,41)},
        {type: "pointerover", target: submorph1, position: pt(15,41)}).whenIdle();

      await env.eventDispatcher.simulateDOMEvents({type: "pointerout", target: submorph1, position: pt(9,9) }).whenIdle();

      assertEventLogContains([
        "onHoverIn-world", "onHoverIn-submorph1", "onHoverIn-submorph2", "onHoverOut-submorph2", "onHoverOut-world", "onHoverOut-submorph1"]);
    });

    it("hover in and out with submorph sticking out", async () => {

      var tl = submorph1.topLeft;
      submorph2.topRight = pt(submorph1.width + 10, 0);
      await env.eventDispatcher.simulateDOMEvents({type: "pointerover", target: submorph2, position: pt(109, 10)}).whenIdle();
      await env.eventDispatcher.simulateDOMEvents({type: "pointerout", target: submorph2, position: pt(111, 10)}).whenIdle();

      assertEventLogContains([
        "onHoverIn-world", "onHoverIn-submorph1", "onHoverIn-submorph2", "onHoverOut-world", "onHoverOut-submorph1", "onHoverOut-submorph2"]);
    });

  });

  describe("key events", () => {

    it("focus + blur", async () => {
      env.eventDispatcher.simulateDOMEvents(
        {target: submorph1, type: "focus"},
        {target: submorph1, type: "blur"});
      assertEventLogContains(["onFocus-submorph1", "onBlur-submorph1"]);
    });

    it("key down", async () => {
      env.eventDispatcher.simulateDOMEvents({target: submorph1, type: "keydown", ctrlKey: true, keyCode: 65});
      assertEventLogContains(["onKeyDown-world", "onKeyDown-submorph1"]);
    });

    it("key down keystring", async () => {
      var pressed; submorph1.onKeyDown = evt => pressed = evt.keyString();
      env.eventDispatcher.simulateDOMEvents({target: submorph1, type: "keydown", ctrlKey: true, keyCode: 65});
      expect(pressed).match(/Control-A/)
    });

    it("key up keystring", async () => {
      var pressed; submorph1.onKeyUp = evt => pressed = evt.keyString();
      env.eventDispatcher.simulateDOMEvents({target: submorph1, type: "keyup", altKey: true, shiftKey: true, keyCode: 88});
      expect(pressed).equals("Alt-Shift-X")
    });

  });

  describe("simulation", () => {

    it("click", async () => {
      await env.eventDispatcher.simulateDOMEvents({type: "click", position: pt(25,25)});
      assertEventLogContains([
        "onMouseDown-world", "onMouseDown-submorph1", "onMouseDown-submorph2",
        "onMouseUp-world", "onMouseUp-submorph1", "onMouseUp-submorph2"]);
    });

  });

});
