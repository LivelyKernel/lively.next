/*global System*/
import {
  requiredModulesOfSnapshot,
  deserializeWithMigrations,
  serialize
} from "lively.serializer2";
import { MorphicEnv } from './env.js';
import { resource } from "lively.resources";
import { newMorphId, morph, pathForBrowserHistory } from "./helpers.js";

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

export function deserializeMorph(idAndSnapshot, options={}) {
  return deserializeWithMigrations(
    idAndSnapshot, 
    options.migrations || migrations,
    normalizeOptions(options));
}


export async function loadWorldFromResource(fromResource) {
  // fromResource = resource(location.origin).join("test-world.json");
  return loadMorphFromSnapshot(await fromResource.readJson());
}

export async function saveWorldToResource(world = MorphicEnv.default().world, toResource, options) {
  let {
    prettyPrint = true,
    showIndicator = true,
    changeName = true,
    changeBrowserURL = true
  } = options || {};

  if (!toResource) {
    var htmlResource = resource(document.location.href),
        name = htmlResource.name();
    toResource = htmlResource
      .join("../" + name.replace(/\.[^\.]+/, "-world.json"))
      .withRelativePartsResolved()
  }

  if (typeof toResource === "string")
    toResource = resource(toResource);

  if (changeName) {
    world.name = toResource.nameWithoutExt();
  }

  if (changeBrowserURL) {
    let histPath = encodeURI(options.pathForBrowserHistory
                          || pathForBrowserHistory(toResource.path()));
    if (window.location.pathname !== histPath)
      window.history.pushState({}, "lively.next", histPath);
  }

  // pretty printing bloats 2x!
  let i;
  if (showIndicator) {
    const { LoadingIndicator } = await System.import("lively.components/loading-indicator.js");
    i = LoadingIndicator.open(typeof showIndicator === "string" ?
      showIndicator : "Snapshotting...");
    await i.whenRendered(); await promise.delay(100);
  }

  try {
    let snap = await createMorphSnapshot(world, options);
    i.label = "Uploading..."
    await i.whenRendered();
    return toResource.writeJson(snap);
  } finally { i && i.remove(); }
}


export function copyMorph(morph) {
  return deserializeMorph(serializeMorph(morph), {migrations, reinitializeIds: true});
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import * as modules from "lively.modules";
import { createFiles } from "lively.resources";
import { promise, graph, arr } from "lively.lang";
import { migrations } from "./object-migration.js";

let { registerPackage, module, getPackage, ensurePackage, lookupPackage, semver } = modules;

let objectScriptingEnabled = false;

export async function createMorphSnapshot(aMorph, options = {}) {
  const isNode = System.get("@system-env").node;
  let {
        addPreview = !isNode,
        previewWidth = 100, previewHeight = 100,
        previewType = "png",
        testLoad = true,
        addPackages = true,
        ignoreMorphs = [],
        frozenSnapshot = false,
      } = options,
      snapshot = serializeMorph(aMorph, { frozenSnapshot });

  if (addPackages) {
    // 1. save object packages
    let { packages, depMap } = await findRequiredPackagesOfSnapshot(snapshot);
    snapshot.packages = packages;
    snapshot.packageDepMap = depMap;
  }

  if (addPreview) {
    let {renderMorphToDataURI} = await System.import("lively.morphic/rendering/morph-to-image.js"),
        width = previewWidth || aMorph.width,
        height = previewHeight || aMorph.height,
        type = previewType || "png";
    try {
      snapshot.preview = await renderMorphToDataURI(aMorph, {width, height, type, ignoreMorphs});
    } catch (err) {
      console.error(`Error generating morph preview: ${err}`);
      snapshot.preview = await renderMorphToDataURI(morph({fill: aMorph.fill, width, height}), {width, height, type, ignoreMorphs})
    }
  }

  if (!snapshot.preview) snapshot.preview = "";

  if (testLoad) {
    try {
      let testLoad = await loadMorphFromSnapshot(snapshot, {
        highlightBuggyMorphs: true, rootObject: aMorph
      });
      if (!testLoad || !testLoad.isMorph)
        throw new Error("reloading snapshot does not create a morph!")
    } catch (e) {
      throw new Error("Error snapshotting morph: Cannot recreate morph from snapshot!\n" + e.stack);
    }
  }

  return snapshot;
}

export function loadMorphFromSnapshot(snapshot, options) {
  return deserializeMorph(snapshot, {
    reinitializeIds: true,
    ignoreClassNotFound: false,
    onDeserializationStart: loadPackagesAndModulesOfSnapshot,
    migrations,
    ...options
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
async function resourceToJSON(currentResource, base) {
  if (!currentResource.isDirectory()) {
    base[currentResource.name()] = await currentResource.read();
    return base;
  } else {
    let subBase = base[currentResource.name()] = {},
        files = await currentResource.dirList();
    for (let f of files) {
      await resourceToJSON(f, subBase);
    }
    return base;
  }
}

function findPackagesInFileSpec(files, path = []) {
  // is a serialized json blob we store packages into a package field that
  // refers to a file spec object. This method extracts all the package file
  // specs from the file tree.
  let result = [];
  if (files.hasOwnProperty("package.json")) {
    let url = path.slice(1).reduceRight((r, name) => r.join(name), resource(path[0])).url;
    result.push({files, url, requiredPackages: files.requiredPackages })
  }
  for (let name in files) {
    if (typeof files[name] !== "object") continue;
    result.push(...findPackagesInFileSpec(files[name], path.concat(name)));
  }
  return result;
}

export function packagesOfSnapshot(snapshot) {
  let packages = findPackagesInFileSpec(snapshot.packages);
  let packageMap = {}, depMap = snapshot.packageDepMap;
  if (!depMap) return packages;
  for (let p of packages) packageMap[p.url] = p;
  return arr.flatten(graph.sortByReference(depMap)).map(url => packageMap[url]);
}

export async function loadPackagesAndModulesOfSnapshot(snapshot) {
  // embedded package definitions
  if (snapshot.packagesToRegister) {
    for (let pName of snapshot.packagesToRegister) {
      try { await registerPackage(pName); } catch (err) {
        console.error(`Failed to register package ${pName}`);
      }
    }
  }


  if (snapshot.packages) {
    let packages = packagesOfSnapshot(snapshot);

    for (let { files, url } of packages) {
      // if a package with the same url already is loaded in the runtime then
      // compare its version with the version of the package that gets loaded.  If
      // the version to-load is older, keep the newer version.
      // FIXME: ensure old objects continue to work!
      let packageLookup = lookupPackage(url),
          p = packageLookup && packageLookup.pkg;
      if (p) {
        let loadedVersion = p.version,
            {version: versionInSpec} = JSON.parse(files["package.json"]);
        try {
          if (versionInSpec && loadedVersion &&
              semver.lte(versionInSpec, loadedVersion, true)) {
            console.log(`[load morph] Package ${url} is loaded in version ${loadedVersion}`
                      + ` which is newer than ${versionInSpec}. Will NOT load older variant.`);
            continue;
          }
        } catch (err) {
          console.warn(`Error in package version comparison: `, err);
        }
      }
      let r = await createFiles(url, files);
          p = await ensurePackage(url);
      await p.reload({forgetEnv: false, forgetDeps: false});
      // ensure object package instance
      const { default: ObjectPackage } = await System.import("lively.classes/object-classes.js");
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

export async function findRequiredPackagesOfSnapshot(snapshot) {
  let packages = {};
  let objects = snapshot.snapshot;
  let packagesToSave = [];
  let externalPackageMap = {};
  let externalPackagesFound = true;
  let depMap = {};

  for (let id in objects) {
    let classInfo = objects[id]['lively.serializer-class-info'];
    if (classInfo && classInfo.module && classInfo.module.package) {
      let p = getPackage(classInfo.module.package.name);

      // if it's a "local" object package then save that as part of the snapshot
      if (p.address.startsWith('local://')) {
        const { default: ObjectPackage } = await System.import('lively.classes/object-classes.js');
        const { withSuperclasses } = await System.import('lively.classes/util.js');
        objectScriptingEnabled = !!ObjectPackage;

        let objPkg = ObjectPackage.forSystemPackage(p);
        let objClass = objPkg.objectModule.systemModule._recorder[classInfo.className];
        let classes = withSuperclasses(objClass);
        classes.forEach(klass => {
          let p = ObjectPackage.lookupPackageForClass(klass);
          p && packagesToSave.push(p.systemPackage);
        });
      }
    }

    let metadata = objects[id].props.metadata;
    if (metadata) {
      let externalPackages;
      if (metadata.value && metadata.value.__ref__) {
        let prop = objects[metadata.value.id];
        if (prop.props.externalPackages)
          externalPackages = prop.props.externalPackages.value;
      } else {
        externalPackages = metadata.externalPackages;
      }
      if (externalPackages) {
        externalPackagesFound = true;
      for (let i = 0; i < externalPackages.length; i++)
        externalPackageMap[externalPackages[i]] = true;
      }
    }
  }

  if (externalPackagesFound) {
    snapshot.packagesToRegister = Object.keys(externalPackageMap);
  }

  let objectPackagesReferenced = [];
  for (let pkg of packagesToSave) {
    for (let mod of pkg.modules()) {
      if (mod.id.endsWith('.json')) continue;
      for (let { fromModule } of await mod.imports()) {
        let requiredPackage = module(fromModule).package();
        if (!requiredPackage) continue;
        let config = requiredPackage.config;
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
      let root = resource(p.address).asDirectory(),
          packageJSON = await resourceToJSON(root, {});
      if (!packages[root.parent().url]) packages[root.parent().url] = {};
      Object.assign(packages[root.parent().url], packageJSON);
      if (!depMap[p.url]) depMap[p.url] = [];
    }));

  return { packages, depMap };
}
