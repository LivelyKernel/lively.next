import { pt, Color, Point } from "lively.graphics";
import { Renderer } from "lively.morphic/renderer.js";
import { Morph } from "lively.morphic/morph.js";

var {scrollWidth: w, scrollHeight: h} = document.body,
    world = new Morph({extent: pt(w, h)}),
    m1 = new Morph({position: pt(20,20), extent: pt(200,200), fill: Color.red}),
    m2 = new Morph({position: pt(34,20), extent: pt(50,100), fill: Color.green})

world.addMorph(m1)
m1.addMorph(m2)

var r = new Renderer()
r.renderWorldLoop(world, document.getElementById("lively-world"));
