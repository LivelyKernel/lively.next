import { pt, Color, Point } from "lively.graphics";
import { morph, MorphicEnv, EventDispatcher } from "lively.morphic";
import Master from "lively.mirror/master.js";
import Client from "lively.mirror/client.js";
import { createDOMEnvironment } from "lively.morphic/rendering/dom-helper.js";
import Workspace from "lively.morphic/ide/js/workspace.js";

async function buildMasterWorld(spec = {type: "world", name: "world", extent: pt(300, 300)}, pos = pt(0, 0)) {
  var morphicEnv = new MorphicEnv(await createDOMEnvironment()), world = morph({...spec, env: morphicEnv});
  morphicEnv.domEnv.iframe.style = `position: absolute; top: ${ pos.y }px; left: ${ pos.x }px; width: ${spec.extent.x}px; height: ${spec.extent.y}px;`;
  morphicEnv.setWorld(world);
  return morphicEnv;
}

async function buildClientWorld(spec = {type: "world", name: "world", extent: pt(300, 300)}, pos = pt(0, 0)) {
  var domEnv = await createDOMEnvironment();
  domEnv.iframe.style = `position: absolute; top: ${ pos.y }px; left: ${ pos.x }px; width: ${spec.extent.x}px; height: ${spec.extent.y}px;`;
  return domEnv;
}

async function cleanup(state) {
  state.stop();

  await state.master.disconnect();
  Master.removeInstance(state.master.id);
  await state.masterEnv.uninstall();

  Client.removeInstance(state.client.id);
  await state.clientEnv.destroy();
}

export async function buildWorlds() {
  var messages = [],
      masterId = `master-mirror-client`,
      clientId = `test-mirror-client`,
      clientEnv = await buildClientWorld({extent: pt(300,300)}, pt(0,300)),
      clientChannel = {
        send(selector, data) {
          // data = JSON.parse(JSON.stringify(data));
          Master.invokeServices(selector, {masterId, ...data});
        }
      },
      // clientRootNode = clientEnv.document.body.appendChild(clientEnv.document.createElement("div")),
      clientRootNode = clientEnv.document.body,
      client = Client.createInstance(clientId, clientChannel, clientRootNode),

      masterEnv = await buildMasterWorld({type: "world", name: "world", extent: pt(300,300)}, pt(0,0)),
      masterChannel = {
        send(selector, data) {
          messages.push({selector, data});
          return Client.invokeServices(selector, data);
        }
      },
      master = Master.createInstance(masterId, masterEnv.world, masterChannel, client.id);

  var updateProcessMaster = null;

  function start() {
    if (!updateProcessMaster) updateProcessMaster = setInterval(() => master.sendUpdate());
  }

  function stop() {
    if (updateProcessMaster) {
      clearInterval(updateProcessMaster);
      updateProcessMaster = null;
    }
  }

  return {
    messages,
    master, masterEnv,
    client, clientEnv,
    start, stop
  }
}


async function test() {
  var state = await buildWorlds();
  var m = state.masterEnv.world.addMorph({type: "text", textString: "test", extent: pt(100,100), fill: Color.yellow})
  // var r = state.masterEnv.world.addMorph({extent: pt(100,100), fill: Color.random()})
  // var w = state.masterEnv.world.addMorph(new Workspace())
  await state.master.sendUpdate();

  m.selectAll()
  await state.master.sendUpdate();

  return state;
}

// var a = state.clientEnv.document.body.innerHTML
// var b = state.clientEnv.document.body.innerHTML

// state = await test()
// state.master.sendUpdate()
// await cleanup(state)
// var m = state.masterEnv.world.submorphs[0]
// state.masterEnv.world.execCommand("open workspace")
// m.collapseSelection()

// state.client.rootNode.childNodes[0].outerHTML

// var state = await buildWorlds();
// state.start()
// var m = state.masterEnv.world.addMorph({type: "text", textString: "test", extent: pt(100,100), fill: Color.yellow})
// m.selectAll()
// m.selection.collapse()

// state.master.sendUpdate()
// var m = state.masterEnv.world.addMorph({extent: pt(100,100), fill: Color.random(), grabbable: false})

// lively.lang.arr.last(state.messages)
