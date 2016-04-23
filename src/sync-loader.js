// TODO
// [ ] originalIndices
// [ ] esm modules
// [ ] nodejs native modules
// [ ] how to get source, especially for trace?

var __global = System.get("@system-env").node ?
  global : (typeof window !== "undefined" ?
    window : (typeof self !== "undefined" ? self : this))

import { graph, obj } from "lively.lang";
import { applyConfig as realApplyConfig } from "./packages.js";

export { importSync }


function importSync(System, moduleName) {

  var id = System.normalizeSync(moduleName);

  // if it's a package.json, load + install it into System object and apply
  // it's settings to the System config
  var configMatch = id.match(/(.*)package\.json(\.js)?$/);
  if (configMatch) {
    var cfg = loadPackageConfigFromDefined(System, id),
        pkgURL = configMatch[1].replace(/\/$/, "");
    applyConfig(System, cfg, pkgURL);
    return cfg;
  }

  // Otherwise do a normal load of `moduleName`. Find and order the
  // dependencies, then import (declare, link, instantiate, evaluate) the target
  // module (which will load the dependencies in turn)
  var baseURL = id.split("/").slice(0,-1).join("/"),
      entries = getDefinedAsEntries(System, baseURL)
        .map(entry => System.defined[entry.name] = entry);

  if (!entries.length) {
    throw new Error("Cannot find any registered modules for " + moduleName);
  }

  var missing = entriesWithMissingDeps(System, entries);
  if (missing.length) 
    throw new Error(`Missing dependencies when loading ${baseURL}! ${JSON.stringify(missing, null, 2)}`)

  var firstModule = entries.find(entry => entry.name === id) || entries[0],
      sorted = sortedByDeps(System, entries, firstModule);

  evaluateEntries(sorted, System);

  return System.get(firstModule.name);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// package.json / configuration related
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function loadPackageConfigFromDefined(System, packageConfigName) {
  var configEntry = System.defined[packageConfigName];
  if (!configEntry) {
    configEntry = System.defined[packageConfigName + ".js"];
  }
  if (configEntry) {
    var config = System.newModule(configEntry.execute());
    System.set(packageConfigName, config);
  }
  return config;
}

function applyConfig(System, config, pkgURL) {
  if (config.systemjs) {
    System.packages[pkgURL] = obj.deepMerge(System.packages[pkgURL], config.systemjs);
  }
  realApplyConfig(System, config, pkgURL);
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// process System.defined entries
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


function getDefinedAsEntries(System, pkgURL) {
  return Object.keys(System.defined).map(name => {
    if (name.indexOf(pkgURL) !== 0) return null;
    if (name.match(/\.json(\.js)?$/)) return null;
    var def = System.defined[name];
    if (!def) return null; // alread loaded
    var normalizedDeps = def.deps.map(dep =>
      System.normalizeSync(dep, def.name))
    var e = obj.deepMerge({deps: [], normalizedDeps: normalizedDeps},
      def);
    e.esmExports = true; // ????
    return e;
  }).filter(ea => !!ea);
}

function entriesWithMissingDeps(System, entries) {
  // returns [{name, dep}]
  var entryNames = entries.pluck("name");
  return entries.reduce((missing, ea) => {
    var unresolved = ea.normalizedDeps.filter(dep =>
                        dep[0] !== "@"                 // not a "special" dep
                     && entryNames.indexOf(dep) === -1 // not defined
                     && !System.get(dep)               // not loaded
                     && !Object.keys(System.defined || {}).some(unloaded => unloaded === dep)
                     );
    return missing.concat(unresolved.map(dep => ({name: ea.name, dep: dep})));
  }, []);
}

function sortedByDeps(System, entries, mainEntry) {
  if (!entries.length) return [];

  var depGraph = entries.reduce((depGraph, ea) => {
        depGraph[ea.name] = ea.normalizedDeps; return depGraph }, {}),
      sorted = graph.sortByReference(depGraph, mainEntry.name).flatten(),
      found = sorted.map(name => entries.find(e => e.name === name)).compact(),
      notFound = entries.withoutAll(found);
  if (notFound.length)
    found = found.concat(sortedByDeps(notFound, notFound[0], System));
  return found;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module loading / instantiation logic. Derived and compatible to systemjs 0.19.24
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function getModule(name, loader) {
  // from SystemJS
  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  var exports, entry = loader.defined[name];

  if (!entry) {
    exports = loader.get(name);
    if (!exports)
      throw new Error('Unable to load dependency ' + name + '.');
  }

  else {
    if (entry.declarative) {
      if (!entry.module) linkDeclarativeModule(entry, loader)
      ensureEvaluated(name, [], loader);
    }
  
    else if (!entry.evaluated)
      linkDynamicModule(entry, loader);

    exports = entry.declarative && entry.esModule ? entry.esModule : entry.module.exports;
  }

  if ((!entry || entry.declarative) && exports && exports.__useDefault)
    return exports['default'];
  
  return exports;
}

function getESModule(exports) {
  var esModule = {};
  // don't trigger getters/setters in environments that support them
  if (typeof exports == 'object' || typeof exports == 'function') {
    if (Object.getOwnPropertyDescriptor) {
      var d;
      for (var p in exports)
        if (d = Object.getOwnPropertyDescriptor(exports, p))
          Object.defineProperty(esModule, p, d);
    }
    else {
      var hasOwnProperty = exports && exports.hasOwnProperty;
      for (var p in exports) {
        if (!hasOwnProperty || exports.hasOwnProperty(p))
          esModule[p] = exports[p];
      }
    }
  }
  esModule['default'] = exports;
  Object.defineProperty(esModule, '__useDefault', {
    value: true
  });
  return esModule;
}

function linkDynamicModule(entry, loader) {
  // from systemjs
  if (entry.module)
    return;

  var exports = {};

  var module = entry.module = { exports: exports, id: entry.name };

  // AMD requires execute the tree first
  if (!entry.executingRequire) {
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      // we know we only need to link dynamic due to linking algorithm
      var depEntry = loader.defined[depName];
      if (depEntry)
        linkDynamicModule(depEntry, loader);
    }
  }

  // now execute
  entry.evaluated = true;
  var output = entry.execute.call(__global, function(name) {
    for (var i = 0, l = entry.deps.length; i < l; i++) {
      if (entry.deps[i] != name)
        continue;
      return getModule(entry.normalizedDeps[i], loader);
    }
    // try and normalize the dependency to see if we have another form
    var nameNormalized = loader.normalizeSync(name, entry.name);
    if (entry.normalizedDeps.indexOf(nameNormalized) != -1)
      return getModule(nameNormalized, loader);

    throw new Error('Module ' + name + ' not declared as a dependency of ' + entry.name);
  }, exports, module);
  
  if (output)
    module.exports = output;

  // create the esModule object, which allows ES6 named imports of dynamics
  exports = module.exports;

  // __esModule flag treats as already-named
  if (exports && (exports.__esModule || exports instanceof Module))
    entry.esModule = exports;
  // set module as 'default' export, then fake named exports by iterating properties
  else if (entry.esmExports && exports !== __global)
    entry.esModule = getESModule(exports);
  // just use the 'default' export
  else
    entry.esModule = { 'default': exports };
}


function getOrCreateModuleRecord(name, moduleRecords) {
  return moduleRecords[name] || (moduleRecords[name] = {
    name: name,
    dependencies: [],
    exports: {toString: () => "Module"},
    importers: []
  });
}

function linkDeclarativeModule(entry, loader) {
  // only link if already not already started linking (stops at circular)
  if (entry.module)
    return;

  var moduleRecords = loader._loader.moduleRecords;
  var module = entry.module = getOrCreateModuleRecord(entry.name, moduleRecords);
  var exports = entry.module.exports;

  var declaration = entry.declare.call(__global, function(name, value) {
    module.locked = true;

    if (typeof name == 'object') {
      for (var p in name)
        exports[p] = name[p];
    }
    else {
      exports[name] = value;
    }

    for (var i = 0, l = module.importers.length; i < l; i++) {
      var importerModule = module.importers[i];
      if (!importerModule.locked) {
        var importerIndex = importerModule.dependencies.indexOf(module);
        importerModule.setters[importerIndex](exports);
      }
    }

    module.locked = false;
    return value;
  }, { id: entry.name });
  
  module.setters = declaration.setters;
  module.execute = declaration.execute;

  if (!module.setters || !module.execute) {
    throw new TypeError('Invalid System.register form for ' + entry.name);
  }

  // now link all the module dependencies
  for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
    var depName = entry.normalizedDeps[i];
    var depEntry = loader.defined[depName];
    var depModule = moduleRecords[depName];

    // work out how to set depExports based on scenarios...
    var depExports;

    if (depModule) {
      depExports = depModule.exports;
    }
    // dynamic, already linked in our registry
    else if (depEntry && !depEntry.declarative) {
      depExports = depEntry.esModule;
    }
    // in the loader registry
    else if (!depEntry) {
      depExports = loader.get(depName);
    }
    // we have an entry -> link
    else {
      linkDeclarativeModule(depEntry, loader);
      depModule = depEntry.module;
      depExports = depModule.exports;
    }

    // only declarative modules have dynamic bindings
    if (depModule && depModule.importers) {
      depModule.importers.push(module);
      module.dependencies.push(depModule);
    }
    else {
      module.dependencies.push(null);
    }
    
    // run setters for all entries with the matching dependency name
    module.setters[i](depExports);
    
    // TODO!
    // originalIndices are currently not set when creating entry / load!
    // var depsForSetters = entry.normalizedDeps.map(dep => depExports);
    // getModule
    // if (depsForSetters.include(undefined)) debugger;
    // depsForSetters.forEach((depExports, i) => module.setters[i](depExports));

    // var originalIndices = entry.originalIndices[i];
    // for (var j = 0, len = originalIndices.length; j < len; ++j) {
    //   var index = originalIndices[j];
    //   if (module.setters[index]) {
    //     module.setters[index](depExports);
    //   }
    // }
  }
}

function ensureEvaluated(moduleName, seen, loader) {
  var entry = loader.defined[moduleName];

  // if already seen, that means it's an already-evaluated non circular dependency
  if (!entry || entry.evaluated || !entry.declarative)
    return;

  // this only applies to declarative modules which late-execute

  seen.push(moduleName);

  for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
    var depName = entry.normalizedDeps[i];
    if (seen.indexOf(depName) == -1) {
      if (!loader.defined[depName])
        loader.get(depName);
      else
        ensureEvaluated(depName, seen, loader);
    }
  }

  if (entry.evaluated)
    return;

  entry.evaluated = true;
  // return evaluateEntries([entry], loader)[0];
  if (!entry.module) show(entry.name)
  entry.module.execute.call(__global);
}

function recordTrace(entry, System) {
  if (!System.trace) return;
  if (!System.loads) System.loads = {};

  var depMap = entry.deps.reduce((depMap, dep, i) => {
    depMap[dep] = entry.normalizedDeps[i];
    return depMap;
  }, {});

  System.loads[entry.name] = {
    name: entry.name,
    deps: entry.deps.concat([]),
    depMap: depMap,
    address: entry.address || entry.name,
    metadata: entry.metadata,
    source: entry.source,
    kind: entry.declarative ? 'declarative' : 'dynamic'
  };
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Better support for sync. normalize
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function doMapWithObject(mappedObject, pkg, loader) {
  // SystemJS allows stuff like {events: {"node": "@node/events", "~node": "@empty"}}
  // for conditional name lookups based on the environment. The resolution
  // process in SystemJS is asynchronous, this one here synch. to support
  // normalizeSync and a one-step-load

  var env = loader.get(pkg.map['@env'] || '@system-env');

  // first map condition to match is used
  var resolved;
  for (var e in mappedObject) {
    var negate = e[0] == '~';
    var value = readMemberExpression(negate ? e.substr(1) : e, env);
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
}

function readMemberExpression(p, value) {
  var pParts = p.split('.');
  while (pParts.length)
    value = value[pParts.shift()];
  return value;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// sync. loading support
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function instantiateRegisteredEntry(entry, System) {
  // instantiate : ({ name: NormalizedModuleName?,
  //                  address: ModuleAddress?,
  //                  source: ModuleSource,
  //                  metadata: object })
  //            -> Promise<ModuleFactory?>
  return {
    deps: entry.deps,
    execute: function() {
      System.defined[entry.name] = undefined;
      if (entry.declarative && entry.module.execute) entry.module.execute();
      var module = System.newModule(entry.declarative ? entry.module.exports : entry.esModule);
      System.set(entry.name, module);
      recordTrace(entry, System);
      return module;
    }
  }
}

function evaluateEntries(entries, System) {
  // do link
  // entries.map(entry => {
  //   if (entry.declarative)
  //     linkDeclarativeModule(entry, S)
  //   else {
  //     linkDynamicModule(entry, S)
  //     instantiateRegisteredEntry(entry, S).execute();
  //   }
  // });

  // return entries.map(entry => {
  //   if (entry.declarative)
  //     return instantiateRegisteredEntry(entry, S).execute();
  //   return System.get(entry.name);
  // })

  // do link
  entries.forEach(entry => 
    entry.declarative ?
      linkDeclarativeModule(entry, System) :
      linkDynamicModule(entry, System));

  // ...and instantiate + execute
  // execute will install loaded module in _loader.modules
  return entries.map(entry =>
    instantiateRegisteredEntry(entry, System).execute());
}
