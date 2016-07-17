/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { morph, Renderer } from "../index.js";
import { pt, Color, Rectangle } from "lively.graphics";
import { num } from "lively.lang";
import { EventDispatcher } from "../events.js";

var world, submorph1, submorph2, eventDispatcher;

function createDummyWorld() {
  world = morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: [{
        name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
        submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
      }]
  });
  submorph1 = world.submorphs[0];
  submorph2 = submorph1.submorphs[0];
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
    expect(halo.originHalo().bounds().center()).equals(submorph1.origin);
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

  it("align to the morph extent while resizing", () => {
    submorph1.origin = pt(20,30);
    var halo = world.showHaloFor(submorph1, "test-pointer-1"),
        resizeButton = halo.resizeHalo(),
        resizeButtonCenter = resizeButton.globalBounds().center();
    resizeButton.update(pt(42,42));
    expect(halo.extent).equals(submorph1.extent);
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
    expect(halo.originHalo().bounds().center()).equals(pt(30, 35));
  });

  it("origin shifts origin according to global delta", () => {
    submorph1.position = pt(200,100);
    submorph1.rotateBy(num.toRadians(90));
    var halo = world.showHaloFor(submorph1);
    halo.originHalo().update(pt(20,5));
    expect(submorph1.origin).equals(pt(5, -20));
  });

  it("grab grabs", () => {
    var halo = world.showHaloFor(submorph2),
        hand = world.handForPointerId("test-pointer");
    halo.grabHalo().init(hand)
    hand.position = submorph1.globalBounds().center();
    expect(submorph2.owner).equals(hand);
    halo.grabHalo().update(hand)
    expect(halo.position).equals(submorph2.globalBounds().topLeft());
    expect(submorph2.owner).equals(submorph1);
  });

  it("copy copies", () => {
    var halo = world.showHaloFor(submorph2),
        hand = world.handForPointerId("test-pointer");
    halo.copyHalo().init(hand)
    var copy = halo.target;
    expect(copy).not.equals(submorph2);
    hand.position = submorph1.globalBounds().center();
    halo.copyHalo().update(hand)
    expect(halo.position).equals(copy.globalBounds().topLeft());
    expect(copy.owner).equals(submorph1);
  });

});
