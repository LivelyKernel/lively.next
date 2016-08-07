export * from "./morph.js";
export * from "./world.js";
export * from "./text.js";
export * from "./widgets.js";
export * from "./menus.js";
export * from "./html-morph.js";
export * from "./list.js";
export * from "./env.js";
export * from "./layout.js";
export { show } from "./markers.js"

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { World } from "./world.js";
import { Morph, Hand, Image, Ellipse } from "./morph.js";
import { Text } from "./text.js";
import { Button } from "./widgets.js";

export function morph(props = {}, opts = {restore: false}) {
  var klass = Morph;
  if (props.type) {
    if (typeof props.type === "function") klass = props.type;
    else if (typeof props.type === "string")
      switch (props.type.toLowerCase()) {
        case 'world':   klass = World; break;
        case 'hand':    klass = Hand; break;
        case 'image':   klass = Image; break;
        case 'ellipse': klass = Ellipse; break;
        case 'text':    klass = Text; break;
        case 'button':  klass = Button; break;
      }
  }

  return opts.restore ?
    new klass({[Symbol.for("lively-instance-restorer")]: true}).initFromJSON(props) :
    new klass(props);
}
