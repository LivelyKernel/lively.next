/*global declare, it, describe, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";
import { Morph, Renderer } from "../index.js";
import { pt, Color } from "lively.graphics";


describe("morphic", () => {

  var world, submorph1, submorph2, submorph3, renderer, domNode;

  beforeEach(() => {
    // why can't comments be morphs? anyway...
    //
    // +---------------------------------------------------+
    // |                                                   |
    // | +--------------------+         +------------+     |
    // | |                    |         |            |     |
    // | |  +---------+       |         |            |     |
    // | |  |         |       |         |            |     |
    // | |  |         |       |         |            |     |
    // | |  |submorph2|       |         | submorph3  |     |
    // | |  |         |       |         |            |     |
    // | |  |         |       |         |            |     |
    // | |  +---------+       |         |            |     |
    // | |                    |         +------------+     |
    // | |                    |                            |
    // | |   submorph1        |                            |
    // | |                    |                            |
    // | +--------------------+                            |
    // |                                                   |
    // |                       world                       |
    // +---------------------------------------------------+

    world = new Morph({
      name: "world", extent: pt(300,300),
      submorphs: [{
          name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
          submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
        },
        {name: "submorph3", extent: pt(50,50), position: pt(200,20), fill: Color.yellow}
      ]
    });
    submorph1 = world.submorphs[0];
    submorph2 = world.submorphs[0].submorphs[0];
    submorph3 = world.submorphs[1];
    renderer = new Renderer(world, document.body)
    renderer.renderWorld();
    domNode = renderer.domNode;
  });

  afterEach(() => {
    renderer.clear();
  });

  describe("properties", () => {
    
    it("Morph has an extent", () => {
      expect(world.extent).deep.equals(pt(300,300))
    });
  
    it("Morph has an id", () => {
      expect(world.id).equals(domNode.id);
    });
    
  });

  describe("morphic relationship", () => {

    it("withAllSubmorphsDetect", () => {
      expect(world.withAllSubmorphsDetect(ea => ea === submorph2)).equals(submorph2);
      expect(world.withAllSubmorphsDetect(ea => ea === "foo")).equals(undefined);
    });
  
    it("withAllSubmorphsSelect", () => {
      expect(world.withAllSubmorphsSelect(ea => ea === submorph2)).deep.equals([submorph2]);
      expect(world.withAllSubmorphsSelect(ea => ea === "foo")).deep.equals([]);
    });
  
    it("ownerChain", () => {
      var owners = submorph2.ownerChain();
      expect(owners).deep.equals([submorph1, world], owners.map(ea => ea.name).join(", "));
    });
    
    it("world", () => {
      expect(submorph2.world()).equals(world);
    });

  });

  describe("rendering", () => {

    it("renderer associates domNodewith morph", () => {
      var node = renderer.getNodeForMorph(submorph2),
          morph = renderer.getMorphForNode(node);
      expect(morph).equals(submorph2, morph && morph.name);
      expect(domNode.childNodes[0].childNodes[0]).equals(node); // brittle, might change...
    });

  });

  describe("morph lookup", () => {
    
    it("get() finds a morph by name", () => {
      expect(world.get("submorph2")).equals(submorph2);
      expect(submorph2.get("submorph3")).equals(submorph3);
      submorph2.remove();
      expect(submorph2.get("submorph3")).equals(null);
    });

    it("allows double naming", () => {
      submorph1.submorphs = [{name: "a morph"},{name: "a morph", submorphs: [{name: 'another morph'}]},{name: "a morph"}]
      var m = world.get('another morph');
      expect(m.owner).equals(submorph1.submorphs[1]);
      expect(m.get("a morph")).equals(submorph1.submorphs[0]);
    });

    it("get() uses toString", () => {
      submorph3.toString = () => "oink";
      expect(world.get("oink")).equals(submorph3);
    });

    it("get() works with RegExp", () => {
      expect(world.get(/rph3/)).equals(submorph3);
    });

  });
});