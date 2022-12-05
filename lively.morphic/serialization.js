/* global System */
import {
  requiredModulesOfSnapshot,
  deserializeWithMigrations,
  serialize,
  allPlugins
} from 'lively.serializer2';
import { resource } from 'lively.resources';

import { createFiles } from 'lively.resources';
import { promise, graph, arr } from 'lively.lang';

import { MorphicEnv } from './env.js';
import { newMorphId, morph, pathForBrowserHistory } from './helpers.js';
import { migrations } from './object-migration.js';

/**
 * Flag that the system uses to denote wether or not
 * object scripting is enabled.
 */
let objectScriptingEnabled = false;

/**
 * Ensures that some of the default options are present.
 * @param { object } options - The options to normalize.
 * @returns { object } The normalized options.
 */
function normalizeOptions (options) {
  options = { reinitializeIds: false, plugins: allPlugins, ...options };

  if (options.reinitializeIds) {
    options.reinitializeIds = typeof options.reinitializeIds === 'function'
      ? options.reinitializeIds
      : (id, ref) => ref.realObj.isMorph ? newMorphId(ref.realObj.constructor) : null;
  }

  return options;
}

/**
 * Converts a morph into a snapshot.
 * @param { Morph } m - The morph to serialize.
 * @param { object } options - The serializer options.
 * @returns { object } The snapshot of the morph.
 */
export function serializeMorph (m, options) {
  return serialize(m, normalizeOptions(options));
}

/**
 * Initializes a morph from a given snapshot.
 * @param { object } idAndSnapshot - The snapshot to initialize the morph from.
 * @param { object } options - The serializer options.
 * @returns { Morph } The fully initialized morph.
 */
export function deserializeMorph (idAndSnapshot, options = {}) {
  return deserializeWithMigrations(
    idAndSnapshot,
    options.migrations || migrations,
    normalizeOptions(options));
}

/**
 * Creates a deep copy of a morph.
 * If desired, the copy can also carry over comments that have been assigned to the morphs.
 * FIXME: The comments should be removed from the morphs entirely, since they only make
 * sense in the context of the IDE world.
 * @param { Morph } morph - The morph to copy.
 * @param { boolean } [realCopy=false] - Wether or not to carry over the commends assigned to the morph (deprecated).
 * @returns { Morph } The deep copy of the morph.
 */
export function copyMorph (morph, realCopy = false) {
  if (!realCopy) {
    return deserializeMorph(
      serializeMorph(morph),
      { migrations, reinitializeIds: true }
    );
  }
  let cachedConnections = [];
  if (morph.attributeConnections) {
    cachedConnections = morph.attributeConnections.filter(ac => ac.targetObj.isCommentIndicator);
    morph.attributeConnections = morph.attributeConnections.filter(ac => !(ac.targetObj.isCommentIndicator || ac.targetObj.isHalo));
  }

  const serializedMorph = serializeMorph(morph);

  if (morph.attributeConnections) {
    morph.attributeConnections = morph.attributeConnections.concat(cachedConnections);
  }

  return deserializeMorph(serializedMorph, { migrations, reinitializeIds: true });
}

/**
 * Converts a resource handle pointing to a directory recursively
 * into JSON data structure. This can be helpful for incorporating
 * directories into snapshots.
 * @param { Resource } currentResource - The resource handle pointing to the directory to extract.
 * @param { object } [base = {}] - The base JSON structure to store the directory into.
 * @returns { object } The extracted directory in JSON.
 */
async function resourceToJSON (currentResource, base = {}) {
  if (!currentResource.isDirectory()) {
    base[currentResource.name()] = await currentResource.read();
    return base;
  } else {
    const subBase = base[currentResource.name()] = {};
    const files = await currentResource.dirList();
    for (const f of files) {
      await resourceToJSON(f, subBase);
    }
    return base;
  }
}

/**
 * In a serialized json blob we store packages into a package field that
 * refers to a file spec object. This method extracts all the package file
 * specs from the file tree.
 * @param { object } files - The file spec to extract.
 * @param { string[] } [path = []] - The current path being traversed (internal).
 * @returns { object[] } The extracted file specs.
 */
function findPackagesInFileSpec (files, path = []) {
  const result = [];
  if (files.hasOwnProperty('package.json')) {
    const url = path.slice(1).reduceRight((r, name) => r.join(name), resource(path[0])).url;
    result.push({ files, url, requiredPackages: files.requiredPackages });
  }
  for (const name in files) {
    if (typeof files[name] !== 'object') continue;
    result.push(...findPackagesInFileSpec(files[name], path.concat(name)));
  }
  return result;
}

/**
 * Given a snapshot, determine which packages are required to deserialize it
 * successfully.
 * @param { object } snapshot - The snapshot to scan for package deps.
 * @returns { string[] } The list of package names required by the snapshot.
 */
export function packagesOfSnapshot (snapshot) {
  const packages = findPackagesInFileSpec(snapshot.packages);
  const packageMap = {}; const depMap = snapshot.packageDepMap;
  if (!depMap) return packages;
  for (const p of packages) packageMap[p.url] = p;
  return graph.sortByReference(depMap).flat().map(url => packageMap[url]);
}

/**
 * Given a snapshot, load the packages (and their modules) that are required.
 * @async
 * @param { object } snapshot - The snapshot to load the packages for.
 * @param { object } options - The serializer options.
 * @returns { Promise<Module[]> } The imported module objects.
 */
export async function loadPackagesAndModulesOfSnapshot (snapshot, options) {
  // embedded package definitions
  const { moduleManager } = options;
  if (!moduleManager) throw new Error('You need to provide a module manager in order to load packages and modules.');
  if (snapshot.packagesToRegister) {
    for (const pName of snapshot.packagesToRegister) {
      try { await moduleManager.registerPackage(pName); } catch (err) {
        console.error(`Failed to register package ${pName}`);
      }
    }
  }

  if (snapshot.packages) {
    const packages = packagesOfSnapshot(snapshot);

    for (const { files, url } of packages) {
      // if a package with the same url already is loaded in the runtime then
      // compare its version with the version of the package that gets loaded.  If
      // the version to-load is older, keep the newer version.
      // FIXME: ensure old objects continue to work!
      const packageLookup = moduleManager.lookupPackage(url);
      let p = packageLookup && packageLookup.pkg;
      if (p) {
        const loadedVersion = p.version;
        const { version: versionInSpec } = JSON.parse(files['package.json']);
        try {
          if (versionInSpec && loadedVersion &&
              moduleManager.semver.lte(versionInSpec, loadedVersion, true)) {
            console.log(`[load morph] Package ${url} is loaded in version ${loadedVersion}` +
                      ` which is newer than ${versionInSpec}. Will NOT load older variant.`);
            continue;
          }
        } catch (err) {
          console.warn('Error in package version comparison: ', err);
        }
      }
      await createFiles(url, files);
      p = await moduleManager.ensurePackage(url);
      await p.reload({ forgetEnv: false, forgetDeps: false });
      // ensure object package instance
      const { default: ObjectPackage } = await System.import('lively.classes/object-classes.js');
      objectScriptingEnabled = !!ObjectPackage;
      objectScriptingEnabled && ObjectPackage.withId(p.name);
    }
  }

  // referenced packages / modules, e.g. b/c instances have classes from them
  // load required modules
  await Promise.all(
    requiredModulesOfSnapshot(snapshot)
      .map(modId => (System.get(modId) ? null : System.import(modId))
        .catch(e => console.error(`Error loading ${modId}`, e))));
}

/**
 * Deserialize a given snapshot, returning a initialized morph.
 * @params { object } snapshot - The snapshot of the morph.
 * @params { object } options - The serialization options.
 * @returns { Morph } The deserialized morph.
 */
export function loadMorphFromSnapshot (snapshot, options) {
  return deserializeMorph(snapshot, {
    reinitializeIds: true,
    ignoreClassNotFound: false,
    onDeserializationStart: loadPackagesAndModulesOfSnapshot,
    migrations,
    ...options
  });
}

/**
 * Deserialize a world morph from a resource handle pointing to a JSON snapshot.
 * @params { Resource } fromResource - The resource handle pointing to a JSON file.
 * @returns { World } The deserialized world morph.
 */
export async function loadWorldFromResource (fromResource) {
  return loadMorphFromSnapshot(await fromResource.readJson());
}

/**
 * Scan a snapshot and return the required package names
 * that need to be loaded before the snapshot can be deserialized successfully.
 * @param { object } snapshot - The snapshot to scan for packages.
 * @param { Module } moduleManager - A module implementing the module management interface.
 * @returns { object } The packages and the dependency map between those packages.
 */
export async function findRequiredPackagesOfSnapshot (snapshot, moduleManager) {
  const packages = {};
  const objects = snapshot.snapshot;
  let packagesToSave = [];
  const externalPackageMap = {};
  let externalPackagesFound = true;
  const depMap = {};

  for (const id in objects) {
    const classInfo = objects[id]['lively.serializer-class-info'];
    if (classInfo && classInfo.module && classInfo.module.package) {
      const p = moduleManager.getPackage(classInfo.module.package.name);

      // if it's a "local" object package then save that as part of the snapshot
      if (p.address.startsWith('local://')) {
        const { default: ObjectPackage } = await System.import('lively.classes/object-classes.js');
        const { withSuperclasses } = await System.import('lively.classes/util.js');
        objectScriptingEnabled = !!ObjectPackage;

        const objPkg = ObjectPackage.forSystemPackage(p);
        const objModule = await objPkg.ensureSubModule(classInfo.module.pathInPackage);
        const objClass = objModule.systemModule._recorder[classInfo.className];
        const classes = withSuperclasses(objClass);
        classes.forEach(klass => {
          const p = ObjectPackage.lookupPackageForClass(klass);
          p && packagesToSave.push(p.systemPackage);
        });
      }
    }

    const metadata = objects[id].props.metadata;
    if (metadata) {
      let externalPackages;
      if (metadata.value && metadata.value.__ref__) {
        const prop = objects[metadata.value.id];
        if (prop.props.externalPackages) { externalPackages = prop.props.externalPackages.value; }
      } else {
        externalPackages = metadata.externalPackages;
      }
      if (externalPackages) {
        externalPackagesFound = true;
        for (let i = 0; i < externalPackages.length; i++) { externalPackageMap[externalPackages[i]] = true; }
      }
    }
  }

  if (externalPackagesFound) {
    snapshot.packagesToRegister = Object.keys(externalPackageMap);
  }

  const objectPackagesReferenced = [];
  for (const pkg of packagesToSave) {
    for (const mod of pkg.modules()) {
      if (mod.id.endsWith('.json')) continue;
      for (const { fromModule } of await mod.imports()) {
        const requiredPackage = moduleManager.module(fromModule).package();
        if (!requiredPackage) continue;
        const config = requiredPackage.config;
        if (config.lively && config.lively.isObjectPackage) {
          objectPackagesReferenced.push(requiredPackage);
          if (!depMap[pkg.url]) depMap[pkg.url] = [requiredPackage.url];
          else arr.pushIfNotIncluded(depMap[pkg.url], requiredPackage.url);
        }
      }
    }
  }

  packagesToSave = [...objectPackagesReferenced, ...packagesToSave];

  await Promise.all(
    packagesToSave.map(async p => {
      const root = resource(p.address).asDirectory();
      const packageJSON = await resourceToJSON(root);
      if (!packages[root.parent().url]) packages[root.parent().url] = {};
      Object.assign(packages[root.parent().url], packageJSON);
      if (!depMap[p.url]) depMap[p.url] = [];
    }));

  return { packages, depMap };
}

export async function createMorphSnapshot (aMorph, options = {}) {
  const {
    addPreview = false, // this is incredibly slow for large worlds. Perform on server instead.
    previewWidth = 100, previewHeight = 100,
    previewType = 'png',
    testLoad = true,
    addPackages = true,
    ignoreMorphs = [],
    frozenSnapshot = false,
    moduleManager
  } = options;
  const snapshot = serializeMorph(aMorph, { frozenSnapshot });

  if (addPackages) {
    // 1. save object packages
    const { packages, depMap } = await findRequiredPackagesOfSnapshot(snapshot, moduleManager);
    snapshot.packages = packages;
    snapshot.packageDepMap = depMap;
  }

  if (addPreview) {
    const { renderMorphToDataURI } = await System.import('lively.morphic/rendering/morph-to-image.js');
    const width = previewWidth || aMorph.width;
    const height = previewHeight || aMorph.height;
    const type = previewType || 'png';
    try {
      snapshot.preview = await renderMorphToDataURI(aMorph, { width: width, height: height, type: type, ignoreMorphs: [] });
    } catch (err) {
      console.error(`Error generating morph preview: ${err}`);
      snapshot.preview = await renderMorphToDataURI(morph({ fill: aMorph.fill, width, height }), { width, height, type, ignoreMorphs });
    }
  }

  if (!snapshot.preview) snapshot.preview = '';

  if (testLoad) {
    try {
      const testLoad = await loadMorphFromSnapshot(snapshot, {
        highlightBuggyMorphs: true, rootObject: aMorph, moduleManager
      });
      if (!testLoad || !testLoad.isMorph) { throw new Error('reloading snapshot does not create a morph!'); }
    } catch (e) {
      throw new Error('Error snapshotting morph: Cannot recreate morph from snapshot!\n' + e.stack);
    }
  }

  return snapshot;
}

/**
 * Converts a given world morph to a JSON snapshot and directly writes it to a file
 * pointed to by a resource handle.
 * @async
 * @param { World } world - The world morph to store away.
 * @param { Resource } toResource - The resource handle pointing to the file we write the snapshot to.
 * @param { object } options
 * @param { boolean } options.showIndicator - Wether or not to display a progress indicator.
 * @param { boolean } options.changeName - Wether or not to force the name of the file onto the world morph.
 * @param { boolean } options.changeBrowserURL - Wether or not to adjust the browser history according to the world name.
 */
export async function saveWorldToResource (world = MorphicEnv.default().world, toResource, options) {
  const {
    showIndicator = true,
    changeName = true,
    changeBrowserURL = true
  } = options || {};

  if (!toResource) {
    const htmlResource = resource(document.location.href);
    const name = htmlResource.name();
    toResource = htmlResource
      .join('../' + name.replace(/\.[^\.]+/, '-world.json'))
      .withRelativePartsResolved();
  }

  if (typeof toResource === 'string') { toResource = resource(toResource); }

  if (changeName) {
    world.name = toResource.nameWithoutExt();
  }

  if (changeBrowserURL) {
    const histPath = encodeURI(options.pathForBrowserHistory ||
                          pathForBrowserHistory(toResource.path()));
    if (window.location.pathname !== histPath) { window.history.pushState({}, 'lively.next', histPath); }
  }

  let i;
  if (showIndicator) {
    const LoadingIndicator = await System.import('lively.components/loading-indicator.cp.js');
    i = LoadingIndicator.open(typeof showIndicator === 'string'
      ? showIndicator
      : 'Snapshotting...');
    await i.whenEnvReady();
  }

  try {
    const snap = await createMorphSnapshot(world, options);
    i.label = 'Uploading...';
    await i.whenEnvReady();
    return toResource.writeJson(snap);
  } finally { i && i.remove(); }
}
