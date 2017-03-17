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
import { reloadPackage, getPackage } from "lively.modules";
import ObjectPackage from "lively.classes/object-classes.js";

export async function createMorphSnapshot(aMorph) {
  var snapshot = serializeMorph(aMorph),
      packages = snapshot.packages = {},
      // 1. save object packages
      packagesToSave = aMorph.withAllSubmorphsDo(m => {
        let klass = m.constructor,
            moduleMeta = klass[Symbol.for("lively-module-meta")];
        // if it's a "local" object package then save that as part of the snapshot
        if (!moduleMeta) return null;
        let p = lively.modules.getPackage(moduleMeta.package.name);
        return p && p.address.startsWith("local://") ? p : null
      }).filter(Boolean);

  await Promise.all(
    packagesToSave.map(async p => {
      let root = resource(p.address).asDirectory(),
          packageJSON = await resourceToJSON(root, {});
      if (!packages[root.parent().url]) packages[root.parent().url] = {};
      Object.assign(packages[root.parent().url], packageJSON);
    }));

  // add preview
  let {renderMorphToDataURI} = await System.import("lively.morphic/rendering/morph-to-image.js");
  snapshot.preview = await renderMorphToDataURI(aMorph, {width: 100, height: 100});

  return snapshot;
}

export async function loadMorphFromSnapshot(snapshot) {
  if (snapshot.packages) {
    let packages = findPackagesInFileSpec(snapshot.packages);
    for (let {files, url} of packages) {
      let r = await createFiles(url, files);
      await reloadPackage(url, {forgetEnv: false, forgetDeps: false});      
      // ensure object package instance
      ObjectPackage.withId(getPackage(url).name);
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
    let subBase = base[currentResource.name()] = {},
        files = await currentResource.dirList();
    for (let f of files) {
      await resourceToJSON(f, subBase);
    }
    return base;
  }
}

export function findPackagesInFileSpec(files, path = []) {
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
