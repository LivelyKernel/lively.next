/*global declare, it, describe, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";
import { createDOMEnvironment } from "./dom-helper.js";
import { morph, Renderer } from "../index.js";
import { pt, Color } from "lively.graphics";


describe("morphic", () => {

  var world, submorph1, submorph2, submorph3, image, ellipse,
      renderer, domEnv;

  beforeEach(async () => {
    world = morph({
      type: "world", name: "world", extent: pt(300,300),
      submorphs: [{
          name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
          submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
        },
        {name: "submorph3", extent: pt(50,50), position: pt(200,20), fill: Color.yellow},
        {type: "image", name: "image", extent: pt(80,80), position: pt(20, 200), fill: Color.lightGray},
        {type: "ellipse", name: "ellipse", extent: pt(50, 50), position: pt(200, 200), fill: Color.pink}
      ]
    });
    image = world.submorphs[2];
    ellipse = world.submorphs[3];
    submorph1 = world.submorphs[0];
    submorph2 = world.submorphs[0].submorphs[0];
    submorph3 = world.submorphs[1];
    
    domEnv = await createDOMEnvironment();
    renderer = new Renderer(world, domEnv.document.body, domEnv);
    renderer.renderWorld();
  });

  afterEach(() => {
    renderer && renderer.clear();
    domEnv && domEnv.destroy();
  });

  describe("properties", () => {

    it("Morph has an extent", () => {
      expect(world.extent).deep.equals(pt(300,300))
    });

    it("Morph has an id", () => {
      expect(world.id).equals(renderer.domNode.id);
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

    it("adds morph in front of other", () => {
      var newMorph = world.addMorph({name: "new morph"}, world.submorphs[1]);
      expect(world.submorphs[0]).equals(submorph1);
      expect(world.submorphs[1]).equals(newMorph);
      expect(world.submorphs[2]).equals(submorph3);
    });
  });

  describe("rendering", () => {

    it("renderer associates domNodewith morph", () => {
      var node = renderer.getNodeForMorph(submorph2),
          morph = renderer.getMorphForNode(node);
      expect(morph).equals(submorph2, morph && morph.name);
      expect(renderer.domNode.childNodes[0].childNodes[0]).equals(node); // brittle, might change...
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

  describe("shapes", () => {

    it("shape influences node style", () => {
      const style = renderer.getNodeForMorph(ellipse).style;
      expect(style.borderRadius).match(/50px/);
      expect(style.position).equals("absolute");
    });

    it("morph type influences node type", () => {
      expect(ellipse._nodeType).equals("div");
      expect(image._nodeType).equals("img");
    });

    it("morph type influences node attributes", () => {
      const ellipseNode = renderer.getNodeForMorph(ellipse),
            imageNode = renderer.getNodeForMorph(image);
      expect(ellipseNode).not.to.have.property('src');
      expect(imageNode).to.have.property('src');
    });

    it("shape translates morph attributes to style", () => {
      expect(ellipse.shape()).deep.property("style.borderRadius").match(/50px/);
      ellipse.extent = pt(200, 100);
      expect(ellipse.shape()).deep.equals({style: {borderRadius: "200px/100px"}});
    });
  });
});
