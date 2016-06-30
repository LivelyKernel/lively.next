import { pt, Color } from "lively.graphics";
import { Renderer } from "./renderer.js";
import { Morph } from "./morph.js";

function test() {
  var world = new Morph({extent: pt(300,300)})
  world.extent;
  world.fill

  // r.stopRenderWorldLoop()
  var r = new Renderer()
  r.renderWorldLoop(world)

  world.fill = Color.white;
  world.fill = Color.random()
  world.undo()
  world.changes
  world.forceRender

  // $morph("vdomMorphTest").setHTMLString("")
    
  world.addMorph(new Morph({position: pt(34,20), extent: pt(50,100), fill: Color.green}))
  world.addMorph(new Morph({position: pt(104,20), extent: pt(50,100), fill: Color.red}))
  
  world.submorphs[1].position = pt(140, 20)
}