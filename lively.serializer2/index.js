import './object-extensions.js';
import { ObjectPool } from './object-pool.js';
// import { version as serializerVersion } from './package.json';
import { requiredModulesOfSnapshot, removeUnreachableObjects, clearDanglingConnections, removeEpiConnections } from './snapshot-navigation.js';
import { allPlugins } from './plugins.js';
import semver from 'semver';

const serializerVersion = '0.1.3';

export function normalizeOptions (options) {
  options = { plugins: allPlugins, reinitializeIds: false, skipMigrations: true, ...options };
  if (options.reinitializeIds && typeof options.reinitializeIds !== 'function') { throw new Error('serializer option \'reinitializeIds\' needs to be a function(id, ref) => id'); }
  return options;
}

function normalizeMigrations (migrations = []) {
  return {
    before: migrations.filter(ea => typeof ea.snapshotConverter === 'function'),
    after: migrations.filter(ea => typeof ea.objectConverter === 'function')
  };
}

function runMigrations (migrations, method, idAndSnapshot, pool) {
  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    try {
      idAndSnapshot = migration[method](idAndSnapshot, pool);
    } catch (err) {
      console.error(`migration ${migration.name} failed:`);
      console.error(err);
    }
  }
  return idAndSnapshot;
}

const majorAndMinorVersionRe = /\.[^\.]+$/; // x.y.z => x.y

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export { ObjectRef, ObjectPool } from './object-pool.js';
export { requiredModulesOfSnapshot, removeUnreachableObjects };

export function serialize (obj, options) {
  options = normalizeOptions(options);
  const objPool = options.objPool || new ObjectPool(options);
  const requiredVersion = '>=' + serializerVersion.replace(majorAndMinorVersionRe, ''); // semver
  const snapshotAndId = objPool.snapshotObject(obj);

  removeUnreachableObjects([snapshotAndId.id], snapshotAndId.snapshot);
  clearDanglingConnections(snapshotAndId.snapshot);
  removeEpiConnections(snapshotAndId.snapshot);
  snapshotAndId.requiredVersion = requiredVersion;
  return snapshotAndId;
}

export function deserialize (idAndSnapshot, options) {
  options = normalizeOptions(options);
  const { requiredVersion } = idAndSnapshot;
  if (requiredVersion && !semver.satisfies(serializerVersion, requiredVersion)) {
    console.warn('[lively.serializer deserialization] snapshot requires version ' +
               `${requiredVersion} but serializer has incompatible version ` +
               `${serializerVersion}. Deserialization might fail...!`);
  }
  const objPool = options.objPool || new ObjectPool(options);
  return objPool.resolveFromSnapshotAndId(idAndSnapshot);
}

export function deserializeWithMigrations (idAndSnapshot, migrations, options) {
  options = normalizeOptions(options);
  if (migrations.length) options.skipMigrations = false;
  const objPool = options.objPool || (options.objPool = new ObjectPool(options));
  const { before, after } = normalizeMigrations(migrations);
  let wait;
  runMigrations(before, 'snapshotConverter', idAndSnapshot, objPool);
  if (typeof options.onDeserializationStart === 'function') { wait = options.onDeserializationStart(idAndSnapshot, options); }
  return wait instanceof Promise ? wait.then(step2) : step2();

  function step2 () {
    const deserialized = deserialize(idAndSnapshot, options);
    runMigrations(after, 'objectConverter', idAndSnapshot, objPool);
    return deserialized;
  }
}

export function copy (obj, options) {
  return deserialize(serialize(obj, options), options);
}

import { default as ExpressionSerializer, serializeSpec, deserializeSpec } from './plugins/expression-serializer.js';
import { getSerializableClassMeta, locateClass, getClassName } from './class-helper.js';
export { ExpressionSerializer, getSerializableClassMeta, locateClass, serializeSpec, deserializeSpec, getClassName, allPlugins };
