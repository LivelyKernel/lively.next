import { arr } from "lively.lang";

export { registerPackage };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function registerPackage(System, packageURL) {
  packageURL = String(packageURL).replace(/\/$/, "");
  var packageInSystem = System.packages[packageURL] || (System.packages[packageURL] = {});

  return _tryToLoadPackageConfig(System, packageURL)
    .then(cfg => {
      _applyPackageConfigToSystem(System, cfg, packageURL);
      return cfg.name;
    });
}

function _tryToLoadPackageConfig(System, packageURL) {
  var packageConfigURL = packageURL + "/package.json";
  
  System.meta[packageConfigURL] = {format: "json"};

  return System.import(packageConfigURL)
    .then(config => {
      arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL)
      return config;
    })
    .catch((err) => {
      delete System.meta[packageConfigURL];
      var name = packageURL.split("/").slice(-1)[0];
      return {name: name}; // "pseudo-config"
    });
}

function _applyPackageConfigToSystem(System, packageConfig, packageURL) {
  var packageConfig;
  System.config({map: {[packageConfig.name]: packageURL}});

  var packageInSystem = System.packages[packageURL],
      sysConfig = packageConfig.systemjs,
      livelyConfig = packageConfig.lively,
      main = packageConfig.main || "index.js";

  if (!packageInSystem.map) packageInSystem.map = {};

  if (sysConfig) {
    if (sysConfig.packageConfigPaths)
      System.packageConfigPaths = arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths))
    if (sysConfig.main) main = sysConfig.main;
    _processSystemjsSettings(System, packageConfig, packageURL)
  }

  if (livelyConfig) {
    _processLivelySettings(System, livelyConfig, packageURL);
  }

  packageInSystem.names = (packageInSystem.names || []).concat(packageConfig.name);
  packageInSystem.main = main;
}

function _processSystemjsSettings(System, systemjsConfig, packageURL) {
  // if (systemjsConfig.map) {
  //   var packageInSystem = System.packages[packageURL],
  //       knownPackages = _knownPackageMap(System),
  //       knownPackageNames = Object.keys(knownPackages);
  //   Object.keys(systemjsConfig.map).forEach(name => {
  //     if (arr.include(knownPackageNames, name))
  //       packageInSystem.map[name] = knownPackages[name];
  //   });
  // }
}

// function _useLoadedPackages(System, map, packageURL) {
//   var packageInSystem = System.packages[packageURL],
//       knownPackages = _knownPackageMap(System),
//       knownPackageNames = Object.keys(knownPackages);
//   Object.keys(map).forEach(name => {
//     if (arr.include(knownPackageNames, name))
//       packageInSystem.map[name] = knownPackages[name];
//   });
// }

function _processLivelySettings(System, livelyConfig, packageURL) {
  var packageInSystem = System.packages[packageURL],
      preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ?
        livelyConfig.preferLoadedPackages : true;

  if (!preferLoadedPackages && livelyConfig.packageMap) {
    Object.keys(livelyConfig.packageMap).forEach(pName =>
      packageInSystem.map[pName] = livelyConfig.packageMap[pName]);
  }

  // if (!packageConfig.map) return;
  // var packageInSystem = System.packages[packageURL],
  //     knownPackages = _knownPackageMap(System),
  //     knownPackageNames = Object.keys(knownPackages);
  // Object.keys(packageConfig.map).f.forEach(name => {
  //   if (arr.include(knownPackageNames, name))
  //     packageInSystem.map[name] = knownPackages[name];
  // });
}

function _knownPackageMap(System) {
  return Object.keys(System.packages).reduce((nameMap, packageURL) => {
    var pkg = System.packages[packageURL];
    if (pkg.names) pkg.names.forEach(name => nameMap[name] = packageURL);
    return nameMap;
  }, {});
}