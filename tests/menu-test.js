/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { morph, Renderer, Menu } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

var world;
function createDummyWorld() {
  world = morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: []
  });
}


var renderer, domEnv;
async function createAndRenderDummyWorld() {
  createDummyWorld();
  domEnv = await createDOMEnvironment();
  renderer = new Renderer(world, domEnv.document.body, domEnv);
  renderer.startRenderWorldLoop()
}

function cleanup() {
  renderer && renderer.clear();
  domEnv && domEnv.destroy();
}


describe("menus", () => {

  beforeEach(async () => createAndRenderDummyWorld());
  afterEach(() => cleanup());

// createAndRenderDummyWorld()
// cleanup()

  it("appear with title and items", () => {
    var item1Activated = 0,
        menu = new Menu({title: "Test", items: [["item 1", () => item1Activated++]]});

    world.addMorph(menu);
    expect(menu.submorphs[0].textString).equals("Test");
    expect(menu.submorphs[1].textString).equals("item 1");
    expect(menu.width).within(30,40, "menu width");
    expect(menu.height).within(30,50, "menu height");
  });

});
