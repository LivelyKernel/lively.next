import { arr, promise, obj } from "lively.lang";
import { emit } from "lively.notifications";
import module from "../../src/module.js";
import { resource } from "lively.resources";
import {
  removeFromPackageStore,
  normalizePackageURL
} from "./internal.js";
import ModulePackageMapping from "./module-package-mapping.js";
import PackageConfiguration from "./configuration.js";
import { isURL } from "../url-helpers.js";
import { PackageRegistry } from "./package-registry.js";



  // arr.withoutAll(
  //   allPackageNames(System),
  //   System["__lively.modules__packageRegistry"].allPackages().map(ea => ea.url))

function allPackageNames(System) {
  return Object.keys(PackageRegistry.ofSystem(System).byURL);
}

export function getPackage(System, packageURL, isNormalized = false) {
  let url = isNormalized ? packageURL : normalizePackageURL(System, packageURL),
      registry = PackageRegistry.ofSystem(System);
  return registry.findPackageWithURL(url) 
      || registry.addPackageDir(packageURL, true/*isDev...*/, true/*sync*/);
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// package object
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class Package {

  static allPackages(System) { return obj.values(PackageRegistry.ofSystem(System).byURL); }

  static forModule(System, module) {
    return this.forModuleId(System, module.id);
  }

  static forModuleId(System, moduleId) {
    let pAddress = ModulePackageMapping.forSystem(System).getPackageURLForModuleId(moduleId);
    return pAddress ? getPackage(System, pAddress, true/*normalized*/) : null;
  }

  static fromJSON(System, jso) {
    return new this(System).fromJSON(jso);
  }

  constructor(System, packageURL, name, version, config = {}) {
    this.url = packageURL;
    this._name = name || config.name;
    this.version = version || config.version;
    this.System = System;
    this.registerProcess = null;
    this.map = {};
    this.dependencies = config.dependencies || {};
    this.devDependencies = config.devDependencies || {};
    this.main = config.main;
    this.systemjs = config.systemjs;
  }

  toJSON() {
    let {System} = this,
        jso = obj.select(this, [
          "url",
          "_name",
          "version",
          "map",
          "dependencies",
          "devDependencies",
          "main",
          "systemjs"
        ]);
    if (jso.url.startsWith(System.baseURL))
      jso.url = jso.url.slice(System.baseURL.length).replace(/^\//, "")
    return jso;
  }
  
  fromJSON(jso) {
    let {System} = this;
    this.url =             jso.url;
    this._name =           jso._name;
    this.version =         jso.version;
    this.map =             jso.map || {};
    this.main =            jso.main;
    this.dependencies =    jso.dependencies || {};
    this.devDependencies = jso.devDependencies || {};
    this.systemjs =        jso.systemjs;
    if (!isURL(this.url))
      this.url = resource(System.baseURL).join(this.url).url;
    return this;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get isPackage() { return true; }

  get name() {
    if (this._name) return this._name;
    var config = this.System.get(this.url + "/package.json");
    if (config && config.name) return config.name;
    return arr.last(this.url.replace(/[\/]+$/, "").split("/"));
  }
  set name(v) { return this._name = v; }

  get nameAndVersion() { return `${this.name}@${this.version}`}

  get address() { return this.url; }
  set address(v) { return this.url = v; }

  get runtimeConfig() {
    let {
          name,
          version,
          dependencies,
          devDependencies,
          main, systemjs
        } = this,
        config = {
          name: name,
          version: version,
          dependencies: dependencies || {},
          devDependencies: devDependencies || {},
        };
    if (main) config.main = main;
    if (systemjs) config.systemjs = systemjs;
    return config;
  }

  path() {
    var base = this.System.baseURL;
    return this.url.indexOf(base) === 0 ? this.url.slice(base.length) : this.url;
  }

  modules() {
    let {url, System} = this;
    return ModulePackageMapping.forSystem(System)
            .getModuleIdsForPackageURL(url)
            .map(id => module(System, id));
  }

  async resources(
    matches /*= url => url.match(/\.js$/)*/,
    exclude = [".git", "node_modules", ".module_cache", "lively.next-node_modules"],
  ) {
    let {System, url} = this,
        allPackages = allPackageNames(System),
        packagesToIgnore = allPackages.filter(purl =>
          purl !== url && !url.startsWith(purl)/*parent packages*/),
        dirList = await resource(url).dirList('infinity', {exclude}),
        resourceURLs = dirList
          .filter(ea => !ea.isDirectory()
                     && !packagesToIgnore.some(purl => ea.url.startsWith(purl)))
          .map(ea => ea.url),
        loadedModules = arr.pluck(this.modules(), "id");

    if (matches) resourceURLs = resourceURLs.filter(matches);

    return resourceURLs.map(resourceURL => {
      let nameInPackage = resourceURL.replace(url, "").replace(/^\//, ""),
          isLoaded = loadedModules.includes(resourceURL);
      return {isLoaded, url: resourceURL, nameInPackage, package: this};
    });
  }

  hasResource(urlOrLocalName) {
    let {System, url: packageURL} = this,
        res = urlOrLocalName.startsWith(packageURL) ?
          resource(urlOrLocalName) : resource(packageURL).join(urlOrLocalName);
    return res.exists();
  }

  toString() { return `Package(${this.name} - ${this.path()}/)`; }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // configuration
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  mergeWithConfig(config) {
    config = {...config};
    var {name, map} = config;

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

  addMapping(name, url) {
    this.map[name] = url;
    this.System.config({packages: {[this.url]: {map: {[name]: url}}}});
  }

  async tryToLoadPackageConfig() {
    var {System, url} = this,
        packageConfigURL = url + "/package.json";

    System.config({
      meta: {[packageConfigURL]: {format: "json"}},
      packages: {[url]: {meta: {"package.json": {format: "json"}}}}
    });

    System.debug && console.log("[lively.modules package reading config] %s", packageConfigURL);

    try {
      var config = System.get(packageConfigURL) || await System.import(packageConfigURL);
      arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL); // to inform systemjs that there is a config
      return config;
    } catch (err) {
      console.log("[lively.modules package] Unable loading package config %s for package: ", packageConfigURL, err);
      delete System.meta[packageConfigURL];
      var name = url.split("/").slice(-1)[0];
      return {name: name}; // "pseudo-config"
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // register / load
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async import() {
    await this.register();
    // *after* the package is registered the normalize call should resolve to the
    // package's main module
    let {url, System} = this,
        mainModule = module(System, await System.normalize(url)),
        exported = await System.import(mainModule.id);
    // rk 2017-01-25: since the notifications that let the ModuleCache know
    // that the module is loaded are async, we need to wait for lively.modules to
    // "know" that the imported module (and all its dependencies) are actually
    // loaded
    await promise.waitFor(1000, () => mainModule.isLoaded());
    return exported;
  }

  isRegistering() { return !!this.registerProcess; }

  async register(optPkgConfig, packageLoadStack = [this.url]) {

    if (this.isRegistering()) return this.registerProcess.promise;

    var {System, url} = this;
    this.registerProcess = promise.deferred();

    System.debug && console.log("[lively.modules package register] %s", url);

    var cfg = optPkgConfig || await this.tryToLoadPackageConfig(),
        packageConfigResult = new PackageConfiguration(this).applyConfig(cfg);

    if (!System["__lively.modules__packageRegistry"]) {
      for (let supPkgURL of packageConfigResult.subPackages) {
        // stop here to support circular deps
        let supPkg = getPackage(System, supPkgURL);
        if (packageLoadStack.includes(supPkg.url)) {
          if (System.debug || true) {
            var shortStack = packageLoadStack
                          && packageLoadStack.map(ea =>
                              ea.indexOf(System.baseURL) === 0 ?
                                ea.slice(System.baseURL.length) : ea)
            System.debug && console.log(`[lively.modules package register]`
                                      + ` ${url} is a circular dependency, stopping registering `
                                      + `subpackages, stack: ${shortStack}`);
          }
        } else {
          packageLoadStack.push(supPkg.url);
          await supPkg.register(null, packageLoadStack);
        }
      }
    }

    var registerP = this.registerProcess.promise;
    this.registerProcess.resolve(cfg);
    delete this.registerProcess;
    emit("lively.modules/packageregistered", {"package": this.url}, Date.now(), System);

    return registerP;
  }

  register2(config = this.runtimeConfig) {
    var {System, url} = this,
        packageConfigURL = url + "/package.json";

    System.config({
      meta: {[packageConfigURL]: {format: "json"}},
      packages: {[url]: {meta: {"package.json": {format: "json"}}}}
    });

    return new PackageConfiguration(this).applyConfig(config);
  }

  remove(opts) {
    opts = {forgetEnv: true, forgetDeps: false, ...opts};
    let {System, url} = this;

    url = url.replace(/\/$/, "");
    let conf = System.getConfig(),
        packageConfigURL = url + "/package.json";

    this.modules().forEach(mod => mod.unload(opts));

    removeFromPackageStore(System, this);
    System.delete(String(packageConfigURL));
    arr.remove(conf.packageConfigPaths || [], packageConfigURL);

    System.config({
      meta: {[packageConfigURL]: {}},
      packages: {[url]: {}},
      packageConfigPaths: conf.packageConfigPaths
    });
    delete System.meta[packageConfigURL];
    delete System.packages[url];
    this.config = {};
    emit("lively.modules/packageremoved", {"package": this.url}, Date.now(), System);
  }

  reload(opts) { this.remove(opts); return this.import(); }

  async fork(newName, newURL) {
    if (!newURL) {
      newURL = resource(this.url).join(`../${newName}`).withRelativePartsResolved().url;
    }
    return await this.changeAddress(newURL, newName, false/*removeOriginal*/);
  }

  async rename(newName) {
    let newURL = resource(this.url).join(`../${newName}`).withRelativePartsResolved().url;
    return await this.changeAddress(newURL, newName, true/*removeOriginal*/);
  }

  async changeAddress(newURL, newName = null, removeOriginal = true) {
    newURL = newURL.replace(/\/?/, "");

    let {System, url: oldURL} = this,
        oldPackageDir = resource(oldURL).asDirectory(),
        newP = new Package(System, newURL),
        newPackageDir = await resource(newURL).asDirectory();

    ModulePackageMapping.forSystem(System).clearCache();
    packageStore(System)[newURL] = newP;
    if (System.packages[oldURL]) {
      System.packages[newURL] = System.packages[oldURL];
      if (removeOriginal)
        delete System.packages[oldURL];
    }

    Object.assign(newP, obj.select(this, ["_name", "map", "config"]))
    await newPackageDir.ensureExistance();

    let resourceURLs = (await this.resources(undefined, [])).map(ea => ea.url),
        modules = this.modules();

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
      let r = resource(url),
          localName = r.relativePathFrom(oldPackageDir);
      await r.copyTo(newPackageDir.join(localName));
    }

    if (removeOriginal) {
      await this.remove({forgetEnv: true, forgetDeps: false});
      await oldPackageDir.remove();
    }

    // name change if necessary
    if (newName) {
      newP.name = newName;

      newP.config.name = newName;
      var configFile = resource(newURL).join("package.json");
      try {
        if (await configFile.exists()) {
          let c = await configFile.readJson();
          if (c.name === this.name) {
            c.name = newName;
            await configFile.writeJson(c, true);
          }
          let runtimeC = System.get(configFile.url)
          if (runtimeC) {
            System.set(configFile.url, System.newModule({...runtimeC, name: newName}));
          }
        }
      } catch (e) {}
    }

    return newP;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // searching
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async search(needle, options = {}) {
    var modules = options.includeUnloaded ?
      (await this.resources(
        url => url.endsWith(".js"),
        [".git", "node_modules", "dist", ".module_cache", "lively.next-node_modules"]))
          .map(({url}) => module(this.System, url)) :
      this.modules().filter(ea => ea.isLoaded());
    return Promise.all(
        modules.map(m => m.search(needle, options)
          .catch(err => {
            console.error(`Error searching module ${m.name}:\n${err.stack}`);
            return [];
          }))).then(res => arr.flatten(res, 1));
  }

}
