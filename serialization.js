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

export function saveWorldToResource(world = World.defaultWorld(), toResource) {
  
  if (!toResource) {
    var htmlResource = resource(document.location.href),
        name = htmlResource.name();
    toResource = htmlResource
      .join("../" + name.replace(/\.[^\.]+/, "-world.json"))
      .withRelativePartsResolved()
  }

  return toResource.write(JSON.stringify(serializeMorph(world), null, 2));
}

// await saveWorldToResource();