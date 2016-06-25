import { arr, promise } from "lively.lang";
import { install as installHook, isInstalled as isHookInstalled } from "./hooks.js";
import module from "../src/module.js";
import { computeRequireMap as requireMap } from './dependencies.js'
import { isJsFile, asDir, isURL, urlResolve, join } from "./url-helpers.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// internal
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function normalizeInsidePackage(System, urlOrName, packageURL) {
  return isURL(urlOrName) ?
    urlOrName : // absolute
    urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName)); // relative to either the package or the system:
}

function normalizePackageURL(System, packageURL) {
  if (Object.keys(getPackages(System)).some(ea => ea === packageURL))
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

function packageStore(System) {
  return System.get("@lively-env").packages;
}

function addToPackageStore(System, p) {
  var store = packageStore(System);
  store[p.url] = p;
  return p;
}

function removeFromPackageStore(System, o) {
  var store = packageStore(System);
  delete store[o.url];
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// config
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

async function tryToLoadPackageConfig(System, packageURL) {
  var packageConfigURL = packageURL + "/package.json";
  System.config({
    meta: {[packageConfigURL]: {format: "json"}},
    packages: {[packageURL]: {meta: {"package.json": {format: "json"}}}}
  });

  System.debug && console.log("[lively.modules package reading config] %s", packageConfigURL)

  try {
    var config = System.get(packageConfigURL) || await System.import(packageConfigURL);
    arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL); // to inform systemjs that there is a config
    return config;
  } catch (err) {
    console.log("[lively.modules package] Unable loading package config %s for package: ", packageConfigURL, err);
    delete System.meta[packageConfigURL];
    var name = packageURL.split("/").slice(-1)[0];
    return {name: name}; // "pseudo-config"
  }
}

function applyConfig(System, packageConfig, packageURL) {
  // takes a config json object (typically read from a package.json file but
  // can be used standalone) and changes the System configuration to what it finds
  // in it.
  // In particular uses the "systemjs" section as described in https://github.com/systemjs/systemjs/blob/master/docs/config-api.md
  // and uses the "lively" section as described in `applyLivelyConfig`

  var name            = packageConfig.name || packageURL.split("/").slice(-1)[0],
      sysConfig       = packageConfig.systemjs || {},
      livelyConfig    = packageConfig.lively,
      main            = packageConfig.main || "index.js";

  System.config({
    map: {[name]: packageURL},
    packages: {[packageURL]: sysConfig}
  });

  var packageInSystem = System.getConfig().packages[packageURL] || {};
  if (!packageInSystem.map) packageInSystem.map = {};

  if (sysConfig) {
    if (sysConfig.packageConfigPaths)
      System.packageConfigPaths = arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths))
    if (sysConfig.main) main = sysConfig.main;
    applySystemJSConfig(System, packageConfig, packageURL)
  }

  var packageApplyResult = livelyConfig ?
    applyLivelyConfig(System, livelyConfig, packageURL) :
    {subPackages: []};

  packageInSystem.names = packageInSystem.names || [];
  arr.pushIfNotIncluded(packageInSystem.names, name);

  if (!main.match(/\.[^\/\.]+/)) main += ".js";
  packageInSystem.main = main;

  // System.packages doesn't allow us to store our own properties
  var p = getPackage(System, packageURL);
  Object.assign(p, packageInSystem);

  return packageApplyResult;
}

function applySystemJSConfig(System, systemjsConfig, packageURL) {}

function applyLivelyConfig(System, livelyConfig, packageURL) {
  // configures System object from lively config JSON object.
  // - adds System.package entry for packageURL
  // - adds name to System.package[packageURL].names
  // - installs hook from {hooks: [{name, source}]}
  // - merges livelyConfig.packageMap into System.package[packageURL].map
  //   entries in packageMap are specifically meant to be sub-packages!
  // Will return a {subPackages: [{name, address},...]} object
  applyLivelyConfigMeta(System, livelyConfig, packageURL);
  applyLivelyConfigHooks(System, livelyConfig, packageURL);
  applyLivelyConfigBundles(System, livelyConfig, packageURL);
  return applyLivelyConfigPackageMap(System, livelyConfig, packageURL);
}

function applyLivelyConfigHooks(System, livelyConfig, packageURL) {
  (livelyConfig.hooks || []).forEach(h => {
    try {
      var f = eval("(" + h.source + ")");
      if (!f.name || !isHookInstalled(System, h.target, f.name))
        installHook(System, h.target, f);
    } catch (e) {
      console.error("Error installing hook for %s: %s", packageURL, e, h);
    }
  });
}

function applyLivelyConfigBundles(System, livelyConfig, packageURL) {
  if (!livelyConfig.bundles) return Promise.resolve();
  var normalized = Object.keys(livelyConfig.bundles).reduce((bundles, name) => {
    var absName = packageURL.replace(/\/$/, "") + "/" + name;
    var files = livelyConfig.bundles[name].map(f => System.decanonicalize(f, packageURL + "/"));
    bundles[absName] = files;
    return bundles;
  }, {});
  System.config({bundles: normalized});
  return Promise.resolve();
}

function applyLivelyConfigMeta(System, livelyConfig, packageURL) {
  if (!livelyConfig.meta) return;
  var pConf = System.getConfig().packages[packageURL] || {},
      c = {meta: {}, packages: {[packageURL]: pConf}};
  Object.keys(livelyConfig.meta).forEach(key => {
    var val = livelyConfig.meta[key];
    if (isURL(key)) {
      c.meta[key] = val;
    } else {
      if (!pConf.meta) pConf.meta = {};
      pConf.meta[key] = val;
    }
  });
  System.config(c);
}

function applyLivelyConfigPackageMap(System, livelyConfig, packageURL) {
  var subPackages = livelyConfig.packageMap ?
    Object.keys(livelyConfig.packageMap).map(name =>
      subpackageNameAndAddress(System, livelyConfig, name, packageURL)) : [];
  return {subPackages: subPackages};
}

function subpackageNameAndAddress(System, livelyConfig, subPackageName, packageURL) {
  var pConf = System.packages[packageURL],
      preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ?
        livelyConfig.preferLoadedPackages : true,
      normalized = System.decanonicalize(subPackageName, packageURL.replace(/\/$/, ""));

  if (preferLoadedPackages && (pConf.map[subPackageName] || System.map[subPackageName] || System.get(normalized))) {
    var subpackageURL;
    if (pConf.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, pConf.map[subPackageName], packageURL);
    else if (System.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], packageURL);
    else subpackageURL = System.decanonicalize(subPackageName, packageURL + "/");
    if (System.get(subpackageURL)) subpackageURL = subpackageURL.split("/").slice(0,-1).join("/"); // force to be dir
    System.debug && console.log("[lively.module package] Package %s required by %s already in system as %s", subPackageName, packageURL, subpackageURL);
    return {name: subPackageName, address: subpackageURL};
  }

  pConf.map[subPackageName] = livelyConfig.packageMap[subPackageName];

  // lookup
  var subpackageURL = normalizeInsidePackage(System, livelyConfig.packageMap[subPackageName], packageURL);
  System.debug && console.log("[lively.module package] Package %s required by %s NOT in system, will be loaded as %s", subPackageName, packageURL, subpackageURL);
  return {name: subPackageName, address: subpackageURL};
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// package object
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class Package {

  constructor(System, packageURL) {
    this.url = packageURL;
    this.System = System;
  }

  async import() {
    await this.register();
    // *after* the package is registered the normalize call should resolve to the
    // package's main module
    return this.System.import(await this.System.normalize(this.url));
  }

  async register(packageLoadStack) {

    var {System, url} = this;
    this.url = url = normalizePackageURL(System, url);

    console.log(`REGISTERING ${url} while loading `, packageLoadStack);

    packageLoadStack = packageLoadStack || [];
    var registerSubPackages = true;
    // stop here to support circular deps
    if (packageLoadStack.indexOf(url) !== -1) {
      registerSubPackages = false;
      System.debug && console.log("[lively.modules package register] %s is a circular dependency, stopping registerign subpackages", url);
    } else packageLoadStack.push(url)

    System.debug && console.log("[lively.modules package register] %s", url);
    var cfg = await tryToLoadPackageConfig(System, url),
        packageConfigResult = await applyConfig(System, cfg, url)

    if (registerSubPackages) {
      for (let subp of packageConfigResult.subPackages) {
        await registerPackage(System, subp.address.replace(/\/?$/, "/"), packageLoadStack);
      }
    }

    return cfg;

  }

  remove() {
    var {System, url} = this;

    url = url.replace(/\/$/, "");
    var conf = System.getConfig(),
        packageConfigURL = url + "/package.json";

    var p = getPackages(System).find(ea => ea.address === url)
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
  }

  reload() { this.remove(); return this.import(); }

  search(needle, options) { return searchPackage(this.System, this.url, needle, options); }

}

function getPackage(System, packageURL) {
  var url = normalizePackageURL(System, packageURL);
  console.log(`getPackage ${url}`)
  return packageStore(System).hasOwnProperty(url) ?
    packageStore(System)[url] :
    addToPackageStore(System, new Package(System, url));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function importPackage(System, packageURL) { return getPackage(System, packageURL).import(); }
function registerPackage(System, packageURL, packageLoadStack) { return getPackage(System, packageURL).register(packageLoadStack); }
function removePackage(System, packageURL) { return getPackage(System, packageURL).remove(); }
function reloadPackage(System, packageURL) { return getPackage(System, packageURL).reload(); }


function groupIntoPackages(System, moduleNames, packageNames) {

  return arr.groupBy(moduleNames, groupFor);

  function groupFor(moduleName) {
    var fullname = System.decanonicalize(moduleName),
        matching = packageNames.filter(p => fullname.indexOf(p) === 0);
    return matching.length ?
      matching.reduce((specific, ea) => ea.length > specific.length ? ea : specific) :
      "no group";
  }
}

function getPackages(System) {
  // returns a list like
  // ```
  // [{
  //   address: package-address,
  //   modules: [module-name-1, module-name-2, ...],
  //   name: package-name,
  //   names: [package-name, ...]
  // }, ... ]
  // ```

  var map = requireMap(System),
      modules = Object.keys(map),
      sysPackages = System.packages,
      livelyPackages = packageStore(System),
      packageNames = arr.uniq(Object.keys(sysPackages).concat(Object.keys(livelyPackages))),
      result = [];

  groupIntoPackages(System, modules, packageNames).mapGroups((packageAddress, moduleNames) => {
    var systemP = sysPackages[packageAddress],
        livelyP = livelyPackages[packageAddress],
        p = livelyP && systemP ? Object.assign(livelyP, systemP) : livelyP || systemP,
        names = p ? p.names : [];
    if (!names || !names.length) names = [packageAddress.replace(/^(?:.+\/)?([^\/]+)$/, "$1")];

    moduleNames = moduleNames.filter(name => name !== packageAddress && name !== packageAddress + "/")

    result.push(Object.assign(p || {}, {
      address: packageAddress,
      name: names[0],
      names: names,
      modules: moduleNames.map(name => ({
        name: name,
        deps: map[name]
      }))
    }));
  });

  return result;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// search
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function searchPackage(System, packageURL, searchStr, options) {
  packageURL = packageURL.replace(/\/$/, "");
  var p = getPackages(System).find(p => p.address == packageURL);
  return p ? Promise.all(
    p.modules.map(m => module(System, m.name).search(searchStr, options)))
        .then(res => arr.flatten(res, 1)) :
        Promise.resolve([])
}

export {
  importPackage,
  registerPackage,
  removePackage,
  reloadPackage,
  applyConfig,
  getPackages,
  searchPackage
};
