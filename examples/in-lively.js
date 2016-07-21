import { obj, num, arr, string } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { morph, EventDispatcher, Renderer } from "lively.morphic";
import { Client, Master } from "lively.sync";

if (!$morph("vdomMorphTest")) {
  var canvas = lively.PartsBin.getPart("HTMLWrapperMorph", "PartsBin/HTML/")
  canvas.name = "vdomMorphTest";
  canvas.setExtent(pt(1100, 400));
  var win = canvas.openInWindow().openInWorldCenter().comeForward();
  win.name += "-window";
}

$morph("vdomMorphTest").setHTMLString(`
<div id="world1"></div>
<div style="position: relative; left: 330px" id="world2"></div>
<div style="position: relative; left: 730px" id="world3"></div>
`)

var rootNode1 = $morph("vdomMorphTest").renderContext().shapeNode.querySelector("#world1")
var rootNode2 = $morph("vdomMorphTest").renderContext().shapeNode.querySelector("#world2")
var rootNode3 = $morph("vdomMorphTest").renderContext().shapeNode.querySelector("#world3")

var world1 = morph({type: "world", name: "world1", extent: pt(300,300)})
var r1 = new Renderer(world1, rootNode1)
r1.startRenderWorldLoop()
var m1 = world1.addMorph({name: "m1", position: pt(20,20), extent: pt(200,200), fill: Color.red})

await lively.lang.promise.waitFor(() => !world1._unrenderedChanges.length)

var world2 = morph(world1.exportToJSON())
var r2 = new Renderer(world2, rootNode2)
r2.startRenderWorldLoop()

var world3 = morph(world1.exportToJSON())
var r3 = new Renderer(world3, rootNode3)
r3.startRenderWorldLoop()

var eventDispatcher1 = new EventDispatcher(rootNode1, world1); eventDispatcher1.install();
var eventDispatcher2 = new EventDispatcher(rootNode2, world2); eventDispatcher2.install();
var eventDispatcher3 = new EventDispatcher(rootNode3, world3); eventDispatcher3.install();



var client1 = new Client(world1), client2 = new Client(world3), master = new Master(world2);
master.clients = [client1, client2]
client1.master = master;
client2.master = master;

world1.signalMorphChange = function(change, morph) { client1.newChange(change) }
world3.signalMorphChange = function(change, morph) { client2.newChange(change) }

// cleanup
// r1.clear(); r2.clear(); r3.clear(); eventDispatcher1.uninstall(); eventDispatcher2.uninstall(); eventDispatcher3.uninstall();
