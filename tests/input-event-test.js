/*global declare, it, describe, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";
import { pt, Color } from "lively.graphics";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { EventDispatcher } from "../events.js";
import { morph, World, Renderer, show } from "../index.js";

var domEnv;

function installEventLogger(morph, log) {
  var loggedEvents = ["onMouseDown","onMouseUp","onMouseMove","onDragStart", "onDrag", "onDragEnd", "onGrab", "onDrop"]
  loggedEvents.forEach(name => {
    morph[name] = function(evt) {
      log.push(name + "-" + morph.name);
      this.constructor.prototype[name].call(this, evt);
    }
  });
}

var world, submorph1, submorph2, submorph3, submorph4,
    eventLog, renderer, eventDispatcher;

async function setup() {
  domEnv = await createDOMEnvironment();
  world = new World({name: "world", extent: pt(300,300)})
  renderer = new Renderer(world, domEnv.document.body, domEnv);
  renderer.startRenderWorldLoop();
  eventDispatcher = new EventDispatcher(domEnv.window, world).install();

  world.submorphs = [{
      name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
      submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
    },
    {name: "submorph3", extent: pt(50,50), position: pt(200,20), fill: Color.yellow},
    {name: "submorph4", type: "text", extent: pt(50,50), position: pt(200,200), fill: Color.blue, textString: "old text"}];

  submorph1 = world.submorphs[0];
  submorph2 = world.submorphs[0].submorphs[0];
  submorph3 = world.submorphs[1];
  submorph4 = world.submorphs[2];

  eventLog = [];
  [world,submorph1,submorph2,submorph3,submorph4].forEach(ea => installEventLogger(ea, eventLog));
  
  await world.whenRendered();
}

function teardown() {
  eventDispatcher && eventDispatcher.uninstall();
  renderer && renderer.clear();
  domEnv && domEnv.destroy();
}

function assertEventLogContains(stuff) {
  expect(eventLog).deep.equals(stuff)
  eventLog.length = 0;
}

describe("events", () => {

  beforeEach(async () => setup());
  afterEach(() => teardown());

  it("mousedown on submorph", () => {
    eventDispatcher.simulateDOMEvents({type: "pointerdown", target: submorph2});
    assertEventLogContains(["onMouseDown-world", "onMouseDown-submorph1", "onMouseDown-submorph2"]);
  });

  it("stop event", () => {
    submorph1.onMouseDown = function(evt) {
      evt.stop();
      eventLog.push("onMouseDown-submorph1");
    }
    eventDispatcher.simulateDOMEvents({type: "pointerdown", target: submorph2});
    assertEventLogContains(["onMouseDown-world", "onMouseDown-submorph1"]);
  });

  it("world has hand and moves it", () => {
    eventDispatcher.simulateDOMEvents({type: "pointermove", target: submorph2, position: pt(120,130)});
    expect(world.submorphs[0]).property("isHand", true);
  });

  it("drag morph", () => {
    submorph2.grabbable = false;
    eventDispatcher.simulateDOMEvents({type: "pointerdown", target: submorph2, position: pt(20, 25)});
    assertEventLogContains(["onMouseDown-world", "onMouseDown-submorph1", "onMouseDown-submorph2"]);

    eventDispatcher.simulateDOMEvents({type: "pointermove", target: submorph2, position: pt(30, 33)});
    assertEventLogContains(["onMouseMove-world", "onDragStart-submorph2"]);

    eventDispatcher.simulateDOMEvents({type: "pointermove", target: submorph2, position: pt(34, 36)});
    assertEventLogContains(["onMouseMove-world", "onDrag-submorph2"]);

    eventDispatcher.simulateDOMEvents({type: "pointerup", target: submorph2, position: pt(34, 36)});
    assertEventLogContains(["onMouseUp-world", "onDragEnd-submorph2"]);
  });

  it("drag computes drag delta", async () => {
    var m = world.addMorph(morph({extent: pt(50,50), fill: Color.pink, grabbable: false}));
    await m.whenRendered()
    var dragStartEvent, dragEvent, dragEndEvent;
    m.onDragStart = evt => dragStartEvent = evt;
    m.onDrag = evt => dragEvent = evt;
    m.onDragEnd = evt => dragEndEvent = evt;
    eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", position: pt(20, 25)},
      {type: "pointermove", position: pt(20, 25)},
      {type: "pointermove", position: pt(30, 35)},
      {type: "pointermove", position: pt(40, 50)});
    expect(dragEvent.state.dragDelta).equals(pt(10,15))
    eventDispatcher.simulateDOMEvents({type: "pointerup", target: m, position: pt(40, 51)});
    expect(dragEndEvent.state.dragDelta).equals(pt(0, 1))
  });

  it("grab and drop morph", () => {
    submorph2.grabbable = true;
    var morphPos = submorph2.globalPosition;

    // grab
    eventDispatcher.simulateDOMEvents(
      {type: "pointerdown", target: submorph2, position: morphPos.addXY(5,5)},
      {type: "pointermove", target: submorph2, position: morphPos.addXY(10,10)});
    assertEventLogContains([
      "onMouseDown-world", "onMouseDown-submorph1", "onMouseDown-submorph2",
      "onMouseMove-world", "onGrab-submorph2"]);
    expect(world.hands[0].carriesMorphs()).equals(true);
    var offsetWhenGrabbed = submorph2.position;

    // drop
    eventDispatcher.simulateDOMEvents(
      {type: "pointermove", target: submorph2, position: morphPos.addXY(15,15)},
      {type: "pointermove", target: submorph2, position: morphPos.addXY(20,20)},
      {type: "pointerup", target: world, position: morphPos.addXY(20,20)});
    assertEventLogContains(["onMouseMove-world", "onMouseMove-world", "onMouseUp-world", "onDrop-world"]);
    expect(world.hands[0].carriesMorphs()).equals(false);
    expect(submorph2.owner).equals(world);
    expect(submorph2.position).equals(morphPos.addXY(10,10));
  });

  it("text input", () => {
    expect(submorph4).property("textString").equals("old text");
    domEnv.document.getElementById(submorph4.id).value = "new text";
    expect(submorph4).property("textString").equals("old text");
    eventDispatcher.simulateDOMEvents({type: "input", target: submorph4, position: pt(225, 225)});
    expect(submorph4).property("textString").equals("new text");
    domEnv.document.getElementById(submorph4.id).value = "really new text";
    expect(submorph4).property("textString").equals("new text");
    eventDispatcher.simulateDOMEvents({type: "input", target: submorph4, position: pt(225, 225)});
    expect(submorph4).property("textString").equals("really new text");
  });


  describe("simulation", () => {

    it("click", () => {
      eventDispatcher.simulateDOMEvents({type: "click", position: pt(25,25)});
      assertEventLogContains([
        "onMouseDown-world", "onMouseDown-submorph1", "onMouseDown-submorph2",
        "onMouseUp-world", "onMouseUp-submorph1", "onMouseUp-submorph2"]);
    });

  });

});
