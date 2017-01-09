import { obj, num, arr, string } from "lively.lang";
import { pt, Color, Point } from "lively.graphics";
import { morph, EventDispatcher } from "lively.morphic";
import { Client, Master } from "lively.sync";
import { destroyTestWorld, buildTestWorld } from "../tests/helper.js";
import { disconnectAll, connect, disconnect } from "lively.bindings";

export async function buildWorlds() {
  var nClients = 2;
  var state = {};

  var masterEnv = state.masterEnv = await buildTestWorld({type: "world", name: "world", extent: pt(300,300)}, pt(0,0)),
      master = state.master = new Master(masterEnv.world);
  state.masterWorld = masterEnv.world;

  for (var i = 0; i < nClients; i++) {
    let env = state[`env${i+1}`] = await buildTestWorld(masterEnv.world.exportToJSON(), pt(0,300*(i+1))),
        client = state[`client${i+1}`] = new Client(env.world, `client${i+1}`);
    client.connectToMaster(master);
    state[`world${i+1}`] = env.world;
    connect(env.changeManager, 'changeRecorded', client, 'newChange');
  }
  state.running = true;

  // env1.world.addMorph({type: 'image', extent: pt(50,50), position: Point.random(pt(200,200))})

  return state;
}

export async function cleanup(state) {
  if (!state.running) return;
  state.running = false;

  destroyTestWorld(state.masterEnv);

  Object.keys(state).forEach(name => {
    if (name.match(/^env/)) {
      var env = state[name];
      disconnectAll(env.changeManager)
      try {
        destroyTestWorld(env);
      } catch (e) { console.error(e); }
    } else if (name.match(/^client/)) {
      var client = state[name];
      client.disconnectFromMaster();
      client.receive = function() {};
    }
  });
}

// var state = await buildWorlds()
// state.world1.addMorph({extent: pt(100,100), fill: Color.random(), grabbable: false})
// state.client2.goOffline()
// state.client2.goOnline()
// await cleanup(state)
