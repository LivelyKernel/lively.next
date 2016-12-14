import { ObjectPool } from "lively.serializer2";
import { World } from "./index.js";
import { resource } from "lively.resources";

export function serializeMorph(m, objPool = new ObjectPool()) {
  var {id} = objPool.add(m);
  return {id, snapshot: objPool.snapshot()};
}

export function deserializeMorph(idAndSnapshot) {
  var {id, snapshot} = idAndSnapshot,
      objPool = ObjectPool.fromSnapshot(snapshot);
  return objPool.resolveToObj(id)
}

export async function loadWorldFromResource(fromResource) {
  var data = JSON.parse(await fromResource.read());

  // load required modules
  await Promise.all(
    ObjectPool.requiredModulesOfSnapshot(data.snapshot)
      .map(modId => System.import(modId)
        .catch(e => console.error(`Error loading ${modId}`, e))))

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