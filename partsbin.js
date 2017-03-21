// This is a prototype implementation of a file-system based partsbin...

import { resource } from "lively.resources";
import { createMorphSnapshot, findPackagesInFileSpec, loadMorphFromSnapshot } from "lively.morphic/serialization.js";

export const defaultPartsbinFolder = System.decanonicalize("lively.morphic/parts/");

function normalizePartsBinFolder(options = {}) {
  let {partsbinFolder} = options;
  if (!partsbinFolder || typeof partsbinFolder !== "string") {
    options.partsbinFolder = defaultPartsbinFolder;
    return;
  }
  if (!partsbinFolder.endsWith("/")) partsbinFolder += "/";
  options.partsbinFolder = System.decanonicalize(partsbinFolder);
  return options;
}

export async function saveObjectToPartsbinFolder(obj, partName, options = {}) {

  options = normalizePartsBinFolder({
    preferWindow: true,
    partsbinFolder: defaultPartsbinFolder,
    ...options
  });

  if (options.preferWindow) {
    var win = obj.getWindow();
    obj = win && win.targetMorph === obj ? win : obj;
  }

  try {
    if (obj.isMorph) {
      obj.withAllSubmorphsDo(ea => {
        if (typeof ea.beforePublish === "function")
          ea.beforePublish(partName, obj);
      });
    } else {
      if (typeof obj.beforePublish === "function")
        obj.beforePublish(partName, obj);
    }
  } catch (e) {
    let msg = `Error in beforePublish of ${obj}\n${e.stack}`;
    if (typeof obj.world === "function" && obj.world()) obj.world().logError(new Error(msg));
    else console.error(msg);
  }

  await resource(options.partsbinFolder).ensureExistance();
  let partResource = resource(options.partsbinFolder).join(partName + ".json"),
      snapshot = await createMorphSnapshot(obj);

  await partResource.write(JSON.stringify(snapshot, null, 2))

  return {partName, url: partResource.url}
}

export async function loadObjectFromPartsbinFolder(partName, options) {
  let {partsbinFolder} = normalizePartsBinFolder({partsbinFolder: defaultPartsbinFolder, ...options})

  var rawContent = await resource(partsbinFolder).join(partName + ".json").read(),
      deserialized = loadMorphFromSnapshot(JSON.parse(rawContent));
  return deserialized;
}

export async function interactivelySaveObjectToPartsBinFolder(obj) {
  var partName = await $world.prompt("Enter part name to publish object under", {
              input: obj.name || "part-name",
              historyId: "lively.partsbin-partname-publish-to-folder-input-hist",
            });
  if (!partName) throw "canceled";
  return saveObjectToPartsbinFolder(obj, partName);
}

export async function getAllPartResources(options) {
  let {partsbinFolder} = normalizePartsBinFolder({partsbinFolder: defaultPartsbinFolder, ...options});
  return await resource(partsbinFolder).dirList(1, {exclude: ea => !ea.name().endsWith(".json")});
}

export async function interactivelyLoadObjectFromPartsBinFolder(options) {
  let partResources = await getAllPartResources(options),
      items = partResources.map(ea => {
        let partName = ea.name().replace(/\.json$/, "");
        return {
          isListItem: true, string: partName, value: partName
        }
      }),
      {selected: [choice]} = await $world.filterableListPrompt(
                              "select part to load", items, {fuzzy: true});
  if (!choice) throw "canceled";
  return await loadObjectFromPartsbinFolder(choice);
}

export async function createNewObjectPackage(object, packageName, options) {
  let {partsbinFolder} = normalizePartsBinFolder({partsbinFolder: defaultPartsbinFolder, ...options}),
      other = await getAllPartResources(options),
      existing = other.find(ea => ea.name() === packageName);
  if (existing)
    throw new Error(`An object package with the name ${packageName} already exists in the PartsBin directory ${partsbinFolder}`);  
}

export async function findPackagesInParts(options) {
  let parts = await getAllPartResources(options),
      packages = [];
  for (let p of parts) {
    try {
      let content = JSON.parse(await p.read()),
          partName = p.name().replace(/\.json/, "");
      if (content.packages)
        packages.push(
          ...findPackagesInFileSpec(content.packages)
            .map(ea => Object.assign(ea, {partName})));
    } catch (e) {
      console.error(`Error readin part resource ${p}`);
    }
  }
  return packages;
}
