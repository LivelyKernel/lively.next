import * as ast from "lively.ast";
import { arr, obj, properties } from "lively.lang";
import { scheduleModuleExportsChange, runScheduledExportChanges } from "./import-export.js";
import { install as installHook, isInstalled as isHookInstalled } from "./hooks.js";
import module from "./module.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var isNode = System.get("@system-env").node;
var initialSystem = initialSystem || System;

var SystemClass = System.constructor;
if (!SystemClass.systems) SystemClass.systems = {};

var defaultOptions = {
  notificationLimit: null
}

function livelySystemEnv(System) {
  return {
    moduleEnv: function(id) { return module(System, id); },

    // TODO this is just a test, won't work in all cases...
    get itself() { return System.get(System.decanonicalize("lively.modules/index.js")); },

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

    // this is where the canonical state of the module system is held...
    packages: System["__lively.modules__packages"]                               || (System["__lively.modules__packages"] = {}),
    loadedModules: System["__lively.modules__loadedModules"]                     || (System["__lively.modules__loadedModules"] = {}),
    pendingExportChanges: System["__lively.modules__pendingExportChanges"]       || (System["__lively.modules__pendingExportChanges"] = {}),
    notifications: System["__lively.modules__notifications"]                     || (System["__lively.modules__notifications"] = []),
    notificationSubscribers: System["__lively.modules__notificationSubscribers"] || (System["__lively.modules__notificationSubscribers"] = {}),
    options: System["__lively.modules__options"]                                 || (System["__lively.modules__options"] = obj.deepCopy(defaultOptions))
  }
}

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
  config = config || {};

  System.set("@lively-env", System.newModule(livelySystemEnv(System)));

  wrapModuleLoad(System);

  if (!isHookInstalled(System, "normalizeHook"))
    installHook(System, "normalize", normalizeHook);

  if (!isHookInstalled(System, "decanonicalize", "decanonicalizeHook"))
    installHook(System, "decanonicalize", decanonicalizeHook);


  if (!isHookInstalled(System, "fetch", "fetch_lively_protocol"))
    installHook(System, "fetch", fetch_lively_protocol);

  if (!isHookInstalled(System, "newModule", "newModule_volatile"))
    installHook(System, "newModule", newModule_volatile);

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
  if (!config.transpiler && System.transpiler === "traceur") {
    System.config({
      map: {
        'plugin-babel': initialSystem.map["plugin-babel"],
        'systemjs-babel-build': initialSystem.map["systemjs-babel-build"]
      },
      transpiler: initialSystem.transpiler,
      babelOptions: Object.assign(initialSystem.babelOptions || {}, config.babelOptions)
    });
  }

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

function decanonicalizeHook(proceed, name, parent, isPlugin) {
  var System = this;
  if (name === "..") name = '../index.js'; // Fix ".."

  // systemjs' decanonicalize has by default not the fancy
  // '{node: "events", "~node": "@mepty"}' mapping but we need it
  var pkg = parent && normalize_packageOfURL(parent, System);
  if (pkg) {
    var mappedObject = (pkg.map && pkg.map[name]) || System.map[name];
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
  // decanonicalize and a one-step-load
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

function fetch_lively_protocol(proceed, load) {
  if (load.name.match(/^lively:\/\//)) {
    var match = load.name.match(/lively:\/\/([^\/]+)\/(.*)$/),
        worldId = match[1], localObjectName = match[2];
    return (typeof $morph !== "undefined"
         && $morph(localObjectName)
         && $morph(localObjectName).textString)
        || `/*Could not locate ${load.name}*/`;
  }
  return proceed(load);
}

function newModule_volatile(proceed, exports) {
  var freeze = Object.freeze;
  Object.freeze = x => x;
  var m = proceed(exports);
  Object.freeze = freeze;
  return m;
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

function loadedModules(System) { return System.get("@lively-env").loadedModules; }

function addGetterSettersForNewVars(System, moduleId) {
  // after eval we modify the env so that all captures vars are wrapped in
  // getter/setter to be notified of changes
  // FIXME: better to not capture via assignments but use func calls...!
  var rec = module(System, moduleId).recorder,
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

function searchLoadedModules(System, searchStr) {
  return Promise.all(obj.values(loadedModules(System)).map(m => m.search(searchStr)))
                .then(res => arr.flatten(res, 1));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exports
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  getSystem, removeSystem, prepareSystem,
  printSystemConfig,
  livelySystemEnv,
  loadedModules,
  searchLoadedModules
};
