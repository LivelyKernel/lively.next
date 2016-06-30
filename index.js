import { pt, Color } from "lively.graphics";
import { Renderer } from "./renderer.js";
import { Morph } from "./morph.js";

function test() {
  var world = new Morph({extent: pt(300,300)})
  world.extent;

  var r = new Renderer()
  r.renderWorldLoop(world)
  // r.stopRenderWorldLoop()

  world.fill = Color.white;

  // $morph("vdomMorphTest").setHTMLString("")
    
  world.addMorph(new Morph({position: pt(34,20), extent: pt(50,100), fill: Color.green}))
  world.addMorph(new Morph({position: pt(104,20), extent: pt(50,100), fill: Color.red}))
  
  world.submorphs[1].position = pt(140, 20)
}