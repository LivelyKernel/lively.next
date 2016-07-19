import { num, arr, installGlobals } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { EventDispatcher, Renderer, Morph, World } from "lively.morphic";
import { ObjectDrawer } from "lively.morphic/widgets.js";

installGlobals();

var {world, renderer, eventDispatcher} = setupWorld();
world.eventDispatcher = eventDispatcher;
window.$$world = world;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function setupWorld() {
  var world = new World({name: "world", extent: pt(window.innerWidth, window.innerHeight)}),
      renderer = new Renderer(world, document.getElementById("lively-world")).startRenderWorldLoop(),
      eventDispatcher = new EventDispatcher(window, world).install();
  world.addMorph(new ObjectDrawer());


  return {world, renderer, eventDispatcher}
}
