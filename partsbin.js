// This is a prototype implementation of a file-system based partsbin...

import { resource } from "lively.resources";
import { serializeMorph } from "lively.morphic/serialization.js";

import { createFiles } from "lively.resources";
import { importPackage } from "lively.modules";
import { deserializeMorph } from 'lively.morphic/serialization.js';
import { inspect } from "lively.morphic";

var partsbinFolder = System.decanonicalize("lively.morphic/parts/")

async function createObjectSnapshot(aMorph) {
window.aMorph = aMorph
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
      Object.assign(packages, {[root.parent().url]: packageJSON});
    }));

  // add preview
  snapshot.preview = aMorph.renderPreview();

  return snapshot;
}

export async function loadObjectFromSnapshot(snapshot) {
  for (var baseURL in snapshot.packages) {
    var r = await createFiles(baseURL, snapshot.packages[baseURL]);
    for (var pName in snapshot.packages[baseURL]) {
      await importPackage(r.join(pName).url)
    }
  }
  return deserializeMorph(snapshot, {reinitializeIds: true, ignoreClassNotFound: false});
}


async function saveObjectToPartsbinFolder(obj, partName) {
  await resource(partsbinFolder).ensureExistance();
  var partResource = resource(partsbinFolder).join(partName + ".json"),
      snapshot = await createObjectSnapshot(obj);
  await partResource.write(JSON.stringify(snapshot, null, 2))
  return {partResource}
}

export async function loadObjectFromPartsbinFolder(partName) {
  var rawContent = await resource(partsbinFolder).join(partName + ".json").read(),
      deserialized = loadObjectFromSnapshot(JSON.parse(rawContent));
  return deserialized;
}

export async function interactivelySaveObjectToPartsBinFolder(obj) {
  var partName = await $world.prompt("Enter part name to publish object under", {
              input: obj.name || "part-name",
              historyId: "lively.partsbin-partname-publish-to-folder-input-hist",
            });
  if (!partName) throw "canceled";
  if (typeof obj.beforePublish === "function")
    obj.beforePublish(partName);
  var win = obj.getWindow(),
      objOrWindow = win && win.targetMorph === obj ? win : obj,
      {partResource} = await saveObjectToPartsbinFolder(objOrWindow, partName);
  return {partName, url: partResource.url}
}

export async function getAllPartResources() {
  var files = await resource(partsbinFolder).dirList(1);
  return files.filter(ea => ea.name().endsWith(".json"));
}

export async function interactivelyLoadObjectFromPartsBinFolder() {
  await resource(partsbinFolder).ensureExistance();
  var files = await resource(partsbinFolder).dirList(1),
      partFiles = files.filter(ea => ea.name().endsWith(".json")),
      items = partFiles.map(ea => {
        var partName = ea.name().replace(/\.json$/, "");
        return {
          isListItem: true, string: partName, value: partName
        }
      }),
      {selected: [choice]} = await $world.filterableListPrompt(
                              "select part to load", items, {fuzzy: true});
  if (!choice) throw "canceled";
  return await loadObjectFromPartsbinFolder(choice);
}

// await saveObjectToPartsbinFolder(that, "PartsBin")
// await interactivelySaveObjectToPartsBinFolder(that)
// var obj = (await loadObjectFromPartsbinFolder("star")).openInWorld();
// var obj = (await loadObjectFromPartsbinFolder("foo")).openInWorld();
// var obj = (await interactivelyLoadObjectFromPartsBinFolder()).openInWorld();


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
