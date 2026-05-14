import './object-extensions.js';
import { ObjectPool } from './object-pool.js';
// import { version as serializerVersion } from './package.json';
import { requiredModulesOfSnapshot, removeUnreachableObjects, clearDanglingConnections, removeEpiConnections } from './snapshot-navigation.js';
import { allPlugins } from './plugins.js';

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

/**
 * Splits a dotted version string into numeric comparison parts.
 * @param {string|number} version - Version value such as "0.1.3".
 * @returns {number[]} Numeric version components with invalid parts treated as 0.
 */
function numericVersionParts (version) {
  return String(version).split('.').map(part => parseInt(part, 10) || 0);
}

/**
 * Checks the serializer's small supported version range syntax.
 * @param {string|number} version - Current serializer version.
 * @param {string} range - Required range written as ">=x.y.z".
 * @returns {boolean} True when the version satisfies the range, or when the range is unknown.
 */
function satisfiesRequiredVersion (version, range) {
  /*
   * Serializer snapshots currently write only a minimal ">=version" range.
   * Keeping this comparator local avoids pulling the full semver package into
   * browser/freezer boot while preserving the compatibility warning that this
   * module needs during deserialization.
   */
  const match = String(range).match(/^>=\s*(.+)$/);
  if (!match) return true;
  const versionParts = numericVersionParts(version);
  const requiredParts = numericVersionParts(match[1]);
  const length = Math.max(versionParts.length, requiredParts.length);
  for (let i = 0; i < length; i++) {
    const current = versionParts[i] || 0;
    const required = requiredParts[i] || 0;
    if (current > required) return true;
    if (current < required) return false;
  }
  return true;
}

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
  if (requiredVersion && !satisfiesRequiredVersion(serializerVersion, requiredVersion)) {
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

import { default as ExpressionSerializer, serializeSpec, deserializeSpec, mergeBindings } from './plugins/expression-serializer.js';
import { getSerializableClassMeta, locateClass, getClassName } from './class-helper.js';
export { ExpressionSerializer, getSerializableClassMeta, locateClass, serializeSpec, deserializeSpec, getClassName, allPlugins, mergeBindings };
