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

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import L2LClient from "lively.2lively/client.js";
import ClientCommand from "lively.shell/client-command.js";
import { resourceExtension } from "lively.shell/client-resource.js";
import { registerExtension } from "lively.resources";

startLively2Lively()
  .then(() => console.log("[lively.2lively] setup done"))
  .catch(err => console.error(err))

async function startLively2Lively() {
  // await lively.modules.removePackage("http://localhost:9001/node_modules/lively.server");
  // await lively.modules.removePackage("socket.io-client");
  // await lively.modules.removePackage("http://localhost:9001/node_modules/lively.2lively");
  // await lively.modules.importPackage("http://localhost:9001/node_modules/lively.2lively");

  // await lively.modules.importPackage("http://localhost:9001/node_modules/lively.shell");

  // await System.normalize("socket.io-client", System.decanonicalize("lively.2lively/client.js"))


  var l2lURL = `${document.location.origin}/lively-socket.io`;
  var l2lURL = `http://localhost:9010/lively-socket.io`;
  var client1 = await L2LClient.ensure({url: l2lURL, namespace: "l2l"});
  ClientCommand.installLively2LivelyServices(client1);
  resourceExtension.resourceClass.defaultL2lClient = client1;
  registerExtension(resourceExtension);
  
  // var cmd = new ClientCommand(client1)
  // await cmd.spawn({command: "ls"})
  // cmd.stdout

}
