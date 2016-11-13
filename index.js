export { default as config } from "./config.js";
export * from "./morph.js";
export * from "./world.js";
export * from "./text/morph.js";
export * from "./text/label.js";
export * from "./buttons.js";
export * from "./widgets.js";
export * from "./menus.js";
export * from "./html-morph.js";
export * from "./list.js";
export * from "./env.js";
export * from "./layout.js";
export { show } from "./markers.js"
export { default as Window } from "./window.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { World } from "./world.js";
import { Morph, Hand, Image, Ellipse, Triangle, Path, Polygon } from "./morph.js";
import { List } from "./list.js";
import { Text } from "./text/morph.js";
import { Label } from "./text/label.js";
import { Button } from "./buttons.js";
import { CheckBox } from "./widgets.js";

export function morph(props = {}, opts = {restore: false}) {
  var klass = Morph;
  if (props.type) {
    if (typeof props.type === "function") klass = props.type;
    else if (typeof props.type === "string")
      switch (props.type.toLowerCase()) {
        case 'world':    klass = World; break;
        case 'hand':     klass = Hand; break;
        case 'image':    klass = Image; break;
        case 'ellipse':  klass = Ellipse; break;
        case 'triangle': klass = Triangle; break;
        case 'path':     klass = Path; break;
        case 'text':     klass = Text; break;
        case 'label':    klass = Label; break;
        case 'list':     klass = List; break;
        case 'button':   klass = Button; break;
        case 'checkbox': klass = CheckBox; break;
        case 'polygon': klass = Polygon; break;
      }
  }

  return opts.restore ?
    new klass({[Symbol.for("lively-instance-restorer")]: true}).initFromJSON(props) :
    new klass(props);
}

async function lazyInspect(obj) {
  // lazy load
  var {inspect: realInspect} = await System.import("lively.morphic/ide/js/inspector.js")
  inspect = realInspect;
  return realInspect(obj);
}

export var inspect = lazyInspect;