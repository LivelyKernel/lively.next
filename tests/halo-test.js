/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { morph, Renderer } from "../index.js";
import { pt, Color, Rectangle } from "lively.graphics";
import { num } from "lively.lang";
import { EventDispatcher } from "../events.js";

var world, submorph1, eventDispatcher;

function fakeEvent(targetMorph, type, pos = pt(0,0)) {
  return {
    type: type,
    target: domEnv.document.getElementById(targetMorph.id),
    pointerId: "test-pointer-1",
    pageX: pos.x, pageY: pos.y,
    stopPropagation: () => {}, preventDefault: () => {}
  }
}

function createDummyWorld() {
  world = morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: [{
        name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
        submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
      }
    ]
  });
  submorph1 = world.submorphs[0];
}

var renderer, domEnv;

async function createAndRenderDummyWorld() {
  createDummyWorld();
  domEnv = await createDOMEnvironment();
  renderer = new Renderer(world, domEnv.document.body, domEnv);
  renderer.startRenderWorldLoop()
  eventDispatcher = new EventDispatcher(domEnv.window, world).install();
}

function cleanup() {
  renderer && renderer.clear();
  domEnv && domEnv.destroy();
}

describe("halos", () => {

  beforeEach(async () => createAndRenderDummyWorld());
  afterEach(() => cleanup());

// createAndRenderDummyWorld()
// cleanup()

  it("halo items are placed correctly", () => {
    submorph1.origin = pt(20,30);
    var halo = world.showHaloFor(submorph1),
        innerButton = halo.buttonControls.find(item =>
          submorph1.bounds().containsPoint(item.globalBounds().center()));
    expect(innerButton).equals(undefined, `halo item ${innerButton} is inside the bounds of its target`);
    expect(halo.originHalo().position).equals(submorph1.origin);
  });

  it("drag drags", () => {
    var halo = world.showHaloFor(submorph1);
    halo.dragHalo().update(pt(10,5));
    expect(submorph1.position).equals(pt(20, 15));
  });

  it("resize resizes", () => {
    var halo = world.showHaloFor(submorph1);
    halo.resizeHalo().update(pt(10,5));
    expect(submorph1.extent).equals(pt(110, 105));
  });

  it("rotate rotates", () => {
    var halo = world.showHaloFor(submorph1);
    halo.rotateHalo().init(num.toRadians(10));
    halo.rotateHalo().update(num.toRadians(25));
    expect(submorph1.rotation).closeTo(num.toRadians(15), 0.1);
  });

  it("close removes", () => {
    var halo = world.showHaloFor(submorph1);
    halo.closeHalo().update();
    expect(submorph1.owner).equals(null);
  });

  it("origin shifts origin", () => {
    submorph1.origin = pt(20,30);
    var halo = world.showHaloFor(submorph1);
    halo.originHalo().update(pt(10,5));
    expect(submorph1.origin).equals(pt(30, 35));
    expect(halo.originHalo().position).equals(pt(30, 35));
  });

  it("align to the morph position while grabbing", () => {
    submorph1.origin = pt(20,30);
    var halo = world.showHaloFor(submorph1, "test-pointer-1"),
        grabButton = halo.grabHalo(),
        grabButtonCenter = grabButton.globalBounds().center();
    eventDispatcher.dispatchDOMEvent(fakeEvent(grabButton, "pointerdown", grabButtonCenter));
    eventDispatcher.dispatchDOMEvent(fakeEvent(grabButton, "pointermove", pt(42,42)));
    expect(halo.position).equals(submorph1.globalBounds.topLeft());
    eventDispatcher.dispatchDOMEvent(fakeEvent(grabButton, "pointermove", pt(42,42)));
    eventDispatcher.dispatchDOMEvent(fakeEvent(grabButton, "pointerup", grabButtonCenter));
    expect(halo.position).equals(submorph1.globalBounds.topLeft());
  });

  it("align to the morph extent while resizing", () => {
    submorph1.origin = pt(20,30);
    var halo = world.showHaloFor(submorph1, "test-pointer-1"),
        resizeButton = halo.resizeHalo(),
        resizeButtonCenter = resizeButton.globalBounds().center();
    resizeButton.update(pt(42,42));
    expect(halo.extent).equals(submorph1.extent);
  });

});
