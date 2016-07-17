import { num, arr, installGlobals } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { EventDispatcher, Renderer, Morph, World } from "lively.morphic";
import { ObjectDrawer } from "lively.morphic/widgets.js";

installGlobals();

var {world, renderer, eventHandler} = setupWorld();
var eventDispatcher = new EventDispatcher(window, world);
eventDispatcher.install();

world.eventDispatcher = eventDispatcher;
window.$world = world;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function setupWorld() {
  var world = new World({name: "world", extent: pt(window.innerWidth,window.innerHeight)})
  world.addMorph(new ObjectDrawer());

  var renderer = new Renderer(world, document.getElementById("lively-world"));
  renderer.startRenderWorldLoop();

  return {world, renderer}
}
