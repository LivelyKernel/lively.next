export { ObjectRef } from "./object-ref.js";
export { ObjectPool } from "./object-pool.js";

import "./object-extensions.js";
import { ObjectPool } from "./object-pool.js";
import { version as serializerVersion } from "./package.json";
import { removeUnreachableObjects } from "./snapshot-navigation.js";

function normalizeOptions(options) {
  options = {reinitializeIds: false, ...options}
  if (options.reinitializeIds && typeof options.reinitializeIds !== "function")
    throw new Error(`serializer option 'reinitializeIds' needs to be a function(id, ref) => id`)
  return options;
}

const majorAndMinorVersionRe = /\.[^\.]+$/; // x.y.z => x.y

export function serialize(obj, options) {
  options = normalizeOptions(options);
  let objPool = options.objPool || new ObjectPool(options),
      ref = objPool.add(obj),
      requiredVersion = "~" + serializerVersion.replace(majorAndMinorVersionRe, ""), // semver
      snapshot = objPool.snapshot();
  // object hooks are allowed to modify the snapshot graph and remove
  // references. To only serialize what's needed we cleanup the graph after all
  // hooks are done.
  removeUnreachableObjects([ref.id], snapshot);
  return {id: ref.id, snapshot, requiredVersion};
}

export function deserialize(idAndSnapshot, options) {
  options = normalizeOptions(options);
  let {id, snapshot, requiredVersion} = idAndSnapshot;
  if (requiredVersion && !lively.modules.semver.satisfies(serializerVersion, requiredVersion))
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
