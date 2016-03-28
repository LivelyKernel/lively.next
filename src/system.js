import { obj } from "lively.lang";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var GLOBAL = typeof window !== "undefined" ? window : (typeof Global !== "undefined" ? Global : global);
var isNode = currentSystem().get("@system-env").node;

var SystemClass = currentSystem().constructor;
if (!SystemClass.systems) SystemClass.systems = {};

SystemClass.prototype.__defineGetter__("__lively.modules__", function() {
  return {
    moduleEnv: moduleEnv,
    evaluationDone: function(moduleId) {
      // var env = moduleEnv(moduleId);
      // addGetterSettersForNewVars(moduleId, env);
      // runScheduledExportChanges(moduleId);
    },
    dumpConfig: function() {
      var System = currentSystem(),
          json = {
            baseURL: System.baseURL,
            transpiler: System.transpiler,
            map: System.map,
            meta: System.meta,
            packages: System.packages,
            paths: System.paths,
            packageConfigPaths: System.packageConfigPaths
          }
      return JSON.stringify(json, null, 2);
    },
    loadedModules: this["__lively.modules__loadedModules"] || (this["__lively.modules__loadedModules"] = {})
  }
})

function systems() { return SystemClass.systems }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// System creation + access interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function currentSystem() { return GLOBAL.System; }

function nameOfSystem(System) {
  return Object.keys(systems()).detect(name => systems()[name] === System);
}

function getSystem(nameOrSystem, config) {
  return nameOrSystem && typeof nameOrSystem !== "string" ?
    nameOrSystem : systems()[nameOrSystem] || (systems()[nameOrSystem] = makeSystem(config));
}

function removeSystem(nameOrSystem) {
  // FIXME "unload" code...???
  var name = nameOrSystem && typeof nameOrSystem !== "string" ?
    nameOfSystem(nameOrSystem) : nameOrSystem;
  delete systems()[name];
}

import { wrapModuleLoad } from "./instrumentation.js"

function makeSystem(cfg) {
  var System = new SystemClass();
  System.trace = true;

  wrapModuleLoad(System);

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

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// import { scheduleModuleExportsChange } from "export-import.js";

function loadedModules(System) { return System["__lively.modules__"].loadedModules; }

function moduleEnv(System, moduleId) {
  var ext = System["__lively.modules__"];

  if (ext.loadedModules[moduleId]) return ext.loadedModules[moduleId];

  return ext.loadedModules[moduleId] = {
    loadError: undefined,
    recorderName: "__rec__",
    recorder: Object.create(GLOBAL, {
      _moduleExport: {
        // get() { return (name, val) => scheduleModuleExportsChange(moduleId, name, val, true/*add export*/); }
        get() { return (name, val) => {/*...*/}; }
      },
      _moduleImport: {
        get: function() {
          return (imported, name) => {
            var id = System.normalizeSync(imported, moduleId),
                imported = System._loader.modules[id];
            if (!imported) throw new Error(`import of ${name} failed: ${imported} (tried as ${id}) is not loaded!`);
            if (name == undefined) return imported.module;
            if (!imported.module.hasOwnProperty(name))
              console.warn(`import from ${imported}: Has no export ${name}!`);
            return imported.module[name];
          }
        }
      }
    })
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exports
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  getSystem, removeSystem,
  printSystemConfig,
  loadedModules, moduleEnv
};