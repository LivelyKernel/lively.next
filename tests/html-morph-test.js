/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { morph, Renderer } from "../index.js";
import { HTMLMorph } from "../html-morph.js";
import { pt, Color, Rectangle } from "lively.graphics";

var world, renderer, domEnv;
async function createAndRenderDummyWorld() {
  world = morph({type: "world", name: "world", extent: pt(300,300)});
  domEnv = await createDOMEnvironment();
  renderer = new Renderer(world, domEnv.document.body, domEnv);
  renderer.startRenderWorldLoop()
}

function cleanup() {
  renderer && renderer.clear();
  domEnv && domEnv.destroy();
}


describe("html morph", function () {

  // jsdom sometimes takes its time to initialize...
  if (System.get("@system-env").node)
    this.timeout(10000);

  beforeEach(async () => createAndRenderDummyWorld());
  afterEach(() => cleanup());

  it("renders html", async () => {
    var m = world.addMorph(new HTMLMorph({html: "<div>This is a <h2>test</h2></div>", document: domEnv.document}));
    await m.whenRendered();
    expect(m.domNode.innerHTML).equals("<div>This is a <h2>test</h2></div>", "initial rendering wrong");
    expect(m.domNode.parentNode).equals(renderer.getNodeForMorph(m), "rendered node not child node of morph node");
    var node = m.domNode;
    m.position = pt(10,20);
    expect(m.domNode).equals(node, "node not the same after morph change");
    expect(m.domNode.parentNode).equals(renderer.getNodeForMorph(m), "custom node child node of morph node after change");
  });

});
