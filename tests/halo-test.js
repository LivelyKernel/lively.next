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

function closeToPoint(p1,p2) {
  var {x,y} = p1;
  expect(x).closeTo(p2.x, 0.1, "x");
  expect(y).closeTo(p2.y, 0.1, "y");
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
        submorph1.bounds().containsPoint(item.globalBounds().center())
        && item != halo.originHalo());
    expect(innerButton).equals(undefined, `halo item ${innerButton} is inside the bounds of its target`);
    expect(halo.originHalo().bounds().center()).equals(submorph1.origin);
  });

  it("drag drags", () => {
    var halo = world.showHaloFor(submorph1);
    halo.dragHalo().update(pt(10,5));
    expect(submorph1.position).equals(pt(20, 15));
  });

  it("acitve drag hides other halos and displays position", () => {
    var halo = world.showHaloFor(submorph1),
        dragHalo = halo.dragHalo(),
        otherHalos = halo.buttonControls.filter((b) => b != dragHalo)
    dragHalo.init();
    halo.alignWithTarget();
    expect(halo.activeButton).equals(dragHalo);
    expect(halo.propertyDisplay.displayedValue()).equals(submorph1.position.toString());
    otherHalos.forEach((h) => {
      expect(h).to.have.property("visible", false);
    });
  })

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

  it("active resize hides other halos and displays extent", () => {
    var halo = world.showHaloFor(submorph1),
        resizeHalo = halo.resizeHalo(),
        otherHalos = halo.buttonControls.filter((b) => b != resizeHalo);
    resizeHalo.init();
    halo.alignWithTarget();
    expect(halo.activeButton).equals(resizeHalo);
    expect(halo.propertyDisplay.displayedValue()).equals("100.0w 100.0h");
    otherHalos.forEach((h) => expect(h).to.have.property("visible", false));
  });

  it("resizes proportionally", () => {
    var halo = world.showHaloFor(submorph1);
    halo.resizeHalo().init(true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
    halo.resizeHalo().update(pt(10,5), true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
    halo.resizeHalo().update(pt(1000,500), true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
  });

  it("shows a visual guide when resizing proportionally", () => {
    var halo = world.showHaloFor(submorph1);
    halo.resizeHalo().init(true);
    halo.resizeHalo().update(pt(10,5), true);
    var d = halo.getSubmorphNamed("diagonal");
    expect(d).to.not.be.undefined;
    expect(d.vertices.map((p) =>
              d.worldPoint(p))).equals(
                [halo.globalBounds().topLeft(),
                 halo.globalBounds().bottomRight()]);
  });

  it("rotate rotates", () => {
    var halo = world.showHaloFor(submorph1);
    halo.rotateHalo().init(num.toRadians(10));
    halo.rotateHalo().update(num.toRadians(25));
    expect(submorph1.rotation).closeTo(num.toRadians(15), 0.1);
  });

  it("indicates rotation", () => {
    var halo = world.showHaloFor(submorph1),
        rh = halo.rotateHalo(),
        oh = halo.originHalo();
    rh.init(num.toRadians(10));
    rh.update(num.toRadians(25));
    const ri = halo.getSubmorphNamed("rotationIndicator");
    expect(ri).to.not.be.undefined;
    expect(ri.vertices.map((p) =>
            ri.worldPoint(p))).equals(
              [oh.globalBounds().center(), rh.globalBounds().center()]);
  });

  it("scale scales", () => {
    var halo = world.showHaloFor(submorph1);
    halo.rotateHalo().initScale(pt(10,10));
    halo.rotateHalo().updateScale(pt(20,20));
    expect(submorph1.scale).equals(2);
  });

  it("indicates scale", () => {
    var halo = world.showHaloFor(submorph1),
        rh = halo.rotateHalo(),
        oh = halo.originHalo();
    rh.initScale(pt(10,10));
    rh.updateScale(pt(20,20));
    const ri = halo.getSubmorphNamed("rotationIndicator");
    expect(ri).to.not.be.undefined;
    expect(ri.vertices.map((p) =>
            ri.worldPoint(p))).equals(
              [oh.globalBounds().center(), rh.globalBounds().center()]);
  });

  it("active rotate halo hides other halos and displays rotation", () => {
    var halo = world.showHaloFor(submorph1),
        rotateHalo = halo.rotateHalo(),
        otherHalos = halo.buttonControls.filter((b) => b != rotateHalo);
    rotateHalo.init();
    halo.alignWithTarget();
    expect(halo.activeButton).equals(rotateHalo);
    expect(halo.propertyDisplay.displayedValue()).equals("0.0°");
    otherHalos.forEach((h) => {
      expect(h).to.have.property("visible", false);
    });
  })

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

  it("shifting the origin will not move bounds", () => {
    submorph1.position = pt(200,100);
    submorph1.rotateBy(num.toRadians(90));
    var oldGlobalPos = submorph1.globalBounds().topLeft();
    var halo = world.showHaloFor(submorph1);
    halo.originHalo().update(pt(20,5));
    expect(submorph1.origin).equals(pt(5, -20));
    expect(submorph1.globalBounds().topLeft()).equals(oldGlobalPos);

    submorph1.rotation = num.toRadians(-42);
    oldGlobalPos = submorph2.globalBounds().topLeft();
    halo = world.showHaloFor(submorph2);
    halo.originHalo().update(pt(20,5));
    closeToPoint(submorph2.globalBounds().topLeft(), oldGlobalPos);

    submorph2.rotation = num.toRadians(-20);
    oldGlobalPos = submorph2.globalBounds().topLeft();
    halo = world.showHaloFor(submorph2);
    halo.originHalo().update(pt(20,5));
    closeToPoint(submorph2.globalBounds().topLeft(), oldGlobalPos);
  });

  it("shifting the origin will not move submorphs", () => {
    submorph1.position = pt(200,100);
    submorph1.rotateBy(num.toRadians(90));
    var halo = world.showHaloFor(submorph1);
    var oldGlobalPos = submorph2.globalPosition;
    halo.originHalo().update(pt(20,5));
    closeToPoint(submorph2.globalPosition, oldGlobalPos);
  });

  it("origin halo aligns correctly if owner is transformed", () => {
    var halo = world.showHaloFor(submorph2);
    submorph1.rotation = num.toRadians(-45);
    submorph2.rotation = num.toRadians(-45);
    halo.alignWithTarget();
    expect(submorph2.worldPoint(submorph2.origin)).equals(halo.originHalo().globalBounds().center());
  });

  it("origin halo aligns correctly if morph is transformed with different origin", () => {
    var halo = world.showHaloFor(submorph1);
    submorph1.adjustOrigin(submorph1.innerBounds().center());
    submorph1.rotation = num.toRadians(-45);
    halo.alignWithTarget();
    var originHaloCenter = halo.originHalo().globalBounds().center(),
        originWorldPos = submorph1.worldPoint(pt(0,0));
    closeToPoint(originHaloCenter, originWorldPos);
  });

  it("origin halo aligns correctly if owner is transformed with different origin", () => {
    var halo = world.showHaloFor(submorph2);
    submorph1.adjustOrigin(submorph2.innerBounds().center());
    submorph2.adjustOrigin(submorph2.innerBounds().center());
    submorph1.rotation = num.toRadians(-45);
    submorph2.rotation = num.toRadians(-45);
    halo.alignWithTarget();
    var originHaloCenter = halo.originHalo().globalBounds().center(),
        originWorldPos = submorph2.worldPoint(pt(0,0));
    closeToPoint(originHaloCenter, originWorldPos);
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
