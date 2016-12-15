import { arr, promise, obj } from "lively.lang";
import { emit } from "lively.notifications";
import { install as installHook, isInstalled as isHookInstalled } from "./hooks.js";
import module from "../src/module.js";
import { computeRequireMap as requireMap } from './dependencies.js'
import { knownModuleNames } from './system.js'
import { isJsFile, asDir, isURL, urlResolve, join } from "./url-helpers.js";
import { resource } from "lively.resources";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// internal
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function normalizeInsidePackage(System, urlOrName, packageURL) {
  return isURL(urlOrName) ?
    urlOrName : // absolute
    urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName)); // relative to either the package or the system:
}

function normalizePackageURL(System, packageURL) {
  if (allPackageNames(System).some(ea => ea === packageURL))
    return packageURL;

  var url = System.decanonicalize(packageURL.replace(/[\/]+$/, "") + "/");

  if (!isURL(url))
    throw new Error(`Strange package URL: ${url} is not a valid URL`)

  // ensure it's a directory
  if (!url.match(/\.js/)) url = url;
  else if (url.indexOf(url + ".js") > -1) url = url.replace(/\.js$/, "");
  else url = url.split("/").slice(0,-1).join("/");

  if (url.match(/\.js$/))
    throw new Error("packageURL is expected to point to a directory but seems to be a .js file: " + url);

  return String(url).replace(/\/$/, "");
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// We add instances of Package to the System which basically serves as
// "database" for all module / package related state.
// This also makes it easy to completely replace the module / package state by
// simply replacing the System instance
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// System.get("@lively-env").packages["http://localhost:9011/lively-system-interface/node_modules/lively.vm"] = new Package(System, System.decanonicalize("lively.vm/"))

function packageStore(System) {
  return System.get("@lively-env").packages;
}

function addToPackageStore(System, p) {
  var pInSystem = System.getConfig().packages[p.url] || {};
  p.mergeWithConfig(pInSystem);
  var store = packageStore(System);
  store[p.url] = p;
  return p;
}

function removeFromPackageStore(System, o) {
  var store = packageStore(System);
  delete store[o.url];
}

function findPackageNamed(System, name) {
  return obj.values(packageStore(System))
    .find(ea => ea.name === name);
}

function getPackage(System, packageURL, isNormalized = false) {
  var url = isNormalized ? packageURL : normalizePackageURL(System, packageURL);
  return packageStore(System).hasOwnProperty(url) ?
    packageStore(System)[url] :
    addToPackageStore(System, new Package(System, url));
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// config
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class PackageConfiguration {

  constructor(pkg) {
    this.pkg = pkg;
  }

  get System() { return this.pkg.System; }
  get packageURL() { return this.pkg.url; }

  applyConfig(config) {
    // takes a config json object (typically read from a package.json file but
    // can be used standalone) and changes the System configuration to what it finds
    // in it.
    // In particular uses the "systemjs" section as described in https://github.com/systemjs/systemjs/blob/master/docs/config-api.md
    // and uses the "lively" section as described in `applyLivelyConfig`

    var {System, packageURL, pkg} = this,
        name                      = config.name || packageURL.split("/").slice(-1)[0],
        version                   = config.version,
        sysConfig                 = config.systemjs || {},
        livelyConfig              = config.lively,
        main                      = config.main || "index.js";

    System.config({
      map: {[name]: packageURL},
      packages: {[packageURL]: sysConfig}
    });

    var packageInSystem = System.getConfig().packages[packageURL] || {};
    if (!packageInSystem.map) packageInSystem.map = {};

    if (sysConfig) {
      if (livelyConfig && livelyConfig.main) main = livelyConfig.main;
      else if (sysConfig.main) main = sysConfig.main;
      this.applySystemJSConfig(sysConfig);
    }

    packageInSystem.referencedAs = packageInSystem.referencedAs || [];
    arr.pushIfNotIncluded(packageInSystem.referencedAs, name);

    if (!main.match(/\.[^\/\.]+/)) main += ".js";
    packageInSystem.main = main;

    // System.packages doesn't allow us to store our own properties
    pkg.version = version;
    pkg.mergeWithConfig(packageInSystem);

    return livelyConfig ? this.applyLivelyConfig(livelyConfig) : {subPackages: []};
  }

  applySystemJSConfig(sysConfig) {
    var {System} = this;
    // System.debug && console.log("[lively.modules package configuration] applying SystemJS config of %s", pkg);
    if (sysConfig.packageConfigPaths)
      System.packageConfigPaths = arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths));
    if (sysConfig.packages) // packages is normaly not support locally in a package.json
      System.config({packages: sysConfig.packages})
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively config
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  applyLivelyConfig(livelyConfig) {
    // configures System object from lively config JSON object.
    // - adds System.package entry for package
    // - adds name to System.package[pkg.url].referencedAs
    // - installs hook from {hooks: [{name, source}]}
    // - merges livelyConfig.packageMap into System.package[pkg.url].map
    //   entries in packageMap are specifically meant to be sub-packages!
    // Will return a {subPackages: [{name, address},...]} object

    this.applyLivelyConfigMeta(livelyConfig);
    this.applyLivelyConfigHooks(livelyConfig);
    this.applyLivelyConfigBundles(livelyConfig);
    return this.applyLivelyConfigPackageMap(livelyConfig);
  }

  applyLivelyConfigHooks(livelyConfig) {
    (livelyConfig.hooks || []).forEach(h => {
      try {
        var f = eval("(" + h.source + ")");
        if (!f.name || !isHookInstalled(this.System, h.target, f.name))
          installHook(this.System, h.target, f);
      } catch (e) {
        console.error("Error installing hook for %s: %s", this.packageURL, e, h);
      }
    });
  }

  applyLivelyConfigBundles(livelyConfig) {
    if (!livelyConfig.bundles) return Promise.resolve();
    var normalized = Object.keys(livelyConfig.bundles).reduce((bundles, name) => {
      var absName = this.packageURL + "/" + name,
          files = livelyConfig.bundles[name].map(f => this.System.decanonicalize(f, this.packageURL + "/"));
      bundles[absName] = files;
      return bundles;
    }, {});
    this.System.config({bundles: normalized});
    return Promise.resolve();
  }

  applyLivelyConfigMeta(livelyConfig) {
    if (!livelyConfig.meta) return;
    var pConf = this.System.getConfig().packages[this.packageURL] || {},
        c = {meta: {}, packages: {[this.packageURL]: pConf}};
    Object.keys(livelyConfig.meta).forEach(key => {
      var val = livelyConfig.meta[key];
      if (isURL(key)) {
        c.meta[key] = val;
      } else {
        if (!pConf.meta) pConf.meta = {};
        pConf.meta[key] = val;
      }
    });
    this.System.config(c);
  }

  applyLivelyConfigPackageMap(livelyConfig) {
    var subPackages = livelyConfig.packageMap ?
      Object.keys(livelyConfig.packageMap).map(name =>
        this.subpackageNameAndAddress(livelyConfig, name)) : [];
    return {subPackages};
  }

  subpackageNameAndAddress(livelyConfig, subPackageName) {
    // find out what other packages are dependencies of this.pkg

    var {System, packageURL, pkg} = this,
        preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ?
          livelyConfig.preferLoadedPackages : true,
        normalized = System.decanonicalize(subPackageName, packageURL);

    if (preferLoadedPackages) {
      var subpackageURL,
          existing = findPackageNamed(System, subPackageName);

      if (existing)                        subpackageURL = existing.url;
      else if (pkg.map[subPackageName])    subpackageURL = normalizeInsidePackage(System, pkg.map[subPackageName], packageURL);
      else if (System.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], packageURL);
      else if (System.get(normalized))     subpackageURL = System.decanonicalize(subPackageName, packageURL + "/");

      if (subpackageURL) {
        if (System.get(subpackageURL)) subpackageURL = subpackageURL.split("/").slice(0,-1).join("/"); // force to be dir
        System.debug && console.log("[lively.module package] Package %s required by %s already in system as %s", subPackageName, pkg, subpackageURL);
        return getPackage(System, subpackageURL);
      }
    }

    pkg.addMapping(subPackageName, livelyConfig.packageMap[subPackageName])

    // lookup
    var subpackageURL = normalizeInsidePackage(System, livelyConfig.packageMap[subPackageName], pkg.url);
    System.debug && console.log("[lively.module package] Package %s required by %s NOT in system, will be loaded as %s", subPackageName, pkg, subpackageURL);

    return getPackage(System, subpackageURL);
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// package object
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class Package {

  static allPackages(System) { return obj.values(packageStore(System)); }

  static forModule(System, module) {
    var id = module.id,
        map = moduleNamesByPackageNames(System),
        pAddress = Object.keys(map).find(pName => map[pName].includes(id));
    return getPackage(System, pAddress, true/*normalized*/);
  }

  constructor(System, packageURL) {
    // the name from the packages config, set once the config is loaded
    this._name = undefined;
    // The names under which the package is referenced by other packages
    this.referencedAs = [];
    this.url = packageURL;
    this.System = System;
    this.version = null;
    this.registerProcess = null;
    this.map = {};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get name() {
    if (this._name) return this._name;
    var config = this.System.get(this.url + "/package.json");
    if (config && config.name) return config.name;
    if (this.referencedAs[0]) return this.referencedAs[0];
    return arr.last(this.url.replace(/[\/]+$/, "").split("/"));
  }
  set name(v) { return this._name = v; }
  get address() { return this.url; }
  set address(v) { return this.url = v; }

  path() {
    var base = this.System.baseURL;
    return this.url.indexOf(base) === 0 ? this.url.slice(base.length) : this.url;
  }

  modules() {
    return (moduleNamesByPackageNames(this.System)[this.url] || [])
            .map(id => module(this.System, id));
  }

  async resources(
    matches /*= url => url.match(/\.js$/)*/,
    exclude = [".git", "node_modules", ".optimized-loading-cache"],
  ) {
    var allPackages = allPackageNames(this.System),
        packagesToIgnore = allPackages.filter(purl => {
          return purl !== this.url && !this.url.startsWith(purl)/*parent packages*/
        }),
        dirList = await resource(this.address).dirList('infinity', {exclude}),
        resourceURLs = dirList
          .filter(ea => !ea.isDirectory()
                     && !packagesToIgnore.some(purl => ea.url.startsWith(purl)))
          .map(ea => ea.url),
        loadedModules = arr.pluck(this.modules(), "id");

// console.log(resourceURLs)
// console.log(packageNames)

    if (matches) resourceURLs = resourceURLs.filter(matches);

    return resourceURLs.map(url => {
      var nameInPackage = url.replace(this.address, "").replace(/‘\//, ""),
          isLoaded = loadedModules.includes(url);
      return {isLoaded, url, nameInPackage, package: this};
    });
  }

  toString() { return `Package(${this.name} - ${this.path()}/)`; }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // configuration
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  mergeWithConfig(config) {
    config = {...config};
    var {name, referencedAs, map} = config;

    if (referencedAs) {
      delete config.referencedAs
      this.referencedAs = arr.uniq(this.referencedAs.concat(referencedAs))
    }

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
    this.System.config({packages: {[this.url]: {map: {[name]: url}}}})
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
    return this.System.import(await this.System.normalize(this.url));
  }

  isRegistering() { return !!this.registerProcess; }

  async register(packageLoadStack = [this.url]) {

    var {System, url} = this;

    if (this.isRegistering()) return this.registerProcess.promise;
    this.registerProcess = promise.deferred();

    System.debug && console.log("[lively.modules package register] %s", url);
    var cfg = await this.tryToLoadPackageConfig(),
        packageConfigResult = await new PackageConfiguration(this).applyConfig(cfg);

    for (let supPkg of packageConfigResult.subPackages) {
      // stop here to support circular deps
      if (arr.include(packageLoadStack, supPkg.url)) {
        if (System.debug || true) {
          var shortStack = packageLoadStack && packageLoadStack.map(ea => ea.indexOf(System.baseURL) === 0 ? ea.slice(System.baseURL.length) : ea)
          System.debug && console.log(`[lively.modules package register] ${url} is a circular dependency, stopping registering subpackages, stack: ${shortStack}`);
        }
      } else {
        packageLoadStack.push(supPkg.url);
        await supPkg.register(packageLoadStack);
      }
    }

    var registerP = this.registerProcess.promise;
    this.registerProcess.resolve(cfg);
    delete this.registerProcess;
    emit("lively.modules/packageregistered", {"package": this.url}, Date.now(), System);

    return registerP;
  }

  remove() {
    var {System, url} = this;

    url = url.replace(/\/$/, "");
    var conf = System.getConfig(),
        packageConfigURL = url + "/package.json",
        p = getPackages(System).find(ea => ea.address === url);

    if (p)
      p.modules.forEach(mod =>
        module(System, mod.name).unload({forgetEnv: true, forgetDeps: false}));

    System.delete(String(packageConfigURL));
    arr.remove(conf.packageConfigPaths || [], packageConfigURL);

    System.config({
      meta: {[packageConfigURL]: {}},
      packages: {[url]: {}},
      packageConfigPaths: conf.packageConfigPaths
    });
    delete System.meta[packageConfigURL];
    delete System.packages[url];
    emit("lively.modules/packageremoved", {"package": this.url}, Date.now(), System);
  }

  reload() { this.remove(); return this.import(); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // searching
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async search(needle, options = {}) {
    var modules = options.includeUnloaded ?
      (await this.resources(
        url => url.endsWith(".js"),
        [".git", "node_modules", "dist"]))
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


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function importPackage(System, packageURL) { return getPackage(System, packageURL).import(); }
function registerPackage(System, packageURL, packageLoadStack) { return getPackage(System, packageURL).register(packageLoadStack); }
function removePackage(System, packageURL) { return getPackage(System, packageURL).remove(); }
function reloadPackage(System, packageURL) { return getPackage(System, packageURL).reload(); }

function allPackageNames(System) {
  var sysPackages = System.packages,
      livelyPackages = packageStore(System);
  return arr.uniq(Object.keys(sysPackages).concat(Object.keys(livelyPackages)))
}

export function moduleNamesByPackageNames(System) {
  var modules = knownModuleNames(System),
      packageNames = allPackageNames(System);

  return modules.reduce((packageMap, moduleName) => {
    var itsPackage = packageNames.reduce((itsPackage, packageName) => {
      if (!moduleName.startsWith(packageName)) return itsPackage;
      if (!itsPackage || itsPackage.length < packageName.length) return packageName;
      return itsPackage;
    }, null) || "no group";
    var packageModules = packageMap[itsPackage] || (packageMap[itsPackage] = []);
    packageModules.push(moduleName);
    return packageMap;
  }, {})
}

function groupIntoPackages(System, moduleIds, packageNames) {
  return arr.groupBy(moduleIds, moduleId => {
    var matching = packageNames.filter(p => moduleId.indexOf(p) === 0);
    return matching.length ?
      matching.reduce((specific, ea) => ea.length > specific.length ? ea : specific) :
      "no group";
  });
}


function getPackages(System) {
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
  return Package.allPackages(System).map(p => {
    return {
      ...obj.select(p, [
        "name", "main", "map", "meta",
        "referencedAs", "url", "address", "version"
      ]),
      modules: p.modules().map(m =>
        ({name: m.id, deps: m.directRequirements().map(ea => ea.id)}))
    }
  })
}

function applyConfig(System, packageConfig, packageURL) {
  return new PackageConfiguration(getPackage(System, packageURL)).applyConfig(packageConfig);
}


export {
  Package,
  getPackage,
  importPackage,
  registerPackage,
  removePackage,
  reloadPackage,
  applyConfig,
  getPackages
};
