/*global System*/
import {
  requiredModulesOfSnapshot,
  deserializeWithMigrations,
  serialize
} from "lively.serializer2";
import { World, Morph } from "./index.js";
import { resource } from "lively.resources";
import { newMorphId } from "./morph.js";
import { pathForBrowserHistory } from "./world-loading.js";

function normalizeOptions(options) {
  options = {reinitializeIds: false, ...options}

  if (options.reinitializeIds)
    options.reinitializeIds = typeof options.reinitializeIds === "function" ?
      options.reinitializeIds :
      (id, ref) => ref.realObj.isMorph ? newMorphId(ref.realObj.constructor) : null;

  return options;
}

export function serializeMorph(m, options) {
  return serialize(m, normalizeOptions(options));
}

export function deserializeMorph(idAndSnapshot, options) {
  return deserializeWithMigrations(idAndSnapshot, migrations, normalizeOptions(options));
}


export async function loadWorldFromResource(fromResource) {
  // fromResource = resource(location.origin).join("test-world.json");
  return loadMorphFromSnapshot(await fromResource.readJson());
}

export async function saveWorldToResource(world = World.defaultWorld(), toResource, options) {
  let {
    prettyPrint = true,
    showIndicator = true,
    changeName = true,
    changeBrowserURL = true
  } = options || {};

  if (!toResource) {
    var htmlResource = resource(document.location.href),
        name = htmlResource.name();
    toResource = htmlResource
      .join("../" + name.replace(/\.[^\.]+/, "-world.json"))
      .withRelativePartsResolved()
  }

  if (typeof toResource === "string")
    toResource = resource(toResource);

  if (changeName) {
    world.name = toResource.nameWithoutExt();
  }

  if (changeBrowserURL) {
    let histPath = encodeURI(options.pathForBrowserHistory
                          || pathForBrowserHistory(toResource));
    if (window.location.pathname !== histPath)
      window.history.pushState({}, "lively.next", histPath);
  }

  // pretty printing bloats 2x!
  let i;
  if (showIndicator) {
    i = LoadingIndicator.open(typeof showIndicator === "string" ?
      showIndicator : "Snapshotting...");
    await i.whenRendered(); await promise.delay(100);
  }

  try {
    let snap = await createMorphSnapshot(world, options);
    i.label = "Uploading..."
    await i.whenRendered();
    return toResource.writeJson(snap);
  } finally { i && i.remove(); }
}


export function copyMorph(morph) {
  return deserializeMorph(serializeMorph(morph), {migrations, reinitializeIds: true});
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { createFiles } from "lively.resources";
import { ensurePackage } from "lively.modules";
import ObjectPackage from "lively.classes/object-classes.js";
import LoadingIndicator from "./components/loading-indicator.js";
import { promise } from "lively.lang";
import { migrations } from "./object-migration.js";
import { ObjectMigrationPlugin } from "lively.serializer2/plugins.js";


export async function createMorphSnapshot(aMorph, options = {}) {
  const isNode = System.get("@system-env").node;
  let {
        addPreview = !isNode,
        previewWidth = 100, previewHeight = 100,
        previewType = "png",
        testLoad = true,
        addPackages = true
      } = options,
      snapshot = serializeMorph(aMorph);

  if (addPackages) {
    // 1. save object packages
    let packages = snapshot.packages = {},
        objects = snapshot.snapshot,
        packagesToSave = [];
    for (let id in objects) {
      let classInfo = objects[id]["lively.serializer-class-info"];
      if (!classInfo || !classInfo.module || !classInfo.module.package) continue;
      let p = lively.modules.getPackage(classInfo.module.package.name);
      // if it's a "local" object package then save that as part of the snapshot
      if (p.address.startsWith("local://")) packagesToSave.push(p);
    }
    await Promise.all(
      packagesToSave.map(async p => {
        let root = resource(p.address).asDirectory(),
            packageJSON = await resourceToJSON(root, {});
        if (!packages[root.parent().url]) packages[root.parent().url] = {};
        Object.assign(packages[root.parent().url], packageJSON);
      }));
  }

  if (addPreview) {
    let {renderMorphToDataURI} = await System.import("lively.morphic/rendering/morph-to-image.js"),
        width = previewWidth || aMorph.width,
        height = previewHeight || aMorph.height,
        type = previewType || "png";
    try {
      snapshot.preview = await renderMorphToDataURI(aMorph, {width, height, type});
    } catch (err) {
      console.error(`Error generating morph preview: ${err}`);
      snapshot.preview = await renderMorphToDataURI(new Morph({fill: aMorph.fill, width, height}), {width, height, type})
    }
  }

  if (!snapshot.preview) snapshot.preview = "";

  if (testLoad) {
    try {
      let testLoad = await loadMorphFromSnapshot(snapshot);
      if (!testLoad || !testLoad.isMorph)
        throw new Error("reloading snapshot does not create a morph!")
    } catch (e) {
      throw new Error("Error snapshotting morph: Cannot recreate morph from snapshot!\n" + e.stack);
    }
  }

  return snapshot;
}

export function loadMorphFromSnapshot(snapshot, options) {
  return deserializeMorph(snapshot, {
    reinitializeIds: true,
    ignoreClassNotFound: false,
    onDeserializationStart: loadPackagesAndModulesOfSnapshot,
    migrations,
    ...options
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
async function resourceToJSON(currentResource, base) {
  if (!currentResource.isDirectory()) {
    base[currentResource.name()] = await currentResource.read();
    return base;
  } else {
    let subBase = base[currentResource.name()] = {},
        files = await currentResource.dirList();
    for (let f of files) {
      await resourceToJSON(f, subBase);
    }
    return base;
  }
}

function findPackagesInFileSpec(files, path = []) {
  // is a serialized json blob we store packages into a package field that
  // refers to a file spec object. This method extracts all the package file
  // specs from the file tree.
  let result = [];
  if (files.hasOwnProperty("package.json")) {
    let url = path.slice(1).reduceRight((r, name) => r.join(name), resource(path[0])).url;
    result.push({files, url})
  }
  for (let name in files) {
    if (typeof files[name] !== "object") continue;
    result.push(...findPackagesInFileSpec(files[name], path.concat(name)));
  }
  return result;
}

async function loadPackagesAndModulesOfSnapshot(snapshot) {
  // embedded package definitions
  if (snapshot.packages) {
    let packages = findPackagesInFileSpec(snapshot.packages);
    for (let {files, url} of packages) {
      let r = await createFiles(url, files),
          p = await ensurePackage(url);
      await p.reload({forgetEnv: false, forgetDeps: false});
      // ensure object package instance
      ObjectPackage.withId(p.name);
    }
  }

  // referenced packages / modules, e.g. b/c instances have classes from them
  // load required modules
  await Promise.all(
    requiredModulesOfSnapshot(snapshot)
      .map(modId =>
        (System.get(modId) ? null : System.import(modId))
                .catch(e => console.error(`Error loading ${modId}`, e))));
}
