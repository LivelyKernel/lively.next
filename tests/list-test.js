/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { expect } from "mocha-es6";
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { Morph, List, Renderer } from "../index.js";
import { pt, Color, Rectangle } from "lively.graphics";
import { num, arr } from "lively.lang";

var world, list, renderer, domEnv;

function createDummyWorld() {
  world = new Morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: [new List({center: pt(150,150), items: [
      new Morph({extent: pt(100,100)}),
      new Morph({extent: pt(42,42)}),
      new Morph({extent: pt(100, 42)})
    ]})]
  });
  list = world.submorphs[0];
}

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

describe("list morph", () => {
  
  beforeEach(async () => createAndRenderDummyWorld());
  afterEach(() => cleanup());
  
  describe("vertical layout", () => {
    
    it("renders items vertically", () => {
      const [item1, item2, item3] = list.submorphs;
      expect(item1.position).equals(pt(0,0));
      expect(item2.position).equals(item1.bottomLeft);
      expect(item3.position).equals(item2.bottomLeft);
    });
    
    it("adjusts width to widest item", () => {
      const maxWidth = arr.max(list.items.map( m => m.width ));
      expect(list.width).equals(maxWidth);
    });
  
    it("adjusts height to number of items", () => {
      const totalHeight = list.items.reduce((h, m) => h + m.height, 0)
      expect(list.height).equals(totalHeight);
    });
    
    it("adjusts layout when item is removed", () => {
      const [item1, item2, item3] = list.submorphs;
      list.removeItem(item2);
      expect(list.items.length).equals(2);
      expect(item3.position).equals(item1.bottomLeft);
      expect(list.height).equals(142);
    });
    
    it("adjusts layout when item is inserted", () => {
      const [item1, item2, item3] = list.submorphs,
            item4 = new Morph({extent: pt(200,200)});
      list.addItemAt(item4, 1);
      expect(list.items.length).equals(4);
      expect(item4.position).equals(item1.bottomLeft);
      expect(list.width).equals(200);
      expect(list.height).equals(384);
    });
  
  });

    

  describe("horizontal layout", () => {
    
     beforeEach(() => {
       list.layoutPolicy = "horizontal";
       list.applyLayout();
     });
    
    it("renders items horizontally", () => {
      const [item1, item2, item3] = list.submorphs;
      expect(item1.position).equals(pt(0,0));
      expect(item2.position).equals(item1.topRight);
      expect(item3.position).equals(item2.topRight);
    });
    
    it("adjusts width to number of items", () => {
      const totalWidth = list.items.reduce( (w,m) => w + m.width, 0);
      expect(list.width).equals(totalWidth);
    });
    
    it("adjusts height to highest item", () => {
      const maxHeight = arr.max(list.items.map(m => m.height))
      expect(list.height).equals(maxHeight);
    });
    
  });
  
})
