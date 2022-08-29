(/* global self,global,System */

/*

Code in here will not be directly executed but stringified and embedded in bundles!

*/

function runtimeDefinition () {
  let G = typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
      ? global
      : typeof self !== 'undefined' ? self : this;
  if (typeof G.lively !== 'object') G.lively = {};

  function prepareGlobal (moduleName, exports, globals, encapsulate) {
    // disable module detection
    let curDefine = G.define;

    G.define = undefined;

    // set globals
    let oldGlobals;
    if (globals) {
      oldGlobals = {};
      for (let g in globals) {
        oldGlobals[g] = G[g];
        G[g] = globals[g];
      }
    }

    // store a complete copy of the global object in order to detect changes
    if (!exports) {
      globalSnapshot = {};

      forEachGlobalValue(function (name, value) {
        globalSnapshot[name] = value;
      });
    }

    // return function to retrieve global
    return function () {
      let globalValue = exports ? getGlobalValue(exports) : {};

      let singleGlobal;
      let multipleExports = !!exports;

      if (!exports || encapsulate) {
        forEachGlobalValue(function (name, value) {
          if (globalSnapshot[name] === value) { return; }
          if (typeof value === 'undefined') { return; }

          // allow global encapsulation where globals are removed
          if (encapsulate) { G[name] = undefined; }

          if (!exports) {
            globalValue[name] = value;

            if (typeof singleGlobal !== 'undefined') {
              if (!multipleExports && singleGlobal !== value) { multipleExports = true; }
            } else {
              singleGlobal = value;
            }
          }
        });
      }

      globalValue = multipleExports ? globalValue : singleGlobal;

      // revert globals
      if (oldGlobals) {
        for (let g in oldGlobals) { G[g] = oldGlobals[g]; }
      }
      G.define = curDefine;

      return globalValue;
    };
  }

  G.prepareGlobal = prepareGlobal; // set as global

  let version; let registry = {}; let globalModules = {}; var globalSnapshot = {};

  // bare minimum ignores from SystemJS
  let ignoredGlobalProps = ['_g', 'sessionStorage', 'localStorage', 'clipboardData', 'frames', 'frameElement', 'external',
    'mozAnimationStartTime', 'webkitStorageInfo', 'webkitIndexedDB', 'mozInnerScreenY', 'mozInnerScreenX'];

  // taken from SystemJS

  function forEachGlobal (callback) {
    if (Object.keys) { Object.keys(G).forEach(callback); } else {
      for (let g in G) {
        if (!Object.hasOwnProperty.call(G, g)) { continue; }
        callback(g);
      }
    }
  }

  function forEachGlobalValue (callback) {
    forEachGlobal(function (globalName) {
      let value;
      if (ignoredGlobalProps.indexOf(globalName) != -1) { return; }
      try {
        value = G[globalName];
      } catch (e) {
        ignoredGlobalProps.push(globalName);
      }
      callback(globalName, value);
    });
  }

  function readMemberExpression (p, value) {
    let pParts = p.split('.');
    while (pParts.length) { value = value[pParts.shift()]; }
    return value;
  }

  function getGlobalValue (exports) {
    if (typeof exports === 'string') { return readMemberExpression(exports, G); }

    if (!(exports instanceof Array)) { throw new Error('Global exports must be a string or array.'); }

    let globalValue = {};
    let first = true;
    for (let i = 0; i < exports.length; i++) {
      let val = readMemberExpression(exports[i], G);
      if (first) {
        globalValue.default = val;
        first = false;
      }
      globalValue[exports[i].split('.').pop()] = val;
    }
    return globalValue;
  }

  if (G.lively.FreezerRuntime) {
    let [myMajor, myMinor, myPatch] = version.split('.').map(Number);
    let [otherMajor, otherMinor, otherPatch] = G.lively.FreezerRuntime.version.split('.').map(Number);
    let update = false;
    if (isNaN(otherMajor) || (!isNaN(myMajor) && myMajor > otherMajor)) update = true;
    if (!update && (isNaN(otherMinor) || (!isNaN(myMinor) && myMinor > otherMinor))) update = true;
    if (!update && (isNaN(otherPatch) || (!isNaN(myPatch) && myPatch > otherPatch))) update = true;
    if (!update) return;
    registry = G.lively.FreezerRuntime.registry;
  }

  globalModules['@lively-env'] = {
    executed: true,
    options: {},
    // this is for lively.serializer2 locateClass()
    moduleEnv (id) {
      const m = System.get(id, false) || System.fetchStandaloneFor(id) || System.get(id + 'index.js', false);
      return { recorder: m.recorder || m.exports };
    }
  };
  globalModules['@system-env'] = { executed: true, browser: true };

  let loc = G.document && G.document.location.href.split('?')[0];

  if (loc && loc.endsWith('.html')) {
    // ensure we do not point to a html file
    loc = loc.split('/').slice(0, -1).join('/') + '/';
  }

  G.lively.FreezerRuntime = {
    global: G,
    location: loc,
    baseURL: G.System ? G.System.baseURL : loc,
    version,
    registry,
    globalModules,
    get (moduleId, recorder = true) {
      if (moduleId && moduleId.startsWith('@')) return this.globalModules[moduleId];
      let mod = this.registry[moduleId];
      return recorder ? mod && mod.recorder : mod;
    },
    set (moduleId, module) { return this.registry[moduleId] = module; },
    add (id, dependencies = [], exports = {}, executed = false) {
      let module = {
        id,
        dependencies,
        executed,
        exports,
        execute: function () {},
        setters: [],
        subscribeToToplevelDefinitionChanges: function () { },
        package: function () { }
      };
      this.set(id, module);
      return module;
    },
    decanonicalize (name) {
      if (name.startsWith('lively://')) return name;
      if (name.endsWith('.json')) return G.lively.resources.resource(G.origin).join(name).url;
      if (!name.endsWith('.js') && !name.endsWith('/') && !name.endsWith('.svg')) // just import via package name
      { return name.split('/').concat(['index.js']).filter(Boolean).join('/'); }
      return name;
      // this decanonicalize forces all modules to contain version numbers (if not provided)
      // and to start with the local:// prefix.
      // This only applies to modules, that is all .js file that are requested in this context.
      // assets such as .css files etc, keep their usual decanonicalization
      // is global id?
      if (G.lively.FreezerRuntime.globalModules[name]) return name;
      // check if this is a submodule of a global module, that can be
      let localName = name.replace('lively-object-modules/', '').replace(G.System.baseURL, '');
      // includes local prefix?
      localName = localName.includes('local://') ? localName : 'local://' + localName;
      // includes package version?
      // this fucks up if there are packages wich share a prefix in their naming
      if (!localName.match(/\@\S*\//)) {
        let [packageName, ...rest] = localName.replace('local://', '').split('/');
        let pkg = Object.keys(G.lively.FreezerRuntime.registry).find(k =>
          k.replace('local://', '').split('@')[0] == packageName);
        let version = pkg && pkg.match(/\@[\d|\.|\-|\~]*\//)[0];
        // if (!pkg) return proceed(name, parent, isPlugin);
        // return pkg;
        localName = 'local://' + packageName + version + rest;
      }
      return localName;
    },
    loadObjectFromPartsbinFolder (name) {
      let location = this.location;
      let r = G.lively.resources.resource(location);
      if (!r.isDirectory()) r = r.parent();
      return r.join(`dynamicParts/${name}.json`).readJson().then(snapshot => {
        return G.lively.morphic.loadMorphFromSnapshot(
          snapshot, {
            onDeserializationStart: false,
            migrations: []
          });
      });
    },
    fetchStandaloneFor (name) {
      for (let glob in this.globalModules) {
        if (name.match(glob.replace('local://', '').replace(/\@.*\//, '/').replace('/index.js', ''))) { return this.globalModules[glob]; }
      }
    },
    resolveSync (name, parentName) {
      let mod = this.get(name);
      if (mod) return mod;
      // try global
      if (!name.includes('/')) {
        let parts = name.split('.'); let obj = G;
        while (obj && parts.length) obj = obj[parts.shift()];
        if (obj) return { executed: true, exports: obj, dependencies: [] };
      }
      let obj = this.get(this.decanonicalize(name, parentName));
      if (obj) return { executed: true, exports: obj, dependencies: [] };
      mod = this.fetchStandaloneFor(name);
      if (mod) return mod;
      throw new Error(`Module ${name} cannot be found in lively.freezer bundle!`);
    },

    import (id) {
      return Promise.resolve(this.registry[id] ? this.registry[id].exports : {});
    },

    register (id, dependencies, defineFn) {
      let module = this.add(id, dependencies);
      let body = defineFn((name, val) => {
        if (typeof name === 'string') {
          module.exports[name] = val;
        } else {
          // * export
          let prevExports = {};
          for (let key in module.exports) { prevExports[key] = module.exports[key]; }
          module.exports = name;
          for (let key in prevExports) { if (!module.exports[key]) module.exports[key] = prevExports[key]; }
        }
      });
      module.execute = body.execute;
      module.setters = body.setters;
      // how to actually propagate module information inside system?
      // window.System._loader.modules[id] = {module: module.exports};
      return module;
    },
    updateImports (module) {
      if (!module.dependencies) return;
      for (let i = 0; i < module.dependencies.length; i++) {
        let depName = module.dependencies[i];
        let mod = depName != '@empty' && this.resolveSync(depName, module.id);
        mod && module.setters[i](mod.exports);
      }
    },
    updateDependent (module, dependentModule) {
      for (let i = 0; i < dependentModule.dependencies.length; i++) {
        let depName = dependentModule.dependencies[i];
        if (depName != '@empty' && module == this.resolveSync(depName, dependentModule.id)) {
          dependentModule.setters[i](module.exports);
        }
      }
    },
    computeUniqDepGraphs (depGraph) {
      let dependencies = []; let remainingSeen = {}; let uniqDepGraph = { '@empty': [] }; let inverseDepGraph = { '@empty': [] };
      if (!depGraph) {
        let g = {}; let r = lively.FreezerRuntime.registry;
        for (let modName in r) g[modName] = r[modName].dependencies;
        depGraph = g;
      }
      for (let key in depGraph) {
        if (!remainingSeen.hasOwnProperty(key)) { remainingSeen[key] = true; dependencies.push(key); }
        let deps = depGraph[key]; let uniqDeps = {};
        if (deps) {
          uniqDepGraph[key] = [];
          for (let dep of deps) {
            if (uniqDeps.hasOwnProperty(dep) || key === dep) continue;
            let inverse = inverseDepGraph[dep] || (inverseDepGraph[dep] = []);
            if (!inverse.includes(key)) inverse.push(key);
            uniqDeps[dep] = true;
            uniqDepGraph[key].push(dep);
            if (!remainingSeen.hasOwnProperty(dep)) {
              remainingSeen[dep] = true;
              dependencies.push(dep);
            }
          }
        }
      }
      return { uniqDepGraph, inverseDepGraph, dependencies };
    },
    sortForLoad (entry) {
      const debug = false;
      // establish unique list of keys
      let { dependencies: remaining, uniqDepGraph, inverseDepGraph } = this.computeUniqDepGraphs();
      let groups = []; let packages = {}; let moduleId;
      function getPackageName (m) {
        return m.split('/')[0];
      }
      function getPackageRefs (m) {
        return (uniqDepGraph[moduleId] || []).filter(m => !isGlobalModule(m)).map(d => getPackageName(d));
      }
      function isGlobalModule (m) {
        return m == '@empty' || !!lively.FreezerRuntime.globalModules[m];
      }
      // this should just be pre computed once for each package
      function reachable (m, id, seen = new Set()) {
        if (m == id) return true;
        if (uniqDepGraph[m]) {
          return uniqDepGraph[m].includes(id) ||
                 uniqDepGraph[m].some(m => !seen.has(m) && reachable(m, id, new Set([...seen, ...uniqDepGraph[m]])));
        }
        return false;
      }
      for (let i = remaining.length; i--;) {
        moduleId = remaining[i];
        if (isGlobalModule(moduleId)) {
          // 0.) exclude all global modules
          groups.push(moduleId);
        } else {
          // 1.) identify packages
          let packageId = getPackageName(moduleId);
          // only add module to package, if reachable from index.js
          if (!reachable(packageId + '/index.js', moduleId)) continue;
          if (packages[packageId]) {
            packages[packageId].modules.push(moduleId);
            packages[packageId].deps.push(...getPackageRefs(moduleId));
          } else {
            packages[packageId] = {
              modules: [moduleId],
              deps: getPackageRefs(moduleId)
            };
          }
        }
        remaining.splice(i, 1);
      }

      let detachedModules = remaining; // these are modules part of a package, yet not reachable via index;

      // free floating modules are worth excluding at this stage, since they can confuse the static load order for packages

      debug && console.log('unreachable from package index: ', detachedModules);

      // 2.) try to order package partitions such that their dependencies are satisfied
      for (var p in packages) {
        packages[p].deps = new Set(packages[p].deps.filter(d => d != p));
      }

      debug && console.log('Identified packages: ', packages);

      function haveBeenDeclared (deps, ...declared) {
        return deps.filter(dep => dep != '@empty' && !dep.includes('/index.js'))
          .every(d => declared.some(dcls => dcls.includes(d)));
      }

      remaining = Object.keys(packages);
      let orderedPackages = [];
      while (remaining.length) {
        var minDepCount = Infinity; var minKeys = []; var minKeyIndexes = []; var affectedKeys = [];
        for (var i = 0; i < remaining.length; i++) {
          var key = remaining[i];
          let deps = [...packages[key].deps];
          if (deps.length > minDepCount) continue;
          if (deps.length === minDepCount && haveBeenDeclared(deps, orderedPackages, minKeys)) {
            minKeys.push(key);
            minKeyIndexes.push(i);
            continue;
          }
          minDepCount = deps.length;
          if (!haveBeenDeclared(deps, orderedPackages, minKeys)) continue;
          minKeys = [key];
          minKeyIndexes = [i];
        }
        if (minKeys.length == 0) break; // this means that the remaining modules contain a cycle somewhere
        for (var i = minKeyIndexes.length; i--;) {
          var key = remaining[minKeyIndexes[i]];
          remaining.splice(minKeyIndexes[i], 1);
        }
        orderedPackages.push(...minKeys);
      }
      debug && console.log('could not sort: ', remaining);

      let unsortablePackages = remaining;

      // the remaining packages will be sorted by breaking up package bounds together with the non reachable packages

      // orderedPackages.push(...remaining);

      debug && console.log('Sorting Packages in order: ', orderedPackages);

      // 3.) sort packages in isolation
      // for each iteration find the keys with the minimum number of dependencies
      // and add them to the result group list
      let packageModules;
      for (var packageId of orderedPackages) {
        packageModules = packages[packageId].modules;
        while (packageModules.length) {
          var minDepCount = Infinity; var minKeys = []; var minKeyIndexes = []; var affectedKeys = [];
          for (var i = 0; i < packageModules.length; i++) {
            var key = packageModules[i];
            let deps = uniqDepGraph[key] || [];
            if (deps.length > minDepCount) continue;
            if (deps.length === minDepCount && haveBeenDeclared(deps, groups, minKeys)) {
              minKeys.push(key);
              minKeyIndexes.push(i);
              affectedKeys.push(...inverseDepGraph[key] || []);
              continue;
            }
            minDepCount = deps.length;
            if (!haveBeenDeclared(deps, groups, minKeys)) continue;
            minKeys = [key];
            minKeyIndexes = [i];
            affectedKeys = (inverseDepGraph[key] || []).slice();
          }
          if (minKeys.length == 0) break; // this means that the remaining modules contain a cycle somewhere
          for (var i = minKeyIndexes.length; i--;) {
            var key = packageModules[minKeyIndexes[i]];
            inverseDepGraph[key] = [];
            packageModules.splice(minKeyIndexes[i], 1);
          }
          for (var key of affectedKeys) {
            uniqDepGraph[key] = uniqDepGraph[key].filter(ea => !minKeys.includes(ea));
          }
          groups.push(...minKeys);
        }
        debug && console.log(packageId + ' could not order modules ', packageModules);
        groups.push(...packageModules); // insert them anyway and let async load hanlde those things later in the game
      }

      // return groups;

      // 4.) attempt to sort the unsortable packages together with the free standing modules

      // var groups = [];
      //
      // function haveBeenDeclared(deps, ...declared) {
      //   return deps.every(d => declared.some(dcls => dcls.includes(d)))
      // }
      //

      remaining = detachedModules;
      for (var packageId of unsortablePackages) {
        remaining.push(...packages[packageId].modules);
      }

      debug && console.log('sorting remaining: ', remaining);

      while (remaining.length) {
        var minDepCount = Infinity; var minKeys = []; var minKeyIndexes = []; var affectedKeys = [];
        for (var i = 0; i < remaining.length; i++) {
          var key = remaining[i];
          let deps = uniqDepGraph[key] || [];
          if (deps.length > minDepCount) continue;
          if (deps.length === minDepCount && haveBeenDeclared(deps, groups, minKeys)) {
            minKeys.push(key);
            minKeyIndexes.push(i);
            affectedKeys.push(...inverseDepGraph[key] || []);
            continue;
          }
          minDepCount = deps.length;
          if (!haveBeenDeclared(deps, groups, minKeys)) continue;
          minKeys = [key];
          minKeyIndexes = [i];
          affectedKeys = (inverseDepGraph[key] || []).slice();
        }
        if (minKeys.length == 0) break; // this means that the remaining modules contain a cycle somewhere
        for (var i = minKeyIndexes.length; i--;) {
          var key = remaining[minKeyIndexes[i]];
          inverseDepGraph[key] = [];
          remaining.splice(minKeyIndexes[i], 1);
        }
        for (var key of affectedKeys) {
          uniqDepGraph[key] = uniqDepGraph[key].filter(ea => !minKeys.includes(ea));
        }
        groups.push(...minKeys);
      }

      debug && console.log('totally unsortable and probably cyclic: ', remaining);

      let asyncModules = [];
      for (let key in groups) {
        if ((uniqDepGraph[key] || []).length) asyncModules.push(key);
      }

      console.log('async modules due to preserved module structures: ', [...asyncModules, ...remaining]);

      return [groups, remaining];
    },

    initializeClass (constructorFunc, superclassSpec, instanceMethods = [], classMethods = [], classHolder = {}, currentModule, sourceLoc) {
      if (typeof superclassSpec === 'undefined') throw Error('Superclass can not be undefined!');
      G.System.initializeClass._get = G.lively.classes.runtime.initializeClass._get;
      G.System.initializeClass._set = G.lively.classes.runtime.initializeClass._set;
      return lively.classes.runtime.initializeClass(constructorFunc, superclassSpec, instanceMethods, classMethods, classHolder, currentModule, sourceLoc);
    },

    prepareGlobal (moduleName, exports, globals, encapsulate) {
      // disable module detection
      let curDefine = G.define;

      G.define = undefined;

      // set globals
      let oldGlobals;
      if (globals) {
        oldGlobals = {};
        for (let g in globals) {
          oldGlobals[g] = G[g];
          G[g] = globals[g];
        }
      }

      // store a complete copy of the global object in order to detect changes
      if (!exports) {
        globalSnapshot = {};

        forEachGlobalValue(function (name, value) {
          globalSnapshot[name] = value;
        });
      }

      // return function to retrieve global
      return function () {
        let globalValue = exports ? getGlobalValue(exports) : {};

        let singleGlobal;
        let multipleExports = !!exports;

        if (!exports || encapsulate) {
          forEachGlobalValue(function (name, value) {
            if (globalSnapshot[name] === value) { return; }
            if (typeof value === 'undefined') { return; }

            // allow global encapsulation where globals are removed
            if (encapsulate) { G[name] = undefined; }

            if (!exports) {
              globalValue[name] = value;

              if (typeof singleGlobal !== 'undefined') {
                if (!multipleExports && singleGlobal !== value) { multipleExports = true; }
              } else {
                singleGlobal = value;
              }
            }
          });
        }

        globalValue = multipleExports ? globalValue : singleGlobal;

        // revert globals
        if (oldGlobals) {
          for (let g in oldGlobals) { G[g] = oldGlobals[g]; }
        }
        G.define = curDefine;

        return globalValue;
      };
    },

    recorderFor (moduleId) {
      let rec = {};
      return (this.registry[moduleId] = this.registry[moduleId] || { recorder: rec, exports: rec }).recorder;
    },

    load (moduleId) {
      let [syncLoad, cyclicLoad] = this.sortForLoad(moduleId);
      let { inverseDepGraph } = this.computeUniqDepGraphs();
      let modulesToLoad = [...syncLoad, ...cyclicLoad];
      let failedModules = [];
      let maxAttempts = 5;
      let updateDependents = (m) => {
        let dependents = inverseDepGraph[m.id] || [];
        dependents.forEach(dependent => {
          let dm = this.get(dependent);
          try {
            this.updateDependent(m, dm);
          } catch (e) {
            m.executed = false;
          }
        });
      };
      let loadModules = (modulesToLoad) => {
        for (let modName of modulesToLoad) {
          let m = this.get(modName);
          if (!m || m.executed) continue;
          m.executed = true;
          try {
            this.updateImports(m);
            m.execute();
          } catch (e) {
            m.executed = false;
          }
          updateDependents(m);
        }
      };
      for (let i = 0; modulesToLoad.some(m => this.get(m) && !this.get(m).executed) && i < maxAttempts; i++) {
        loadModules(modulesToLoad);
      }
      return this.get(moduleId).exports;
    }

  };

  G.loadCompiledFrozenPart = G.lively.FreezerRuntime.loadObjectFromPartsbinFolder.bind(G.lively.FreezerRuntime);
})();
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    return obj[key];
  }
  try {
    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
    define({}, "");
  } catch (err) {
    define = function(obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunction.displayName = define(
    GeneratorFunctionPrototype,
    toStringTagSymbol,
    "GeneratorFunction"
  );

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      define(prototype, method, function(arg) {
        return this._invoke(method, arg);
      });
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      define(genFun, toStringTagSymbol, "GeneratorFunction");
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  define(Gp, toStringTagSymbol, "Generator");

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
  typeof module === "object" ? module.exports : {}
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  Function("r", "regeneratorRuntime = r")(runtime);
}
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.WHATWGFetch = {})));
}(this, (function (exports) { 'use strict';

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob:
      'FileReader' in self &&
      'Blob' in self &&
      (function() {
        try {
          new Blob();
          return true
        } catch (e) {
          return false
        }
      })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  };

  function isDataView(obj) {
    return obj && DataView.prototype.isPrototypeOf(obj)
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ];

    var isArrayBufferView =
      ArrayBuffer.isView ||
      function(obj) {
        return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
      };
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name);
    }
    if (/[^a-z0-9\-#$%&'*+.^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift();
        return {done: value === undefined, value: value}
      }
    };

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      };
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {};

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value);
      }, this);
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1]);
      }, this);
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name]);
      }, this);
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name);
    value = normalizeValue(value);
    var oldValue = this.map[name];
    this.map[name] = oldValue ? oldValue + ', ' + value : value;
  };

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)];
  };

  Headers.prototype.get = function(name) {
    name = normalizeName(name);
    return this.has(name) ? this.map[name] : null
  };

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  };

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value);
  };

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this);
      }
    }
  };

  Headers.prototype.keys = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push(name);
    });
    return iteratorFor(items)
  };

  Headers.prototype.values = function() {
    var items = [];
    this.forEach(function(value) {
      items.push(value);
    });
    return iteratorFor(items)
  };

  Headers.prototype.entries = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push([name, value]);
    });
    return iteratorFor(items)
  };

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true;
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result);
      };
      reader.onerror = function() {
        reject(reader.error);
      };
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsText(blob);
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf);
    var chars = new Array(view.length);

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i]);
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength);
      view.set(new Uint8Array(buf));
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false;

    this._initBody = function(body) {
      this._bodyInit = body;
      if (!body) {
        this._bodyText = '';
      } else if (typeof body === 'string') {
        this._bodyText = body;
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body;
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body;
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString();
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer);
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer]);
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body);
      } else {
        this._bodyText = body = Object.prototype.toString.call(body);
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8');
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type);
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
        }
      }
    };

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this);
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      };

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      };
    }

    this.text = function() {
      var rejected = consumed(this);
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    };

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      };
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    };

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

  function normalizeMethod(method) {
    var upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method
  }

  function Request(input, options) {
    options = options || {};
    var body = options.body;

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url;
      this.credentials = input.credentials;
      if (!options.headers) {
        this.headers = new Headers(input.headers);
      }
      this.method = input.method;
      this.mode = input.mode;
      this.signal = input.signal;
      if (!body && input._bodyInit != null) {
        body = input._bodyInit;
        input.bodyUsed = true;
      }
    } else {
      this.url = String(input);
    }

    this.credentials = options.credentials || this.credentials || 'same-origin';
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers);
    }
    this.method = normalizeMethod(options.method || this.method || 'GET');
    this.mode = options.mode || this.mode || null;
    this.signal = options.signal || this.signal;
    this.referrer = null;

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body);
  }

  Request.prototype.clone = function() {
    return new Request(this, {body: this._bodyInit})
  };

  function decode(body) {
    var form = new FormData();
    body
      .trim()
      .split('&')
      .forEach(function(bytes) {
        if (bytes) {
          var split = bytes.split('=');
          var name = split.shift().replace(/\+/g, ' ');
          var value = split.join('=').replace(/\+/g, ' ');
          form.append(decodeURIComponent(name), decodeURIComponent(value));
        }
      });
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers();
    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
    preProcessedHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':');
      var key = parts.shift().trim();
      if (key) {
        var value = parts.join(':').trim();
        headers.append(key, value);
      }
    });
    return headers
  }

  Body.call(Request.prototype);

  function Response(bodyInit, options) {
    if (!options) {
      options = {};
    }

    this.type = 'default';
    this.status = options.status === undefined ? 200 : options.status;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = 'statusText' in options ? options.statusText : 'OK';
    this.headers = new Headers(options.headers);
    this.url = options.url || '';
    this._initBody(bodyInit);
  }

  Body.call(Response.prototype);

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  };

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''});
    response.type = 'error';
    return response
  };

  var redirectStatuses = [301, 302, 303, 307, 308];

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  };

  exports.DOMException = self.DOMException;
  try {
    new exports.DOMException();
  } catch (err) {
    exports.DOMException = function(message, name) {
      this.message = message;
      this.name = name;
      var error = Error(message);
      this.stack = error.stack;
    };
    exports.DOMException.prototype = Object.create(Error.prototype);
    exports.DOMException.prototype.constructor = exports.DOMException;
  }

  function fetch(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init);

      if (request.signal && request.signal.aborted) {
        return reject(new exports.DOMException('Aborted', 'AbortError'))
      }

      var xhr = new XMLHttpRequest();

      function abortXhr() {
        xhr.abort();
      }

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        };
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
        var body = 'response' in xhr ? xhr.response : xhr.responseText;
        resolve(new Response(body, options));
      };

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'));
      };

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'));
      };

      xhr.onabort = function() {
        reject(new exports.DOMException('Aborted', 'AbortError'));
      };

      xhr.open(request.method, request.url, true);

      if (request.credentials === 'include') {
        xhr.withCredentials = true;
      } else if (request.credentials === 'omit') {
        xhr.withCredentials = false;
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob';
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value);
      });

      if (request.signal) {
        request.signal.addEventListener('abort', abortXhr);

        xhr.onreadystatechange = function() {
          // DONE (success or failure)
          if (xhr.readyState === 4) {
            request.signal.removeEventListener('abort', abortXhr);
          }
        };
      }

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
    })
  }

  fetch.polyfill = true;

  if (!self.fetch) {
    self.fetch = fetch;
    self.Headers = Headers;
    self.Request = Request;
    self.Response = Response;
  }

  exports.Headers = Headers;
  exports.Request = Request;
  exports.Response = Response;
  exports.fetch = fetch;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
/*
* SystemJS v0.21.6 Dev
*/
(function () {
  'use strict';

  /*
   * Environment
   */
  var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  var isWindows = typeof process !== 'undefined' && typeof process.platform === 'string' && process.platform.match(/^win/);

  var envGlobal = typeof self !== 'undefined' ? self : global;

  /*
   * Simple Symbol() shim
   */
  var hasSymbol = typeof Symbol !== 'undefined';
  function createSymbol (name) {
    return hasSymbol ? Symbol() : '@@' + name;
  }

  var toStringTag = hasSymbol && Symbol.toStringTag;

  /*
   * Environment baseURI
   */
  var baseURI;

  // environent baseURI detection
  if (typeof document != 'undefined' && document.getElementsByTagName) {
    baseURI = document.baseURI;

    if (!baseURI) {
      var bases = document.getElementsByTagName('base');
      baseURI = bases[0] && bases[0].href || window.location.href;
    }
  }
  else if (typeof location != 'undefined') {
    baseURI = location.href;
  }

  // sanitize out the hash and querystring
  if (baseURI) {
    baseURI = baseURI.split('#')[0].split('?')[0];
    var slashIndex = baseURI.lastIndexOf('/');
    if (slashIndex !== -1)
      baseURI = baseURI.substr(0, slashIndex + 1);
  }
  else if (typeof process !== 'undefined' && process.cwd) {
    baseURI = 'file://' + (isWindows ? '/' : '') + process.cwd();
    if (isWindows)
      baseURI = baseURI.replace(/\\/g, '/');
  }
  else {
    throw new TypeError('No environment baseURI');
  }

  // ensure baseURI has trailing "/"
  if (baseURI[baseURI.length - 1] !== '/')
    baseURI += '/';

  /*
   * LoaderError with chaining for loader stacks
   */
  var errArgs = new Error(0, '_').fileName == '_';
  function LoaderError__Check_error_message_for_loader_stack (childErr, newMessage) {
    // Convert file:/// URLs to paths in Node
    if (!isBrowser)
      newMessage = newMessage.replace(isWindows ? /file:\/\/\//g : /file:\/\//g, '');

    var message = (childErr.message || childErr) + '\n  ' + newMessage;

    var err;
    if (errArgs && childErr.fileName)
      err = new Error(message, childErr.fileName, childErr.lineNumber);
    else
      err = new Error(message);


    var stack = childErr.originalErr ? childErr.originalErr.stack : childErr.stack;

    if (isNode)
      // node doesn't show the message otherwise
      err.stack = message + '\n  ' + stack;
    else
      err.stack = stack;

    err.originalErr = childErr.originalErr || childErr;

    return err;
  }

  /*
   * Optimized URL normalization assuming a syntax-valid URL parent
   */
  function throwResolveError (relUrl, parentUrl) {
    throw new RangeError('Unable to resolve "' + relUrl + '" to ' + parentUrl);
  }
  var backslashRegEx = /\\/g;
  function resolveIfNotPlain (relUrl, parentUrl) {
    if (relUrl[0] === ' ' || relUrl[relUrl.length - 1] === ' ')
      relUrl = relUrl.trim();
    var parentProtocol = parentUrl && parentUrl.substr(0, parentUrl.indexOf(':') + 1);

    var firstChar = relUrl[0];
    var secondChar = relUrl[1];

    // protocol-relative
    if (firstChar === '/' && secondChar === '/') {
      if (!parentProtocol)
        throwResolveError(relUrl, parentUrl);
      if (relUrl.indexOf('\\') !== -1)
        relUrl = relUrl.replace(backslashRegEx, '/');
      return parentProtocol + relUrl;
    }
    // relative-url
    else if (firstChar === '.' && (secondChar === '/' || secondChar === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) ||
        relUrl.length === 1  && (relUrl += '/')) ||
        firstChar === '/') {
      if (relUrl.indexOf('\\') !== -1)
        relUrl = relUrl.replace(backslashRegEx, '/');
      var parentIsPlain = !parentProtocol || parentUrl[parentProtocol.length] !== '/';

      // read pathname from parent if a URL
      // pathname taken to be part after leading "/"
      var pathname;
      if (parentIsPlain) {
        // resolving to a plain parent -> skip standard URL prefix, and treat entire parent as pathname
        if (parentUrl === undefined)
          throwResolveError(relUrl, parentUrl);
        pathname = parentUrl;
      }
      else if (parentUrl[parentProtocol.length + 1] === '/') {
        // resolving to a :// so we need to read out the auth and host
        if (parentProtocol !== 'file:') {
          pathname = parentUrl.substr(parentProtocol.length + 2);
          pathname = pathname.substr(pathname.indexOf('/') + 1);
        }
        else {
          pathname = parentUrl.substr(8);
        }
      }
      else {
        // resolving to :/ so pathname is the /... part
        pathname = parentUrl.substr(parentProtocol.length + 1);
      }

      if (firstChar === '/') {
        if (parentIsPlain)
          throwResolveError(relUrl, parentUrl);
        else
          return parentUrl.substr(0, parentUrl.length - pathname.length - 1) + relUrl;
      }

      // join together and split for removal of .. and . segments
      // looping the string instead of anything fancy for perf reasons
      // '../../../../../z' resolved to 'x/y' is just 'z' regardless of parentIsPlain
      var segmented = pathname.substr(0, pathname.lastIndexOf('/') + 1) + relUrl;

      var output = [];
      var segmentIndex = -1;

      for (var i = 0; i < segmented.length; i++) {
        // busy reading a segment - only terminate on '/'
        if (segmentIndex !== -1) {
          if (segmented[i] === '/') {
            output.push(segmented.substring(segmentIndex, i + 1));
            segmentIndex = -1;
          }
          continue;
        }

        // new segment - check if it is relative
        if (segmented[i] === '.') {
          // ../ segment
          if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
            output.pop();
            i += 2;
          }
          // ./ segment
          else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
            i += 1;
          }
          else {
            // the start of a new segment as below
            segmentIndex = i;
            continue;
          }

          // this is the plain URI backtracking error (../, package:x -> error)
          if (parentIsPlain && output.length === 0)
            throwResolveError(relUrl, parentUrl);

          continue;
        }

        // it is the start of a new segment
        segmentIndex = i;
      }
      // finish reading out the last segment
      if (segmentIndex !== -1)
        output.push(segmented.substr(segmentIndex));

      return parentUrl.substr(0, parentUrl.length - pathname.length) + output.join('');
    }

    // sanitizes and verifies (by returning undefined if not a valid URL-like form)
    // Windows filepath compatibility is an added convenience here
    var protocolIndex = relUrl.indexOf(':');
    if (protocolIndex !== -1) {
      if (isNode) {
        // C:\x becomes file:///c:/x (we don't support C|\x)
        if (relUrl[1] === ':' && relUrl[2] === '\\' && relUrl[0].match(/[a-z]/i))
          return 'file:///' + relUrl.replace(backslashRegEx, '/');
      }
      return relUrl;
    }
  }

  var resolvedPromise = Promise.resolve();

  /*
   * Simple Array values shim
   */
  function arrayValues (arr) {
    if (arr.values)
      return arr.values();

    if (typeof Symbol === 'undefined' || !Symbol.iterator)
      throw new Error('Symbol.iterator not supported in this browser');

    var iterable = {};
    iterable[Symbol.iterator] = function () {
      var keys = Object.keys(arr);
      var keyIndex = 0;
      return {
        next: function () {
          if (keyIndex < keys.length)
            return {
              value: arr[keys[keyIndex++]],
              done: false
            };
          else
            return {
              value: undefined,
              done: true
            };
        }
      };
    };
    return iterable;
  }

  /*
   * 3. Reflect.Loader
   *
   * We skip the entire native internal pipeline, just providing the bare API
   */
  // 3.1.1
  function Loader () {
    this.registry = new Registry();
  }
  // 3.3.1
  Loader.prototype.constructor = Loader;

  function ensureInstantiated (module) {
    if (module === undefined)
      return;
    if (module instanceof ModuleNamespace === false && module[toStringTag] !== 'module')
      throw new TypeError('Module instantiation did not return a valid namespace object.');
    return module;
  }

  // 3.3.2
  Loader.prototype.import = function (key, parent) {
    if (typeof key !== 'string')
      throw new TypeError('Loader import method must be passed a module key string');
    // custom resolveInstantiate combined hook for better perf
    var loader = this;
    return resolvedPromise
    .then(function () {
      return loader[RESOLVE_INSTANTIATE](key, parent);
    })
    .then(ensureInstantiated)
    //.then(Module.evaluate)
    .catch(function (err) {
      throw LoaderError__Check_error_message_for_loader_stack(err, 'Loading ' + key + (parent ? ' from ' + parent : ''));
    });
  };
  // 3.3.3
  var RESOLVE = Loader.resolve = createSymbol('resolve');

  /*
   * Combined resolve / instantiate hook
   *
   * Not in current reduced spec, but necessary to separate RESOLVE from RESOLVE + INSTANTIATE as described
   * in the spec notes of this repo to ensure that loader.resolve doesn't instantiate when not wanted.
   *
   * We implement RESOLVE_INSTANTIATE as a single hook instead of a separate INSTANTIATE in order to avoid
   * the need for double registry lookups as a performance optimization.
   */
  var RESOLVE_INSTANTIATE = Loader.resolveInstantiate = createSymbol('resolveInstantiate');

  // default resolveInstantiate is just to call resolve and then get from the registry
  // this provides compatibility for the resolveInstantiate optimization
  Loader.prototype[RESOLVE_INSTANTIATE] = function (key, parent) {
    var loader = this;
    return loader.resolve(key, parent)
    .then(function (resolved) {
      return loader.registry.get(resolved);
    });
  };

  function ensureResolution (resolvedKey) {
    if (resolvedKey === undefined)
      throw new RangeError('No resolution found.');
    return resolvedKey;
  }

  Loader.prototype.resolve = function (key, parent) {
    var loader = this;
    return resolvedPromise
    .then(function() {
      return loader[RESOLVE](key, parent);
    })
    .then(ensureResolution)
    .catch(function (err) {
      throw LoaderError__Check_error_message_for_loader_stack(err, 'Resolving ' + key + (parent ? ' to ' + parent : ''));
    });
  };

  // 3.3.4 (import without evaluate)
  // this is not documented because the use of deferred evaluation as in Module.evaluate is not
  // documented, as it is not considered a stable feature to be encouraged
  // Loader.prototype.load may well be deprecated if this stays disabled
  /* Loader.prototype.load = function (key, parent) {
    return Promise.resolve(this[RESOLVE_INSTANTIATE](key, parent || this.key))
    .catch(function (err) {
      throw addToError(err, 'Loading ' + key + (parent ? ' from ' + parent : ''));
    });
  }; */

  /*
   * 4. Registry
   *
   * Instead of structuring through a Map, just use a dictionary object
   * We throw for construction attempts so this doesn't affect the public API
   *
   * Registry has been adjusted to use Namespace objects over ModuleStatus objects
   * as part of simplifying loader API implementation
   */
  var iteratorSupport = typeof Symbol !== 'undefined' && Symbol.iterator;
  var REGISTRY = createSymbol('registry');
  function Registry() {
    this[REGISTRY] = {};
  }
  // 4.4.1
  if (iteratorSupport) {
    // 4.4.2
    Registry.prototype[Symbol.iterator] = function () {
      return this.entries()[Symbol.iterator]();
    };

    // 4.4.3
    Registry.prototype.entries = function () {
      var registry = this[REGISTRY];
      return arrayValues(Object.keys(registry).map(function (key) {
        return [key, registry[key]];
      }));
    };
  }

  // 4.4.4
  Registry.prototype.keys = function () {
    return arrayValues(Object.keys(this[REGISTRY]));
  };
  // 4.4.5
  Registry.prototype.values = function () {
    var registry = this[REGISTRY];
    return arrayValues(Object.keys(registry).map(function (key) {
      return registry[key];
    }));
  };
  // 4.4.6
  Registry.prototype.get = function (key) {
    return this[REGISTRY][key];
  };
  // 4.4.7
  Registry.prototype.set = function (key, namespace) {
    if (!(namespace instanceof ModuleNamespace || namespace[toStringTag] === 'module'))
      throw new Error('Registry must be set with an instance of Module Namespace');
    this[REGISTRY][key] = namespace;
    return this;
  };
  // 4.4.8
  Registry.prototype.has = function (key) {
    return Object.hasOwnProperty.call(this[REGISTRY], key);
  };
  // 4.4.9
  Registry.prototype.delete = function (key) {
    if (Object.hasOwnProperty.call(this[REGISTRY], key)) {
      delete this[REGISTRY][key];
      return true;
    }
    return false;
  };

  /*
   * Simple ModuleNamespace Exotic object based on a baseObject
   * We export this for allowing a fast-path for module namespace creation over Module descriptors
   */
  // var EVALUATE = createSymbol('evaluate');
  var BASE_OBJECT = createSymbol('baseObject');

  // 8.3.1 Reflect.Module
  /*
   * Best-effort simplified non-spec implementation based on
   * a baseObject referenced via getters.
   *
   * Allows:
   *
   *   loader.registry.set('x', new Module({ default: 'x' }));
   *
   * Optional evaluation function provides experimental Module.evaluate
   * support for non-executed modules in registry.
   */
  function ModuleNamespace (baseObject/*, evaluate*/) {
    Object.defineProperty(this, BASE_OBJECT, {
      value: baseObject
    });

    // evaluate defers namespace population
    /* if (evaluate) {
      Object.defineProperty(this, EVALUATE, {
        value: evaluate,
        configurable: true,
        writable: true
      });
    }
    else { */
      Object.keys(baseObject).forEach(extendNamespace, this);
    //}
  }// 8.4.2
  ModuleNamespace.prototype = Object.create(null);

  if (toStringTag)
    Object.defineProperty(ModuleNamespace.prototype, toStringTag, {
      value: 'Module'
    });

  function extendNamespace (key) {
    Object.defineProperty(this, key, {
      enumerable: true,
      get: function () {
        return this[BASE_OBJECT][key];
      }
    });
  }

  /* function doEvaluate (evaluate, context) {
    try {
      evaluate.call(context);
    }
    catch (e) {
      return e;
    }
  }

  // 8.4.1 Module.evaluate... not documented or used because this is potentially unstable
  Module.evaluate = function (ns) {
    var evaluate = ns[EVALUATE];
    if (evaluate) {
      ns[EVALUATE] = undefined;
      var err = doEvaluate(evaluate);
      if (err) {
        // cache the error
        ns[EVALUATE] = function () {
          throw err;
        };
        throw err;
      }
      Object.keys(ns[BASE_OBJECT]).forEach(extendNamespace, ns);
    }
    // make chainable
    return ns;
  }; */

  var resolvedPromise$1 = Promise.resolve();

  /*
   * Register Loader
   *
   * Builds directly on top of loader polyfill to provide:
   * - loader.register support
   * - hookable higher-level resolve
   * - instantiate hook returning a ModuleNamespace or undefined for es module loading
   * - loader error behaviour as in HTML and loader specs, caching load and eval errors separately
   * - build tracing support by providing a .trace=true and .loads object format
   */

  var REGISTER_INTERNAL = createSymbol('register-internal');

  function RegisterLoader () {
    Loader.call(this);

    var registryDelete = this.registry.delete;
    this.registry.delete = function (key) {
      var deleted = registryDelete.call(this, key);

      // also delete from register registry if linked
      if (records.hasOwnProperty(key) && !records[key].linkRecord) {
        delete records[key];
        deleted = true;
      }

      return deleted;
    };

    var records = {};

    this[REGISTER_INTERNAL] = {
      // last anonymous System.register call
      lastRegister: undefined,
      // in-flight es module load records
      records: records
    };

    // tracing
    this.trace = false;
  }

  RegisterLoader.prototype = Object.create(Loader.prototype);
  RegisterLoader.prototype.constructor = RegisterLoader;

  var INSTANTIATE = RegisterLoader.instantiate = createSymbol('instantiate');

  // default normalize is the WhatWG style normalizer
  RegisterLoader.prototype[RegisterLoader.resolve = Loader.resolve] = function (key, parentKey) {
    return resolveIfNotPlain(key, parentKey || baseURI);
  };

  RegisterLoader.prototype[INSTANTIATE] = function (key, processAnonRegister) {};

  // once evaluated, the linkRecord is set to undefined leaving just the other load record properties
  // this allows tracking new binding listeners for es modules through importerSetters
  // for dynamic modules, the load record is removed entirely.
  function createLoadRecord (state, key, registration) {
    return state.records[key] = {
      key: key,

      // defined System.register cache
      registration: registration,

      // module namespace object
      module: undefined,

      // es-only
      // this sticks around so new module loads can listen to binding changes
      // for already-loaded modules by adding themselves to their importerSetters
      importerSetters: undefined,

      loadError: undefined,
      evalError: undefined,

      // in-flight linking record
      linkRecord: {
        // promise for instantiated
        instantiatePromise: undefined,
        dependencies: undefined,
        execute: undefined,
        executingRequire: false,

        // underlying module object bindings
        moduleObj: undefined,

        // es only, also indicates if es or not
        setters: undefined,

        // promise for instantiated dependencies (dependencyInstantiations populated)
        depsInstantiatePromise: undefined,
        // will be the array of dependency load record or a module namespace
        dependencyInstantiations: undefined,

        // top-level await!
        evaluatePromise: undefined,

        // NB optimization and way of ensuring module objects in setters
        // indicates setters which should run pre-execution of that dependency
        // setters is then just for completely executed module objects
        // alternatively we just pass the partially filled module objects as
        // arguments into the execute function
        // hoisted: undefined
      }
    };
  }

  RegisterLoader.prototype[Loader.resolveInstantiate] = function (key, parentKey) {
    var loader = this;
    var state = this[REGISTER_INTERNAL];
    var registry = this.registry[REGISTRY];

    return resolveInstantiate(loader, key, parentKey, registry, state)
    .then(function (instantiated) {
      if (instantiated instanceof ModuleNamespace || instantiated[toStringTag] === 'module')
        return instantiated;

      // resolveInstantiate always returns a load record with a link record and no module value
      var link = instantiated.linkRecord;

      // if already beaten to done, return
      if (!link) {
        if (instantiated.module)
          return instantiated.module;
        throw instantiated.evalError;
      }

      return deepInstantiateDeps(loader, instantiated, link, registry, state)
      .then(function () {
        return ensureEvaluate(loader, instantiated, link, registry, state);
      });
    });
  };

  function resolveInstantiate (loader, key, parentKey, registry, state) {
    // normalization shortpath for already-normalized key
    // could add a plain name filter, but doesn't yet seem necessary for perf
    var module = registry[key];
    if (module)
      return Promise.resolve(module);

    var load = state.records[key];

    // already linked but not in main registry is ignored
    if (load && !load.module) {
      if (load.loadError)
        return Promise.reject(load.loadError);
      return instantiate(loader, load, load.linkRecord, registry, state);
    }

    return loader.resolve(key, parentKey)
    .then(function (resolvedKey) {
      // main loader registry always takes preference
      module = registry[resolvedKey];
      if (module)
        return module;

      load = state.records[resolvedKey];

      // already has a module value but not already in the registry (load.module)
      // means it was removed by registry.delete, so we should
      // disgard the current load record creating a new one over it
      // but keep any existing registration
      if (!load || load.module)
        load = createLoadRecord(state, resolvedKey, load && load.registration);

      if (load.loadError)
        return Promise.reject(load.loadError);

      var link = load.linkRecord;
      if (!link)
        return load;

      return instantiate(loader, load, link, registry, state);
    });
  }

  function createProcessAnonRegister (loader, load, state) {
    return function () {
      var lastRegister = state.lastRegister;

      if (!lastRegister)
        return !!load.registration;

      state.lastRegister = undefined;
      load.registration = lastRegister;

      return true;
    };
  }

  function instantiate (loader, load, link, registry, state) {
    return link.instantiatePromise || (link.instantiatePromise =
    // if there is already an existing registration, skip running instantiate
    (load.registration ? resolvedPromise$1 : resolvedPromise$1.then(function () {
      state.lastRegister = undefined;
      return loader[INSTANTIATE](load.key, loader[INSTANTIATE].length > 1 && createProcessAnonRegister(loader, load, state));
    }))
    .then(function (instantiation) {
      // direct module return from instantiate -> we're done
      if (instantiation !== undefined) {
        if (!(instantiation instanceof ModuleNamespace || instantiation[toStringTag] === 'module'))
          throw new TypeError('Instantiate did not return a valid Module object.');

        delete state.records[load.key];
        if (loader.trace)
          traceLoad(loader, load, link);
        return registry[load.key] = instantiation;
      }

      // run the cached loader.register declaration if there is one
      var registration = load.registration;
      // clear to allow new registrations for future loads (combined with registry delete)
      load.registration = undefined;
      if (!registration)
        throw new TypeError('Module instantiation did not call an anonymous or correctly named System.register.');

      link.dependencies = registration[0];

      load.importerSetters = [];

      link.moduleObj = {};

      // process System.registerDynamic declaration
      if (registration[2]) {
        link.moduleObj.default = link.moduleObj.__useDefault = {};
        link.executingRequire = registration[1];
        link.execute = registration[2];
      }

      // process System.register declaration
      else {
        registerDeclarative(loader, load, link, registration[1]);
      }

      return load;
    })
    .catch(function (err) {
      load.linkRecord = undefined;
      throw load.loadError = load.loadError || LoaderError__Check_error_message_for_loader_stack(err, 'Instantiating ' + load.key);
    }));
  }

  // like resolveInstantiate, but returning load records for linking
  function resolveInstantiateDep (loader, key, parentKey, registry, state, traceDepMap) {
    // normalization shortpaths for already-normalized key
    // DISABLED to prioritise consistent resolver calls
    // could add a plain name filter, but doesn't yet seem necessary for perf
    /* var load = state.records[key];
    var module = registry[key];

    if (module) {
      if (traceDepMap)
        traceDepMap[key] = key;

      // registry authority check in case module was deleted or replaced in main registry
      if (load && load.module && load.module === module)
        return load;
      else
        return module;
    }

    // already linked but not in main registry is ignored
    if (load && !load.module) {
      if (traceDepMap)
        traceDepMap[key] = key;
      return instantiate(loader, load, load.linkRecord, registry, state);
    } */
    return loader.resolve(key, parentKey)
    .then(function (resolvedKey) {
      if (traceDepMap)
        traceDepMap[key] = resolvedKey;

      // normalization shortpaths for already-normalized key
      var load = state.records[resolvedKey];
      var module = registry[resolvedKey];

      // main loader registry always takes preference
      if (module && (!load || load.module && module !== load.module))
        return module;

      if (load && load.loadError)
        throw load.loadError;

      // already has a module value but not already in the registry (load.module)
      // means it was removed by registry.delete, so we should
      // disgard the current load record creating a new one over it
      // but keep any existing registration
      if (!load || !module && load.module)
        load = createLoadRecord(state, resolvedKey, load && load.registration);

      var link = load.linkRecord;
      if (!link)
        return load;

      return instantiate(loader, load, link, registry, state);
    });
  }

  function traceLoad (loader, load, link) {
    loader.loads = loader.loads || {};
    loader.loads[load.key] = {
      key: load.key,
      deps: link.dependencies,
      dynamicDeps: [],
      depMap: link.depMap || {}
    };
  }

  /*
   * Convert a CJS module.exports into a valid object for new Module:
   *
   *   new Module(getEsModule(module.exports))
   *
   * Sets the default value to the module, while also reading off named exports carefully.
   */
  function registerDeclarative (loader, load, link, declare) {
    var moduleObj = link.moduleObj;
    var importerSetters = load.importerSetters;

    var definedExports = false;

    // closure especially not based on link to allow link record disposal
    var declared = declare.call(envGlobal, function (name, value) {
      if (typeof name === 'object') {
        var changed = false;
        for (var p in name) {
          value = name[p];
          if (p !== '__useDefault' && (!(p in moduleObj) || moduleObj[p] !== value)) {
            changed = true;
            moduleObj[p] = value;
          }
        }
        if (changed === false)
          return value;
      }
      else {
        if ((definedExports || name in moduleObj) && moduleObj[name] === value)
          return value;
        moduleObj[name] = value;
      }

      for (var i = 0; i < importerSetters.length; i++)
        importerSetters[i](moduleObj);

      return value;
    }, new ContextualLoader(loader, load.key));

    link.setters = declared.setters || [];
    link.execute = declared.execute;
    if (declared.exports) {
      link.moduleObj = moduleObj = declared.exports;
      definedExports = true;
    }
  }

  function instantiateDeps (loader, load, link, registry, state) {
    if (link.depsInstantiatePromise)
      return link.depsInstantiatePromise;

    var depsInstantiatePromises = Array(link.dependencies.length);

    for (var i = 0; i < link.dependencies.length; i++)
      depsInstantiatePromises[i] = resolveInstantiateDep(loader, link.dependencies[i], load.key, registry, state, loader.trace && link.depMap || (link.depMap = {}));

    var depsInstantiatePromise = Promise.all(depsInstantiatePromises)
    .then(function (dependencyInstantiations) {
      link.dependencyInstantiations = dependencyInstantiations;

      // run setters to set up bindings to instantiated dependencies
      if (link.setters) {
        for (var i = 0; i < dependencyInstantiations.length; i++) {
          var setter = link.setters[i];
          if (setter) {
            var instantiation = dependencyInstantiations[i];

            if (instantiation instanceof ModuleNamespace || instantiation[toStringTag] === 'module') {
              setter(instantiation);
            }
            else {
              if (instantiation.loadError)
                throw instantiation.loadError;
              setter(instantiation.module || instantiation.linkRecord.moduleObj);
              // this applies to both es and dynamic registrations
              if (instantiation.importerSetters)
                instantiation.importerSetters.push(setter);
            }
          }
        }
      }

      return load;
    });

    if (loader.trace)
      depsInstantiatePromise = depsInstantiatePromise.then(function () {
        traceLoad(loader, load, link);
        return load;
      });

    depsInstantiatePromise = depsInstantiatePromise.catch(function (err) {
      // throw up the instantiateDeps stack
      link.depsInstantiatePromise = undefined;
      throw LoaderError__Check_error_message_for_loader_stack(err, 'Loading ' + load.key);
    });

    depsInstantiatePromise.catch(function () {});

    return link.depsInstantiatePromise = depsInstantiatePromise;
  }

  function deepInstantiateDeps (loader, load, link, registry, state) {
    var seen = [];
    function addDeps (load, link) {
      if (!link)
        return resolvedPromise$1;
      if (seen.indexOf(load) !== -1)
        return resolvedPromise$1;
      seen.push(load);
      
      return instantiateDeps(loader, load, link, registry, state)
      .then(function () {
        var depPromises;
        for (var i = 0; i < link.dependencies.length; i++) {
          var depLoad = link.dependencyInstantiations[i];
          if (!(depLoad instanceof ModuleNamespace || depLoad[toStringTag] === 'module')) {
            depPromises = depPromises || [];
            depPromises.push(addDeps(depLoad, depLoad.linkRecord));
          }
        }
        if (depPromises)
          return Promise.all(depPromises);
      });
    }
    return addDeps(load, link);
  }

  /*
   * System.register
   */
  RegisterLoader.prototype.register = function (key, deps, declare) {
    var state = this[REGISTER_INTERNAL];

    // anonymous modules get stored as lastAnon
    if (declare === undefined) {
      state.lastRegister = [key, deps, undefined];
    }

    // everything else registers into the register cache
    else {
      var load = state.records[key] || createLoadRecord(state, key, undefined);
      load.registration = [deps, declare, undefined];
    }
  };

  /*
   * System.registerDyanmic
   */
  RegisterLoader.prototype.registerDynamic = function (key, deps, executingRequire, execute) {
    var state = this[REGISTER_INTERNAL];

    // anonymous modules get stored as lastAnon
    if (typeof key !== 'string') {
      state.lastRegister = [key, deps, executingRequire];
    }

    // everything else registers into the register cache
    else {
      var load = state.records[key] || createLoadRecord(state, key, undefined);
      load.registration = [deps, executingRequire, execute];
    }
  };

  // ContextualLoader class
  // backwards-compatible with previous System.register context argument by exposing .id, .key
  function ContextualLoader (loader, key) {
    this.loader = loader;
    this.key = this.id = key;
    this.meta = {
      url: key
      // scriptElement: null
    };
  }
  /*ContextualLoader.prototype.constructor = function () {
    throw new TypeError('Cannot subclass the contextual loader only Reflect.Loader.');
  };*/
  ContextualLoader.prototype.import = function (key) {
    if (this.loader.trace)
      this.loader.loads[this.key].dynamicDeps.push(key);
    return this.loader.import(key, this.key);
  };
  /*ContextualLoader.prototype.resolve = function (key) {
    return this.loader.resolve(key, this.key);
  };*/

  function ensureEvaluate (loader, load, link, registry, state) {
    if (load.module)
      return load.module;
    if (load.evalError)
      throw load.evalError;
    if (link.evaluatePromise)
      return link.evaluatePromise;

    if (link.setters) {
      var evaluatePromise = doEvaluateDeclarative(loader, load, link, registry, state, [load]);
      if (evaluatePromise)
        return evaluatePromise;
    }
    else {
      doEvaluateDynamic(loader, load, link, registry, state, [load]);
    }
    return load.module;
  }

  function makeDynamicRequire (loader, key, dependencies, dependencyInstantiations, registry, state, seen) {
    // we can only require from already-known dependencies
    return function (name) {
      for (var i = 0; i < dependencies.length; i++) {
        if (dependencies[i] === name) {
          var depLoad = dependencyInstantiations[i];
          var module;

          if (depLoad instanceof ModuleNamespace || depLoad[toStringTag] === 'module') {
            module = depLoad;
          }
          else {
            if (depLoad.evalError)
              throw depLoad.evalError;
            if (depLoad.module === undefined && seen.indexOf(depLoad) === -1 && !depLoad.linkRecord.evaluatePromise) {
              if (depLoad.linkRecord.setters) {
                doEvaluateDeclarative(loader, depLoad, depLoad.linkRecord, registry, state, [depLoad]);
              }
              else {
                seen.push(depLoad);
                doEvaluateDynamic(loader, depLoad, depLoad.linkRecord, registry, state, seen);
              }
            }
            module = depLoad.module || depLoad.linkRecord.moduleObj;
          }

          return '__useDefault' in module ? module.__useDefault : module;
        }
      }
      throw new Error('Module ' + name + ' not declared as a System.registerDynamic dependency of ' + key);
    };
  }

  function evalError (load, err) {
    load.linkRecord = undefined;
    var evalError = LoaderError__Check_error_message_for_loader_stack(err, 'Evaluating ' + load.key);
    if (load.evalError === undefined)
      load.evalError = evalError;
    throw evalError;
  }

  // es modules evaluate dependencies first
  // returns the error if any
  function doEvaluateDeclarative (loader, load, link, registry, state, seen) {
    var depLoad, depLink;
    var depLoadPromises;
    for (var i = 0; i < link.dependencies.length; i++) {
      var depLoad = link.dependencyInstantiations[i];
      if (depLoad instanceof ModuleNamespace || depLoad[toStringTag] === 'module')
        continue;

      // custom Module returned from instantiate
      depLink = depLoad.linkRecord;
      if (depLink) {
        if (depLoad.evalError) {
          evalError(load, depLoad.evalError);
        }
        else if (depLink.setters) {
          if (seen.indexOf(depLoad) === -1) {
            seen.push(depLoad);
            try {
              var depLoadPromise = doEvaluateDeclarative(loader, depLoad, depLink, registry, state, seen);
            }
            catch (e) {
              evalError(load, e);
            }
            if (depLoadPromise) {
              depLoadPromises = depLoadPromises || [];
              depLoadPromises.push(depLoadPromise.catch(function (err) {
                evalError(load, err);
              }));
            }
          }
        }
        else {
          try {
            doEvaluateDynamic(loader, depLoad, depLink, registry, state, [depLoad]);
          }
          catch (e) {
            evalError(load, e);
          }
        }
      }
    }

    if (depLoadPromises)
      return link.evaluatePromise = Promise.all(depLoadPromises)
      .then(function () {
        if (link.execute) {
          // ES System.register execute
          // "this" is null in ES
          try {
            var execPromise = link.execute.call(nullContext);
          }
          catch (e) {
            evalError(load, e);
          }
          if (execPromise)
            return execPromise.catch(function (e) {
              evalError(load, e);
            })
            .then(function () {
              load.linkRecord = undefined;
              return registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);
            });
        }
      
        // dispose link record
        load.linkRecord = undefined;
        registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);
      });

    if (link.execute) {
      // ES System.register execute
      // "this" is null in ES
      try {
        var execPromise = link.execute.call(nullContext);
      }
      catch (e) {
        evalError(load, e);
      }
      if (execPromise)
        return link.evaluatePromise = execPromise.catch(function (e) {
          evalError(load, e);
        })
        .then(function () {
          load.linkRecord = undefined;
          return registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);
        });
    }

    // dispose link record
    load.linkRecord = undefined;
    registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);
  }

  // non es modules explicitly call moduleEvaluate through require
  function doEvaluateDynamic (loader, load, link, registry, state, seen) {
    // System.registerDynamic execute
    // "this" is "exports" in CJS
    var module = { id: load.key };
    var moduleObj = link.moduleObj;
    Object.defineProperty(module, 'exports', {
      configurable: true,
      set: function (exports) {
        moduleObj.default = moduleObj.__useDefault = exports;
      },
      get: function () {
        return moduleObj.__useDefault;
      }
    });

    var require = makeDynamicRequire(loader, load.key, link.dependencies, link.dependencyInstantiations, registry, state, seen);

    // evaluate deps first
    if (!link.executingRequire)
      for (var i = 0; i < link.dependencies.length; i++)
        require(link.dependencies[i]);

    try {
      var output = link.execute.call(envGlobal, require, moduleObj.default, module);
      if (output !== undefined)
        module.exports = output;
    }
    catch (e) {
      evalError(load, e);
    }

    load.linkRecord = undefined;

    // pick up defineProperty calls to module.exports when we can
    if (module.exports !== moduleObj.__useDefault)
      moduleObj.default = moduleObj.__useDefault = module.exports;

    var moduleDefault = moduleObj.default;

    // __esModule flag extension support via lifting
    if (moduleDefault && moduleDefault.__esModule) {
      for (var p in moduleDefault) {
        if (Object.hasOwnProperty.call(moduleDefault, p))
          moduleObj[p] = moduleDefault[p];
      }
    }

    registry[load.key] = load.module = new ModuleNamespace(link.moduleObj);

    // run importer setters and clear them
    // this allows dynamic modules to update themselves into es modules
    // as soon as execution has completed
    if (load.importerSetters)
      for (var i = 0; i < load.importerSetters.length; i++)
        load.importerSetters[i](load.module);
    load.importerSetters = undefined;
  }

  // the closest we can get to call(undefined)
  var nullContext = Object.create(null);
  if (Object.freeze)
    Object.freeze(nullContext);

  var resolvedPromise$2 = Promise.resolve();
  function noop () {}
  var emptyModule = new ModuleNamespace({});

  function protectedCreateNamespace (bindings) {
    if (bindings) {
      if (bindings instanceof ModuleNamespace || bindings[toStringTag] === 'module')
        return bindings;

      if (bindings.__esModule)
        return new ModuleNamespace(bindings);
    }

    return new ModuleNamespace({ default: bindings, __useDefault: bindings });
  }

  function isModule (m) {
    return m instanceof ModuleNamespace || m[toStringTag] === 'module';
  }

  var CONFIG = createSymbol('loader-config');
  var METADATA = createSymbol('metadata');

  var isWorker = typeof window === 'undefined' && typeof self !== 'undefined' && typeof importScripts !== 'undefined';

  function warn (msg, force) {
    if (force || this.warnings && typeof console !== 'undefined' && console.warn)
      console.warn(msg);
  }

  function checkInstantiateWasm (loader, wasmBuffer, processAnonRegister) {
    var bytes = new Uint8Array(wasmBuffer);

    // detect by leading bytes
    // Can be (new Uint32Array(fetched))[0] === 0x6D736100 when working in Node
    if (bytes[0] === 0 && bytes[1] === 97 && bytes[2] === 115) {
      return WebAssembly.compile(wasmBuffer).then(function (m) {
        var deps = [];
        var setters = [];
        var importObj = {};

        // we can only set imports if supported (eg Safari doesnt support)
        if (WebAssembly.Module.imports)
          WebAssembly.Module.imports(m).forEach(function (i) {
            var key = i.module;
            setters.push(function (m) {
              importObj[key] = m;
            });
            if (deps.indexOf(key) === -1)
              deps.push(key);
          });
        loader.register(deps, function (_export) {
          return {
            setters: setters,
            execute: function () {
              _export(new WebAssembly.Instance(m, importObj).exports);
            }
          };
        });
        processAnonRegister();

        return true;
      });
    }

    return Promise.resolve(false);
  }

  var parentModuleContext;
  function loadNodeModule (key, baseURL) {
    if (key[0] === '.')
      throw new Error('Node module ' + key + ' can\'t be loaded as it is not a package require.');

    if (!parentModuleContext) {
      var Module = this._nodeRequire('module');
      var base = decodeURI(baseURL.substr(isWindows ? 8 : 7));
      parentModuleContext = new Module(base);
      parentModuleContext.paths = Module._nodeModulePaths(base);
    }
    return parentModuleContext.require(key);
  }

  function extend (a, b) {
    for (var p in b) {
      if (!Object.hasOwnProperty.call(b, p))
        continue;
      a[p] = b[p];
    }
    return a;
  }

  function prepend (a, b) {
    for (var p in b) {
      if (!Object.hasOwnProperty.call(b, p))
        continue;
      if (a[p] === undefined)
        a[p] = b[p];
    }
    return a;
  }

  // meta first-level extends where:
  // array + array appends
  // object + object extends
  // other properties replace
  function extendMeta (a, b, _prepend) {
    for (var p in b) {
      if (!Object.hasOwnProperty.call(b, p))
        continue;
      var val = b[p];
      if (a[p] === undefined)
        a[p] = val;
      else if (val instanceof Array && a[p] instanceof Array)
        a[p] = [].concat(_prepend ? val : a[p]).concat(_prepend ? a[p] : val);
      else if (typeof val == 'object' && val !== null && typeof a[p] == 'object')
        a[p] = (_prepend ? prepend : extend)(extend({}, a[p]), val);
      else if (!_prepend)
        a[p] = val;
    }
  }

  var supportsPreload = false, supportsPrefetch = false;
  if (isBrowser)
    (function () {
      var relList = document.createElement('link').relList;
      if (relList && relList.supports) {
        supportsPrefetch = true;
        try {
          supportsPreload = relList.supports('preload');
        }
        catch (e) {}
      }
    })();

  function preloadScript (url) {
    // fallback to old fashioned image technique which still works in safari
    if (!supportsPreload && !supportsPrefetch) {
      var preloadImage = new Image();
      preloadImage.src = url;
      return;
    }

    var link = document.createElement('link');
    if (supportsPreload) {
      link.rel = 'preload';
      link.as = 'script';
    }
    else {
      // this works for all except Safari (detected by relList.supports lacking)
      link.rel = 'prefetch';
    }
    link.href = url;
    document.head.appendChild(link);
  }

  function workerImport (src, resolve, reject) {
    try {
      importScripts(src);
    }
    catch (e) {
      reject(e);
    }
    resolve();
  }

  if (isBrowser) {
    var onerror = window.onerror;
    window.onerror = function globalOnerror (msg, src) {
      if (onerror)
        onerror.apply(this, arguments);
    };
  }

  function scriptLoad (src, crossOrigin, integrity, resolve, reject) {
    // percent encode just "#" for HTTP requests
    src = src.replace(/#/g, '%23');

    // subresource integrity is not supported in web workers
    if (isWorker)
      return workerImport(src, resolve, reject);

    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.charset = 'utf-8';
    script.async = true;

    if (crossOrigin)
      script.crossOrigin = crossOrigin;
    if (integrity)
      script.integrity = integrity;

    script.addEventListener('load', load, false);
    script.addEventListener('error', error, false);

    script.src = src;
    document.head.appendChild(script);

    function load () {
      resolve();
      cleanup();
    }

    // note this does not catch execution errors
    function error (err) {
      cleanup();
      reject(new Error('Fetching ' + src));
    }

    function cleanup () {
      script.removeEventListener('load', load, false);
      script.removeEventListener('error', error, false);
      document.head.removeChild(script);
    }
  }

  function readMemberExpression (p, value) {
    var pParts = p.split('.');
    while (pParts.length)
      value = value[pParts.shift()];
    return value;
  }

  // separate out paths cache as a baseURL lock process
  function applyPaths (baseURL, paths, key) {
    var mapMatch = getMapMatch(paths, key);
    if (mapMatch) {
      var target = paths[mapMatch] + key.substr(mapMatch.length);

      var resolved = resolveIfNotPlain(target, baseURI);
      if (resolved !== undefined)
        return resolved;

      return baseURL + target;
    }
    else if (key.indexOf(':') !== -1) {
      return key;
    }
    else {
      return baseURL + key;
    }
  }

  function checkMap (p) {
    var name = this.name;
    // can add ':' here if we want paths to match the behaviour of map
    if (name.substr(0, p.length) === p && (name.length === p.length || name[p.length] === '/' || p[p.length - 1] === '/' || p[p.length - 1] === ':')) {
      var curLen = p.split('/').length;
      if (curLen > this.len) {
        this.match = p;
        this.len = curLen;
      }
    }
  }

  function getMapMatch (map, name) {
    if (Object.hasOwnProperty.call(map, name))
      return name;

    var bestMatch = {
      name: name,
      match: undefined,
      len: 0
    };

    Object.keys(map).forEach(checkMap, bestMatch);

    return bestMatch.match;
  }

  // RegEx adjusted from https://github.com/jbrantly/yabble/blob/master/lib/yabble.js#L339
  var cjsRequireRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF."'])require\s*\(\s*("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`)\s*\)/g;

  /*
   * Source loading
   */
  function fetchFetch (url, authorization, integrity, asBuffer) {
    // fetch doesn't support file:/// urls
    if (url.substr(0, 8) === 'file:///') {
      if (hasXhr)
        return xhrFetch(url, authorization, integrity, asBuffer);
      else
        throw new Error('Unable to fetch file URLs in this environment.');
    }

    // percent encode just "#" for HTTP requests
    url = url.replace(/#/g, '%23');

    var opts = {
      // NB deprecate
      headers: { Accept: 'application/x-es-module, */*' }
    };

    if (integrity)
      opts.integrity = integrity;

    if (authorization) {
      if (typeof authorization == 'string')
        opts.headers['Authorization'] = authorization;
      opts.credentials = 'include';
    }

    return fetch(url, opts)
    .then(function(res) {
      if (res.ok)
        return asBuffer ? res.arrayBuffer() : res.text();
      else
        throw new Error('Fetch error: ' + res.status + ' ' + res.statusText);
    });
  }

  function xhrFetch (url, authorization, integrity, asBuffer) {
    return new Promise(function (resolve, reject) {
      // percent encode just "#" for HTTP requests
      url = url.replace(/#/g, '%23');

      var xhr = new XMLHttpRequest();
      if (asBuffer)
        xhr.responseType = 'arraybuffer';
      function load() {
        resolve(asBuffer ? xhr.response : xhr.responseText);
      }
      function error() {
        reject(new Error('XHR error: ' + (xhr.status ? ' (' + xhr.status + (xhr.statusText ? ' ' + xhr.statusText  : '') + ')' : '') + ' loading ' + url));
      }

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          // in Chrome on file:/// URLs, status is 0
          if (xhr.status == 0) {
            if (xhr.response) {
              load();
            }
            else {
              // when responseText is empty, wait for load or error event
              // to inform if it is a 404 or empty file
              xhr.addEventListener('error', error);
              xhr.addEventListener('load', load);
            }
          }
          else if (xhr.status === 200) {
            load();
          }
          else {
            error();
          }
        }
      };
      xhr.open("GET", url, true);

      if (xhr.setRequestHeader) {
        xhr.setRequestHeader('Accept', 'application/x-es-module, */*');
        // can set "authorization: true" to enable withCredentials only
        if (authorization) {
          if (typeof authorization == 'string')
            xhr.setRequestHeader('Authorization', authorization);
          xhr.withCredentials = true;
        }
      }

      xhr.send(null);
    });
  }

  var fs;
  function nodeFetch (url, authorization, integrity, asBuffer) {
    if (url.substr(0, 8) != 'file:///') {
      if (hasFetch)
        return fetchFetch(url, authorization, integrity, asBuffer);
      else
        return Promise.reject(new Error('Unable to fetch "' + url + '". Only file URLs of the form file:/// supported running in Node without fetch.'));
    }
    
    fs = fs || require('fs');
    if (isWindows)
      url = url.replace(/\//g, '\\').substr(8);
    else
      url = url.substr(7);

    return new Promise(function (resolve, reject) {
      fs.readFile(url, function(err, data) {
        if (err) {
          return reject(err);
        }
        else {
          if (asBuffer) {
            resolve(data);
          }
          else {
            // Strip Byte Order Mark out if it's the leading char
            var dataString = data + '';
            if (dataString[0] === '\ufeff')
              dataString = dataString.substr(1);

            resolve(dataString);
          }
        }
      });
    });
  }

  function noFetch () {
    throw new Error('No fetch method is defined for this environment.');
  }

  var fetchFunction;

  var hasXhr = typeof XMLHttpRequest !== 'undefined';
  var hasFetch = typeof fetch !== 'undefined';

  if (typeof self !== 'undefined' && typeof self.fetch !== 'undefined')
   fetchFunction = fetchFetch;
  else if (hasXhr)
    fetchFunction = xhrFetch;
  else if (typeof require !== 'undefined' && typeof process !== 'undefined')
    fetchFunction = nodeFetch;
  else
    fetchFunction = noFetch;

  var fetch$1 = fetchFunction;

  function createMetadata () {
    return {
      pluginKey: undefined,
      pluginArgument: undefined,
      pluginModule: undefined,
      packageKey: undefined,
      packageConfig: undefined,
      load: undefined
    };
  }

  function getParentMetadata (loader, config, parentKey) {
    var parentMetadata = createMetadata();

    if (parentKey) {
      // detect parent plugin
      // we just need pluginKey to be truthy for package configurations
      // so we duplicate it as pluginArgument - although not correct its not used
      var parentPluginIndex;
      if (config.pluginFirst) {
        if ((parentPluginIndex = parentKey.lastIndexOf('!')) !== -1)
          parentMetadata.pluginArgument = parentMetadata.pluginKey = parentKey.substr(0, parentPluginIndex);
      }
      else {
        if ((parentPluginIndex = parentKey.indexOf('!')) !== -1)
          parentMetadata.pluginArgument = parentMetadata.pluginKey = parentKey.substr(parentPluginIndex + 1);
      }

      // detect parent package
      parentMetadata.packageKey = getMapMatch(config.packages, parentKey);
      if (parentMetadata.packageKey)
        parentMetadata.packageConfig = config.packages[parentMetadata.packageKey];
    }

    return parentMetadata;
  }

  function normalize (key, parentKey) {
    var config = this[CONFIG];

    var metadata = createMetadata();
    var parentMetadata = getParentMetadata(this, config, parentKey);

    var loader = this;

    return Promise.resolve()

    // boolean conditional
    .then(function () {
      // first we normalize the conditional
      var booleanIndex = key.lastIndexOf('#?');

      if (booleanIndex === -1)
        return Promise.resolve(key);

      var conditionObj = parseCondition.call(loader, key.substr(booleanIndex + 2));

      // in builds, return normalized conditional
      /*if (this.builder)
        return this.resolve(conditionObj.module, parentKey)
        .then(function (conditionModule) {
          conditionObj.module = conditionModule;
          return key.substr(0, booleanIndex) + '#?' + serializeCondition(conditionObj);
        });*/

      return resolveCondition.call(loader, conditionObj, parentKey, true)
      .then(function (conditionValue) {
        return conditionValue ? key.substr(0, booleanIndex) : '@empty';
      });
    })

    // plugin
    .then(function (key) {
      var parsed = parsePlugin(config.pluginFirst, key);

      if (!parsed)
        return packageResolve.call(loader, config, key, parentMetadata && parentMetadata.pluginArgument || parentKey, metadata, parentMetadata, false);

      metadata.pluginKey = parsed.plugin;

      return Promise.all([
        packageResolve.call(loader, config, parsed.argument, parentMetadata && parentMetadata.pluginArgument || parentKey, metadata, parentMetadata, true),
        loader.resolve(parsed.plugin, parentKey)
      ])
      .then(function (normalized) {
        metadata.pluginArgument = normalized[0];
        metadata.pluginKey = normalized[1];

        // don't allow a plugin to load itself
        if (metadata.pluginArgument === metadata.pluginKey)
          throw new Error('Plugin ' + metadata.pluginArgument + ' cannot load itself, make sure it is excluded from any wildcard meta configuration via a custom loader: false rule.');

        return combinePluginParts(config.pluginFirst, normalized[0], normalized[1]);
      });
    })
    .then(function (normalized) {
      return interpolateConditional.call(loader, normalized, parentKey, parentMetadata);
    })
    .then(function (normalized) {
      setMeta.call(loader, config, normalized, metadata);

      if (metadata.pluginKey || !metadata.load.loader)
        return normalized;

      // loader by configuration
      // normalizes to parent to support package loaders
      return loader.resolve(metadata.load.loader, normalized)
      .then(function (pluginKey) {
        metadata.pluginKey = pluginKey;
        metadata.pluginArgument = normalized;
        return normalized;
      });
    })
    .then(function (normalized) {
      loader[METADATA][normalized] = metadata;
      return normalized;
    });
  }

  // normalization function used for registry keys
  // just does coreResolve without map
  function decanonicalize (config, key) {
    var parsed = parsePlugin(config.pluginFirst, key);

    // plugin
    if (parsed) {
      var pluginKey = decanonicalize.call(this, config, parsed.plugin);
      return combinePluginParts(config.pluginFirst, coreResolve.call(this, config, parsed.argument, undefined, false, false), pluginKey);
    }

    return coreResolve.call(this, config, key, undefined, false, false);
  }

  function normalizeSync (key, parentKey) {
    var config = this[CONFIG];

    // normalizeSync is metadataless, so create metadata
    var metadata = createMetadata();
    var parentMetadata = parentMetadata || getParentMetadata(this, config, parentKey);

    var parsed = parsePlugin(config.pluginFirst, key);

    // plugin
    if (parsed) {
      metadata.pluginKey = normalizeSync.call(this, parsed.plugin, parentKey);
      return combinePluginParts(config.pluginFirst,
          packageResolveSync.call(this, config, parsed.argument, parentMetadata.pluginArgument || parentKey, metadata, parentMetadata, !!metadata.pluginKey),
          metadata.pluginKey);
    }

    return packageResolveSync.call(this, config, key, parentMetadata.pluginArgument || parentKey, metadata, parentMetadata, !!metadata.pluginKey);
  }

  function coreResolve (config, key, parentKey, doMap, packageName) {
    var relativeResolved = resolveIfNotPlain(key, parentKey || baseURI);

    // standard URL resolution
    if (relativeResolved)
      return applyPaths(config.baseURL, config.paths, relativeResolved);

    // plain keys not starting with './', 'x://' and '/' go through custom resolution
    if (doMap) {
      var mapMatch = getMapMatch(config.map, key);

      if (mapMatch) {
        key = config.map[mapMatch] + key.substr(mapMatch.length);

        relativeResolved = resolveIfNotPlain(key, baseURI);
        if (relativeResolved)
          return applyPaths(config.baseURL, config.paths, relativeResolved);
      }
    }

    if (this.registry.has(key))
      return key;

    if (key.substr(0, 6) === '@node/')
      return key;

    var trailingSlash = packageName && key[key.length - 1] !== '/';
    var resolved = applyPaths(config.baseURL, config.paths, trailingSlash ? key + '/' : key);
    if (trailingSlash)
      return resolved.substr(0, resolved.length - 1);
    return resolved;
  }

  function packageResolveSync (config, key, parentKey, metadata, parentMetadata, skipExtensions) {
    // ignore . since internal maps handled by standard package resolution
    if (parentMetadata && parentMetadata.packageConfig && key[0] !== '.') {
      var parentMap = parentMetadata.packageConfig.map;
      var parentMapMatch = parentMap && getMapMatch(parentMap, key);

      if (parentMapMatch && typeof parentMap[parentMapMatch] === 'string') {
        var mapped = doMapSync(this, config, parentMetadata.packageConfig, parentMetadata.packageKey, parentMapMatch, key, metadata, skipExtensions);
        if (mapped)
          return mapped;
      }
    }

    var normalized = coreResolve.call(this, config, key, parentKey, true, true);

    var pkgConfigMatch = getPackageConfigMatch(config, normalized);
    metadata.packageKey = pkgConfigMatch && pkgConfigMatch.packageKey || getMapMatch(config.packages, normalized);

    if (!metadata.packageKey)
      return normalized;

    if (config.packageConfigKeys.indexOf(normalized) !== -1) {
      metadata.packageKey = undefined;
      return normalized;
    }

    metadata.packageConfig = config.packages[metadata.packageKey] || (config.packages[metadata.packageKey] = createPackage());

    var subPath = normalized.substr(metadata.packageKey.length + 1);

    return applyPackageConfigSync(this, config, metadata.packageConfig, metadata.packageKey, subPath, metadata, skipExtensions);
  }

  function packageResolve (config, key, parentKey, metadata, parentMetadata, skipExtensions) {
    var loader = this;

    return resolvedPromise$2
    .then(function () {
      // ignore . since internal maps handled by standard package resolution
      if (parentMetadata && parentMetadata.packageConfig && key.substr(0, 2) !== './') {
        var parentMap = parentMetadata.packageConfig.map;
        var parentMapMatch = parentMap && getMapMatch(parentMap, key);

        if (parentMapMatch)
          return doMap(loader, config, parentMetadata.packageConfig, parentMetadata.packageKey, parentMapMatch, key, metadata, skipExtensions);
      }

      return resolvedPromise$2;
    })
    .then(function (mapped) {
      if (mapped)
        return mapped;

      // apply map, core, paths, contextual package map
      var normalized = coreResolve.call(loader, config, key, parentKey, true, true);

      var pkgConfigMatch = getPackageConfigMatch(config, normalized);
      metadata.packageKey = pkgConfigMatch && pkgConfigMatch.packageKey || getMapMatch(config.packages, normalized);

      if (!metadata.packageKey)
        return Promise.resolve(normalized);

      if (config.packageConfigKeys.indexOf(normalized) !== -1) {
        metadata.packageKey = undefined;
        metadata.load = createMeta();
        metadata.load.format = 'json';
        // ensure no loader
        metadata.load.loader = '';
        return Promise.resolve(normalized);
      }

      metadata.packageConfig = config.packages[metadata.packageKey] || (config.packages[metadata.packageKey] = createPackage());

      // load configuration when it matches packageConfigPaths, not already configured, and not the config itself
      var loadConfig = pkgConfigMatch && !metadata.packageConfig.configured;

      return (loadConfig ? loadPackageConfigPath(loader, config, pkgConfigMatch.configPath, metadata) : resolvedPromise$2)
      .then(function () {
        var subPath = normalized.substr(metadata.packageKey.length + 1);

        return applyPackageConfig(loader, config, metadata.packageConfig, metadata.packageKey, subPath, metadata, skipExtensions);
      });
    });
  }

  function createMeta () {
    return {
      extension: '',
      deps: undefined,
      format: undefined,
      loader: undefined,
      scriptLoad: undefined,
      globals: undefined,
      nonce: undefined,
      integrity: undefined,
      sourceMap: undefined,
      exports: undefined,
      encapsulateGlobal: false,
      crossOrigin: undefined,
      cjsRequireDetection: true,
      cjsDeferDepsExecute: false,
      esModule: false
    };
  }

  function setMeta (config, key, metadata) {
    metadata.load = metadata.load || createMeta();

    // apply wildcard metas
    var bestDepth = 0;
    var wildcardIndex;
    for (var module in config.meta) {
      wildcardIndex = module.indexOf('*');
      if (wildcardIndex === -1)
        continue;
      if (module.substr(0, wildcardIndex) === key.substr(0, wildcardIndex)
          && module.substr(wildcardIndex + 1) === key.substr(key.length - module.length + wildcardIndex + 1)) {
        var depth = module.split('/').length;
        if (depth > bestDepth)
          bestDepth = depth;
        extendMeta(metadata.load, config.meta[module], bestDepth !== depth);
      }
    }

    // apply exact meta
    if (config.meta[key])
      extendMeta(metadata.load, config.meta[key], false);

    // apply package meta
    if (metadata.packageKey) {
      var subPath = key.substr(metadata.packageKey.length + 1);

      var meta = {};
      if (metadata.packageConfig.meta) {
        var bestDepth = 0;
        getMetaMatches(metadata.packageConfig.meta, subPath, function (metaPattern, matchMeta, matchDepth) {
          if (matchDepth > bestDepth)
            bestDepth = matchDepth;
          extendMeta(meta, matchMeta, matchDepth && bestDepth > matchDepth);
        });

        extendMeta(metadata.load, meta, false);
      }

      // format
      if (metadata.packageConfig.format && !metadata.pluginKey && !metadata.load.loader)
        metadata.load.format = metadata.load.format || metadata.packageConfig.format;
    }
  }

  function parsePlugin (pluginFirst, key) {
    var argumentKey;
    var pluginKey;

    var pluginIndex = pluginFirst ? key.indexOf('!') : key.lastIndexOf('!');

    if (pluginIndex === -1)
      return;

    if (pluginFirst) {
      argumentKey = key.substr(pluginIndex + 1);
      pluginKey = key.substr(0, pluginIndex);
    }
    else {
      argumentKey = key.substr(0, pluginIndex);
      pluginKey = key.substr(pluginIndex + 1) || argumentKey.substr(argumentKey.lastIndexOf('.') + 1);
    }

    return {
      argument: argumentKey,
      plugin: pluginKey
    };
  }

  // put key back together after parts have been normalized
  function combinePluginParts (pluginFirst, argumentKey, pluginKey) {
    if (pluginFirst)
      return pluginKey + '!' + argumentKey;
    else
      return argumentKey + '!' + pluginKey;
  }

  /*
   * Package Configuration Extension
   *
   * Example:
   *
   * SystemJS.packages = {
   *   jquery: {
   *     main: 'index.js', // when not set, package key is requested directly
   *     format: 'amd',
   *     defaultExtension: 'ts', // defaults to 'js', can be set to false
   *     modules: {
   *       '*.ts': {
   *         loader: 'typescript'
   *       },
   *       'vendor/sizzle.js': {
   *         format: 'global'
   *       }
   *     },
   *     map: {
   *        // map internal require('sizzle') to local require('./vendor/sizzle')
   *        sizzle: './vendor/sizzle.js',
   *        // map any internal or external require of 'jquery/vendor/another' to 'another/index.js'
   *        './vendor/another.js': './another/index.js',
   *        // test.js / test -> lib/test.js
   *        './test.js': './lib/test.js',
   *
   *        // environment-specific map configurations
   *        './index.js': {
   *          '~browser': './index-node.js',
   *          './custom-condition.js|~export': './index-custom.js'
   *        }
   *     },
   *     // allows for setting package-prefixed depCache
   *     // keys are normalized module keys relative to the package itself
   *     depCache: {
   *       // import 'package/index.js' loads in parallel package/lib/test.js,package/vendor/sizzle.js
   *       './index.js': ['./test'],
   *       './test.js': ['external-dep'],
   *       'external-dep/path.js': ['./another.js']
   *     }
   *   }
   * };
   *
   * Then:
   *   import 'jquery'                       -> jquery/index.js
   *   import 'jquery/submodule'             -> jquery/submodule.js
   *   import 'jquery/submodule.ts'          -> jquery/submodule.ts loaded as typescript
   *   import 'jquery/vendor/another'        -> another/index.js
   *
   * Detailed Behaviours
   * - main can have a leading "./" can be added optionally
   * - map and defaultExtension are applied to the main
   * - defaultExtension adds the extension only if the exact extension is not present

   * - if a meta value is available for a module, map and defaultExtension are skipped
   * - like global map, package map also applies to subpaths (sizzle/x, ./vendor/another/sub)
   * - condition module map is '@env' module in package or '@system-env' globally
   * - map targets support conditional interpolation ('./x': './x.#{|env}.js')
   * - internal package map targets cannot use boolean conditionals
   *
   * Package Configuration Loading
   *
   * Not all packages may already have their configuration present in the System config
   * For these cases, a list of packageConfigPaths can be provided, which when matched against
   * a request, will first request a ".json" file by the package key to derive the package
   * configuration from. This allows dynamic loading of non-predetermined code, a key use
   * case in SystemJS.
   *
   * Example:
   *
   *   SystemJS.packageConfigPaths = ['packages/test/package.json', 'packages/*.json'];
   *
   *   // will first request 'packages/new-package/package.json' for the package config
   *   // before completing the package request to 'packages/new-package/path'
   *   SystemJS.import('packages/new-package/path');
   *
   *   // will first request 'packages/test/package.json' before the main
   *   SystemJS.import('packages/test');
   *
   * When a package matches packageConfigPaths, it will always send a config request for
   * the package configuration.
   * The package key itself is taken to be the match up to and including the last wildcard
   * or trailing slash.
   * The most specific package config path will be used.
   * Any existing package configurations for the package will deeply merge with the
   * package config, with the existing package configurations taking preference.
   * To opt-out of the package configuration request for a package that matches
   * packageConfigPaths, use the { configured: true } package config option.
   *
   */

  function addDefaultExtension (config, pkg, pkgKey, subPath, skipExtensions) {
    // don't apply extensions to folders or if defaultExtension = false
    if (!subPath || !pkg.defaultExtension || subPath[subPath.length - 1] === '/' || skipExtensions)
      return subPath;

    var metaMatch = false;

    // exact meta or meta with any content after the last wildcard skips extension
    if (pkg.meta)
      getMetaMatches(pkg.meta, subPath, function (metaPattern, matchMeta, matchDepth) {
        if (matchDepth === 0 || metaPattern.lastIndexOf('*') !== metaPattern.length - 1)
          return metaMatch = true;
      });

    // exact global meta or meta with any content after the last wildcard skips extension
    if (!metaMatch && config.meta)
      getMetaMatches(config.meta, pkgKey + '/' + subPath, function (metaPattern, matchMeta, matchDepth) {
        if (matchDepth === 0 || metaPattern.lastIndexOf('*') !== metaPattern.length - 1)
          return metaMatch = true;
      });

    if (metaMatch)
      return subPath;

    // work out what the defaultExtension is and add if not there already
    var defaultExtension = '.' + pkg.defaultExtension;
    if (subPath.substr(subPath.length - defaultExtension.length) !== defaultExtension)
      return subPath + defaultExtension;
    else
      return subPath;
  }

  function applyPackageConfigSync (loader, config, pkg, pkgKey, subPath, metadata, skipExtensions) {
    // main
    if (!subPath) {
      if (pkg.main)
        subPath = pkg.main.substr(0, 2) === './' ? pkg.main.substr(2) : pkg.main;
      else
        // also no submap if key is package itself (import 'pkg' -> 'path/to/pkg.js')
        // NB can add a default package main convention here
        // if it becomes internal to the package then it would no longer be an exit path
        return pkgKey;
    }

    // map config checking without then with extensions
    if (pkg.map) {
      var mapPath = './' + subPath;

      var mapMatch = getMapMatch(pkg.map, mapPath);

      // we then check map with the default extension adding
      if (!mapMatch) {
        mapPath = './' + addDefaultExtension(config, pkg, pkgKey, subPath, skipExtensions);
        if (mapPath !== './' + subPath)
          mapMatch = getMapMatch(pkg.map, mapPath);
      }
      if (mapMatch) {
        var mapped = doMapSync(loader, config, pkg, pkgKey, mapMatch, mapPath, metadata, skipExtensions);
        if (mapped)
          return mapped;
      }
    }

    // normal package resolution
    return pkgKey + '/' + addDefaultExtension(config, pkg, pkgKey, subPath, skipExtensions);
  }

  function validMapping (mapMatch, mapped, path) {
    // allow internal ./x -> ./x/y or ./x/ -> ./x/y recursive maps
    // but only if the path is exactly ./x and not ./x/z
    if (mapped.substr(0, mapMatch.length) === mapMatch && path.length > mapMatch.length)
      return false;

    return true;
  }

  function doMapSync (loader, config, pkg, pkgKey, mapMatch, path, metadata, skipExtensions) {
    if (path[path.length - 1] === '/')
      path = path.substr(0, path.length - 1);
    var mapped = pkg.map[mapMatch];

    if (typeof mapped === 'object')
      throw new Error('Synchronous conditional normalization not supported sync normalizing ' + mapMatch + ' in ' + pkgKey);

    if (!validMapping(mapMatch, mapped, path) || typeof mapped !== 'string')
      return;

    return packageResolveSync.call(loader, config, mapped + path.substr(mapMatch.length), pkgKey + '/', metadata, metadata, skipExtensions);
  }

  function applyPackageConfig (loader, config, pkg, pkgKey, subPath, metadata, skipExtensions) {
    // main
    if (!subPath) {
      if (pkg.main)
        subPath = pkg.main.substr(0, 2) === './' ? pkg.main.substr(2) : pkg.main;
      // also no submap if key is package itself (import 'pkg' -> 'path/to/pkg.js')
      else
        // NB can add a default package main convention here
        // if it becomes internal to the package then it would no longer be an exit path
        return Promise.resolve(pkgKey);
    }

    // map config checking without then with extensions
    var mapPath, mapMatch;

    if (pkg.map) {
      mapPath = './' + subPath;
      mapMatch = getMapMatch(pkg.map, mapPath);

      // we then check map with the default extension adding
      if (!mapMatch) {
        mapPath = './' + addDefaultExtension(config, pkg, pkgKey, subPath, skipExtensions);
        if (mapPath !== './' + subPath)
          mapMatch = getMapMatch(pkg.map, mapPath);
      }
    }

    return (mapMatch ? doMap(loader, config, pkg, pkgKey, mapMatch, mapPath, metadata, skipExtensions) : resolvedPromise$2)
    .then(function (mapped) {
      if (mapped)
        return Promise.resolve(mapped);

      // normal package resolution / fallback resolution for no conditional match
      return Promise.resolve(pkgKey + '/' + addDefaultExtension(config, pkg, pkgKey, subPath, skipExtensions));
    });
  }

  function doMap (loader, config, pkg, pkgKey, mapMatch, path, metadata, skipExtensions) {
    if (path[path.length - 1] === '/')
      path = path.substr(0, path.length - 1);

    var mapped = pkg.map[mapMatch];

    if (typeof mapped === 'string') {
      if (!validMapping(mapMatch, mapped, path))
        return resolvedPromise$2;
      return packageResolve.call(loader, config, mapped + path.substr(mapMatch.length), pkgKey + '/', metadata, metadata, skipExtensions)
      .then(function (normalized) {
        return interpolateConditional.call(loader, normalized, pkgKey + '/', metadata);
      });
    }

    // we use a special conditional syntax to allow the builder to handle conditional branch points further
    /*if (loader.builder)
      return Promise.resolve(pkgKey + '/#:' + path);*/

    // we load all conditions upfront
    var conditionPromises = [];
    var conditions = [];
    for (var e in mapped) {
      var c = parseCondition(e);
      conditions.push({
        condition: c,
        map: mapped[e]
      });
      conditionPromises.push(RegisterLoader.prototype.import.call(loader, c.module, pkgKey));
    }

    // map object -> conditional map
    return Promise.all(conditionPromises)
    .then(function (conditionValues) {
      // first map condition to match is used
      for (var i = 0; i < conditions.length; i++) {
        var c = conditions[i].condition;
        var value = readMemberExpression(c.prop, '__useDefault' in conditionValues[i] ? conditionValues[i].__useDefault : conditionValues[i]);
        if (!c.negate && value || c.negate && !value)
          return conditions[i].map;
      }
    })
    .then(function (mapped) {
      if (mapped) {
        if (!validMapping(mapMatch, mapped, path))
          return resolvedPromise$2;
        return packageResolve.call(loader, config, mapped + path.substr(mapMatch.length), pkgKey + '/', metadata, metadata, skipExtensions)
        .then(function (normalized) {
          return interpolateConditional.call(loader, normalized, pkgKey + '/', metadata);
        });
      }

      // no environment match -> fallback to original subPath by returning undefined
    });
  }

  // check if the given normalized key matches a packageConfigPath
  // if so, loads the config
  var packageConfigPaths = {};

  // data object for quick checks against package paths
  function createPkgConfigPathObj (path) {
    var lastWildcard = path.lastIndexOf('*');
    var length = Math.max(lastWildcard + 1, path.lastIndexOf('/'));
    return {
      length: length,
      regEx: new RegExp('^(' + path.substr(0, length).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^\\/]+') + ')(\\/|$)'),
      wildcard: lastWildcard !== -1
    };
  }

  // most specific match wins
  function getPackageConfigMatch (config, normalized) {
    var pkgKey, exactMatch = false, configPath;
    for (var i = 0; i < config.packageConfigPaths.length; i++) {
      var packageConfigPath = config.packageConfigPaths[i];
      var p = packageConfigPaths[packageConfigPath] || (packageConfigPaths[packageConfigPath] = createPkgConfigPathObj(packageConfigPath));
      if (normalized.length < p.length)
        continue;
      var match = normalized.match(p.regEx);
      if (match && (!pkgKey || (!(exactMatch && p.wildcard) && pkgKey.length < match[1].length))) {
        pkgKey = match[1];
        exactMatch = !p.wildcard;
        configPath = pkgKey + packageConfigPath.substr(p.length);
      }
    }

    if (!pkgKey)
      return;

    return {
      packageKey: pkgKey,
      configPath: configPath
    };
  }

  function loadPackageConfigPath (loader, config, pkgConfigPath, metadata, normalized) {
    var configLoader = loader.pluginLoader || loader;

    // ensure we note this is a package config file path
    // it will then be skipped from getting other normalizations itself to ensure idempotency
    if (config.packageConfigKeys.indexOf(pkgConfigPath) === -1)
      config.packageConfigKeys.push(pkgConfigPath);

    return configLoader.import(pkgConfigPath)
    .then(function (pkgConfig) {
      setPkgConfig(metadata.packageConfig, pkgConfig, metadata.packageKey, true, config);
      metadata.packageConfig.configured = true;
    })
    .catch(function (err) {
      throw LoaderError__Check_error_message_for_loader_stack(err, 'Unable to fetch package configuration file ' + pkgConfigPath);
    });
  }

  function getMetaMatches (pkgMeta, subPath, matchFn) {
    // wildcard meta
    var wildcardIndex;
    for (var module in pkgMeta) {
      // allow meta to start with ./ for flexibility
      var dotRel = module.substr(0, 2) === './' ? './' : '';
      if (dotRel)
        module = module.substr(2);

      wildcardIndex = module.indexOf('*');
      if (wildcardIndex === -1)
        continue;

      if (module.substr(0, wildcardIndex) === subPath.substr(0, wildcardIndex)
          && module.substr(wildcardIndex + 1) === subPath.substr(subPath.length - module.length + wildcardIndex + 1)) {
        // alow match function to return true for an exit path
        if (matchFn(module, pkgMeta[dotRel + module], module.split('/').length))
          return;
      }
    }
    // exact meta
    var exactMeta = pkgMeta[subPath] && Object.hasOwnProperty.call(pkgMeta, subPath) ? pkgMeta[subPath] : pkgMeta['./' + subPath];
    if (exactMeta)
      matchFn(exactMeta, exactMeta, 0);
  }


  /*
   * Conditions Extension
   *
   *   Allows a condition module to alter the resolution of an import via syntax:
   *
   *     import $ from 'jquery/#{browser}';
   *
   *   Will first load the module 'browser' via `SystemJS.import('browser')` and
   *   take the default export of that module.
   *   If the default export is not a string, an error is thrown.
   *
   *   We then substitute the string into the require to get the conditional resolution
   *   enabling environment-specific variations like:
   *
   *     import $ from 'jquery/ie'
   *     import $ from 'jquery/firefox'
   *     import $ from 'jquery/chrome'
   *     import $ from 'jquery/safari'
   *
   *   It can be useful for a condition module to define multiple conditions.
   *   This can be done via the `|` modifier to specify an export member expression:
   *
   *     import 'jquery/#{./browser.js|grade.version}'
   *
   *   Where the `grade` export `version` member in the `browser.js` module  is substituted.
   *
   *
   * Boolean Conditionals
   *
   *   For polyfill modules, that are used as imports but have no module value,
   *   a binary conditional allows a module not to be loaded at all if not needed:
   *
   *     import 'es5-shim#?./conditions.js|needs-es5shim'
   *
   *   These conditions can also be negated via:
   *
   *     import 'es5-shim#?./conditions.js|~es6'
   *
   */

  var sysConditions = ['browser', 'node', 'dev', 'build', 'production', 'default'];

  function parseCondition (condition) {
    var conditionExport, conditionModule, negation;

    var negation;
    var conditionExportIndex = condition.lastIndexOf('|');
    if (conditionExportIndex !== -1) {
      conditionExport = condition.substr(conditionExportIndex + 1);
      conditionModule = condition.substr(0, conditionExportIndex);

      if (conditionExport[0] === '~') {
        negation = true;
        conditionExport = conditionExport.substr(1);
      }
    }
    else {
      negation = condition[0] === '~';
      conditionExport = 'default';
      conditionModule = condition.substr(negation);
      if (sysConditions.indexOf(conditionModule) !== -1) {
        conditionExport = conditionModule;
        conditionModule = null;
      }
    }

    return {
      module: conditionModule || '@system-env',
      prop: conditionExport,
      negate: negation
    };
  }

  function resolveCondition (conditionObj, parentKey, bool) {
    // import without __useDefault handling here
    return RegisterLoader.prototype.import.call(this, conditionObj.module, parentKey)
    .then(function (condition) {
      var m = readMemberExpression(conditionObj.prop, condition);

      if (bool && typeof m !== 'boolean')
        throw new TypeError('Condition did not resolve to a boolean.');

      return conditionObj.negate ? !m : m;
    });
  }

  var interpolationRegEx = /#\{[^\}]+\}/;
  function interpolateConditional (key, parentKey, parentMetadata) {
    // first we normalize the conditional
    var conditionalMatch = key.match(interpolationRegEx);

    if (!conditionalMatch)
      return Promise.resolve(key);

    var conditionObj = parseCondition.call(this, conditionalMatch[0].substr(2, conditionalMatch[0].length - 3));

    // in builds, return normalized conditional
    /*if (this.builder)
      return this.normalize(conditionObj.module, parentKey, createMetadata(), parentMetadata)
      .then(function (conditionModule) {
        conditionObj.module = conditionModule;
        return key.replace(interpolationRegEx, '#{' + serializeCondition(conditionObj) + '}');
      });*/

    return resolveCondition.call(this, conditionObj, parentKey, false)
    .then(function (conditionValue) {
      if (typeof conditionValue !== 'string')
        throw new TypeError('The condition value for ' + key + ' doesn\'t resolve to a string.');

      if (conditionValue.indexOf('/') !== -1)
        throw new TypeError('Unabled to interpolate conditional ' + key + (parentKey ? ' in ' + parentKey : '') + '\n\tThe condition value ' + conditionValue + ' cannot contain a "/" separator.');

      return key.replace(interpolationRegEx, conditionValue);
    });
  }

  /*
   Extend config merging one deep only

    loader.config({
      some: 'random',
      config: 'here',
      deep: {
        config: { too: 'too' }
      }
    });

    <=>

    loader.some = 'random';
    loader.config = 'here'
    loader.deep = loader.deep || {};
    loader.deep.config = { too: 'too' };


    Normalizes meta and package configs allowing for:

    SystemJS.config({
      meta: {
        './index.js': {}
      }
    });

    To become

    SystemJS.meta['https://thissite.com/index.js'] = {};

    For easy normalization canonicalization with latest URL support.

  */
  var envConfigNames = ['browserConfig', 'nodeConfig', 'devConfig', 'buildConfig', 'productionConfig'];
  function envSet(loader, cfg, envCallback) {
    for (var i = 0; i < envConfigNames.length; i++) {
      var envConfig = envConfigNames[i];
      if (cfg[envConfig] && envModule[envConfig.substr(0, envConfig.length - 6)])
        envCallback(cfg[envConfig]);
    }
  }

  function cloneObj (obj, maxDepth) {
    var clone = {};
    for (var p in obj) {
      var prop = obj[p];
      if (maxDepth > 1) {
        if (prop instanceof Array)
          clone[p] = [].concat(prop);
        else if (typeof prop === 'object')
          clone[p] = cloneObj(prop, maxDepth - 1);
        else if (p !== 'packageConfig')
          clone[p] = prop;
      }
      else {
        clone[p] = prop;
      }
    }
    return clone;
  }

  function getConfigItem (config, p) {
    var cfgItem = config[p];

    // getConfig must return an unmodifiable clone of the configuration
    if (cfgItem instanceof Array)
      return config[p].concat([]);
    else if (typeof cfgItem === 'object')
      return cloneObj(cfgItem, 3)
    else
      return config[p];
  }

  function getConfig (configName) {
    if (configName) {
      if (configNames.indexOf(configName) !== -1)
        return getConfigItem(this[CONFIG], configName);
      throw new Error('"' + configName + '" is not a valid configuration name. Must be one of ' + configNames.join(', ') + '.');
    }

    var cfg = {};
    for (var i = 0; i < configNames.length; i++) {
      var p = configNames[i];
      var configItem = getConfigItem(this[CONFIG], p);
      if (configItem !== undefined)
        cfg[p] = configItem;
    }
    return cfg;
  }

  function setConfig (cfg, isEnvConfig) {
    var loader = this;
    var config = this[CONFIG];

    if ('warnings' in cfg)
      config.warnings = cfg.warnings;

    if ('wasm' in cfg)
      config.wasm = typeof WebAssembly !== 'undefined' && cfg.wasm;

    if ('production' in cfg || 'build' in cfg)
      setProduction.call(loader, !!cfg.production, !!(cfg.build || envModule && envModule.build));

    if (!isEnvConfig) {
      // if using nodeConfig / browserConfig / productionConfig, take baseURL from there
      // these exceptions will be unnecessary when we can properly implement config queuings
      var baseURL;
      envSet(loader, cfg, function(cfg) {
        baseURL = baseURL || cfg.baseURL;
      });
      baseURL = baseURL || cfg.baseURL;

      // always configure baseURL first
      if (baseURL) {
        config.baseURL = resolveIfNotPlain(baseURL, baseURI) || resolveIfNotPlain('./' + baseURL, baseURI);
        if (config.baseURL[config.baseURL.length - 1] !== '/')
          config.baseURL += '/';
      }

      if (cfg.paths)
        extend(config.paths, cfg.paths);

      envSet(loader, cfg, function(cfg) {
        if (cfg.paths)
          extend(config.paths, cfg.paths);
      });

      for (var p in config.paths) {
        if (config.paths[p].indexOf('*') === -1)
          continue;
        warn.call(config, 'Path config ' + p + ' -> ' + config.paths[p] + ' is no longer supported as wildcards are deprecated.');
        delete config.paths[p];
      }
    }

    if (cfg.defaultJSExtensions)
      warn.call(config, 'The defaultJSExtensions configuration option is deprecated.\n  Use packages defaultExtension instead.', true);

    if (typeof cfg.pluginFirst === 'boolean')
      config.pluginFirst = cfg.pluginFirst;

    if (cfg.map) {
      for (var p in cfg.map) {
        var v = cfg.map[p];

        if (typeof v === 'string') {
          var mapped = coreResolve.call(loader, config, v, undefined, false, false);
          if (mapped[mapped.length -1] === '/' && p[p.length - 1] !== ':' && p[p.length - 1] !== '/')
            mapped = mapped.substr(0, mapped.length - 1);
          config.map[p] = mapped;
        }

        // object map
        else {
          var pkgName = coreResolve.call(loader, config, p[p.length - 1] !== '/' ? p + '/' : p, undefined, true, true);
          pkgName = pkgName.substr(0, pkgName.length - 1);

          var pkg = config.packages[pkgName];
          if (!pkg) {
            pkg = config.packages[pkgName] = createPackage();
            // use '' instead of false to keep type consistent
            pkg.defaultExtension = '';
          }
          setPkgConfig(pkg, { map: v }, pkgName, false, config);
        }
      }
    }

    if (cfg.packageConfigPaths) {
      var packageConfigPaths = [];
      for (var i = 0; i < cfg.packageConfigPaths.length; i++) {
        var path = cfg.packageConfigPaths[i];
        var packageLength = Math.max(path.lastIndexOf('*') + 1, path.lastIndexOf('/'));
        var normalized = coreResolve.call(loader, config, path.substr(0, packageLength), undefined, false, false);
        packageConfigPaths[i] = normalized + path.substr(packageLength);
      }
      config.packageConfigPaths = packageConfigPaths;
    }

    if (cfg.bundles) {
      for (var p in cfg.bundles) {
        var bundle = [];
        for (var i = 0; i < cfg.bundles[p].length; i++)
          bundle.push(loader.normalizeSync(cfg.bundles[p][i]));
        config.bundles[p] = bundle;
      }
    }

    if (cfg.packages) {
      for (var p in cfg.packages) {
        if (p.match(/^([^\/]+:)?\/\/$/))
          throw new TypeError('"' + p + '" is not a valid package name.');

        var pkgName = coreResolve.call(loader, config, p[p.length - 1] !== '/' ? p + '/' : p, undefined, true, true);
        pkgName = pkgName.substr(0, pkgName.length - 1);

        setPkgConfig(config.packages[pkgName] = config.packages[pkgName] || createPackage(), cfg.packages[p], pkgName, false, config);
      }
    }

    if (cfg.depCache) {
      for (var p in cfg.depCache)
        config.depCache[loader.normalizeSync(p)] = [].concat(cfg.depCache[p]);
    }

    if (cfg.meta) {
      for (var p in cfg.meta) {
        // base wildcard stays base
        if (p[0] === '*') {
          extend(config.meta[p] = config.meta[p] || {}, cfg.meta[p]);
        }
        else {
          var resolved = coreResolve.call(loader, config, p, undefined, true, true);
          extend(config.meta[resolved] = config.meta[resolved] || {}, cfg.meta[p]);
        }
      }
    }

    if ('transpiler' in cfg)
      config.transpiler = cfg.transpiler;


    // copy any remaining non-standard configuration properties
    for (var c in cfg) {
      if (configNames.indexOf(c) !== -1)
        continue;
      if (envConfigNames.indexOf(c) !== -1)
        continue;

      // warn.call(config, 'Setting custom config option `System.config({ ' + c + ': ... })` is deprecated. Avoid custom config options or set SystemJS.' + c + ' = ... directly.');
      loader[c] = cfg[c];
    }

    envSet(loader, cfg, function(cfg) {
      loader.config(cfg, true);
    });
  }

  function createPackage () {
    return {
      defaultExtension: undefined,
      main: undefined,
      format: undefined,
      meta: undefined,
      map: undefined,
      packageConfig: undefined,
      configured: false
    };
  }

  // deeply-merge (to first level) config with any existing package config
  function setPkgConfig (pkg, cfg, pkgName, prependConfig, config) {
    for (var prop in cfg) {
      if (prop === 'main' || prop === 'format' || prop === 'defaultExtension' || prop === 'configured') {
        if (!prependConfig || pkg[prop] === undefined)
          pkg[prop] = cfg[prop];
      }
      else if (prop === 'map') {
        (prependConfig ? prepend : extend)(pkg.map = pkg.map || {}, cfg.map);
      }
      else if (prop === 'meta') {
        (prependConfig ? prepend : extend)(pkg.meta = pkg.meta || {}, cfg.meta);
      }
      else if (Object.hasOwnProperty.call(cfg, prop)) {
        warn.call(config, '"' + prop + '" is not a valid package configuration option in package ' + pkgName);
      }
    }

    // default defaultExtension for packages only
    if (pkg.defaultExtension === undefined)
      pkg.defaultExtension = 'js';

    if (pkg.main === undefined && pkg.map && pkg.map['.']) {
      pkg.main = pkg.map['.'];
      delete pkg.map['.'];
    }
    // main object becomes main map
    else if (typeof pkg.main === 'object') {
      pkg.map = pkg.map || {};
      pkg.map['./@main'] = pkg.main;
      pkg.main['default'] = pkg.main['default'] || './';
      pkg.main = '@main';
    }

    return pkg;
  }

  var hasBuffer = typeof Buffer !== 'undefined';
  try {
    if (hasBuffer && new Buffer('a').toString('base64') !== 'YQ==')
      hasBuffer = false;
  }
  catch (e) {
    hasBuffer = false;
  }

  var sourceMapPrefix = '\n//# sourceMapping' + 'URL=data:application/json;base64,';
  function inlineSourceMap (sourceMapString) {
    if (hasBuffer)
      return sourceMapPrefix + new Buffer(sourceMapString).toString('base64');
    else if (typeof btoa !== 'undefined')
      return sourceMapPrefix + btoa(unescape(encodeURIComponent(sourceMapString)));
    else
      return '';
  }

  function getSource(source, sourceMap, address, wrap) {
    var lastLineIndex = source.lastIndexOf('\n');

    if (sourceMap) {
      if (typeof sourceMap != 'object')
        throw new TypeError('load.metadata.sourceMap must be set to an object.');

      sourceMap = JSON.stringify(sourceMap);
    }

    return (wrap ? '(function(System, SystemJS) {' : '') + source + (wrap ? '\n})(System, System);' : '')
        // adds the sourceURL comment if not already present
        + (source.substr(lastLineIndex, 15) != '\n//# sourceURL='
          ? '\n//# sourceURL=' + address + (sourceMap ? '!transpiled' : '') : '')
        // add sourceMappingURL if load.metadata.sourceMap is set
        + (sourceMap && inlineSourceMap(sourceMap) || '');
  }

  // script execution via injecting a script tag into the page
  // this allows CSP nonce to be set for CSP environments
  var head;
  function scriptExec(loader, source, sourceMap, address, nonce) {
    if (!head)
      head = document.head || document.body || document.documentElement;

    var script = document.createElement('script');
    script.text = getSource(source, sourceMap, address, false);
    var onerror = window.onerror;
    var e;
    window.onerror = function(_e) {
      e = addToError(_e, 'Evaluating ' + address);
      if (onerror)
        onerror.apply(this, arguments);
    };
    preExec(loader);

    if (nonce)
      script.setAttribute('nonce', nonce);

    head.appendChild(script);
    head.removeChild(script);
    postExec();
    window.onerror = onerror;
    if (e)
      return e;
  }

  var vm;
  var useVm;

  var curSystem;

  var callCounter = 0;
  function preExec (loader) {
    if (callCounter++ == 0)
      curSystem = envGlobal.System;
    envGlobal.System = envGlobal.SystemJS = loader;
  }
  function postExec () {
    if (--callCounter == 0)
      envGlobal.System = envGlobal.SystemJS = curSystem;
  }

  var supportsScriptExec = false;
  if (isBrowser && typeof document != 'undefined' && document.getElementsByTagName) {
    if (!(window.chrome && window.chrome.extension || navigator.userAgent.match(/^Node\.js/)))
      supportsScriptExec = true;
  }

  function evaluate (loader, source, sourceMap, address, integrity, nonce, noWrap) {
    if (!source)
      return;
    if (nonce && supportsScriptExec)
      return scriptExec(loader, source, sourceMap, address, nonce);
    try {
      preExec(loader);
      // global scoped eval for node (avoids require scope leak)
      if (!vm && loader._nodeRequire) {
        vm = loader._nodeRequire('vm');
        useVm = vm.runInThisContext("typeof System !== 'undefined' && System") === loader;
      }
      if (useVm)
        vm.runInThisContext(getSource(source, sourceMap, address, !noWrap), { filename: address + (sourceMap ? '!transpiled' : '') });
      else
        (0, eval)(getSource(source, sourceMap, address, !noWrap));
      postExec();
    }
    catch (e) {
      postExec();
      return e;
    }
  }

  function setHelpers (loader) {
    loader.set('@@cjs-helpers', loader.newModule({
      requireResolve: requireResolve.bind(loader),
      getPathVars: getPathVars
    }));

    loader.set('@@global-helpers', loader.newModule({
      prepareGlobal: prepareGlobal
    }));
  }

  function setAmdHelper (loader) {

    /*
      AMD-compatible require
      To copy RequireJS, set window.require = window.requirejs = loader.amdRequire
    */
    function require (names, callback, errback, referer) {
      // in amd, first arg can be a config object... we just ignore
      if (typeof names === 'object' && !(names instanceof Array))
        return require.apply(null, Array.prototype.splice.call(arguments, 1, arguments.length - 1));

      // amd require
      if (typeof names === 'string' && typeof callback === 'function')
        names = [names];
      if (names instanceof Array) {
        var dynamicRequires = [];
        for (var i = 0; i < names.length; i++)
          dynamicRequires.push(loader.import(names[i], referer));
        Promise.all(dynamicRequires).then(function (modules) {
          if (callback)
            callback.apply(null, modules);
        }, errback);
      }

      // commonjs require
      else if (typeof names === 'string') {
        var normalized = loader.decanonicalize(names, referer);
        var module = loader.get(normalized);
        if (!module)
          throw new Error('Module not already loaded loading "' + names + '" as ' + normalized + (referer ? ' from "' + referer + '".' : '.'));
        return '__useDefault' in module ? module.__useDefault : module;
      }

      else
        throw new TypeError('Invalid require');
    }

    function define (name, deps, factory) {
      if (typeof name !== 'string') {
        factory = deps;
        deps = name;
        name = null;
      }

      if (!(deps instanceof Array)) {
        factory = deps;
        deps = ['require', 'exports', 'module'].splice(0, factory.length);
      }

      if (typeof factory !== 'function')
        factory = (function (factory) {
          return function() { return factory; }
        })(factory);

      if (!name) {
        if (curMetaDeps) {
          deps = deps.concat(curMetaDeps);
          curMetaDeps = undefined;
        }
      }

      // remove system dependencies
      var requireIndex, exportsIndex, moduleIndex;

      if ((requireIndex = deps.indexOf('require')) !== -1) {

        deps.splice(requireIndex, 1);

        // only trace cjs requires for non-named
        // named defines assume the trace has already been done
        if (!name)
          deps = deps.concat(amdGetCJSDeps(factory.toString(), requireIndex));
      }

      if ((exportsIndex = deps.indexOf('exports')) !== -1)
        deps.splice(exportsIndex, 1);

      if ((moduleIndex = deps.indexOf('module')) !== -1)
        deps.splice(moduleIndex, 1);

      function execute (req, exports, module) {
        var depValues = [];
        for (var i = 0; i < deps.length; i++)
          depValues.push(req(deps[i]));

        module.uri = module.id;

        module.config = noop;

        // add back in system dependencies
        if (moduleIndex !== -1)
          depValues.splice(moduleIndex, 0, module);

        if (exportsIndex !== -1)
          depValues.splice(exportsIndex, 0, exports);

        if (requireIndex !== -1) {
          var contextualRequire = function (names, callback, errback) {
            if (typeof names === 'string' && typeof callback !== 'function')
              return req(names);
            return require.call(loader, names, callback, errback, module.id);
          };
          contextualRequire.toUrl = function (name) {
            return loader.normalizeSync(name, module.id);
          };
          depValues.splice(requireIndex, 0, contextualRequire);
        }

        // set global require to AMD require
        var curRequire = envGlobal.require;
        envGlobal.require = require;

        var output = factory.apply(exportsIndex === -1 ? envGlobal : exports, depValues);

        envGlobal.require = curRequire;

        if (typeof output !== 'undefined')
          module.exports = output;
      }

      // anonymous define
      if (!name) {
        loader.registerDynamic(deps, false, curEsModule ? wrapEsModuleExecute(execute) : execute);
      }
      else {
        loader.registerDynamic(name, deps, false, execute);

        // if we don't have any other defines,
        // then let this be an anonymous define
        // this is just to support single modules of the form:
        // define('jquery')
        // still loading anonymously
        // because it is done widely enough to be useful
        // as soon as there is more than one define, this gets removed though
        if (lastNamedDefine) {
          lastNamedDefine = undefined;
          multipleNamedDefines = true;
        }
        else if (!multipleNamedDefines) {
          lastNamedDefine = [deps, execute];
        }
      }
    }
    define.amd = {};

    loader.amdDefine = define;
    loader.amdRequire = require;
  }

  // CJS
  var windowOrigin;
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.location)
    windowOrigin = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '');

  function stripOrigin(path) {
    if (path.substr(0, 8) === 'file:///')
      return path.substr(7 + !!isWindows);

    if (windowOrigin && path.substr(0, windowOrigin.length) === windowOrigin)
      return path.substr(windowOrigin.length);

    return path;
  }

  function requireResolve (request, parentId) {
    return stripOrigin(this.normalizeSync(request, parentId));
  }

  function getPathVars (moduleId) {
    // remove any plugin syntax
    var pluginIndex = moduleId.lastIndexOf('!');
    var filename;
    if (pluginIndex !== -1)
      filename = moduleId.substr(0, pluginIndex);
    else
      filename = moduleId;

    var dirname = filename.split('/');
    dirname.pop();
    dirname = dirname.join('/');

    return {
      filename: stripOrigin(filename),
      dirname: stripOrigin(dirname)
    };
  }

  var commentRegEx = /(^|[^\\])(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;
  var stringRegEx = /("[^"\\\n\r]*(\\.[^"\\\n\r]*)*"|'[^'\\\n\r]*(\\.[^'\\\n\r]*)*')/g;

  // extract CJS dependencies from source text via regex static analysis
  // read require('x') statements not in comments or strings
  function getCJSDeps (source) {
    cjsRequireRegEx.lastIndex = commentRegEx.lastIndex = stringRegEx.lastIndex = 0;

    var deps = [];

    var match;

    // track string and comment locations for unminified source
    var stringLocations = [], commentLocations = [];

    function inLocation (locations, match) {
      for (var i = 0; i < locations.length; i++)
        if (locations[i][0] < match.index && locations[i][1] > match.index)
          return true;
      return false;
    }

    if (source.length / source.split('\n').length < 200) {
      while (match = stringRegEx.exec(source))
        stringLocations.push([match.index, match.index + match[0].length]);

      // TODO: track template literals here before comments

      while (match = commentRegEx.exec(source)) {
        // only track comments not starting in strings
        if (!inLocation(stringLocations, match))
          commentLocations.push([match.index + match[1].length, match.index + match[0].length - 1]);
      }
    }

    while (match = cjsRequireRegEx.exec(source)) {
      // ensure we're not within a string or comment location
      if (!inLocation(stringLocations, match) && !inLocation(commentLocations, match)) {
        var dep = match[1].substr(1, match[1].length - 2);
        // skip cases like require('" + file + "')
        if (dep.match(/"|'/))
          continue;
        deps.push(dep);
      }
    }

    return deps;
  }

  // Global
  // bare minimum ignores
  var ignoredGlobalProps = ['_g', 'sessionStorage', 'localStorage', 'clipboardData', 'frames', 'frameElement', 'external',
    'mozAnimationStartTime', 'mozPaintCount', 'webkitStorageInfo', 'webkitIndexedDB', 'mozInnerScreenY', 'mozInnerScreenX'];

  var globalSnapshot;
  function globalIterator (globalName) {
    if (ignoredGlobalProps.indexOf(globalName) !== -1)
      return;
    try {
      var value = envGlobal[globalName];
    }
    catch (e) {
      ignoredGlobalProps.push(globalName);
    }
    this(globalName, value);
  }

  function getGlobalValue (exports) {
    if (typeof exports === 'string')
      return readMemberExpression(exports, envGlobal);

    if (!(exports instanceof Array))
      throw new Error('Global exports must be a string or array.');

    var globalValue = {};
    for (var i = 0; i < exports.length; i++)
      globalValue[exports[i].split('.').pop()] = readMemberExpression(exports[i], envGlobal);
    return globalValue;
  }

  function prepareGlobal (moduleName, exports, globals, encapsulate) {
    // disable module detection
    var curDefine = envGlobal.define;

    envGlobal.define = undefined;

    // set globals
    var oldGlobals;
    if (globals) {
      oldGlobals = {};
      for (var g in globals) {
        oldGlobals[g] = envGlobal[g];
        envGlobal[g] = globals[g];
      }
    }

    // store a complete copy of the global object in order to detect changes
    if (!exports) {
      globalSnapshot = {};

      Object.keys(envGlobal).forEach(globalIterator, function (name, value) {
        globalSnapshot[name] = value;
      });
    }

    // return function to retrieve global
    return function () {
      var globalValue = exports ? getGlobalValue(exports) : {};

      var singleGlobal;
      var multipleExports = !!exports;

      if (!exports || encapsulate)
        Object.keys(envGlobal).forEach(globalIterator, function (name, value) {
          if (globalSnapshot[name] === value)
            return;
          if (value === undefined)
            return;

          // allow global encapsulation where globals are removed
          if (encapsulate)
            envGlobal[name] = undefined;

          if (!exports) {
            globalValue[name] = value;

            if (singleGlobal !== undefined) {
              if (!multipleExports && singleGlobal !== value)
                multipleExports = true;
            }
            else {
              singleGlobal = value;
            }
          }
        });

      globalValue = multipleExports ? globalValue : singleGlobal;

      // revert globals
      if (oldGlobals) {
        for (var g in oldGlobals)
          envGlobal[g] = oldGlobals[g];
      }
      envGlobal.define = curDefine;

      return globalValue;
    };
  }

  // AMD
  var cjsRequirePre = "(?:^|[^$_a-zA-Z\\xA0-\\uFFFF.])";
  var cjsRequirePost = "\\s*\\(\\s*(\"([^\"]+)\"|'([^']+)')\\s*\\)";
  var fnBracketRegEx = /\(([^\)]*)\)/;
  var wsRegEx = /^\s+|\s+$/g;

  var requireRegExs = {};

  function amdGetCJSDeps(source, requireIndex) {

    // remove comments
    source = source.replace(commentRegEx, '');

    // determine the require alias
    var params = source.match(fnBracketRegEx);
    var requireAlias = (params[1].split(',')[requireIndex] || 'require').replace(wsRegEx, '');

    // find or generate the regex for this requireAlias
    var requireRegEx = requireRegExs[requireAlias] || (requireRegExs[requireAlias] = new RegExp(cjsRequirePre + requireAlias + cjsRequirePost, 'g'));

    requireRegEx.lastIndex = 0;

    var deps = [];

    var match;
    while (match = requireRegEx.exec(source))
      deps.push(match[2] || match[3]);

    return deps;
  }

  function wrapEsModuleExecute (execute) {
    return function (require, exports, module) {
      execute(require, exports, module);
      exports = module.exports;
      if ((typeof exports === 'object' || typeof exports === 'function') && !('__esModule' in exports))
        Object.defineProperty(module.exports, '__esModule', {
          value: true
        });
    };
  }

  // generate anonymous define from singular named define
  var multipleNamedDefines = false;
  var lastNamedDefine;
  var curMetaDeps;
  var curEsModule = false;
  function clearLastDefine (metaDeps, esModule) {
    curMetaDeps = metaDeps;
    curEsModule = esModule;
    lastNamedDefine = undefined;
    multipleNamedDefines = false;
  }
  function registerLastDefine (loader) {
    if (lastNamedDefine)
      loader.registerDynamic(curMetaDeps ? lastNamedDefine[0].concat(curMetaDeps) : lastNamedDefine[0],
          false, curEsModule ? wrapEsModuleExecute(lastNamedDefine[1]) : lastNamedDefine[1]);

    // bundles are an empty module
    else if (multipleNamedDefines)
      loader.registerDynamic([], false, noop);
  }

  var supportsScriptLoad = (isBrowser || isWorker) && typeof navigator !== 'undefined' && navigator.userAgent && !navigator.userAgent.match(/MSIE (9|10).0/);

  // include the node require since we're overriding it
  var nodeRequire;
  if (typeof require !== 'undefined' && typeof process !== 'undefined' && !process.browser)
    nodeRequire = require;

  function setMetaEsModule (metadata, moduleValue) {
    if (metadata.load.esModule && (typeof moduleValue === 'object' || typeof moduleValue === 'function') &&
        !('__esModule' in moduleValue))
      Object.defineProperty(moduleValue, '__esModule', {
        value: true
      });
  }

  function instantiate$1 (key, processAnonRegister) {
    var loader = this;
    var config = this[CONFIG];
    // first do bundles and depCache
    return (loadBundlesAndDepCache(config, this, key) || resolvedPromise$2)
    .then(function () {
      if (processAnonRegister())
        return;

      var metadata = loader[METADATA][key];

      // node module loading
      if (key.substr(0, 6) === '@node/') {
        if (!loader._nodeRequire)
          throw new TypeError('Error loading ' + key + '. Can only load node core modules in Node.');
        loader.registerDynamic([], false, function () {
          return loadNodeModule.call(loader, key.substr(6), loader.baseURL);
        });
        processAnonRegister();
        return;
      }

      if (metadata.load.scriptLoad ) {
        if (metadata.pluginKey || !supportsScriptLoad) {
          metadata.load.scriptLoad = false;
          warn.call(config, 'scriptLoad not supported for "' + key + '"');
        }
      }
      else if (metadata.load.scriptLoad !== false && !metadata.pluginKey && supportsScriptLoad) {
        // auto script load AMD, global without deps
        if (!metadata.load.deps && !metadata.load.globals &&
            (metadata.load.format === 'system' || metadata.load.format === 'register' || metadata.load.format === 'global' && metadata.load.exports))
          metadata.load.scriptLoad = true;
      }

      // fetch / translate / instantiate pipeline
      if (!metadata.load.scriptLoad)
        return initializePlugin(loader, key, metadata)
        .then(function () {
          return runFetchPipeline(loader, key, metadata, processAnonRegister, config.wasm);
        })

      // just script loading
      return new Promise(function (resolve, reject) {
        if (metadata.load.format === 'amd' && envGlobal.define !== loader.amdDefine)
          throw new Error('Loading AMD with scriptLoad requires setting the global `' + globalName + '.define = SystemJS.amdDefine`');

        scriptLoad(key, metadata.load.crossOrigin, metadata.load.integrity, function () {
          if (!processAnonRegister()) {
            metadata.load.format = 'global';
            var globalValue = metadata.load.exports && getGlobalValue(metadata.load.exports);
            loader.registerDynamic([], false, function () {
              setMetaEsModule(metadata, globalValue);
              return globalValue;
            });
            processAnonRegister();
          }

          resolve();
        }, reject);
      });
    })
    .then(function (instantiated) {
      delete loader[METADATA][key];
      return instantiated;
    });
  }
  function initializePlugin (loader, key, metadata) {
    if (!metadata.pluginKey)
      return resolvedPromise$2;

    return loader.import(metadata.pluginKey).then(function (plugin) {
      metadata.pluginModule = plugin;
      metadata.pluginLoad = {
        name: key,
        address: metadata.pluginArgument,
        source: undefined,
        metadata: metadata.load
      };
      metadata.load.deps = metadata.load.deps || [];
    });
  }

  function loadBundlesAndDepCache (config, loader, key) {
    // load direct deps, in turn will pick up their trace trees
    var deps;
    if (isBrowser && (deps = config.depCache[key])) {
      for (var i = 0; i < deps.length; i++)
        loader.normalize(deps[i], key).then(preloadScript);
    }
    else {
      var matched = false;
      for (var b in config.bundles) {
        for (var i = 0; i < config.bundles[b].length; i++) {
          var curModule = config.bundles[b][i];

          if (curModule === key) {
            matched = true;
            break;
          }

          // wildcard in bundles includes / boundaries
          if (curModule.indexOf('*') !== -1) {
            var parts = curModule.split('*');
            if (parts.length !== 2) {
              config.bundles[b].splice(i--, 1);
              continue;
            }

            if (key.substr(0, parts[0].length) === parts[0] &&
                key.substr(key.length - parts[1].length, parts[1].length) === parts[1]) {
              matched = true;
              break;
            }
          }
        }

        if (matched)
          return loader.import(b);
      }
    }
  }

  function runFetchPipeline (loader, key, metadata, processAnonRegister, wasm) {
    if (metadata.load.exports && !metadata.load.format)
      metadata.load.format = 'global';

    return resolvedPromise$2

    // locate
    .then(function () {
      if (!metadata.pluginModule || !metadata.pluginModule.locate)
        return;

      return Promise.resolve(metadata.pluginModule.locate.call(loader, metadata.pluginLoad))
      .then(function (address) {
        if (address)
          metadata.pluginLoad.address = address;
      });
    })

    // fetch
    .then(function () {
      if (!metadata.pluginModule)
        return fetch$1(key, metadata.load.authorization, metadata.load.integrity, wasm);

      wasm = false;

      if (!metadata.pluginModule.fetch)
        return fetch$1(metadata.pluginLoad.address, metadata.load.authorization, metadata.load.integrity, false);

      return metadata.pluginModule.fetch.call(loader, metadata.pluginLoad, function (load) {
        return fetch$1(load.address, metadata.load.authorization, metadata.load.integrity, false);
      });
    })

    .then(function (fetched) {
      // fetch is already a utf-8 string if not doing wasm detection
      if (!wasm || typeof fetched === 'string')
        return translateAndInstantiate(loader, key, fetched, metadata, processAnonRegister);

      return checkInstantiateWasm(loader, fetched, processAnonRegister)
      .then(function (wasmInstantiated) {
        if (wasmInstantiated)
          return;

        // not wasm -> convert buffer into utf-8 string to execute as a module
        // TextDecoder compatibility matches WASM currently. Need to keep checking this.
        // The TextDecoder interface is documented at http://encoding.spec.whatwg.org/#interface-textdecoder
        var stringSource = isBrowser ? new TextDecoder('utf-8').decode(new Uint8Array(fetched)) : fetched.toString();
        return translateAndInstantiate(loader, key, stringSource, metadata, processAnonRegister);
      });
    });
  }

  function translateAndInstantiate (loader, key, source, metadata, processAnonRegister) {
    return Promise.resolve(source)
    // translate
    .then(function (source) {
      if (metadata.load.format === 'detect')
        metadata.load.format = undefined;

      readMetaSyntax(source, metadata);

      if (!metadata.pluginModule)
        return source;

      metadata.pluginLoad.source = source;

      if (!metadata.pluginModule.translate)
        return source;

      return Promise.resolve(metadata.pluginModule.translate.call(loader, metadata.pluginLoad, metadata.traceOpts))
      .then(function (translated) {
        if (metadata.load.sourceMap) {
          if (typeof metadata.load.sourceMap !== 'object')
            throw new Error('metadata.load.sourceMap must be set to an object.');
          sanitizeSourceMap(metadata.pluginLoad.address, metadata.load.sourceMap);
        }

        if (typeof translated === 'string')
          return translated;
        else
          return metadata.pluginLoad.source;
      });
    })
    .then(function (source) {
      if (!metadata.load.format && source.substring(0, 8) === '"bundle"') {
        metadata.load.format = 'system';
        return source;
      }

      if (metadata.load.format === 'register' || !metadata.load.format && detectRegisterFormat(source)) {
        metadata.load.format = 'register';
        return source;
      }

      if (metadata.load.format !== 'esm' && (metadata.load.format || !source.match(esmRegEx))) {
        return source;
      }

      metadata.load.format = 'esm';
      return transpile(loader, source, key, metadata, processAnonRegister);
    })

    // instantiate
    .then(function (translated) {
      if (typeof translated !== 'string' || !metadata.pluginModule || !metadata.pluginModule.instantiate)
        return translated;

      var calledInstantiate = false;
      metadata.pluginLoad.source = translated;
      return Promise.resolve(metadata.pluginModule.instantiate.call(loader, metadata.pluginLoad, function (load) {
        translated = load.source;
        metadata.load = load.metadata;
        if (calledInstantiate)
          throw new Error('Instantiate must only be called once.');
        calledInstantiate = true;
      }))
      .then(function (result) {
        if (calledInstantiate)
          return translated;
        return protectedCreateNamespace(result);
      });
    })
    .then(function (source) {
      // plugin instantiate result case
      if (typeof source !== 'string')
        return source;

      if (!metadata.load.format)
        metadata.load.format = detectLegacyFormat(source);

      var registered = false;

      switch (metadata.load.format) {
        case 'esm':
        case 'register':
        case 'system':
          var err = evaluate(loader, source, metadata.load.sourceMap, key, metadata.load.integrity, metadata.load.nonce, false);
          if (err)
            throw err;
          if (!processAnonRegister())
            return emptyModule;
          return;
        break;

        case 'json':
          // warn.call(config, '"json" module format is deprecated.');
          var parsed = JSON.parse(source);
          return loader.newModule({ default: parsed, __useDefault: parsed });

        case 'amd':
          var curDefine = envGlobal.define;
          envGlobal.define = loader.amdDefine;

          clearLastDefine(metadata.load.deps, metadata.load.esModule);

          var err = evaluate(loader, source, metadata.load.sourceMap, key, metadata.load.integrity, metadata.load.nonce, false);

          // if didn't register anonymously, use the last named define if only one
          registered = processAnonRegister();
          if (!registered) {
            registerLastDefine(loader);
            registered = processAnonRegister();
          }

          envGlobal.define = curDefine;

          if (err)
            throw err;
        break;

        case 'cjs':
          var metaDeps = metadata.load.deps;
          var deps = (metadata.load.deps || []).concat(metadata.load.cjsRequireDetection ? getCJSDeps(source) : []);

          for (var g in metadata.load.globals)
            if (metadata.load.globals[g])
              deps.push(metadata.load.globals[g]);

          loader.registerDynamic(deps, true, function (require, exports, module) {
            require.resolve = function (key) {
              return requireResolve.call(loader, key, module.id);
            };
            // support module.paths ish
            module.paths = [];
            module.require = require;

            // ensure meta deps execute first
            if (!metadata.load.cjsDeferDepsExecute && metaDeps)
              for (var i = 0; i < metaDeps.length; i++)
                require(metaDeps[i]);

            var pathVars = getPathVars(module.id);
            var __cjsWrapper = {
              exports: exports,
              args: [require, exports, module, pathVars.filename, pathVars.dirname, envGlobal, envGlobal]
            };

            var cjsWrapper = "(function (require, exports, module, __filename, __dirname, global, GLOBAL";

            // add metadata.globals to the wrapper arguments
            if (metadata.load.globals)
              for (var g in metadata.load.globals) {
                __cjsWrapper.args.push(require(metadata.load.globals[g]));
                cjsWrapper += ", " + g;
              }

            // disable AMD detection
            var define = envGlobal.define;
            envGlobal.define = undefined;
            envGlobal.__cjsWrapper = __cjsWrapper;

            source = cjsWrapper + ") {" + source.replace(hashBangRegEx$1, '') + "\n}).apply(__cjsWrapper.exports, __cjsWrapper.args);";

            var err = evaluate(loader, source, metadata.load.sourceMap, key, metadata.load.integrity, metadata.load.nonce, false);
            if (err)
              throw err;

            setMetaEsModule(metadata, exports);

            envGlobal.__cjsWrapper = undefined;
            envGlobal.define = define;
          });
          registered = processAnonRegister();
        break;

        case 'global':
          var deps = metadata.load.deps || [];
          for (var g in metadata.load.globals) {
            var gl = metadata.load.globals[g];
            if (gl)
              deps.push(gl);
          }

          loader.registerDynamic(deps, false, function (require, exports, module) {
            var globals;
            if (metadata.load.globals) {
              globals = {};
              for (var g in metadata.load.globals)
                if (metadata.load.globals[g])
                  globals[g] = require(metadata.load.globals[g]);
            }

            var exportName = metadata.load.exports;

            if (exportName)
              source += '\n' + globalName + '["' + exportName + '"] = ' + exportName + ';';

            var retrieveGlobal = prepareGlobal(module.id, exportName, globals, metadata.load.encapsulateGlobal);
            var err = evaluate(loader, source, metadata.load.sourceMap, key, metadata.load.integrity, metadata.load.nonce, true);

            if (err)
              throw err;

            var output = retrieveGlobal();
            setMetaEsModule(metadata, output);
            return output;
          });
          registered = processAnonRegister();
        break;

        default:
          throw new TypeError('Unknown module format "' + metadata.load.format + '" for "' + key + '".' + (metadata.load.format === 'es6' ? ' Use "esm" instead here.' : ''));
      }

      if (!registered)
        throw new Error('Module ' + key + ' detected as ' + metadata.load.format + ' but didn\'t execute correctly.');
    });
  }

  var globalName = typeof self != 'undefined' ? 'self' : 'global';

  // good enough ES6 module detection regex - format detections not designed to be accurate, but to handle the 99% use case
  var esmRegEx = /(^\s*|[}\);\n]\s*)(import\s*(['"]|(\*\s+as\s+)?(?!type)([^"'\(\)\n; ]+)\s*from\s*['"]|\{)|export\s+\*\s+from\s+["']|export\s*(\{|default|function|class|var|const|let|async\s+function))/;

  var leadingCommentAndMetaRegEx = /^(\s*\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)*\s*/;
  function detectRegisterFormat(source) {
    var leadingCommentAndMeta = source.match(leadingCommentAndMetaRegEx);
    if (!leadingCommentAndMeta)
      return false;
    var codeStart = leadingCommentAndMeta[0].length;
    return source.substr(codeStart, 17) === 'SystemJS.register' || source.substr(codeStart, 15) === 'System.register';
  }

  // AMD Module Format Detection RegEx
  // define([.., .., ..], ...)
  // define(varName); || define(function(require, exports) {}); || define({})
  var amdRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])define\s*\(\s*("[^"]+"\s*,\s*|'[^']+'\s*,\s*)?\s*(\[(\s*(("[^"]+"|'[^']+')\s*,|\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*(\s*("[^"]+"|'[^']+')\s*,?)?(\s*(\/\/.*\r?\n|\/\*(.|\s)*?\*\/))*\s*\]|function\s*|{|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*\))/;

  /// require('...') || exports[''] = ... || exports.asd = ... || module.exports = ...
  var cjsExportsRegEx = /(?:^\uFEFF?|[^$_a-zA-Z\xA0-\uFFFF.])(exports\s*(\[['"]|\.)|module(\.exports|\['exports'\]|\["exports"\])\s*(\[['"]|[=,\.]))/;

  // used to support leading #!/usr/bin/env in scripts as supported in Node
  var hashBangRegEx$1 = /^\#\!.*/;

  function detectLegacyFormat (source) {
    if (source.match(amdRegEx))
      return 'amd';

    cjsExportsRegEx.lastIndex = 0;
    cjsRequireRegEx.lastIndex = 0;
    if (cjsRequireRegEx.exec(source) || cjsExportsRegEx.exec(source))
      return 'cjs';

    // global is the fallback format
    return 'global';
  }

  function sanitizeSourceMap (address, sourceMap) {
    var originalName = address.split('!')[0];

    // force set the filename of the original file
    if (!sourceMap.file || sourceMap.file == address)
      sourceMap.file = originalName + '!transpiled';

    // force set the sources list if only one source
    if (!sourceMap.sources || sourceMap.sources.length <= 1 && (!sourceMap.sources[0] || sourceMap.sources[0] === address))
      sourceMap.sources = [originalName];
  }

  function transpile (loader, source, key, metadata, processAnonRegister) {
    if (!loader.transpiler)
      throw new TypeError('Unable to dynamically transpile ES module\n   A loader plugin needs to be configured via `SystemJS.config({ transpiler: \'transpiler-module\' })`.');

    // deps support for es transpile
    if (metadata.load.deps) {
      var depsPrefix = '';
      for (var i = 0; i < metadata.load.deps.length; i++)
        depsPrefix += 'import "' + metadata.load.deps[i] + '"; ';
      source = depsPrefix + source;
    }

    // do transpilation
    return loader.import.call(loader, loader.transpiler)
    .then(function (transpiler) {
      transpiler = transpiler.__useDefault || transpiler;

      // translate hooks means this is a transpiler plugin instead of a raw implementation
      if (!transpiler.translate)
        throw new Error(loader.transpiler + ' is not a valid transpiler plugin.');

      // if transpiler is the same as the plugin loader, then don't run twice
      if (transpiler === metadata.pluginModule)
        return source;

      // convert the source map into an object for transpilation chaining
      if (typeof metadata.load.sourceMap === 'string')
        metadata.load.sourceMap = JSON.parse(metadata.load.sourceMap);

      metadata.pluginLoad = metadata.pluginLoad || {
        name: key,
        address: key,
        source: source,
        metadata: metadata.load
      };
      metadata.load.deps = metadata.load.deps || [];

      return Promise.resolve(transpiler.translate.call(loader, metadata.pluginLoad, metadata.traceOpts))
      .then(function (source) {
        // sanitize sourceMap if an object not a JSON string
        var sourceMap = metadata.load.sourceMap;
        if (sourceMap && typeof sourceMap === 'object')
          sanitizeSourceMap(key, sourceMap);

        if (metadata.load.format === 'esm' && detectRegisterFormat(source))
          metadata.load.format = 'register';

        return source;
      });
    }, function (err) {
      throw LoaderError__Check_error_message_for_loader_stack(err, 'Unable to load transpiler to transpile ' + key);
    });
  }

  // detect any meta header syntax
  // only set if not already set
  var metaRegEx = /^(\s*\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\s*\/\/[^\n]*|\s*"[^"]+"\s*;?|\s*'[^']+'\s*;?)+/;
  var metaPartRegEx = /\/\*[^\*]*(\*(?!\/)[^\*]*)*\*\/|\/\/[^\n]*|"[^"]+"\s*;?|'[^']+'\s*;?/g;

  function setMetaProperty(target, p, value) {
    var pParts = p.split('.');
    var curPart;
    while (pParts.length > 1) {
      curPart = pParts.shift();
      target = target[curPart] = target[curPart] || {};
    }
    curPart = pParts.shift();
    if (target[curPart] === undefined)
      target[curPart] = value;
  }

  function readMetaSyntax (source, metadata) {
    var meta = source.match(metaRegEx);
    if (!meta)
      return;

    var metaParts = meta[0].match(metaPartRegEx);

    for (var i = 0; i < metaParts.length; i++) {
      var curPart = metaParts[i];
      var len = curPart.length;

      var firstChar = curPart.substr(0, 1);
      if (curPart.substr(len - 1, 1) == ';')
        len--;

      if (firstChar != '"' && firstChar != "'")
        continue;

      var metaString = curPart.substr(1, curPart.length - 3);
      var metaName = metaString.substr(0, metaString.indexOf(' '));

      if (metaName) {
        var metaValue = metaString.substr(metaName.length + 1, metaString.length - metaName.length - 1);

        if (metaName === 'deps')
          metaName = 'deps[]';

        if (metaName.substr(metaName.length - 2, 2) === '[]') {
          metaName = metaName.substr(0, metaName.length - 2);
          metadata.load[metaName] = metadata.load[metaName] || [];
          metadata.load[metaName].push(metaValue);
        }
        // "use strict" is not meta
        else if (metaName !== 'use') {
          setMetaProperty(metadata.load, metaName, metaValue);
        }
      }
      else {
        metadata.load[metaString] = true;
      }
    }
  }

  var scriptSrc;

  // Promise detection and error message
  if (typeof Promise === 'undefined')
    throw new Error('SystemJS needs a Promise polyfill.');

  if (typeof document !== 'undefined') {
    var scripts = document.getElementsByTagName('script');
    var curScript = scripts[scripts.length - 1];
    if (document.currentScript && (curScript.defer || curScript.async))
      curScript = document.currentScript;

    scriptSrc = curScript && curScript.src;
  }
  // worker
  else if (typeof importScripts !== 'undefined') {
    try {
      throw new Error('_');
    }
    catch (e) {
      e.stack.replace(/(?:at|@).*(http.+):[\d]+:[\d]+/, function(m, url) {
        scriptSrc = url;
      });
    }
  }
  // node
  else if (typeof __filename !== 'undefined') {
    scriptSrc = __filename;
  }

  function SystemJSLoader () {
    RegisterLoader.call(this);

    // NB deprecate
    this._loader = {};

    // internal metadata store
    this[METADATA] = {};

    // internal configuration
    this[CONFIG] = {
      baseURL: baseURI,
      paths: {},

      packageConfigPaths: [],
      packageConfigKeys: [],
      map: {},
      packages: {},
      depCache: {},
      meta: {},
      bundles: {},

      production: false,

      transpiler: undefined,
      loadedBundles: {},

      // global behaviour flags
      warnings: false,
      pluginFirst: false,

      // enable wasm loading and detection when supported
      wasm: false
    };

    // make the location of the system.js script accessible (if any)
    this.scriptSrc = scriptSrc;

    this._nodeRequire = nodeRequire;

    // support the empty module, as a concept
    this.registry.set('@empty', emptyModule);

    setProduction.call(this, false, false);

    // add module format helpers
    setHelpers(this);
    setAmdHelper(this);
  }

  var envModule;
  function setProduction (isProduction, isBuilder) {
    this[CONFIG].production = isProduction;
    this.registry.set('@system-env', envModule = this.newModule({
      browser: isBrowser,
      node: !!this._nodeRequire,
      production: !isBuilder && isProduction,
      dev: isBuilder || !isProduction,
      build: isBuilder,
      'default': true
    }));
  }

  SystemJSLoader.prototype = Object.create(RegisterLoader.prototype);

  SystemJSLoader.prototype.constructor = SystemJSLoader;

  // NB deprecate normalize
  SystemJSLoader.prototype[SystemJSLoader.resolve = RegisterLoader.resolve] = SystemJSLoader.prototype.normalize = normalize;

  SystemJSLoader.prototype.load = function (key, parentKey) {
    warn.call(this[CONFIG], 'System.load is deprecated.');
    return this.import(key, parentKey);
  };

  // NB deprecate decanonicalize, normalizeSync
  SystemJSLoader.prototype.decanonicalize = SystemJSLoader.prototype.normalizeSync = SystemJSLoader.prototype.resolveSync = normalizeSync;

  SystemJSLoader.prototype[SystemJSLoader.instantiate = RegisterLoader.instantiate] = instantiate$1;

  SystemJSLoader.prototype.config = setConfig;
  SystemJSLoader.prototype.getConfig = getConfig;

  SystemJSLoader.prototype.global = envGlobal;

  SystemJSLoader.prototype.import = function () {
    return RegisterLoader.prototype.import.apply(this, arguments)
    .then(function (m) {
      return '__useDefault' in m ? m.__useDefault : m;
    });
  };

  var configNames = ['baseURL', 'map', 'paths', 'packages', 'packageConfigPaths', 'depCache', 'meta', 'bundles', 'transpiler', 'warnings', 'pluginFirst', 'production', 'wasm'];

  var hasProxy = typeof Proxy !== 'undefined';
  for (var i = 0; i < configNames.length; i++) (function (configName) {
    Object.defineProperty(SystemJSLoader.prototype, configName, {
      get: function () {
        var cfg = getConfigItem(this[CONFIG], configName);

        if (hasProxy && typeof cfg === 'object')
          cfg = new Proxy(cfg, {
            set: function (target, option) {
              throw new Error('Cannot set SystemJS.' + configName + '["' + option + '"] directly. Use SystemJS.config({ ' + configName + ': { "' + option + '": ... } }) rather.');
            }
          });

        //if (typeof cfg === 'object')
        //  warn.call(this[CONFIG], 'Referencing `SystemJS.' + configName + '` is deprecated. Use the config getter `SystemJS.getConfig(\'' + configName + '\')`');
        return cfg;
      },
      set: function (name) {
        throw new Error('Setting `SystemJS.' + configName + '` directly is no longer supported. Use `SystemJS.config({ ' + configName + ': ... })`.');
      }
    });
  })(configNames[i]);

  /*
   * Backwards-compatible registry API, to be deprecated
   */
  function registryWarn(loader, method) {
    warn.call(loader[CONFIG], 'SystemJS.' + method + ' is deprecated for SystemJS.registry.' + method);
  }
  SystemJSLoader.prototype.delete = function (key) {
    registryWarn(this, 'delete');
    return this.registry.delete(key);
  };
  SystemJSLoader.prototype.get = function (key) {
    registryWarn(this, 'get');
    return this.registry.get(key);
  };
  SystemJSLoader.prototype.has = function (key) {
    registryWarn(this, 'has');
    return this.registry.has(key);
  };
  SystemJSLoader.prototype.set = function (key, module) {
    registryWarn(this, 'set');
    return this.registry.set(key, module);
  };
  SystemJSLoader.prototype.newModule = function (bindings) {
    return new ModuleNamespace(bindings);
  };
  SystemJSLoader.prototype.isModule = isModule;

  // ensure System.register and System.registerDynamic decanonicalize
  SystemJSLoader.prototype.register = function (key, deps, declare) {
    if (typeof key === 'string')
      key = decanonicalize.call(this, this[CONFIG], key);
    return RegisterLoader.prototype.register.call(this, key, deps, declare);
  };

  SystemJSLoader.prototype.registerDynamic = function (key, deps, executingRequire, execute) {
    if (typeof key === 'string')
      key = decanonicalize.call(this, this[CONFIG], key);
    return RegisterLoader.prototype.registerDynamic.call(this, key, deps, executingRequire, execute);
  };

  SystemJSLoader.prototype.version = "0.21.6 Dev";

  var System = new SystemJSLoader();

  // only set the global System on the global in browsers
  if (isBrowser || isWorker)
    envGlobal.SystemJS = envGlobal.System = System;

  if (typeof module !== 'undefined' && module.exports)
    module.exports = System;

}());
//# sourceMappingURL=system.src.js.map
(function instrumentStaticSystemJS (system) {
  const _origGet = system.get ? system.get.bind(system) : () => {};
  system.get = (id, recorder = true) => (lively.FreezerRuntime && lively.FreezerRuntime.get(id, recorder)) || _origGet(id);
  const _origDecanonicalize = system.decanonicalize ? system.decanonicalize.bind(system) : (id) => id;
  system.decanonicalize = (id) =>
    lively.FreezerRuntime ? lively.FreezerRuntime.decanonicalize(id) : _origDecanonicalize(id);
  window._missingExportShim = () => {};
  const _originalRegister = system.register.bind(system);
  system.register = (name, deps, def) => {
    if (typeof name !== 'string') {
      def = deps;
      deps = name;
      return _originalRegister(deps, (exports, module) => {
        let res = def(exports, module);
        if (!res.setters) res.setters = [];
        return res;
      });
    }
    return _originalRegister(name, deps, (exports, module) => {
      let res = def(exports, module);
      if (!res.setters) res.setters = [];
      return res;
    });
  };

  if (!system.config) system.config = () => {}; // no need for config anyways...

  if (!system.global) system.global = window;

  // map fs as global
  if (system.set && system.newModule) {
    // handle this via import-map instead
    system.set('stub-transpiler', system.newModule({
      translate: (load) => {
        return load.source;
      }
    }));
  }

  if (!system.newModule) system.newModule = (exports) => exports;
  system.config({
    transpiler: 'stub-transpiler' // this is tp be revised when we migrate the entire system to the new systemjs
  });
  system.get('@lively-env').loadedModules = lively.FreezerRuntime.registry;
  // if (system.baseURL !== lively.FreezerRuntime.baseURL) { system.baseURL = lively.FreezerRuntime.baseURL; }
  system.trace = false;
})(System);
System.set("lively.collab", System.newModule({ default: {} }));
System.set("mocha-es6", System.newModule({ default: {} }));
System.set("mocha", System.newModule({ default: {} }));
System.set("rollup", System.newModule({ default: {} }));
System.set("@babel/preset-env", System.newModule({ default: {} }));
System.set("@babel/plugin-syntax-import-meta", System.newModule({ default: {} }));
System.set("@rollup/plugin-json", System.newModule({ default: {} }));
System.set("@rollup/plugin-commonjs", System.newModule({ default: {} }));
System.set("rollup-plugin-polyfill-node", System.newModule({ default: {} }));
System.set("babel-plugin-transform-es2015-modules-systemjs", System.newModule({ default: {} }));
System.set("fs", System.newModule({ default: {} }));
System.set("events", System.newModule({ default: {} }));
