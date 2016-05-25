import { arr, string, promise } from "lively.lang";
import { install as installHook, isInstalled as isHookInstalled } from "./hooks.js";

import { computeRequireMap as requireMap } from './dependencies.js'

export { importPackage, registerPackage, applyConfig, getPackages };

// helper
function isJsFile(url) { return /\.js/i.test(url); }
function asDir(url) {
  return isJsFile(url) ? url.replace(/\/[^\/]*$/, "") : url.replace(/\/$/, "");
}

var join = string.joinPath;

function isURL(string) { return /^[^:\\]+:\/\//.test(string); }

function urlResolve(url) {
  var urlMatch = url.match(/^([^:]+:\/\/)(.*)/);
  if (!urlMatch) return url;

  var protocol = urlMatch[1],
      path = urlMatch[2],
      result = path;
  // /foo/../bar --> /bar
  do {
      path = result;
      result = path.replace(/\/[^\/]+\/\.\./, '');
  } while (result != path);
  // foo//bar --> foo/bar
  result = result.replace(/(^|[^:])[\/]+/g, '$1/');
  // foo/./bar --> foo/bar
  result = result.replace(/\/\.\//g, '/');
  return protocol + result;
}

function normalizeInsidePackage(System, urlOrName, packageURL) {
  return isURL(urlOrName) ?
    urlOrName : // absolute
    urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName)); // relative to either the package or the system:
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

async function importPackage(System, packageURL) {
  await registerPackage(System, packageURL);
  // *after* the package is registered the normalize call should resolve to the
  // package's main module
  return System.import(await System.normalize(packageURL));
}

async function registerPackage(System, packageURL, packageLoadStack) {
  var url = await System.normalize(packageURL);

  if (!isURL(url))
    return Promise.reject(new Error(`Error registering package: ${url} is not a valid URL`));


  // ensure it's a directory
  if (!url.match(/\.js/)) url = url;
  else if (url.indexOf(url + ".js") > -1) url = url.replace(/\.js$/, "");
  else url = url.split("/").slice(0,-1).join("/");

  if (url.match(/\.js$/))
    return Promise.reject(new Error("[registerPackage] packageURL is expected to point to a directory but seems to be a .js file: " + url));

  url = String(url).replace(/\/$/, "");

  packageLoadStack = packageLoadStack || [];
  var registerSubPackages = true;
  // stop here to support circular deps
  if (packageLoadStack.indexOf(url) !== -1) {
    registerSubPackages = false;
    System.debug && console.log("[lively.modules package register] %s is a circular dependency, stopping registerign subpackages", url);
  } else packageLoadStack.push(url)

  System.debug && console.log("[lively.modules package register] %s", url);

  var packageInSystem = System.packages[url] || (System.packages[url] = {}),
      cfg = await tryToLoadPackageConfig(System, url),
      packageConfigResult = await applyConfig(System, cfg, url)

  if (registerSubPackages) {
    for (let subp of packageConfigResult.subPackages)
      await registerPackage(System, subp.address.replace(/\/?$/, "/"), packageLoadStack);
  }

  return cfg.name;
}

function tryToLoadPackageConfig(System, packageURL) {
  var packageConfigURL = packageURL + "/package.json";

  System.config({
    meta: {[packageConfigURL]: {format: "json"}},
    packages: {[packageURL]: {meta: {"package.json": {format: "json"}}}}
  });

  System.debug && console.log("[lively.modules package reading config] %s", packageConfigURL)

  return Promise.resolve(System.get(packageConfigURL) || System.import(packageConfigURL))
    .then(config => {
      arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL)
      return config;
    })
    .catch((err) => {
      console.log("[lively.modules package] Unable loading package config %s for package: ", packageConfigURL, err);
      delete System.meta[packageConfigURL];
      var name = packageURL.split("/").slice(-1)[0];
      return {name: name}; // "pseudo-config"
    });
}

function applyConfig(System, packageConfig, packageURL) {
  // takes a config json object (typically read from a package.json file but
  // can be used standalone) and changes the System configuration to what it finds
  // in it.
  // In particular uses the "systemjs" section as described in https://github.com/systemjs/systemjs/blob/master/docs/config-api.md
  // and uses the "lively" section as described in `applyLivelyConfig`

  var name            = packageConfig.name || packageURL.split("/").slice(-1)[0],
      packageInSystem = System.packages[packageURL] || (System.packages[packageURL] = {}),
      sysConfig       = packageConfig.systemjs,
      livelyConfig    = packageConfig.lively,
      main            = packageConfig.main || "index.js";
  System.config({map: {[name]: packageURL}});

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
    var files = livelyConfig.bundles[name].map(f => System.normalizeSync(f, packageURL + "/"));
    bundles[absName] = files;
    return bundles;
  }, {});
  System.config({bundles: normalized});
  return Promise.resolve();
}

function applyLivelyConfigMeta(System, livelyConfig, packageURL) {
  if (!livelyConfig.meta) return;
  var pConf = System.packages[packageURL];
  Object.keys(livelyConfig.meta).forEach(key => {
    var val = livelyConfig.meta[key];
    if (isURL(key)) {
      System.meta[key] = val;
    } else {
      if (!pConf.meta) pConf.meta = {};
      pConf.meta[key] = val;
    }
  });
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
        livelyConfig.preferLoadedPackages : true;

  var normalized = System.normalizeSync(subPackageName, packageURL + "/");
  if (preferLoadedPackages && (pConf.map[subPackageName] || System.map[subPackageName] || System.get(normalized))) {
    var subpackageURL;
    if (pConf.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, pConf.map[subPackageName], packageURL);
    else if (System.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], packageURL);
    else subpackageURL = normalized;
    System.debug && console.log("[lively.module package] Package %s required by %s already in system as %s", subPackageName, packageURL, subpackageURL);
    return {name: subPackageName, address: subpackageURL};
  }

  pConf.map[subPackageName] = livelyConfig.packageMap[subPackageName];

  // lookup
  var subpackageURL = normalizeInsidePackage(System, livelyConfig.packageMap[subPackageName], packageURL);
  System.debug && console.log("[lively.module package] Package %s required by %s NOT in system, will be loaded as %s", subPackageName, packageURL, subpackageURL);
  return {name: subPackageName, address: subpackageURL};
}

function packageNamesAndAddresses(System) {
  // returns a name - address map like
  // {
  //   lively.modules: "http://localhost:9001/node_modules/lively.modules",
  //   // ...
  // }
  return Object.keys(System.packages).reduce((nameMap, packageURL) => {
    var pkg = System.packages[packageURL];
    if (pkg.names) pkg.names.forEach(name => nameMap[name] = packageURL);
    return nameMap;
  }, {});
}

function groupIntoPackages(System, moduleNames, packageNames) {

  return arr.groupBy(moduleNames, groupFor);

  function groupFor(moduleName) {
    var fullname = System.normalizeSync(moduleName),
        matching = packageNames.filter(p => fullname.indexOf(p) === 0);
    return matching.length ?
      matching.reduce((specific, ea) => ea.length > specific.length ? ea : specific) :
      "no group";
  }
}

function getPackages(System) {
  // returns a map like
  // ```
  // {
  // package-address: {
  //   address: package-address,
  //   modules: [module-name-1, module-name-2, ...],
  //   name: package-name,
  //   names: [package-name, ...]
  // }, ...
  // ```

  var map = requireMap(System),
      modules = Object.keys(map),
      packages = Object.keys(System.packages),
      result = {};

  groupIntoPackages(System, modules, packages).mapGroups((packageAddress, moduleNames) => {
    var p = System.packages[packageAddress],
        names = p ? p.names : [];
    if (!names || !names.length) names = [packageAddress.replace(/^(?:.+\/)?([^\/]+)$/, "$1")];

    moduleNames = moduleNames.filter(name => name !== packageAddress && name !== packageAddress + "/")

    result[packageAddress] = {
      address: packageAddress,
      name: names[0],
      names: names,
      modules: moduleNames.map(name => ({
        name: name,
        deps: map[name]
      }))
    }
  });

  return result;
}