/*global declare, it, describe, beforeEach, afterEach*/
import { createDOMEnvironment } from "../dom-helper.js";
import { morph, Renderer } from "../index.js";
import { expect, chai} from "mocha-es6";
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
      submorph3.toString = () => "oink"
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  describe("geometric transformations", () => {

    it("localizes position", function() {
        var morph1 = morph(), morph2 = morph();
        world.addMorph(morph1);
        morph1.addMorph(morph2);
        morph2.position = pt(10,10);
        expect(pt(0,0)).equals(morph2.localize(pt(10,10)));
    });

  });

  xdescribe("contains point", () => {
    
    it("testMorphsContainingPoint", function() {
        var morph = lively.morphic.Morph.makeRectangle(0, 0, 100, 100),
            submorph = lively.morphic.Morph.makeRectangle(20, 20, 30, 30),
            subsubmorph = lively.morphic.Morph.makeRectangle(25, 25, 5, 5),
            morph2 = lively.morphic.Morph.makeRectangle(48, 48, 100, 100);
        this.world.addMorph(morph)
        morph.addMorph(submorph)
        submorph.addMorph(subsubmorph)
        this.world.addMorph(morph2)

        var result, expected;

        result = morph.morphsContainingPoint(pt(-1,-1));
        this.assertEquals(0, result.length, 'for ' + pt(-1,-1));

        result = morph.morphsContainingPoint(pt(1,1));
        this.assertEquals(1, result.length, 'for ' + pt(1,1));
        this.assertEquals(morph, result[0], 'for ' + pt(1,1));

        result = morph.morphsContainingPoint(pt(40,40));
        this.assertEquals(2, result.length, 'for ' + pt(40,40));
        this.assertEquals(submorph, result[0]);
        this.assertEquals(morph, result[1]);

        result = morph.morphsContainingPoint(pt(45,45));
        this.assertEquals(3, result.length, 'for ' + pt(45,45));
        this.assertEquals(subsubmorph, result[0]);
        this.assertEquals(submorph, result[1]);
        this.assertEquals(morph, result[2]);

        result = this.world.morphsContainingPoint(pt(48,48));
        this.assertEquals(5, result.length, 'for ' + pt(48,48));
        this.assertEquals(morph2, result[0]);
        this.assertEquals(subsubmorph, result[1]);
        this.assertEquals(submorph, result[2]);
        this.assertEquals(morph, result[3]);
        this.assertEquals(this.world, result[4]);
    });

    it("testMorphsContainingPointWithAddMorphFront", function() {
        var morph1 = lively.morphic.Morph.makeRectangle(0, 0, 100, 100),
            morph2 = lively.morphic.Morph.makeRectangle(0, 0, 100, 100);

        this.world.addMorph(morph1);
        this.world.addMorphBack(morph2);

        var result = this.world.morphsContainingPoint(pt(1,1));
        this.assertEquals(3, result.length);

        this.assertEquals(morph1, result[0], 'for ' + pt(1,1));
        this.assertEquals(morph2, result[1], 'for ' + pt(1,1));
    });

    it("testMorphsContainingPointDoesNotIncludeOffsetedOwner", function() {
        var owner = lively.morphic.Morph.makeRectangle(0, 0, 100, 100),
            submorph = lively.morphic.Morph.makeRectangle(110, 10, 90, 90),
            other = lively.morphic.Morph.makeRectangle(100, 0, 100, 100);

        owner.name = 'owner'; submorph.name = 'submorph'; other.name = 'other';
        this.world.addMorph(owner)
        owner.addMorph(submorph)
        this.world.addMorphBack(other)

        var result = this.world.morphsContainingPoint(pt(150,50));
        this.assertEquals(3, result.length, 'for ' + pt(150,50));
        this.assertEquals(this.world, result[2], 'for 2');
        this.assertEquals(other, result[1], 'for 1');
        this.assertEquals(submorph, result[0], 'for 0');
    });

  });

  xdescribe("bounds", () => {

    it("testMorphBounds", function() {
        var morph1 = new lively.morphic.Morph(),
            morph2 = new lively.morphic.Morph();
        this.world.addMorph(morph1);
        morph1.addMorph(morph2);
        morph1.setBounds(rect(100, 100, 40, 40));
        morph2.setBounds(rect(20, 10, 40, 40));
        this.assertEquals(rect(100, 100, 60, 50), morph1.getBounds());
    });

    it("testMorphBoundsOnCreation", function() {
        var bounds = rect(30, 90, 30, 60),
            shape = new lively.morphic.Shapes.Rectangle(bounds);
        this.assertEquals(bounds, shape.getBounds(), 'shape bounds');
        var morph = new lively.morphic.Morph(shape);
        this.assertEquals(bounds, morph.getBounds(), 'morph bounds');
    });

    it("testMorphBoundsChangeOnExtentPositionScaleRotationTransformChanges", function() {
        this.epsilon = 0.01;
        var morph = new lively.morphic.Morph();
        morph.setBounds(rect(100, 100, 40, 40));
        this.assertEqualsEpsilon(rect(100, 100, 40, 40), morph.getBounds(), "setBounds");
        morph.setExtent(pt(50,50));
        this.assertEqualsEpsilon(rect(100, 100, 50, 50), morph.getBounds(), "setExtent");
        morph.setPosition(pt(150,50));
        this.assertEqualsEpsilon(rect(150, 50, 50, 50), morph.getBounds(), "setPosition");
        morph.setScale(2);
        this.assertEqualsEpsilon(rect(150, 50, 100, 100), morph.getBounds(), "setScale");
        morph.setTransform(new lively.morphic.Similitude(pt(0,0)));
        this.assertEqualsEpsilon(rect(0,0 , 50, 50), morph.getBounds(), "setTransform");
        morph.rotateBy((45).toRadians());
        this.assertEqualsEpsilon(rect(-35.36, 0, 70.71, 70.71), morph.getBounds(), "setRotation");
    });

    it("testBorderWidthDoesNotAffectsBounds", function() {
        var morph = new lively.morphic.Morph();
        morph.setBounds(rect(100, 100, 40, 40));
        morph.setBorderWidth(4);
        this.assertEquals(rect(100, 100, 40, 40), morph.getBounds());
    });

    it("testSubmorphsAffectBounds", function() {
        var morph1 = new lively.morphic.Morph(),
            morph2 = new lively.morphic.Morph();
        morph1.setBounds(rect(100, 100, 40, 40));
        this.assertEquals(rect(100, 100, 40, 40), morph1.getBounds());
        morph2.setBounds(rect(-10,0, 20, 50));
        morph1.addMorph(morph2);
        this.assertEquals(rect(90, 100, 50, 50), morph1.getBounds());
        morph2.remove();
        this.assertEquals(rect(100, 100, 40, 40), morph1.getBounds());
    });

  });
});
