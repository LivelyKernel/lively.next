export async function run() {

  var l2lClient = await setupLively2Lively();
  await setupLivelyShell({l2lClient})

  window.addEventListener('beforeunload', function(evt) {
    var msg = "Really?";
    evt.returnValue = msg;
    return msg;
  }, true);

  var {loadWorldFrom} = urlQuery();

  if (loadWorldFrom) loadWorld(loadWorldFrom)
  else createNewWorld();
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { loadWorldFromResource } from 'lively.morphic/serialization.js';

async function loadWorld(from) {
  var fromLocation = resource(document.location.origin).join(from),
      world = await loadWorldFromResource(fromLocation);
  MorphicEnv.default().setWorld(world);
  return window.$$world = world;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


import { pt } from 'lively.graphics';
import { World, MorphicEnv, show } from 'lively.morphic';
import ObjectDrawer from "lively.morphic/components/object-drawer.js";
import Workspace from "lively.morphic/ide/js/workspace.js";

function createNewWorld() {
  var world = window.$world = window.$$world = new World({
    name: "world",
    extent: pt(window.innerWidth, window.innerHeight)
  });

  MorphicEnv.default().setWorld(world);

  new ObjectDrawer().openInWorld(pt(20,20));
  new Workspace({name: "workspace", extent: pt(500, 600)}).openInWorld();

  world.get("workspace").targetMorph.doSave = function() {
    show("saved!");
    localStorage.setItem('lively workspace', this.textString)
  }
  var code = localStorage.getItem('lively workspace');
  if (code) world.get("workspace").targetMorph.textString = code;

  return world
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import L2LClient from "lively.2lively/client.js";
async function setupLively2Lively(opts) {
  var l2lURL = `${document.location.origin}/lively-socket.io`,
      client = await L2LClient.ensure({url: l2lURL, namespace: "l2l"});
  console.log(`[lively] lively2lively client created ${client}`)
  return client;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import ClientCommand from "lively.shell/client-command.js";
import { resourceExtension as shellResourceExtension } from "lively.shell/client-resource.js";
import { registerExtension, resource } from "lively.resources";
async function setupLivelyShell(opts) {
  var {l2lClient} = opts;
  ClientCommand.installLively2LivelyServices(l2lClient);
  shellResourceExtension.resourceClass.defaultL2lClient = l2lClient;
  registerExtension(shellResourceExtension);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function urlQuery() {
  if (typeof document === "undefined" || !document.location) return {};
  return (document.location.search || "").replace(/^\?/, "").split("&")
    .reduce(function(query, ea) {
      var split = ea.split("="), key = split[0], value = split[1];
      if (value === "true" || value === "false") value = eval(value);
      else if (!isNaN(Number(value))) value = Number(value);
      query[key] = value;
      return query;
    }, {});
}
