/*global System*/
import { MorphicEnv } from "./index.js";
import { loadWorldFromResource } from "./serialization.js";
import { resource, registerExtension as registerResourceExension } from "lively.resources";
import { MorphicDB } from "./morphicdb/index.js";
import { Path, obj, date, promise } from "lively.lang";
import { loadObjectFromPartsbinFolder } from "./partsbin.js";
import LoadingIndicator from "./components/loading-indicator.js";
import { subscribe } from "lively.notifications/index.js";
import { Color } from "lively.graphics";


export function pathForBrowserHistory(worldName, queryString) {
  // how does the resource map to a URL shown in the browser URL bar? used for
  // browser history
  queryString = queryString.trim();
  if (!queryString || queryString === "?") queryString = "";
  let basePath = "/worlds/";
  worldName = worldName.replace(/\.json$/, "").replace(/%20/g, " ");
  return `${basePath}${worldName}${queryString}`;
}

export async function loadWorldFromURL(url, oldWorld, options) {
  let worldResource = url.isResource ? url :
        lively.resources.resource(System.decanonicalize(url)),
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

  let doc = env.domEnv.document || document,
      nativeLoadingIndicator = doc.getElementById("dom-loading-indicator");

  try {

    let l2lClient = l2l && await setupLively2Lively(newWorld);

    if (l2lClient && shell) await setupLivelyShell({l2lClient});

    if (verbose && nativeLoadingIndicator) nativeLoadingIndicator.style.display = "";

    await env.setWorld(newWorld);

    localconfig && await loadLocalConfig();

    initializeGlobalStyleSheets && newWorld.whenRendered().then(() =>
                                    newWorld.propertiesAndPropertySettings()
                                      .properties.styleSheets.initialize.call(newWorld));

    worldLoadDialog && newWorld.execCommand("load world");

    if (options.pathForBrowserHistory) {
      window.history.pushState({}, "lively.next", options.pathForBrowserHistory);
    }

    newWorld.showsUserFlap = showUserFlap;

    if (oldWorld)
      oldWorld.onUnload();

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
  let {default: ClientCommand} = await lively.modules.module("lively.shell/client-command.js").load(),
      { resourceExtension } = await lively.modules.module("lively.shell/client-resource.js").load(),
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
  let {default: L2LClient} = await lively.modules.module("lively.2lively/client.js").load(),
      client = await L2LClient.forLivelyInBrowser(info);
  console.log(`[lively] lively2lively client created ${client}`);

  // FIXME... put this go somewhere else...?
  if (!client._onUserChange) {
    client._onUserChange = function(evt) {
      console.log("user change evtn", evt)
      if (client.isOnline() && evt.user) {
        let {token: userToken, realm: userRealm} = evt.user;
        client.info = {...client.info, userToken, userRealm};
        client.unregister().then(() => client.register())
          .then(() => console.log("re-registered after user change"));
      }
    }
    lively.notifications.subscribe("lively.user/userchanged", client._onUserChange, System);

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
  }

  return client;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export async function interactivelySaveWorld(world, options) {
  options = {showSaveDialog: true, ...options};

  let name = world.name, tags = [], description = "",
      oldCommit = Path("metadata.commit").get(world),
      db = MorphicDB.default;

  if (options.showSaveDialog) {
    let dialog = await loadObjectFromPartsbinFolder("save world dialog");
    ({name, tags, description} = await world.openPrompt(dialog, {targetWorld: world}));
    if (!name) return null;
  } else if (oldCommit) {
    ({name, tags, description} = oldCommit);
  }


  var i = LoadingIndicator.open(`saving ${name}...`);
  await promise.delay(80);

  try {
    let snapshotOptions = {previewWidth: 200, previewHeight: 200, previewType: "png"},
        ref = "HEAD",
        oldName = oldCommit ? oldCommit.name : world.name,
        expectedParentCommit;

    if (oldName !== name) {
      let {exists, commitId: existingCommitId} = await db.exists("world", name);
      if (exists) {
        let overwrite = await world.confirm(`A world "${name}" already exists, overwrite?`);
        if (!overwrite) return null;
        expectedParentCommit = existingCommitId;
      }
      world.name = name;
    } else {
      expectedParentCommit = oldCommit ? oldCommit._id : undefined;
    }

    let commitSpec = {author: world.getCurrentUser(),
                      message: "world save", tags, description},
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
    let [_, typeAndName, expectedVersion, actualVersion] = err.message.match(/Trying to store "([^\"]+)" on top of expected version ([^\s]+) but ref HEAD is of version ([^\s\!]+)/) || [];
    if (expectedVersion && actualVersion) {
      let [newerCommit] = await db.log(actualVersion, 1, /*includeCommits = */true),
          {author: {name: authorName}, timestamp} = newerCommit,
          overwriteQ = `The current version of world ${name} is not the most recent!\n`
      + `A newer version by ${authorName} was saved on `
      + `${date.format(new Date(timestamp), "yyyy-mm-dd HH:MM")}. Overwrite?`,
          overwrite = await world.confirm(overwriteQ);
      if (!overwrite) return null;
      world.changeMetaData("commit", obj.dissoc(newerCommit, ["preview"]), /*serialize = */true, /*merge = */false);
      return interactivelySaveWorld(world, {...options, showSaveDialog: false});
    }

    console.error(err);
    world.logError("Error saving world: " + err);
  } finally { i.remove(); }

}
