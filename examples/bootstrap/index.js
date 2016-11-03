import { arr } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { Morph, World, List, Polygon, MorphicEnv, show } from "lively.morphic";
import ObjectDrawer from "lively.morphic/object-drawer.js";
import Workspace from "lively.morphic/ide/js/workspace.js";

var world = new World({
  name: "world",
  extent: pt(window.innerWidth, window.innerHeight),
  submorphs: [
    new ObjectDrawer(),
    new Workspace({name: "workspace", extent: pt(500, 600), position: pt(200,200)})
  ]

});

world.get("workspace").targetMorph.doSave = function() {
  show("saved!");
  localStorage.setItem('lively workspace', this.textString)
}

var code = localStorage.getItem('lively workspace');
if (code) world.get("workspace").targetMorph.textString = code;

MorphicEnv.default().setWorld(world);

window.$$world = world;


window.addEventListener('beforeunload', function(evt) {
  var msg = "Really?";
  evt.returnValue = msg;
  return msg;
}, true);
