import "./object-extensions.js";
export { ObjectRef } from "./object-ref.js";
export { ObjectPool } from "./object-pool.js";

import { ObjectPool } from "./object-pool.js";

import { version as serializerVersion } from "./package.json";

function normalizeOptions(options) {
  options = {reinitializeIds: false, ...options}

  if (options.reinitializeIds && typeof options.reinitializeIds !== "function")
    throw new Error(`serializer option 'reinitializeIds' needs to be a function(id, ref) => id`)

  return options;
}

export function serialize(obj, options) {
  options = normalizeOptions(options);
  let objPool = options.objPool || new ObjectPool(options),
      ref = objPool.add(obj),
      requiredVersion = "~" + serializerVersion.replace(/\.[^\.]+/, ""); // semver
  return {id: ref.id, snapshot: objPool.snapshot(), requiredVersion};
}

export function deserialize(idAndSnapshot, options) {
  options = normalizeOptions(options);
  let {id, snapshot, requiredVersion} = idAndSnapshot;
  if (!lively.modules.semver.satisfies(serializerVersion, requiredVersion))
    console.warn(`[lively.serializer deserialization] snapshot requires version `
               + `${requiredVersion} but serializer has incompatible version `
               + `${serializerVersion}. Deserialization might fail...!`);
  let objPool = options.objPool || new ObjectPool(options);
  objPool.readSnapshot(snapshot);
  return objPool.resolveToObj(id)
}

export function copy(obj) {
  return deserialize(serialize(obj));
}
