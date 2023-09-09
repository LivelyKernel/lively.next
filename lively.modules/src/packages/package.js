import { arr, promise, obj } from 'lively.lang';
import { emit } from 'lively.notifications';
import module from '../../src/module.js';
import { resource } from 'lively.resources';
import PackageConfiguration from './configuration.js';
import { isURL, join } from '../url-helpers.js';
import { classHolder } from '../cycle-breaker.js';

export async function packagesConfig () {
  const config = System.decanonicalize('lively.installer/packages-config.json');
  return JSON.parse(await resource(config).read());
}

function normalizePackageURL (System, packageURL, allPackageURLs = []) {
  if (allPackageURLs.some(ea => ea === packageURL)) return packageURL;

  let url = System.decanonicalize(packageURL.replace(/[\/]+$/, '') + '/');

  if (!isURL(url)) { throw new Error(`Strange package URL: ${url} is not a valid URL`); }

  // ensure it's a directory
  if (!url.match(/\.js/)) url = url;
  else if (url.indexOf(url + '.js') > -1) url = url.replace(/\.js$/, '');
  else url = url.split('/').slice(0, -1).join('/');

  if (url.match(/\.js$/)) {
    console.warn('packageURL is expected to point to a directory but seems to be a .js file: ' + url); // eslint-disable-line no-console
  }

  return String(url).replace(/\/$/, '');
}

function lookupPackage (System, packageURL, isNormalized = false) {
  let registry = classHolder.PackageRegistry.ofSystem(System);
  let allPackageURLs = registry.allPackageURLs();
  let url = isNormalized
    ? packageURL
    : normalizePackageURL(System, packageURL, allPackageURLs);
  return { pkg: registry.findPackageWithURL(url), url, allPackageURLs, registry };
}

function ensurePackage (System, packageURL, isNormalized = false) {
  let { pkg, url, registry } = lookupPackage(System, packageURL, isNormalized);
  return pkg || registry.addPackageAt(url, 'devPackageDirs');
}

function getPackage (System, packageURL, isNormalized = false) {
  let { pkg, url } = lookupPackage(System, packageURL, isNormalized);
  if (pkg) return pkg;
  throw new Error(`[getPackage] package ${packageURL} (as ${url}) not found`);
}

function applyConfig (System, packageConfig, packageURL) {
  let p = getPackage(System, packageURL);
  return p.updateConfig(packageConfig);
}

function importPackage (System, packageURL) {
  return Promise.resolve(ensurePackage(System, packageURL))
    .then(p => p.import());
}

function removePackage (System, packageURL) {
  let { pkg } = lookupPackage(System, packageURL);
  return pkg ? pkg.remove() : null;
}

function reloadPackage (System, packageURL, opts) {
  return getPackage(System, packageURL).reload(opts);
}

function registerPackage (System, packageURL, optPkgConfig) {
  return Promise.resolve(ensurePackage(System, packageURL))
    .then(p => p.register(optPkgConfig));
}

// function normalizeInsidePackage(System, urlOrNameOrMap, packageURL) {
//   // for env dependend rules like {"node": "./foo.js", "~node": "./bar.js"}
//   if (typeof urlOrNameOrMap === "object") {
//     let map = urlOrNameOrMap,
//         env = System.get("@system-env"),
//         found = lively.lang.arr.findAndGet(Object.keys(map), key => {
//           let negate = false, pred = key;
//           if (pred.startsWith("~")) { negate = true; pred = pred.slice(1); }
//           let matches = env[pred]; if (negate) matches = !matches;
//           return matches ? map[key] : null;
//         });
//     if (found) return normalizeInsidePackage(System, found, packageURL);
//   }
//
//   let urlOrName = urlOrNameOrMap;
//   return isURL(urlOrName) ?
//     // absolute
//     urlOrName :
//     // relative to either the package or the system:
//     urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName));
// }

function getPackageSpecs (System) {
  // Note does not return package instances but spec objects that can be JSON
  // stringified(!) like
  // ```
  // [{
  //   address: package-address,
  //   modules: [module-name-1, module-name-2, ...],
  //   name: package-name,
  //   names: [package-name, ...]
  //   version: semver version number
  // }, ... ]
  // ```
  return Package.allPackages(System).map(p => p.asSpec()); // eslint-disable-line no-use-before-define
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// package object
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class Package {
  static allPackages (System) { return obj.values(classHolder.PackageRegistry.ofSystem(System).byURL); }

  static allPackageURLs (System) { return classHolder.PackageRegistry.ofSystem(System).allPackageURLs(); }

  static forModule (System, module) { return this.forModuleId(System, module.id); }

  static forModuleId (System, moduleId) {
    let pAddress = classHolder.ModulePackageMapping.forSystem(System).getPackageURLForModuleId(moduleId);
    return pAddress ? getPackage(System, pAddress, true/* normalized */) : null;
  }

  static fromJSON (System, jso) { return new Package(System).fromJSON(jso); }

  constructor (System, packageURL, name, version, config = {}) {
    this.System = System;
    this.url = packageURL;
    this.registerProcess = null;
    this.map = {};
    this.setConfig(config);
  }

  setConfig (config) {
    this._name = config.name;
    this.version = config.version;
    this.dependencies = config.dependencies || {};
    this.devDependencies = config.devDependencies || {};
    this.main = config.main || 'index.js';
    this.systemjs = config.systemjs;
    this.lively = config.lively;
  }

  toJSON () {
    let { System } = this;
    let jso = obj.select(this, [
      'url',
      '_name',
      'version',
      'map',
      'dependencies',
      'devDependencies',
      'main',
      'systemjs',
      'lively'
    ]);
    if (jso.url.startsWith(System.baseURL)) { jso.url = jso.url.slice(System.baseURL.length).replace(/^\//, ''); }
    return jso;
  }

  fromJSON (jso) {
    let { System } = this;
    this.url = jso.url;
    this._name = jso._name;
    this.version = jso.version;
    this.map = jso.map || {};
    this.main = jso.main;
    this.dependencies = jso.dependencies || {};
    this.devDependencies = jso.devDependencies || {};
    this.systemjs = jso.systemjs;
    this.lively = jso.lively;
    if (!isURL(this.url)) { this.url = join(System.baseURL, this.url); }
    this.registerWithConfig();
    return this;
  }

  asSpec () {
    return {
      ...obj.select(this, [
        'name', 'main', 'map', 'meta',
        'url', 'address', 'version', 'lively'
      ]),
      modules: this.modules().map(m => {
        return {
          name: m.id,
          deps: m.directRequirements().map(ea => ea.id)
        };
      })
    };
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get isPackage () { return true; }

  get name () {
    if (this._name) return this._name;
    let config = this.System.get(this.url + '/package.json');
    if (config && config.name) return config.name;
    return arr.last(this.url.replace(/[\/]+$/, '').split('/'));
  }

  set name (v) { return this._name = v; }

  get nameAndVersion () { return `${this.name}@${this.version}`; }

  get address () { return this.url; }
  set address (v) { return this.url = v; }

  get runtimeConfig () {
    let {
      name,
      version,
      dependencies,
      devDependencies,
      main, systemjs, lively
    } = this;
    let config = {
      name: name,
      version: version,
      dependencies: dependencies || {},
      devDependencies: devDependencies || {}
    };
    if (main) config.main = main;
    if (systemjs) config.systemjs = systemjs;
    if (lively) config.lively = lively;
    return config;
  }

  path () {
    let base = this.System.baseURL;
    return this.url.indexOf(base) === 0 ? this.url.slice(base.length) : this.url;
  }

  modules () {
    let { url, System } = this;
    return classHolder.ModulePackageMapping.forSystem(System)
      .getModuleIdsForPackageURL(url)
      .map(id => module(System, id));
  }

  async resources (
    matches /* = url => url.match(/\.js$/) */,
    exclude = ['.git', 'node_modules', '.module_cache', 'lively.next-node_modules']
  ) {
    let { System, url } = this;
    let allPackages = Package.allPackageURLs(System);
    let packagesToIgnore = allPackages.filter(purl =>
      purl !== url && !url.startsWith(purl)/* parent packages */);
    let dirList = await resource(url).dirList('infinity', { exclude });
    let resourceURLs = dirList
      .filter(ea => !ea.isDirectory() &&
                     !packagesToIgnore.some(purl => ea.url.startsWith(purl)))
      .map(ea => ea.url);
    let loadedModules = arr.pluck(this.modules(), 'id');

    if (matches) resourceURLs = resourceURLs.filter(matches);

    return resourceURLs.map(resourceURL => {
      let nameInPackage = resourceURL.replace(url, '').replace(/^\//, '');
      let isLoaded = loadedModules.includes(resourceURL);
      return { isLoaded, url: resourceURL, nameInPackage, package: this };
    });
  }

  hasResource (urlOrLocalName) {
    let { url: packageURL } = this;
    let res = urlOrLocalName.startsWith(packageURL)
      ? resource(urlOrLocalName)
      : resource(packageURL).join(urlOrLocalName);
    return res.exists();
  }

  toString () { return `Package(${this.name} - ${this.path()}/)`; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // configuration
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  mergeWithConfig (config) {
    config = { ...config };
    let { name, map } = config;

    if (name) {
      delete config.name;
      this._name = name;
    }

    if (map) {
      delete config.map;
      Object.assign(this.map, map);
    }

    Object.assign(this, config);
    return this;
  }

  addMapping (name, url) {
    this.map[name] = url;
    this.System.config({ packages: { [this.url]: { map: { [name]: url } } } });
  }

  async tryToLoadPackageConfig () {
    let { System, url } = this;
    let packageConfigURL = url + '/package.json';
    System.config({
      meta: { [packageConfigURL]: { format: 'json' } },
      packages: { [url]: { meta: { 'package.json': { format: 'json' } } } }
    });

    System.debug && console.log('[lively.modules package reading config] %s', packageConfigURL); // eslint-disable-line no-console

    try {
      let config = System.get(packageConfigURL) || await System.import(packageConfigURL);
      let packageConfigPaths = [...System.packageConfigPaths];
      arr.pushIfNotIncluded(packageConfigPaths, packageConfigURL); // to inform systemjs that there is a config
      System.config({ packageConfigPaths });
      return config;
    } catch (err) {
      console.log('[lively.modules package] Unable loading package config %s for package: ', packageConfigURL, err); // eslint-disable-line no-console
      delete System.meta[packageConfigURL];
      let name = url.split('/').slice(-1)[0];
      return { name: name }; // "pseudo-config"
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // register / load
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async import () {
    await this.register();
    // *after* the package is registered the normalize call should resolve to the
    // package's main module
    let { url, System } = this;
    let mainModule = module(System, await System.normalize(url));
    let exported = await System.import(mainModule.id);
    // rk 2017-01-25: since the notifications that let the ModuleCache know
    // that the module is loaded are async, we need to wait for lively.modules to
    // "know" that the imported module (and all its dependencies) are actually
    // loaded
    // rms 2021-09-05 we now achieve this by an explicitly resolved promise on
    // load of the module instead of waitFor() which has a huge impact
    // on performance.
    const p = promise.deferred();
    mainModule.whenLoaded(p.resolve);
    await p.promise;
    return exported;
  }

  isRegistering () { return !!this.registerProcess; }

  async register (optPkgConfig) {
    if (this.isRegistering()) return this.registerProcess.promise;

    let { System, url } = this;
    this.registerProcess = promise.deferred();
    let registerP = this.registerProcess.promise;

    System.debug && console.log('[lively.modules package register] %s', url); // eslint-disable-line no-console

    try {
      let cfg = optPkgConfig || await this.tryToLoadPackageConfig();
      this.registerWithConfig(cfg);
      this.registerProcess.resolve(cfg);
    } catch (err) {
      this.registerProcess.reject(err);
      throw err;
    } finally { delete this.registerProcess; }

    return registerP;
  }

  updateConfig (config) {
    config = { ...this.runtimeConfig, ...config };
    let { name, version } = this;
    let { name: newName, version: newVersion } = config;
    new PackageConfiguration(this).applyConfig(config);
    if (name !== config.name || version !== config.version) {
      console.log(`[lively.modules] Updating registry ${name}@${version} => ${newName}@${newVersion}`); // eslint-disable-line no-console
      let registry = classHolder.PackageRegistry.ofSystem(this.System);
      registry.updateNameAndVersionOf(this, name, version, newName, newVersion);
    }
  }

  registerWithConfig (config = this.runtimeConfig) {
    let { System, url } = this;
    let result = new PackageConfiguration(this).applyConfig(config);
    let packageConfigURL = join(url, 'package.json');

    if (!System.get(packageConfigURL)) { System.set(packageConfigURL, System.newModule({ ...config, default: config })); }

    emit('lively.modules/packageregistered', { package: url }, Date.now(), System);

    return result;
  }

  remove (opts) {
    opts = { forgetEnv: true, forgetDeps: false, unloadModules: true, ...opts };
    let { System, url } = this;
    url = url.replace(/\/$/, '');

    if (opts.unloadModules) { this.modules().forEach(mod => mod.unload(opts)); }

    let registry = classHolder.PackageRegistry.ofSystem(System);
    registry.removePackage(this);

    let conf = System.getConfig();
    let packageConfigURL = url + '/package.json';
    System.delete(String(packageConfigURL));
    arr.remove(conf.packageConfigPaths || [], packageConfigURL);
    System.config({
      meta: { [packageConfigURL]: {} },
      packages: { [url]: {} },
      packageConfigPaths: conf.packageConfigPaths
    });
    delete System.CONFIG.packages[url];

    emit('lively.modules/packageremoved', { package: this.url }, Date.now(), System);
  }

  reload (opts) {
    let { System, url } = this;
    let registry = classHolder.PackageRegistry.ofSystem(System);
    let covered = registry.coversDirectory(url);

    this.remove(opts);
    registry.addPackageAt(url, covered || 'devPackageDirs', { [url]: this });
    return this.import();
  }

  async fork (newName, newURL) {
    if (!newURL) {
      newURL = resource(this.url).join(`../${newName}`).withRelativePartsResolved().url;
    }
    return await this.changeAddress(newURL, newName, false/* removeOriginal */);
  }

  async rename (newName) {
    let newURL = resource(this.url).join(`../${newName}`).withRelativePartsResolved().url;
    return await this.changeAddress(newURL, newName, true/* removeOriginal */);
  }

  async changeAddress (newURL, newName = null, removeOriginal = true) {
    newURL = newURL.replace(/\/?/, '');

    let { System, url: oldURL } = this;
    let config = await this.runtimeConfig;
    let oldPackageDir = resource(oldURL).asDirectory();
    let newP = new Package(System, newURL);
    let newPackageDir = await resource(newURL).asDirectory();

    config.name = newName || this.name;

    let registry = classHolder.PackageRegistry.ofSystem(System);
    let covered = registry.coversDirectory(oldURL);

    classHolder.ModulePackageMapping.forSystem(System).clearCache();
    if (System.CONFIG.packages[oldURL]) {
      System.CONFIG.packages[newURL] = System.CONFIG.packages[oldURL];
      if (removeOriginal) { delete System.CONFIG.packages[oldURL]; }
    }

    Object.assign(newP, obj.select(this, ['_name', 'map', 'config']));
    await newPackageDir.ensureExistance();

    let resourceURLs = (await this.resources(undefined, [])).map(ea => ea.url);
    let modules = this.modules();

    // first move modules loaded in runtime, those now how to rename
    // themselves...
    for (let m of modules) {
      let newId = newPackageDir.join(m.pathInPackage()).url;
      if (removeOriginal) await m.renameTo(newId);
      else await m.copyTo(newId);
      // keep track of resources
      let resourceIndex = resourceURLs.indexOf(m.id);
      if (resourceIndex > -1) {
        resourceURLs.splice(resourceIndex, 1);
      }
    }

    // ensure the existance of the remaining resources
    for (let url of resourceURLs) {
      let r = resource(url);
      let localName = r.relativePathFrom(oldPackageDir);
      await r.copyTo(newPackageDir.join(localName));
    }

    if (removeOriginal) {
      await this.remove({ forgetEnv: true, forgetDeps: false });
      await oldPackageDir.remove();
    }

    // name change if necessary
    if (newName) {
      newP.name = newName;

      newP.config.name = newName;
      let configFile = resource(newURL).join('package.json');
      try {
        if (await configFile.exists()) {
          let c = await configFile.readJson();
          if (c.name === this.name) {
            c.name = newName;
            await configFile.writeJson(c, true);
          }
          let runtimeC = System.get(configFile.url);
          if (runtimeC) {
            System.set(configFile.url, System.newModule({ ...runtimeC, name: newName }));
          }
        }
      } catch (e) {}
    }

    // PackageRegistry update;
    covered = covered || 'individualPackageDirs';
    if (covered === 'individualPackageDirs' || covered === 'devPackageDirs') {
      registry._addPackageDir(newURL, covered, true/* uniqCheck */);
    }
    registry._addPackageWithConfig(newP, config, newURL, covered);
    registry.resetByURL();
    registry._updateLatestPackages();

    return newP;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // searching
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async search (needle, options = {}) {
    let modules = options.includeUnloaded
      ? (await this.resources(
          url => url.endsWith('.js'),
          ['.git', 'node_modules', 'dist', '.module_cache', 'lively.next-node_modules', ...options.excludedModules || []]))
          .map(({ url }) => module(this.System, url))
      : this.modules().filter(ea => ea.isLoaded());
    return Promise.all(
      modules.map(m => m.search(needle, options)
        .catch(err => {
          console.error(`Error searching module ${m.name}:\n${err.stack}`); // eslint-disable-line no-console
          return [];
        }))).then(res => res.flat());
  }
}

export {
  ensurePackage,
  importPackage,
  removePackage,
  reloadPackage,
  registerPackage,
  getPackage,
  lookupPackage,
  applyConfig,
  getPackageSpecs,
  Package
};
