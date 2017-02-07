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

export function saveWorldToResource(world = World.defaultWorld(), toResource) {

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
  return toResource.write(JSON.stringify(serializeMorph(world), null, 2));
  // return toResource.write(JSON.stringify(serializeMorph(world)));
}

// await saveWorldToResource();


export function copyMorph(morph) {
  return deserializeMorph(serializeMorph(morph), {reinitializeIds: true});
}