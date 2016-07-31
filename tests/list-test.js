/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { MorphicEnv } from "../index.js";
import { expect } from "mocha-es6";
import { Morph, List } from "../index.js";
import { pt, Color, Rectangle } from "lively.graphics";
import { num, arr } from "lively.lang";

var world, list;
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
  return world;
}

describe("list morph", () => {

  beforeEach(async () => MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment())).setWorld(createDummyWorld()));
  afterEach(() =>  MorphicEnv.popDefault().uninstall());

  describe("vertical layout", () => {

    it("adjusts width to widest item", () => {
      const maxWidth = arr.max(list.items.map( m => m.width ));
      expect(list.width).equals(maxWidth);
    });

    it("adjusts height to number of items", () => {
      const totalHeight = list.items.reduce((h, m) => h + m.height, 0)
      expect(list.height).equals(totalHeight);
    });
  });



  describe("horizontal layout", () => {

     beforeEach(() => {
       list.layoutPolicy = "horizontal";
       list.applyLayout();
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
