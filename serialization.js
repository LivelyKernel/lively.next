import { ObjectPool, serialize, deserialize } from "lively.serializer2";
import { World } from "./index.js";
import { resource } from "lively.resources";
import { newMorphId } from "./morph.js";

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
  return deserialize(idAndSnapshot, normalizeOptions(options));
}

export async function loadWorldFromResource(fromResource) {
  var data = JSON.parse(await fromResource.read());
  // load required modules
  await Promise.all(
    ObjectPool.requiredModulesOfSnapshot(data.snapshot)
      .map(modId =>
        (System.get(modId) ? null : System.import(modId))
                .catch(e => console.error(`Error loading ${modId}`, e))));

  return deserializeMorph(data);
}

export async function saveWorldToResource(world = World.defaultWorld(), toResource) {

  if (!toResource) {
    var htmlResource = resource(document.location.href),
        name = htmlResource.name();
    toResource = htmlResource
      .join("../" + name.replace(/\.[^\.]+/, "-world.json"))
      .withRelativePartsResolved()
  }
  
  if (typeof toResource === "string")
    toResource = resource(toResource);

  // pretty printing bloats 2x!
  return toResource.write(JSON.stringify(await createMorphSnapshot(world), null, 2));
  // return toResource.write(JSON.stringify(serializeMorph(world)));
}

// await saveWorldToResource();


export function copyMorph(morph) {
  return deserializeMorph(serializeMorph(morph), {reinitializeIds: true});
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { createFiles } from "lively.resources";
import { reloadPackage } from "lively.modules";

export async function createMorphSnapshot(aMorph) {
  var snapshot = serializeMorph(aMorph),
      packages = snapshot.packages = {},
      // 1. save object packages
      packagesToSave = aMorph.withAllSubmorphsDo(m => {
        let klass = m.constructor,
            moduleMeta = klass[Symbol.for("lively-module-meta")];
        // if it's a "local" object package then save that as part of the snapshot
        if (!moduleMeta) return null;
        var p = lively.modules.getPackage(moduleMeta.package.name);
        return p && p.address.startsWith("local://") ? p : null
      }).filter(Boolean);

  await Promise.all(
    packagesToSave.map(async p => {
      var root = resource(p.address).asDirectory(),
          packageJSON = await resourceToJSON(root, {});
      if (!packages[root.parent().url]) packages[root.parent().url] = {};
      Object.assign(packages[root.parent().url], packageJSON);
    }));

  // add preview
  snapshot.preview = aMorph.renderPreview();

  return snapshot;
}

export async function loadMorphFromSnapshot(snapshot) {
  for (var baseURL in snapshot.packages) {
    var r = await createFiles(baseURL, snapshot.packages[baseURL]);
    for (var pName in snapshot.packages[baseURL]) {
      await reloadPackage(r.join(pName).url, {forgetEnv: false, forgetDeps: false});
    }
  }
  return deserializeMorph(snapshot, {reinitializeIds: true, ignoreClassNotFound: false});
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
async function resourceToJSON(currentResource, base) {
  if (!currentResource.isDirectory()) {
    base[currentResource.name()] = await currentResource.read();
    return base;
  } else {
    var subBase = base[currentResource.name()] = {};
    var files = await currentResource.dirList();
    for (let f of files) {
      await resourceToJSON(f, subBase);
    }
    return base;
  }
}
