import { arr } from "lively.lang";
import { install as installHook, isInstalled as isHookInstalled } from "./hooks.js";

export { registerPackage, applyConfig, knownPackages };

// helper
function isJsFile(url) { return /\.js/i.test(url); }
function asDir(url) {
  return isJsFile(url) ? url.replace(/\/[^\/]*$/, "") : url.replace(/\/$/, "");
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function registerPackage(System, packageURL) {
  // packageURL = String(packageURL).replace(/\/$/, "");
  // console.log("%s ... %s", packageURL, asDir(String(packageURL)))

  packageURL = asDir(String(packageURL));

  System.debug && console.log("[lively.modules package register] %s", packageURL)

  var packageInSystem = System.packages[packageURL] || (System.packages[packageURL] = {});

  return tryToLoadPackageConfig(System, packageURL)
    .then(cfg => applyConfig(System, cfg, packageURL)
    .then(packageConfigResult =>
      Promise.all(packageConfigResult.subPackages.map(subp => registerPackage(System, subp.address))))
    .then(() => cfg.name));
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

  return Promise.resolve().then(() => {
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
  
    return (livelyConfig ? applyLivelyConfig(System, livelyConfig, packageURL) : Promise.resolve({subPackages: []}))
      .then((packageApplyResult) => {
        packageInSystem.names = packageInSystem.names || [];
        arr.pushIfNotIncluded(packageInSystem.names, name);
        packageInSystem.main = main;
        return packageApplyResult;
      });
  });
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
  applyLivelyConfigHooks(System, livelyConfig, packageURL);
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

function applyLivelyConfigPackageMap(System, livelyConfig, packageURL) {
  var pConf = System.packages[packageURL],
      preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ?
        livelyConfig.preferLoadedPackages : true;

  if (!livelyConfig.packageMap) return Promise.resolve({subPackages: []});

  return Promise.all(
    Object.keys(livelyConfig.packageMap).map(name =>
      System.normalize(name, packageURL + "/")
        .then(normalized => {
          if (preferLoadedPackages && (pConf.map[name] || System.map[name] || System.get(normalized)))
            return Promise.resolve({name: name, address: pConf.map[name] || System.map[name] || normalized});

          pConf.map[name] = livelyConfig.packageMap[name];

          // lookup
          return System.normalize(livelyConfig.packageMap[name], packageURL + "/")
            .then(normalized => {
              // SystemJS sometimes adds .js extension even without defaultJSExtensions, grrr
              if (!/\.js$/.test(livelyConfig.packageMap[name])) normalized = normalized.replace(/\.js$/, "");
              return {name: name, address: normalized};
            });
      }))).then(subPackages => ({subPackages: subPackages}));
}

function knownPackages(System) {
  return Object.keys(System.packages).reduce((nameMap, packageURL) => {
    var pkg = System.packages[packageURL];
    if (pkg.names) pkg.names.forEach(name => nameMap[name] = packageURL);
    return nameMap;
  }, {});
}
