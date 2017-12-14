import "./object-extensions.js";
import { ObjectPool } from "./object-pool.js";
import { version as serializerVersion } from "./package.json";
import { removeUnreachableObjects } from "./snapshot-navigation.js";
import { allPlugins } from "./plugins.js";

function normalizeOptions(options) {
  options = {plugins: allPlugins, reinitializeIds: false, ...options};
  if (options.reinitializeIds && typeof options.reinitializeIds !== "function")
    throw new Error(`serializer option 'reinitializeIds' needs to be a function(id, ref) => id`)
  return options;
}

function normalizeMigrations(migrations = []) {
  return {
    before: migrations.filter(ea => typeof ea.snapshotConverter === "function"),
    after: migrations.filter(ea => typeof ea.objectConverter === "function")
  }
}

function runMigrations(migrations, method, idAndSnapshot, pool) {
  for (let i = 0; i < migrations.length; i++) {
    let migration = migrations[i];
    try {
      idAndSnapshot = migration[method](idAndSnapshot, pool);
    } catch (err) {
      console.error(`migration ${migration.name} failed:`)
      console.error(err);
    }
  }
  return idAndSnapshot;
}

const majorAndMinorVersionRe = /\.[^\.]+$/; // x.y.z => x.y

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export { ObjectRef, ObjectPool } from "./object-pool.js";
export { requiredModulesOfSnapshot, removeUnreachableObjects } from "./snapshot-navigation.js";

export function serialize(obj, options) {
  options = normalizeOptions(options);
  let objPool = options.objPool || new ObjectPool(options),
      requiredVersion = "~" + serializerVersion.replace(majorAndMinorVersionRe, ""), // semver
      snapshotAndId = objPool.snapshotObject(obj);
  // object hooks are allowed to modify the snapshot graph and remove
  // references. To only serialize what's needed we cleanup the graph after all
  // hooks are done.
  removeUnreachableObjects([snapshotAndId.id], snapshotAndId.snapshot);
  snapshotAndId.requiredVersion = requiredVersion;
  return snapshotAndId;
}

export function deserialize(idAndSnapshot, options) {
  options = normalizeOptions(options);
  let {id, snapshot, requiredVersion} = idAndSnapshot;
  if (requiredVersion && !lively.modules.semver.satisfies(serializerVersion, requiredVersion))
    console.warn(`[lively.serializer deserialization] snapshot requires version `
               + `${requiredVersion} but serializer has incompatible version `
               + `${serializerVersion}. Deserialization might fail...!`);
  let objPool = options.objPool || new ObjectPool(options);
  return objPool.resolveFromSnapshotAndId(idAndSnapshot);
}

export function deserializeWithMigrations(idAndSnapshot, migrations, options) {
  options = normalizeOptions(options);
  let objPool = options.objPool || (options.objPool = new ObjectPool(options)),
      {before, after} = normalizeMigrations(migrations),
      wait;
  runMigrations(before, "snapshotConverter", idAndSnapshot, objPool);
  if (typeof options.onDeserializationStart === "function")
    wait = options.onDeserializationStart(idAndSnapshot, options);
  return wait instanceof Promise ? wait.then(step2) : step2();

  function step2() {
    let deserialized = deserialize(idAndSnapshot, options);
    runMigrations(after, "objectConverter", idAndSnapshot, objPool);
    return deserialized;
  }
}

export function copy(obj, options) {
  return deserialize(serialize(obj, options), options);
}
