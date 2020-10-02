/*global System,fetch*/
import { resource, registerExtension as registerResourceExension } from "lively.resources";
import { Color } from "lively.graphics";
import { Path, obj, date, promise } from "lively.lang";

import { MorphicEnv } from "./env.js";
import { loadWorldFromResource, createMorphSnapshot } from "./serialization.js";
import { MorphicDB } from "./morphicdb/index.js";
import { loadObjectFromPartsbinFolder } from "./partsbin.js";
import { ensureCommitInfo } from "./morphicdb/db.js";
import { pathForBrowserHistory } from './helpers.js';
import { subscribe, emit } from "lively.notifications";

export async function loadWorldFromURL(url, oldWorld, options) {
  let worldResource = url.isResource ? url :
        resource(System.decanonicalize(url)),
      name = worldResource.nameWithoutExt();
  return loadWorldFromDB(name, undefined, oldWorld, options);
}

export async function loadWorldFromCommit(commitOrId, oldWorld, options) {
    let db = MorphicDB.default,
        newWorld = await db.load("world", undefined, options, commitOrId),
        queryString = typeof document !== "undefined" ? document.location.search : ""
  options = {
    pathForBrowserHistory: pathForBrowserHistory(newWorld.name, queryString),
    ...options
  };
  return loadWorld(newWorld, oldWorld, options)
}

export async function loadWorldFromDB(name, ref, oldWorld, options) {
  let db = MorphicDB.default,
      newWorld = await db.load("world", name, options, undefined/*commit||id*/, ref || undefined),
      queryString = typeof document !== "undefined" ? document.location.search : ""
  options = {
    pathForBrowserHistory: pathForBrowserHistory(name, queryString),
    ...options
  };
  return loadWorld(newWorld, oldWorld, options)
}

export async function loadWorld(newWorld, oldWorld, options = {}) {
  // oldWorld is optional

  let {
    env,
    root,
    verbose = true,
    localconfig = true,
    l2l = true,
    shell = true,
    worldLoadDialog = false,
    initializeGlobalStyleSheets = true,
    showUserFlap = typeof newWorld.showsUserFlap === "undefined"
      ? true : newWorld.showsUserFlap
  } = options;

  env = env || (oldWorld ? oldWorld.env : MorphicEnv.default());

  let doc = env.domEnv.document || document;
  let nativeLoadingIndicator = doc.getElementById("dom-loading-indicator");

  try {
    let l2lClient = l2l && await setupLively2Lively(newWorld);

    if (l2lClient && shell) await setupLivelyShell({l2lClient});

    if (verbose && nativeLoadingIndicator) nativeLoadingIndicator.style.display = "";

    localconfig && await loadLocalConfig();
    
    // if root is defined render on the root node
    await env.setWorld(newWorld);

    worldLoadDialog && newWorld.execCommand("load world");

    if (options.pathForBrowserHistory) {
      window.history.pushState({}, "lively.next", options.pathForBrowserHistory);
    }

    newWorld.showsUserFlap = showUserFlap;

    if (oldWorld)
      oldWorld.onUnload();

    emit('world/loaded', newWorld);

    return newWorld;
  } catch (e) {
    console.error(`Error loading world: `, e);
    if (oldWorld) {
      await env.setWorld(oldWorld);
      oldWorld.showError(e);
    }
    throw e;
  } finally {
    if (nativeLoadingIndicator) nativeLoadingIndicator.style.display = "none";
  }
}


async function loadLocalConfig() {
  let localconfig = lively.modules.module("localconfig.js");
  try {
    // reload so that localconfig module actually executes, even if it was loaded before
    if (await resource(localconfig.id).exists())
      await localconfig.reload({resetEnv: false, reloadDeps: false});
  } catch (err) {
    console.error(`Error loading localconfig:`, err);
    if (typeof $world !== "undefined")
      $world.showError(`Error loading localconfig.js: ${err}`);
  }
}

async function setupLivelyShell(opts) {
  await lively.modules.importPackage("lively.shell");
  let {default: ClientCommand} = await System.import("lively.shell/client-command.js"),
      { resourceExtension } = await System.import("lively.shell/client-resource.js"),
      {l2lClient} = opts;
  ClientCommand.installLively2LivelyServices(l2lClient);
  resourceExtension.resourceClass.defaultL2lClient = l2lClient;
  registerResourceExension(resourceExtension);
  console.log(`[lively] lively.shell setup`);
}

async function setupLively2Lively(world) {
  let user = world.getCurrentUser(),
      info = {world: world.name};
  if (user) {
    info.userToken = user.token;
    info.userRealm = user.realm;
  }

  await lively.modules.importPackage("lively.2lively");
  let {default: L2LClient} = await System.import("lively.2lively/client.js"),
      client = await L2LClient.forLivelyInBrowser(info);
  console.log(`[lively] lively2lively client created ${client}`);

  // FIXME... put this go somewhere else...?
  if (!client._onUserChange) {
    client._onUserChange = function(evt) {
      if (client.isOnline() && evt.user) {
        let {token: userToken, realm: userRealm} = evt.user;
        client.info = {...client.info, userToken, userRealm};
        client.unregister().then(() => client.register())
          .then(() => console.log("re-registered after user change"));
      }
    }
    
    subscribe("lively.user/userchanged", client._onUserChange, System);

    client.once("registered", () => {
      reportWorldLoad(world, user);
    });

    client.on("registered", () => {
      let flap = world.get("user flap");
      flap && flap.updateNetworkIndicator(client);
      
    });
    client.on("connected", () => {
      let flap = world.get("user flap");
      flap && flap.updateNetworkIndicator(client);
    });
    client.on("reconnecting", () => {
      let flap = world.get("user flap");
      flap && flap.updateNetworkIndicator(client);
    });
    client.on("disconnected", () => {
      let flap = world.get("user flap");
      flap && flap.updateNetworkIndicator(client);
    });

  } else reportWorldLoad(world, user);

  return client;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export async function interactivelySaveWorld(world, options) {
  options = {showSaveDialog: true, useExpectedCommit: true, errorOnMissingExpectedCommit: false, confirmOverwrite: true, ...options};

  let name = world.name, tags = [], description = "",
      oldCommit = await ensureCommitInfo(Path("metadata.commit").get(world)),
      db = options.morphicdb || MorphicDB.default,
      jsonStoragePath = "",
      mode = 'db';

  if (options.showSaveDialog) {
    let dialog = await resource("part://SystemDialogs/save world dialog").read(),
        {commit, db: dialogDB, mode: storageMode, filePath} = await world.openPrompt(dialog, {targetWorld: world});
    if (dialogDB) db = dialogDB;
    mode = storageMode;
    jsonStoragePath = filePath;
    ({name, tags, description} = commit || {});
    if (!name) return null;
  } else if (oldCommit) {
    ({name, tags, description} = oldCommit);
  }

  let i = $world.execCommand('open loading indicator', `saving ${name}...`);
  await promise.delay(80);

  if (mode == 'json') {
    const resourceHandle = resource(System.baseURL).join(jsonStoragePath).withRelativePartsResolved();
    
    if (await resourceHandle.exists()) {
      i.visible = false;
      const proceed = await $world.confirm([
        'File Conflict\n', {},
        'The file you want to save the world to\n', { fontSize: 15, fontWeight: 'normal' },
        resourceHandle.url, { textStyle: 'italic', fontSize: 15, fontWeight: 'normal' },
        '\n already exists. Overwrite?', { fontSize: 15, fontWeight: 'normal' }
      ], { lineWrapping: false });
      if (!proceed) {
        i.remove();
        return;
      }
      i.visible = true;
    } else await resourceHandle.ensureExistance();
    
    await resourceHandle.writeJson(await createMorphSnapshot(world));
    i.remove();
    world.setStatusMessage(`saved world ${name} to file: ${resourceHandle.url}`);
    return;
  }

  try {
    let snapshotOptions = {
          previewWidth: 200, previewHeight: 200,
          previewType: "png", ignoreMorphs: [i]
        },
        ref = "HEAD",
        oldName = oldCommit ? oldCommit.name : world.name,
        expectedParentCommit;

    if (options.useExpectedCommit) {
      if (oldName !== name && options.confirmOverwrite) {
        let {exists, commitId: existingCommitId} = await db.exists("world", name);
        if (exists) {
          let overwrite = await world.confirm(`A world "${name}" already exists, overwrite?`, {styleClasses: ['Halo'], fill: Color.rgba(0,0,0,0.8)});
          if (!overwrite) return null;
          expectedParentCommit = existingCommitId;
        }
        world.name = name;
      } else {
        expectedParentCommit = oldCommit ? oldCommit._id : undefined;
      }
    }

    let commitSpec = {
          author: world.getCurrentUser(),
          message: "world save",
          tags, description
        },
        commit = await db.snapshotAndCommit(
          "world", name, world, snapshotOptions,
          commitSpec, ref, expectedParentCommit);

    // hist
    if (window.history) {
      let queryString = typeof document !== "undefined" ? document.location.search : "",
          path = pathForBrowserHistory(name, queryString);
      window.history.pushState({}, "lively.next", path);
    }

    world.setStatusMessage(`saved world ${name}`);
    world.get("world-list") && world.get("world-list").onWorldSaved(name);

    return commit;

  } catch (err) {

    if (err.message.includes("but no version entry exists") && !options.errorOnMissingExpectedCommit) {
      return interactivelySaveWorld(world, {...options, morphicdb: db, useExpectedCommit: false, showSaveDialog: false});
    }

    let [_, typeAndName, expectedVersion, actualVersion] = err.message.match(/Trying to store "([^\"]+)" on top of expected version ([^\s]+) but ref HEAD is of version ([^\s\!]+)/) || [];
    if (expectedVersion && actualVersion) {
      let [newerCommit] = await db.log(actualVersion, 1, /*includeCommits = */true);
      let overwrite = true;
      if (options.confirmOverwrite) {
        let {author: {name: authorName}, timestamp} = newerCommit,
            overwriteQ = `The current version of world ${name} is not the most recent!\n`
                       + `A newer version by ${authorName} was saved on `
                       + `${date.format(new Date(timestamp), "yyyy-mm-dd HH:MM")}. Overwrite?`;
        overwrite = await world.confirm(overwriteQ);        
      }
      if (!overwrite) return null;
      world.changeMetaData("commit", obj.dissoc(newerCommit, ["preview"]), /*serialize = */true, /*merge = */false);
      return interactivelySaveWorld(world, {...options, morphicdb: db, showSaveDialog: false});
    }

    console.error(err);
    world.logError("Error saving world: " + err);
  } finally { i.remove(); }

}

function reportWorldLoad(world, user) {
  let userId = user ? `${user.name} (${(user.token || "").slice(0,5)})` : "---";
  fetch("/report-world-load", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      message: `${userId} logged in at ${world.name} [${window._livelyLoadId}]`
    })
  }).catch(err => console.warn(`report-world-load failed: ${err}`));
}
