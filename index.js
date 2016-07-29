export { Renderer } from "./rendering/renderer.js";
export * from "./events.js";
export * from "./morph.js";
export * from "./world.js";
export * from "./text.js";
export * from "./menus.js";
export * from "./html-morph.js";
export * from "./list.js";
export { show } from "./markers.js"

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { World } from "./world.js";
import { Morph, Hand, Image, Ellipse } from "./morph.js";
import { Text } from "./text.js";

export function morph(props = {}, opts = {restore: false}) {
  var klass;
  switch (props.type) {
    case 'world':   klass = World; break;
    case 'hand':    klass = Hand; break;
    case 'image':   klass = Image; break;
    case 'ellipse': klass = Ellipse; break;
    case 'text':    klass = Text; break;
    default:        klass = Morph;
  }
  return opts.restore ?
    new klass({[Symbol.for("lively-instance-restorer")]: true}).initFromJSON(props) :
    new klass(props);
}


import { Renderer } from "./rendering/renderer.js";
import { EventDispatcher } from "./events.js";

export function addWorldToDOM(world, domEnv = {window, document, destroy() {}}) {
  var renderer = new Renderer(world, domEnv.document.body, domEnv).startRenderWorldLoop(),
      eventDispatcher = new EventDispatcher(domEnv.window, world).install();
  world.makeDirty();
  return {
    world, renderer, eventDispatcher,
    destroy() { renderer.clear(); eventDispatcher.uninstall(); domEnv.destroy(); }
  }
}
