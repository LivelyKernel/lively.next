import * as ast from "lively.ast";
import { obj, properties } from "lively.lang";
import { scheduleModuleExportsChange, runScheduledExportChanges } from "./import-export.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var GLOBAL = typeof window !== "undefined" ? window : (typeof Global !== "undefined" ? Global : global);
var isNode = System.get("@system-env").node;

var SystemClass = System.constructor;
if (!SystemClass.systems) SystemClass.systems = {};

SystemClass.prototype.__defineGetter__("__lively.modules__", function() {
  var System = this;
  return {
    debug: false,
    moduleEnv: moduleEnv,
    evaluationDone: function(moduleId) {
      addGetterSettersForNewVars(System, moduleId);
      runScheduledExportChanges(System, moduleId);
    },
    dumpConfig: function() {
      return JSON.stringify({
        baseURL: System.baseURL,
        transpiler: System.transpiler,
        defaultJSExtensions: System.defaultJSExtensions,
        map: System.map,
        meta: System.meta,
        packages: System.packages,
        paths: System.paths,
        packageConfigPaths: System.packageConfigPaths
      }, null, 2);
    },
    loadedModules: System["__lively.modules__loadedModules"] || (System["__lively.modules__loadedModules"] = {}),
    pendingExportChanges: System["__lively.modules__pendingExportChanges"] || (System["__lively.modules__pendingExportChanges"] = {})
  }
})

function systems() { return SystemClass.systems }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// System creation + access interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
// module state
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function loadedModules(System) { return System["__lively.modules__"].loadedModules; }

function moduleEnv(System, moduleId) {
  var ext = System["__lively.modules__"];

  if (ext.loadedModules[moduleId]) return ext.loadedModules[moduleId];

  var env = {
    loadError: undefined,
    recorderName: "__lvVarRecorder",
    dontTransform: ["__rec__", "__lvVarRecorder", "global",
    // "System",
    "_moduleExport", "_moduleImport"].concat(ast.query.knownGlobals),
    recorder: Object.create(GLOBAL, {
      _moduleExport: {
        get() { return (name, val) => scheduleModuleExportsChange(System, moduleId, name, val, true/*add export*/); }
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

  env.recorder.System = System;

  return ext.loadedModules[moduleId] = env;
}

function addGetterSettersForNewVars(System, moduleId) {
  // after eval we modify the env so that all captures vars are wrapped in
  // getter/setter to be notified of changes
  // FIXME: better to not capture via assignments but use func calls...!
  var rec = moduleEnv(System, moduleId).recorder,
      prefix = "__lively.modules__";
  properties.own(rec).forEach(key => {
    if (key.indexOf(prefix) === 0 || rec.__lookupGetter__(key)) return;
    rec[prefix + key] = rec[key];
    rec.__defineGetter__(key, () => rec[prefix + key]);
    rec.__defineSetter__(key, (v) => {
      scheduleModuleExportsChange(System, moduleId, key, v, false/*add export*/);
      return rec[prefix + key] = v;
    });
  });
}

function sourceOf(System, moduleName, parent) {
  return System.normalize(moduleName, parent)
    .then(id => {
      var load = (System.loads && System.loads[id]) || {
        status: 'loading', address: id, name: id,
        linkSets: [], dependencies: [], metadata: {}};
      return System.fetch(load);
    });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module records
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function moduleRecordFor(System, fullname) {
  var record = System._loader.moduleRecords[fullname];
  if (!record) return null;
  if (!record.hasOwnProperty("__lively_modules__"))
    record.__lively_modules__ = {evalOnlyExport: {}};
  return record;
}

function updateModuleRecordOf(System, fullname, doFunc) {
  var record = moduleRecordFor(System, fullname);
  if (!record) throw new Error(`es6 environment global of ${fullname}: module not loaded, cannot get export object!`);
  record.locked = true;
  try {
    return doFunc(record);
  } finally { record.locked = false; }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exports
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  getSystem, removeSystem,
  printSystemConfig,
  moduleRecordFor, updateModuleRecordOf,
  loadedModules, moduleEnv,
  sourceOf
};