import { obj, arr } from "lively.lang";
import uri from "URI";

var systems = {};

function nameOfSystem(System) {
  return Object.keys(systems).detect(name => systems[name] === System);
}

function getSystem(nameOrSystem, config) {
  return nameOrSystem && typeof nameOrSystem !== "string" ?
    nameOrSystem : systems[nameOrSystem] || (systems[nameOrSystem] = makeSystem(config));
}

function removeSystem(nameOrSystem) {
  // FIXME "unload" code...???
  var name = nameOrSystem && typeof nameOrSystem !== "string" ?
    nameOfSystem(nameOrSystem) : nameOrSystem;
  delete systems[name];
}

export { getSystem, removeSystem };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function registerPackage(System, packageURL) {
  System = getSystem(System);

  packageURL = String(packageURL).replace(/\/$/, "");
  System.packages[packageURL] || (System.packages[packageURL] = {});

  var packageConfigURL = packageURL + "/package.json";
  
  System.meta[packageConfigURL] = {format: "json"}
  
  return System.import(packageConfigURL)
    .then(config => {
      arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL);
      return config.name;
    })
    .catch((err) => {
      delete System.meta[packageConfigURL];
      return uri(packageURL).filename()
    })
    .then(name => {
      System.config({map: {[name]: packageURL}})
      return name;
    });
}

export { registerPackage };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var GLOBAL = typeof window !== "undefined" ? window : (typeof Global !== "undefined" ? Global : global);

function currentSystem() { return GLOBAL.System; }

var SystemClass = currentSystem().constructor;

var isNode = currentSystem().get("@system-env").node;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// configuration
function makeSystem(cfg) {
  debug && console.log("[lively.vm es6] defining new System");
  var System = new SystemClass();
  System.trace = true;

  cfg = obj.merge({transpiler: 'babel', babelOptions: {}}, cfg);
  if (System.get("@system-env").node) {
    var nodejsCoreModules = ["addons", "assert", "buffer", "child_process",
        "cluster", "console", "crypto", "dgram", "dns", "domain", "events", "fs",
        "http", "https", "module", "net", "os", "path", "punycode", "querystring",
        "readline", "repl", "stream", "stringdecoder", "timers", "tls",
        "tty", "url", "util", "v8", "vm", "zlib"],
        map = nodejsCoreModules.reduce((map, ea) => { map[ea] = "@node/" + ea; return map; }, {});
    cfg.map = obj.merge(map, cfg.map);
    // for sth l ike map: {"lively.lang": "node_modules:lively.lang"}
    cfg.paths = obj.merge({"node_modules:*": "./node_modules/*"}, cfg.paths);
    cfg.packageConfigPaths = cfg.packageConfigPaths || ['./node_modules/*/package.json'];
    // if (!cfg.hasOwnProperty("defaultJSExtensions")) cfg.defaultJSExtensions = true;
  }

  System.config(cfg);
  
  return System;
}

function printSystemConfig(System) {
  System = getSystem(System);
  var json = {
    baseURL:             System.baseURL,
    transpiler:          System.transpiler,
    defaultJSExtensions: System.defaultJSExtensions,
    defaultExtension:    System.defaultExtension,
    map:                 System.map,
    meta:                System.meta,
    packages:            System.packages,
    paths:               System.paths,
    packageConfigPaths:  System.packageConfigPaths,
  }
  return JSON.stringify(json, null, 2);
}

export { printSystemConfig };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module access
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
function moduleRecordFor(fullname) {
  var record = currentSystem()._loader.moduleRecords[fullname];
  if (!record) return null;
  return record;
}

function updateModuleRecordOf(fullname, doFunc) {
  var record = moduleRecordFor(fullname);
  if (!record) throw new Error(`es6 environment global of ${fullname}: module not loaded, cannot get export object!`);
  record.locked = true;
  try {
    doFunc(record);
  } finally { record.locked = false; }
}

function sourceOf(System, moduleName, parent) {
  System = getSystem(System);
  return System.normalize(moduleName, parent)
    .then(id => {
      var load = (System.loads && System.loads[id]) || {
        status: 'loading', address: id, name: id,
        linkSets: [], dependencies: [], metadata: {}};
      return System.fetch(load);
    });
}


export {
  moduleRecordFor,
  updateModuleRecordOf,
  sourceOf
}
