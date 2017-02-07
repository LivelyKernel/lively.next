import "./object-extensions.js";
export { ObjectRef } from "./object-ref.js";
export { ObjectPool } from "./object-pool.js";

import { ObjectPool } from "./object-pool.js";

function normalizeOptions(options) {
  options = {reinitializeIds: false, ...options}

  if (options.reinitializeIds && typeof options.reinitializeIds !== "function")
    throw new Error(`serializer option 'reinitializeIds' needs to be a function(id, ref) => id`)

  return options;
}

export function serialize(obj, options) {
  options = normalizeOptions(options);
  var objPool = options.objPool || new ObjectPool(options),
      ref = objPool.add(obj);
  return {id: ref.id, snapshot: objPool.snapshot()};
}

export function deserialize(idAndSnapshot, options) {
  options = normalizeOptions(options);
  var {id, snapshot} = idAndSnapshot,
      objPool = options.objPool || new ObjectPool(options);
  objPool.readSnapshot(snapshot);
  return objPool.resolveToObj(id)
}

export function copy(obj) {
  return deserialize(serialize(obj));
}