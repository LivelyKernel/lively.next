/*global declare, it, describe, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";
import { Morph, Renderer, Ellipse, Image } from "../index.js";
import { pt, Color } from "lively.graphics";


describe("morphic", () => {

  var world, submorph1, submorph2, submorph3, renderer, domNode, image, ellipse;

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
        {name: "submorph3", extent: pt(50,50), position: pt(200,20), fill: Color.yellow,
         submorphs: [new Ellipse({name: "ellipse", extent: pt(100,100), position: pt(42,42), fill: Color.pink}),
                     new Image({name: "image", extent: pt(100,100), position: pt(42,42), fill: Color.pink})]}
      ]
    });
    image = world.submorphs[1].submorphs[1];
    ellipse = world.submorphs[1].submorphs[0];
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

  describe("shapes", () => {

    it("shape influences node style", () => {
      const style = domNode.childNodes[1].childNodes[0].style;
      expect(style.borderRadius).equals("100px");
      expect(style.position).equals("absolute");
    });

    it("morph type influences node type", () => {
      expect(ellipse._nodeType).equals("div");
      expect(image._nodeType).equals("img");
    });

    it("morph type influences node attributes", () => {
      const ellipseNode = domNode.childNodes[1].childNodes[0];
      const imageNode = domNode.childNodes[1].childNodes[1];
      expect(ellipseNode).not.to.have.property('src');
      expect(imageNode).to.have.property('src');
    });

    it("shape translates morph attributes to style", () => {
      expect(ellipse.shape()).deep.equals({style: {borderRadius: "100px/100px"}});
      ellipse.extent = pt(200, 100);
      expect(ellipse.shape()).deep.equals({style: {borderRadius: "200px/100px"}});
    });
  });
});
