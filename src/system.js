import { arr, obj, promise } from 'lively.lang';
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

// Accessible system-wide via System.get("@lively-env")
function livelySystemEnv(System) {
  return {
    moduleEnv(id) { return module(System, id); },

    // TODO this is just a test, won't work in all cases...
    get itself() { return System.get(System.decanonicalize("lively.modules/index.js")); },

    evaluationStart(moduleId) {
      module(System, moduleId).evaluationStart();
    },

    evaluationEnd(moduleId) {
      module(System, moduleId).evaluationEnd();
    },

    dumpConfig() {
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
    packages:                System["__lively.modules__packages"]                 || (System["__lively.modules__packages"]                = {}),
    loadedModules:           System["__lively.modules__loadedModules"]            || (System["__lively.modules__loadedModules"]           = {}),
    pendingExportChanges:    System["__lively.modules__pendingExportChanges"]     || (System["__lively.modules__pendingExportChanges"]    = {}),
    notifications:           System["__lively.modules__notifications"]            || (System["__lively.modules__notifications"]           = []),
    notificationSubscribers: System["__lively.modules__notificationSubscribers"]  || (System["__lively.modules__notificationSubscribers"] = {}),
    options:                 System["__lively.modules__options"]                  || (System["__lively.modules__options"]                 = obj.deepCopy(defaultOptions)),
    onLoadCallbacks:         System["__lively.modules__onLoadCallbacks"]          || (System["__lively.modules__onLoadCallbacks"]         = []),
    modulePackageMapCache:   System["__lively.modules__modulePackageMapCache"]
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
import { wrapResource } from "./resource.js"
import { emit } from "lively.notifications";

function makeSystem(cfg) { return prepareSystem(new SystemClass(), cfg); }

function prepareSystem(System, config) {
  System.trace = true;
  config = config || {};

  var useModuleTranslationCache = config.hasOwnProperty("useModuleTranslationCache") ?
    config.useModuleTranslationCache : !urlQuery().noModuleCache;
  System.useModuleTranslationCache = useModuleTranslationCache;

  System.set("@lively-env", System.newModule(livelySystemEnv(System)));

  wrapResource(System);
  wrapModuleLoad(System);

  if (!isHookInstalled(System, "normalizeHook"))
    installHook(System, "normalize", normalizeHook);

  if (!isHookInstalled(System, "decanonicalize", "decanonicalizeHook"))
    installHook(System, "decanonicalize", decanonicalizeHook);

  if (!isHookInstalled(System, "newModule", "newModule_volatile"))
    installHook(System, "newModule", newModule_volatile);

  if (!isHookInstalled(System, "instantiate", "instantiate_triggerOnLoadCallbacks"))
    installHook(System, "instantiate", instantiate_triggerOnLoadCallbacks);

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

    if (initialSystem.transpiler === "lively.transpiler") {
      System.set("lively.transpiler", initialSystem.get("lively.transpiler"));
      System._loader.transpilerPromise = initialSystem._loader.transpilerPromise;
      System.config({
        transpiler: 'lively.transpiler',
        babelOptions: Object.assign(initialSystem.babelOptions || {}, config.babelOptions)
      });

    } else {
      System.config({
        map: {
          'plugin-babel': initialSystem.map["plugin-babel"],
          'systemjs-babel-build': initialSystem.map["systemjs-babel-build"]
        },
        transpiler: initialSystem.transpiler,
        babelOptions: Object.assign(initialSystem.babelOptions || {}, config.babelOptions)
      });
    }
  }

  // if (!cfg.hasOwnProperty("defaultJSExtensions")) cfg.defaultJSExtensions = true;


  System.config(config);

  return System;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME! proper config!
function urlQuery() {
  if (typeof document === "undefined" || !document.location) return {};
  return (document.location.search || "").replace(/^\?/, "").split("&")
    .reduce(function(query, ea) {
      var split = ea.split("="), key = split[0], value = split[1];
      if (value === "true" || value === "false") value = eval(value);
      else if (!isNaN(Number(value))) value = Number(value);
      query[key] = value;
      return query;
    }, {});
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// name resolution extensions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
const dotSlashStartRe = /^\.?\//,
      trailingSlashRe = /\/$/,
      jsExtRe = /\.js$/,
      jsonJsExtRe = /\.json\.js$/i,
      doubleSlashRe = /.\/{2,}/g;

function normalizeHook(proceed, name, parent, parentAddress) {
  var System = this;
  if (name === "..") name = '../index.js'; // Fix ".."

  // rk 2016-07-19: sometimes SystemJS doStringMap() will resolve path into
  // names with double slashes which causes module id issues later. This fixes
  // that...
  // name = name.replace(/([^:])\/\/+/g, "$1\/");
  name = name.replace(doubleSlashRe, (match) => match[0] === ":" ? match : match[0]+"/");

  return proceed(name, parent, parentAddress)
    .then(result => {

      // lookup package main
      var base = result.replace(jsExtRe, "");
      if (base in System.packages) {
        var main = System.packages[base].main;
        if (main) return base.replace(trailingSlashRe, "") + "/" + main.replace(dotSlashStartRe, "");
      }

      // Fix issue with accidentally adding .js
      var m = result.match(jsonJsExtRe);
      if (m) return m[1];

      return result;
    })
}

function decanonicalizeHook(proceed, name, parent, isPlugin) {
  var System = this;
  if (name === "..") name = '../index.js'; // Fix ".."

  // systemjs' decanonicalize has by default not the fancy
  // '{node: "events", "~node": "@empty"}' mapping but we need it
  var pkg = parent && normalize_packageOfURL(parent, System);
  if (pkg) {
    var mappedObject = (pkg.map && pkg.map[name]) || System.map[name];
    if (typeof mappedObject === "object") {
      name = normalize_doMapWithObject(mappedObject, pkg, System) || name;
    }
  }

  var result = proceed(name, parent, isPlugin);

  // lookup package main
  var base = result.replace(jsExtRe, "");
  if (base in System.packages) {
    var main = System.packages[base].main;
    if (main) return base.replace(trailingSlashRe, "") + "/" + main.replace(dotSlashStartRe, "");
  }

  // Fix issue with accidentally adding .js
  var m = result.match(jsonJsExtRe);
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
        matchingPackages.reduce((matchingPkg, ea) =>
          matchingPkg.penalty > ea.penalty ? ea: matchingPkg).url :
        null;
  return pName ? System.packages[pName] : null;
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
// on-load / import extensions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function instantiate_triggerOnLoadCallbacks(proceed, load) {
  var System = this;

  return proceed(load).then(result => {
    // Wait until module is properly loaded, i.e. added to the System moule cache.
    // Then find those callbacks in System.get("@lively-env").onLoadCallbacks that
    // resolve to the loaded module, trigger + remove them
    promise.waitFor(() => System.get(load.name)).then(() => {
      var modId = load.name,
          mod = module(System, modId),
          callbacks = System.get("@lively-env").onLoadCallbacks;

      for (var i = callbacks.length; i--; ) {
        var {moduleName, resolved, callback} = callbacks[i],
            id = resolved ? moduleName : System.decanonicalize(moduleName);
        if (id !== modId) continue;
        callbacks.splice(i, 1);
        try { callback(mod) } catch (e) { console.error(e); }
      }

      emit("lively.modules/moduleloaded", {module: load.name}, Date.now(), System);
    });

    return result;
  });
}

export function whenLoaded(System, moduleName, callback) {
  var modId = System.decanonicalize(moduleName);
  if (System.get(modId)) {
    try { callback(module(System, modId)) } catch (e) { console.error(e); }
    return;
  }
  System.get("@lively-env").onLoadCallbacks.push({moduleName, resolved: false, callback});
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module state
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function loadedModules(System) { return System.get("@lively-env").loadedModules; }

function knownModuleNames(System) {
  var fromSystem = System.loads ?
    Object.keys(System.loads) :
    Object.keys(System._loader.moduleRecords);
  return arr.uniq(fromSystem.concat(Object.keys(loadedModules(System))));
}

function searchLoadedModules(System, searchStr, options) {
  return Promise.all(
    obj.values(loadedModules(System))
      .map(m => m.search(searchStr, options)))
        .then(res => arr.flatten(res, 1));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exports
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  getSystem, removeSystem, prepareSystem,
  printSystemConfig,
  livelySystemEnv,
  loadedModules, knownModuleNames,
  searchLoadedModules
};
