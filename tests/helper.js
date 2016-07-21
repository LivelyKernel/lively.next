import { createDOMEnvironment } from "../dom-helper.js";
import { EventDispatcher } from "../events.js";
import { morph, Renderer } from "../index.js";
import { pt } from "lively.graphics";

export async function buildTestWorld(spec = {type: "world", name: "world", extent: pt(300,300)}, pos = pt(0,0)) {
  var world = morph(spec),
      domEnv = await createDOMEnvironment(),
      renderer = new Renderer(world, domEnv.document.body, domEnv);
  domEnv.iframe.style = `position: absolute; top: ${pos.y}px; left: ${pos.x}px; width: 300px; height: 300px;`
  renderer.startRenderWorldLoop();
  var eventDispatcher = new EventDispatcher(domEnv.window, world).install();
  return {renderer, eventDispatcher, domEnv, world}
}

export function destroyTestWorld(worldState) {
  var {renderer, eventDispatcher, domEnv, world} = worldState;
  eventDispatcher && eventDispatcher.uninstall();
  renderer && renderer.clear();
  domEnv.destroy();
}