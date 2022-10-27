/* global self,global,System */

/*

Code in here will not be directly executed but stringified and embedded in bundles!

*/

export function runtimeDefinition () {
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
}
