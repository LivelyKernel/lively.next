// This is a prototype implementation of a file-system based partsbin...
/* global System */
import { resource } from "lively.resources";
import { createMorphSnapshot } from "lively.morphic/serialization.js";
import { MorphicDB } from "./morphicdb/index.js";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// deprecated

export function getAllPartResources(options) { return []; }


function load(nameOrCommit, options = {}) {
  // let {morphicDB} = PartsBinInterface.default;
  let name;
  if (typeof nameOrCommit === "string") name = nameOrCommit;
  else name = nameOrCommit.name;
  let morphicDB = options.morphicDB || MorphicDB.default;
  return morphicDB.load("part", name);
}

export async function interactivelyLoadObjectFromPartsBinFolder(options = {}) {
  let morphicDB = options.morphicDB || MorphicDB.default,
      partSpecs = await morphicDB.latestCommits("part"),
      items = partSpecs.map(ea => ({isListItem: true, string: ea.name, value: ea})),
      {selected: [choice]} = await $world.filterableListPrompt(
        "select part to load", items, {fuzzy: true});
  return choice ? load(choice) : null;
}

export async function interactivelySaveObjectToPartsBinFolder(obj) {
  var partName = await $world.prompt("Enter part name to publish object under", {
              input: obj.name || "part-name",
              historyId: "lively.partsbin-partname-publish-to-folder-input-hist",
            });
  if (!partName) throw "canceled";
  return saveObjectToPartsbinFolder(obj, partName, {previewWidth: obj.width, previewHeight: obj.height});
}

export async function saveObjectToPartsbinFolder(obj, partName, options = {}) {

  options = {
    preferWindow: true,
    ...options
  }

  if (options.preferWindow) {
    var win = obj.getWindow();
    obj = win && win.targetMorph === obj ? win : obj;
  }
  try {
    if (obj.isMorph) {
      let morphsToPrepare = [];
      obj.withAllSubmorphsDo(ea => {
        if (typeof ea.beforePublish === "function")
          morphsToPrepare.push(ea);
      });
      for (var m of morphsToPrepare) {
        await m.beforePublish();
      }
    } else {
      if (typeof obj.beforePublish === "function")
        await obj.beforePublish(partName, obj);
    }
  } catch (e) {
    let msg = `Error in beforePublish of ${obj}\n${e.stack}`;
    if (typeof obj.world === "function" && obj.world()) obj.world().logError(new Error(msg));
    else console.error(msg);
  }
  await resource(options.partsbinFolder).ensureExistance();
  let partResource = resource(options.partsbinFolder).join(partName + ".json"),
      snapshot = await createMorphSnapshot(obj, options);
  await partResource.write(JSON.stringify(snapshot, null, 2))
  return {partName, url: partResource.url}
}

export async function loadObjectFromPartsbinFolder(partName, options = {}) {
  return load(partName, options);
}
