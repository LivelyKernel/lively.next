/*global declare, it, describe, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";
import { Morph, Renderer } from "../index.js";
import { pt, Color } from "lively.graphics";


describe("morphic", () => {

  var world, submorph1, submorph2, submorph3, renderer, domNode;

  beforeEach(() => {
    world = new Morph({extent: pt(300,300)})
    submorph1 = new Morph({extent: pt(100,100), position: pt(10,10), fill: Color.red})
    submorph2 = new Morph({extent: pt(20,20), position: pt(5,10), fill: Color.green})
    submorph3 = new Morph({extent: pt(50,50), position: pt(200,20), fill: Color.yellow})
    world.name = "world";
    submorph1.name = "submorph1";
    submorph2.name = "submorph2";
    submorph3.name = "submorph3";
    world.addMorph(submorph1);
    submorph1.addMorph(submorph2);
    world.addMorph(submorph3);
    
    renderer = new Renderer()
    var rootNode = document.body;
    renderer.renderWorld(world, rootNode);
    domNode = renderer.renderStateFor(world).domNode;
  });

  afterEach(() => {
    domNode.parentNode.removeChild(domNode);
  });

  it("Morph has property extent", () => {
    expect(world.extent).deep.equals(pt(300,300))
  });
  
  it("Morph has property id", () => {
    expect(world.id).equals(domNode.id);
  });

  it("deep search through morphs", () => {
    var result = world.withAllSubmorphsDetect(ea => ea === submorph2);
    expect(result).equals(submorph2);
  });

  it("withOwnerChain", () => {
    expect(submorph2.withOwnerChain())
      .deep.equals(
        [submorph2, submorph1, world],
        submorph2.withOwnerChain().map(ea => ea.name).join(","));
  });

  it("renderer associates domNodewith morph", () => {
    var node = domNode.childNodes[0].childNodes[0]; // brittle, should be the submorph's node....
    var found = renderer.getMorphWithNode(world, node);
    expect(found).equals(submorph2, found && found.name);
  });
  
  describe("events", () => {

    var mousedownEvent;
    beforeEach(() => {
      mousedownEvent = {
        type: "mousedown",
        target: domNode.childNodes[0].childNodes[0] // submorph2
      }
    });

    it("emulate mousedown on submorph", () => {
      var log = [];
      world.onMouseDown = function() { log.push("world"); };
      submorph1.onMouseDown = function() { log.push("submorph1"); };
      submorph2.onMouseDown = function() { log.push("submorph2"); };
      submorph3.onMouseDown = function() { log.push("submorph3"); };
      world.dispatchEvent(mousedownEvent);
      expect(log).deep.equals(["world", "submorph1", "submorph2"]);
    });
  });
});