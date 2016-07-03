/*global declare, it, describe, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";
import { WorldMorph, Renderer } from "../index.js";
import { pt, Color } from "lively.graphics";
import { dispatchEvent } from "../events.js";


describe("morphic", () => {

  var world, submorph1, submorph2, submorph3, renderer,
      mousedownEvent;

  beforeEach(() => {
    world = new WorldMorph({
      name: "world", extent: pt(300,300),
      submorphs: [{
          name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
          submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
        },
        {name: "submorph3", extent: pt(50,50), position: pt(200,20), fill: Color.yellow}
      ]
    })
    submorph1 = world.submorphs[0];
    submorph2 = world.submorphs[0].submorphs[0];
    submorph3 = world.submorphs[1];

    renderer = new Renderer(world, document.body)
    renderer.renderWorld();

    mousedownEvent = {
      type: "pointerdown",
      target: renderer.getNodeForMorph(submorph2),
      pointerId: "test-pointer-1"
    }
  });

  afterEach(() => {
    renderer.clear();
  });

  it("emulate mousedown on submorph", () => {
    var log = [];
    world.onMouseDown = function() { log.push("world"); };
    submorph1.onMouseDown = function() { log.push("submorph1"); };
    submorph2.onMouseDown = function() { log.push("submorph2"); };
    submorph3.onMouseDown = function() { log.push("submorph3"); };
    dispatchEvent(mousedownEvent, world);
    expect(log).deep.equals(["world", "submorph1", "submorph2"]);
  });
});