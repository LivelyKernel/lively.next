export async function run() {

  let l2lClient = await setupLively2Lively();
  await setupLivelyShell({l2lClient})

  window.addEventListener('beforeunload', function(evt) {
    var msg = "Really?";
    evt.returnValue = msg;
    return msg;
  }, true);

  let {loadWorldFrom} = urlQuery(),
      showWorldLoadDialog = !loadWorldFrom;

  if (!loadWorldFrom)
    loadWorldFrom = resource(System.decanonicalize("lively.morphic/worlds/default.json"));

  await loadWorld(loadWorldFrom, showWorldLoadDialog);
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { loadWorldFromResource } from 'lively.morphic/serialization.js';
import { MorphicEnv } from "lively.morphic";

async function loadWorld(from, showWorldLoadDialog) {
  let fromLocation = typeof from === "string" ?
        resource(document.location.origin).join(from) : from,
      world = await loadWorldFromResource(fromLocation);
  MorphicEnv.default().setWorld(world);
  showWorldLoadDialog && world.execCommand("load world");
  setTimeout(() => world.execCommand("fix font metric"), 500);
  setTimeout(() => world.execCommand("fix font metric"), 1000);
  setTimeout(() => world.execCommand("fix font metric"), 5000);
  setTimeout(() => world.execCommand("fix font metric"), 10000);
  loadLocalConfig();
  return world;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import L2LClient from "lively.2lively/client.js";
async function setupLively2Lively(opts) {
  var client = await L2LClient.forLivelyInBrowser();
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

async function loadLocalConfig() {
  let localconfig = lively.modules.module("localconfig.js");
  try {
    if (await resource(localconfig.id).exists())
      await localconfig.load();
  } catch (err) {
    console.error(`Error loading localconfig:`, err);
    if (typeof $world !== "undefined")
      $world.showError(`Error loading localconfig.js: ${err}`);
  }
}

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
