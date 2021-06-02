import { pt, Color, Point } from 'lively.graphics';
import { morph, MorphicEnv, EventDispatcher } from 'lively.morphic';
import Master from 'lively.mirror/master.js';
import Client from 'lively.mirror/client.js';
import { createDOMEnvironment } from 'lively.morphic/rendering/dom-helper.js';
import Workspace from 'lively.ide/js/workspace.js';

async function buildMasterWorld (spec = { type: 'world', name: 'world', extent: pt(300, 300) }, pos = pt(0, 0)) {
  let morphicEnv = new MorphicEnv(await createDOMEnvironment()); let world = morph({ ...spec, env: morphicEnv });
  morphicEnv.domEnv.iframe.style = `position: absolute; top: ${pos.y}px; left: ${pos.x}px; width: ${spec.extent.x}px; height: ${spec.extent.y}px;`;
  morphicEnv.setWorld(world);
  return morphicEnv;
}

async function buildClientWorld (spec = { type: 'world', name: 'world', extent: pt(300, 300) }, pos = pt(0, 0)) {
  let domEnv = await createDOMEnvironment();
  domEnv.iframe.style = `position: absolute; top: ${pos.y}px; left: ${pos.x}px; width: ${spec.extent.x}px; height: ${spec.extent.y}px;`;
  return domEnv;
}

async function cleanup (state) {
  state.stop();

  await state.master.disconnect();
  Master.removeInstance(state.master.id);
  await state.masterEnv.uninstall();

  Client.removeInstance(state.client.id);
  await state.clientEnv.destroy();
}

export async function buildWorlds () {
  let messages = [];
  let masterId = 'master-mirror-client';
  let clientId = 'test-mirror-client';
  let clientEnv = await buildClientWorld({ extent: pt(300, 300) }, pt(0, 300));
  let clientChannel = {
    send (selector, data) {
      // data = JSON.parse(JSON.stringify(data));
      Master.invokeServices(selector, { masterId, ...data });
    }
  };
  // clientRootNode = clientEnv.document.body.appendChild(clientEnv.document.createElement("div")),
  let clientRootNode = clientEnv.document.body;
  let client = Client.createInstance(clientId, clientChannel, clientRootNode);

  let masterEnv = await buildMasterWorld({ type: 'world', name: 'world', extent: pt(300, 300) }, pt(0, 0));
  let masterChannel = {
    send (selector, data) {
      messages.push({ selector, data });
      return Client.invokeServices(selector, data);
    }
  };
  let master = Master.createInstance(masterId, masterEnv.world, masterChannel, client.id);

  let updateProcessMaster = null;

  function start () {
    if (!updateProcessMaster) updateProcessMaster = setInterval(() => master.sendUpdate());
  }

  function stop () {
    if (updateProcessMaster) {
      clearInterval(updateProcessMaster);
      updateProcessMaster = null;
    }
  }

  return {
    messages,
    master,
    masterEnv,
    client,
    clientEnv,
    start,
    stop
  };
}

async function test () {
  let state = await buildWorlds();
  let m = state.masterEnv.world.addMorph({ type: 'text', textString: 'test', extent: pt(100, 100), fill: Color.yellow });
  // var r = state.masterEnv.world.addMorph({extent: pt(100,100), fill: Color.random()})
  // var w = state.masterEnv.world.addMorph(new Workspace())
  await state.master.sendUpdate();

  m.selectAll();
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
