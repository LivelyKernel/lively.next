import * as ast from "lively.ast";
import { obj, properties } from "lively.lang";
import { scheduleModuleExportsChange, runScheduledExportChanges } from "./import-export.js";
import { install as installHook, isInstalled as isHookInstalled } from "./hooks.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var GLOBAL = typeof window !== "undefined" ? window : (typeof Global !== "undefined" ? Global : global);
var isNode = System.get("@system-env").node;


var SystemClass = System.constructor;
if (!SystemClass.systems) SystemClass.systems = {};

SystemClass.prototype.__defineGetter__("__lively.modules__", function() {
  var System = this;
  return {
    moduleEnv: function(id) { return moduleEnv(System, id); },
    // TODO this is just a test, won't work in all cases...
    get itself() { return System.get(System.normalizeSync("lively.modules/index.js")); },
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
  return prepareSystem(new SystemClass(), cfg);
}

function prepareSystem(System, config) {
  System.trace = true;

  wrapModuleLoad(System);

  if (!isHookInstalled(System, "normalizeHook"))
    installHook(System, "normalize", normalizeHook);

  if (!isHookInstalled(System, "normalizeSync", "normalizeSyncHook"))
    installHook(System, "normalizeSync", normalizeSyncHook);

  config = obj.merge({transpiler: 'babel', babelOptions: {}}, config);

  if (isNode) {
    var nodejsCoreModules = ["addons", "assert", "buffer", "child_process",
        "cluster", "console", "crypto", "dgram", "dns", "domain", "events", "fs",
        "http", "https", "module", "net", "os", "path", "punycode", "querystring",
        "readline", "repl", "stream", "stringdecoder", "timers", "tls",
        "tty", "url", "util", "v8", "vm", "zlib"],
        map = nodejsCoreModules.reduce((map, ea) => { map[ea] = "@node/" + ea; return map; }, {});
    config.map = obj.merge(map, config.map);
    // for sth l ike map: {"lively.lang": "node_modules:lively.lang"}
    // cfg.paths = obj.merge({"node_modules:*": "./node_modules/*"}, cfg.paths);
  }

  config.packageConfigPaths = config.packageConfigPaths || ['./node_modules/*/package.json'];
  // if (!cfg.hasOwnProperty("defaultJSExtensions")) cfg.defaultJSExtensions = true;

  System.config(config);

  return System;
}

function normalizeHook(proceed, name, parent, parentAddress) {
  var System = this;
  if (name === "..") name = '../index.js'; // Fix ".."

  return proceed(name, parent, parentAddress)
    .then(result => {

      // lookup package main
      var base = result.replace(/\.js$/, "");
      if (base in System.packages) {
        var main = System.packages[base].main;
        if (main) return base.replace(/\/$/, "") + "/" + main.replace(/^\.?\//, "");
      }
      
      // Fix issue with accidentally adding .js
      var m = result.match(/(.*json)\.js/i);
      if (m) return m[1];

      return result;
    })
}

function normalizeSyncHook(proceed, name, parent, isPlugin) {
  var System = this;
  if (name === "..") name = '../index.js'; // Fix ".."

  // systemjs' normalizeSync has by default not the fancy
  // '{node: "events", "~node": "@mepty"}' mapping but we need it
  var pkg = parent && normalize_packageOfURL(parent, System);
  if (pkg) {
    var mappedObject = pkg.map[name] || System.map[name];
    if (typeof mappedObject === "object") {
      name = normalize_doMapWithObject(mappedObject, pkg, System) || name;
    }
  }

  var result =  proceed(name, parent, isPlugin)
  
  // lookup package main
  var base = result.replace(/\.js$/, "");
  if (base in System.packages) {
    var main = System.packages[base].main;
    if (main) return base.replace(/\/$/, "") + "/" + main.replace(/^\.?\//, "");
  }
  
  // Fix issue with accidentally adding .js
  var m = result.match(/(.*json)\.js/i);
  if (m) return m[1];

  return result;

}

function normalize_doMapWithObject(mappedObject, pkg, loader) {
  // SystemJS allows stuff like {events: {"node": "@node/events", "~node": "@empty"}}
  // for conditional name lookups based on the environment. The resolution
  // process in SystemJS is asynchronous, this one here synch. to support
  // normalizeSync and a one-step-load
  var env = loader.get(pkg.map['@env'] || '@system-env');
  // first map condition to match is used
  var resolved;
  for (var e in mappedObject) {
    var negate = e[0] == '~';
    var value = normalize_readMemberExpression(negate ? e.substr(1) : e, env);
    if (!negate && value || negate && !value) {
      resolved = mappedObject[e];
      break;
    }
  }

  if (resolved) {
    if (typeof resolved != 'string')
      throw new Error('Unable to map a package conditional to a package conditional.');
  }
  return resolved;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function normalize_readMemberExpression(p, value) {
    var pParts = p.split('.');
    while (pParts.length)
      value = value[pParts.shift()];
    return value;
  }
}

function normalize_packageOfURL(url, System) {
  // given a url like "http://localhost:9001/lively.lang/lib/base.js" finds the
  // corresponding package name in loader.packages, like "http://localhost:9001/lively.lang"
  // ... actually it returns the package
  var packageNames = Object.keys(System.packages || {}),
      matchingPackages = packageNames
        .map(pkgName =>
          url.indexOf(pkgName) === 0 ?
            {url: pkgName, penalty: url.slice(pkgName.length).length} : null)
        .filter(ea => !!ea),
      pName = matchingPackages.length ?
        matchingPackages.reduce((matchingPkg, ea) => matchingPkg.penalty > ea.penalty ? ea: matchingPkg).url :
        null;
  return pName ? System.packages[pName] : null;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// debugging
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
    bundles:             System.bundles
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
    dontTransform: ["__rec__", "__lvVarRecorder", "global", "self", "_moduleExport", "_moduleImport"].concat(ast.query.knownGlobals),
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

  if (rec === System.global) {
    console.warn(`[lively.modules] addGetterSettersForNewVars: recorder === global, refraining from installing setters!`)
    return;
  }

  properties.own(rec).forEach(key => {
    if (key.indexOf(prefix) === 0 || rec.__lookupGetter__(key)) return;
    Object.defineProperty(rec, prefix + key, {
      enumerable: false,
      writable: true,
      value: rec[key]
    });
    Object.defineProperty(rec, key, {
      enumerable: true,
      get: () => rec[prefix + key],
      set: (v) => {
        scheduleModuleExportsChange(System, moduleId, key, v, false/*add export*/);
        return rec[prefix + key] = v;
      }
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
  getSystem, removeSystem, prepareSystem,
  printSystemConfig,
  moduleRecordFor, updateModuleRecordOf,
  loadedModules, moduleEnv,
  sourceOf
};
