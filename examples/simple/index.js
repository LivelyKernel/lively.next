import { num, arr, installGlobals } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { EventDispatcher, Renderer, Morph, World } from "lively.morphic";
import { ObjectDrawer, Window, Button} from "lively.morphic/widgets.js";

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
  world.addMorph(new Window({name: "Alice", extent: pt(300, 300), position: pt(200,200),
                             submorphs: [new Button({label: "Click me!", bottomLeft: pt(10,290)}), new Button({label: "Click me!", bottomRight: pt(220,290), active: false})]}));
  world.addMorph(new Window({name: "Bob", extent: pt(200, 300), position: pt(600,200),
                             submorphs: []})); 
    world.addMorph(new Window({name: "Carlo", extent: pt(200, 300), position: pt(800,200)}));

  return {world, renderer, eventDispatcher}
}
