import { num, arr, installGlobals } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { EventDispatcher, Renderer, Morph, World } from "lively.morphic";

installGlobals();

var {world, renderer, eventHandler} = setupWorld();
var eventDispatcher = new EventDispatcher(window, world);
eventDispatcher.install();

world.eventDispatcher = eventDispatcher;
window.$world = world;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function setupWorld() {
  var world = new World({
    name: "world", extent: pt(window.innerWidth,window.innerHeight), submorphs: [
      {name: "icon", position: pt(0, 0), extent: pt(40,40), styleClasses: ["fa", "fa-search"]},
      {name: "morph 1", position: pt(20,20), origin: pt(0, 0), rotation: 0, extent: pt(200,200), fill: Color.blue, submorphs: [
        {name: "morph 2", position: pt(34,20), extent: pt(50,100), fill: Color.green}]}]})

  var renderer = new Renderer(world, document.getElementById("lively-world"));
  renderer.startRenderWorldLoop();

  return {world, renderer}
}
