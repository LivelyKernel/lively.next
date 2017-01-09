import { morph, MorphicEnv } from "lively.morphic";
import { createDOMEnvironment } from "lively.morphic/rendering/dom-helper.js";
import { pt } from "lively.graphics";

export async function buildTestWorld(spec = {type: "world", name: "world", extent: pt(300,300)}, pos = pt(0,0)) {
  var morphicEnv = new MorphicEnv(await createDOMEnvironment()),
      world = morph({...spec, env: morphicEnv});
  morphicEnv.domEnv.iframe.style = `position: absolute; top: ${pos.y}px; left: ${pos.x}px; width: 300px; height: 300px;`
  morphicEnv.setWorld(world);
  return morphicEnv;
}

export function destroyTestWorld(morphicEnv) {
  morphicEnv.uninstall();
}