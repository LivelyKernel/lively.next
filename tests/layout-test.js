/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { Morph, VerticalLayout, HorizontalLayout, TilingLayout, GridLayout, MorphicEnv } from "../index.js";
import { pt, Color, Rectangle } from "lively.graphics";
import { num, arr } from "lively.lang";

var world, m, env, domEnv;

function createDummyWorld() {
  world = new Morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: [new Morph({
      layout: new VerticalLayout(),
      center: pt(150,150), 
      extent: pt(200, 400),
      submorphs: [
        new Morph({name: "m1", extent: pt(100,100)}),
        new Morph({name: "m2", extent: pt(50,50)}),
        new Morph({name: "m3", extent: pt(100, 50)})
    ]})]
  });
  m = world.submorphs[0];
  return world;
}

describe("layout", () => {
  
  beforeEach(async () => env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment())).setWorld(createDummyWorld()));
  afterEach(() =>  MorphicEnv.popDefault().uninstall());
  
  describe("vertical layout", () => {
    
    it("renders submorphs vertically", () => {
      const [item1, item2, item3] = m.submorphs;
      expect(item1.position).equals(pt(0,0));
      expect(item2.position).equals(item1.bottomLeft);
      expect(item3.position).equals(item2.bottomLeft);
    });
    
    it("adjusts layout when submorph changes extent", () => {
      const [item1, item2, item3] = m.submorphs;
      item2.extent = pt(100,100);
      expect(item1.position).equals(pt(0,0));
      expect(item2.position).equals(item1.bottomLeft);
      expect(item3.position).equals(item2.bottomLeft);
    });
    
    it("adjusts layout when submorph is removed", () => {
      const [item1, item2, item3] = m.submorphs;
      item2.remove();
      expect(item3.position).equals(item1.bottomLeft);
    });
    
    it("adjusts layout when submorph is inserted", () => {
      const [item1, item2, item3] = m.submorphs,
            item4 = new Morph({extent: pt(200,200)});
      m.addMorphAt(item4, 1);
      expect(item4.position).equals(item1.bottomLeft);
      expect(item2.position).equals(item4.bottomLeft);
    });
    
    it("can vary the spacing between submorphs", () => {
      const [item1, item2, item3] = m.submorphs;
      m.layout = new VerticalLayout({spacing: 10});
      expect(item2.position).equals(item1.bottomLeft.addPt(pt(0,10)));
      expect(item3.position).equals(item2.bottomLeft.addPt(pt(0,10)));
    });
  
    it("adjusts width to widest item", () => {
      const maxWidth = arr.max(m.submorphs.map( m => m.width ));
      expect(m.width).equals(maxWidth);
    });

    it("adjusts height to number of items", () => {
      const totalHeight = m.submorphs.reduce((h, m) => h + m.height, 0)
      expect(m.height).equals(totalHeight);
    });
  
  });

    

  describe("horizontal layout", () => {
    
     beforeEach(() => {
       m.layout = new HorizontalLayout();
     });
    
    it("renders submorphs horizontally", () => {
      const [item1, item2, item3] = m.submorphs;
      expect(item1.position).equals(pt(0,0));
      expect(item2.position).equals(item1.topRight);
      expect(item3.position).equals(item2.topRight);
    });
    
    it("adjusts width to number of items", () => {
      const totalWidth = m.submorphs.reduce( (w,m) => w + m.width, 0);
      expect(m.width).equals(totalWidth);
    });

    it("adjusts height to highest item", () => {
      const maxHeight = arr.max(m.submorphs.map(m => m.height))
      expect(m.height).equals(maxHeight);
    });
    
    it("enforces minimum height and minimum width", () => {
      m.extent = pt(50,50);
      expect(m.height).equals(100);
      expect(m.width).equals(250);
    });
    
  });
  
  describe("tiling layout", () => {
    
     beforeEach(() => {
       m.layout = new TilingLayout();
       m.width = 200;
     });
    
    it("tiles submorphs to fit the bounds", () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m1.position).equals(pt(0,0));
      expect(m2.position).equals(m1.topRight);
      expect(m3.position).equals(m1.bottomLeft);
    });
    
    it("updates layout on changed extent", () => {
      const [m1, m2, m3] = m.submorphs;
      m.extent = pt(400, 100);
      expect(m1.position).equals(pt(0,0));
      expect(m2.position).equals(m1.topRight);
      expect(m3.position).equals(m2.topRight);
    });
    
  });
  
    describe("grid layout", () => {
    
     beforeEach(() => {
       m.layout = new TilingLayout();
     });
    
    it("aligns submorphs along a grid", () => {
      
    });
    
  });
  
})