import { arr } from "lively.lang";

export { registerPackage };

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
  packageURL = asDir(String(packageURL));

  System.debug && console.log("[package register] %s", packageURL)

  var packageInSystem = System.packages[packageURL] || (System.packages[packageURL] = {});

  return _tryToLoadPackageConfig(System, packageURL)
    .then(cfg => _applyPackageConfigToSystem(System, cfg, packageURL).then(() => cfg.name));
}

function _tryToLoadPackageConfig(System, packageURL) {
  var packageConfigURL = packageURL + "/package.json";
  System.meta[packageConfigURL] = {format: "json"};

  System.debug && console.log("[package reading config] %s", packageConfigURL)

  return Promise.resolve(System.get(packageConfigURL) || System.import(packageConfigURL))
    .then(config => {
      arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL)
      return config;
    })
    .catch((err) => {
      show(String(err))
      delete System.meta[packageConfigURL];
      var name = packageURL.split("/").slice(-1)[0];
      return {name: name}; // "pseudo-config"
    });
}

function _applyPackageConfigToSystem(System, packageConfig, packageURL) {
  return Promise.resolve()
    .then(() => {
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
    
      return (livelyConfig ? _processLivelySettings(System, livelyConfig, packageURL) : Promise.resolve())
        .then(() => {
          packageInSystem.names = packageInSystem.names || [];
          arr.pushIfNotIncluded(packageInSystem.names, packageConfig.name);
          packageInSystem.main = main;
        });
    })

  return Promise.resolve();
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
  var pConf = System.packages[packageURL],
      preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ?
        livelyConfig.preferLoadedPackages : true;

  if (!livelyConfig.packageMap) return Promise.resolve();

  return Promise.all(
    Object.keys(livelyConfig.packageMap).map(name =>
      System.normalize(name, packageURL + "/")
        .then(normalized => {
          if (preferLoadedPackages && (pConf.map[name] || System.map[name] || System.get(normalized))) return Promise.resolve();

          pConf.map[name] = livelyConfig.packageMap[name];
          // recursively register package dependency
          return System.normalize(livelyConfig.packageMap[name], packageURL + "/")
            .then(normalized => registerPackage(System, normalized))
      })));

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