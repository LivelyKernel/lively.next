import { arr } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { Morph, World, List, Polygon, MorphicEnv } from "lively.morphic";
import { Window, Button} from "lively.morphic/widgets.js";
import { ObjectDrawer, Workspace } from "lively.morphic/tools.js";

var world = new World({
  name: "world",
  extent: pt(window.innerWidth, window.innerHeight),
  submorphs: [
    new ObjectDrawer(),

    new List({items: arr.range(0,2000).map(n => "item " + n), position: pt(20, 300), extent: pt(140, 200), borderWidth: 1, borderColor: Color.gray}),

    new Window({
      name: "Alice", extent: pt(300, 300), position: pt(200,200),
      submorphs: [
        new Button({label: "Click me!", bottomLeft: pt(10,290)}), 
        new Button({label: "Click me!", bottomRight: pt(220,290), active: false}),
        new Polygon({
          name: "poly", vertices: [pt(0,0), pt(100,50), pt(50, 100)],
          extent: pt(102,102), fill: Color.orange})
      ]}),

    new Workspace({extent: pt(200, 300), position: pt(800,200)})
  ]
});

MorphicEnv.default().setWorld(world);

window.$$world = world;


window.addEventListener('beforeunload', function(evt) {
  var msg = "Really?";
  evt.returnValue = msg;
  return msg;
}, true);
