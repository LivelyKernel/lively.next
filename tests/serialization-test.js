/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { createDOMEnvironment } from "../rendering/dom-helper.js";
import { morph, addWorldToDOM } from "../index.js";
import { expect } from "mocha-es6";
import { pt, Color } from "lively.graphics";
import { serializeMorph, deserializeMorph } from "../serialization.js";

var world, rendered;

function createDummyWorld() {
  world = morph({
    type: "world", name: "world", extent: pt(300,300),
    submorphs: [{
        name: "submorph1", extent: pt(100,100), position: pt(10,10), fill: Color.red,
        submorphs: [{name: "submorph2", extent: pt(20,20), position: pt(5,10), fill: Color.green}]
      }]
  });
}

async function createAndRenderDummyWorld() {
  createDummyWorld();
  rendered = addWorldToDOM(world, await createDOMEnvironment());
}

function cleanup() {
  rendered && rendered.destroy();
}


describe("morph serialization", () => {
  
  beforeEach(() => createAndRenderDummyWorld());
  afterEach(() => cleanup());

  it("serialize single morph", () => {
    var m = morph({fill: Color.red, position: pt(10,20)}),
        copy = deserializeMorph(serializeMorph(m));
    expect(copy).instanceOf(m.constructor);
    expect(copy).not.equal(m);
    expect(copy.position).equals(m.position);
    expect(copy.fill).equals(m.fill);
    expect(copy.extent).equals(m.extent);
  });

});
