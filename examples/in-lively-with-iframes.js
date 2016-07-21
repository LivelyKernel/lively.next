import { obj, num, arr, string } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { Renderer } from "lively.morphic/renderer.js";
import { morph, EventDispatcher } from "lively.morphic";
import { Client, Master } from "lively.morphic/sync.js";
import { buildTestWorld, destroyTestWorld } from "lively.morphic/tests/helper.js";

var env1 = await buildTestWorld({type: "world", name: "world", extent: pt(300,300)}, pt(0,0)),
    env2 = await buildTestWorld(env1.world.exportToJSON(), pt(0,300)),
    env3 = await buildTestWorld(env1.world.exportToJSON(), pt(0,600));

var client1 = new Client(env1.world),
    client2 = new Client(env2.world),
    master = new Master(env3.world);

master.clients = [client1, client2];
client1.master = client2.master = master;

env1.world.signalMorphChange = function(change, morph) { client1.newChange(change) }
env2.world.signalMorphChange = function(change, morph) { client2.newChange(change) }


env1.world.addMorph({type: 'image', extent: pt(50,50), position: Point.random(pt(200,200))})

// cleanup
// destroyTestWorld(env1); destroyTestWorld(env2); destroyTestWorld(env3);
