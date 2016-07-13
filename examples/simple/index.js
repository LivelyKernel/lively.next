import { num, arr, installGlobals } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { EventDispatcher, Renderer, Morph, World } from "lively.morphic/morph.js";

installGlobals();

var {world, renderer, eventHandler} = setupWorld();
var eventDispatcher = new EventDispatcher(window, world);
eventDispatcher.install();

world.eventDispatcher = eventDispatcher;

window.$world = world;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function setupWorld() {
  var world = new World({
    name: "world", extent: pt(300,300), submorphs: [
      {name: "morph 1", position: pt(20,20), extent: pt(200,200), fill: Color.red, submorphs: [
        {name: "morph 2", position: pt(34,20), extent: pt(50,100), fill: Color.green}]}]})
  
  var renderer = new Renderer(world, document.getElementById("lively-world"));
  renderer.startRenderWorldLoop();

  return {world, renderer}
}
