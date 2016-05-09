import { moduleRecordFor, metadata, sourceOf } from "./system.js";
import {
  instrumentSourceOfEsmModuleLoad,
  instrumentSourceOfGlobalModuleLoad
} from "./instrumentation.js";
import { scheduleModuleExportsChange } from "./import-export.js";
import { recordModuleChange } from "./notify.js";

export { moduleSourceChange, moduleSourceChangeAction }

function moduleSourceChangeAction(System, moduleName, changeFunc) {
  return sourceOf(System, moduleName)
          .then(changeFunc)
          .then(newSource => moduleSourceChange(System, moduleName, newSource, {evaluate: true}));
}
export { moduleSourceChange, moduleSourceChangeAction }

function moduleSourceChangeAction(System, moduleName, changeFunc) {
  return sourceOf(System, moduleName)
          .then(changeFunc)
          .then(newSource => moduleSourceChange(System, moduleName, newSource, {evaluate: true}));
}
export { moduleSourceChange, moduleSourceChangeAction }

function moduleSourceChangeAction(System, moduleName, changeFunc) {
  return sourceOf(System, moduleName)
          .then(changeFunc)
          .then(newSource => moduleSourceChange(System, moduleName, newSource, {evaluate: true}));
}

function moduleSourceChange(System, moduleName, newSource, options) {
  var oldSource, moduleId;
  return System.normalize(moduleName)
    .then(id => moduleId = id)
    .then(() => sourceOf(System, moduleId).then(source => oldSource = source))
    .then(() => {
      var meta = metadata(System, moduleId);
      switch (meta ? meta.format : undefined) {
        case 'es6': case 'esm': case undefined:
          return moduleSourceChangeEsm(System, moduleId, newSource, options);

        case 'global':
          return moduleSourceChangeGlobal(System, moduleId, newSource, options);

        default:
          throw new Error(`moduleSourceChange is not supported for module ${moduleId} with format `)
      }
    })
    .then(result => {
      recordModuleChange(System, moduleId, oldSource, newSource, null, options, Date.now());
      return result;
    }, error => {
      recordModuleChange(System, moduleId, oldSource, newSource, error, options, Date.now());
      throw error;
    });
}

function moduleSourceChangeEsm(System, moduleId, newSource, options) {
  var debug = System["__lively.modules__"].debug,
      load = {
        status: 'loading',
        source: newSource,
        name: moduleId,
        address: moduleId,
        linkSets: [],
        dependencies: [],
        metadata: {format: "esm"}
      };

  return (System.get(moduleId) ? Promise.resolve() : System.import(moduleId))

    // translate the source and produce a {declare: FUNCTION, localDeps:
    // [STRING]} object
    .then((_) => instrumentSourceOfEsmModuleLoad(System, load))

    .then(updateData => {
      // evaluate the module source
      var _exports = (name, val) => scheduleModuleExportsChange(System, load.name, name, val),
          declared = updateData.declare(_exports);
      System["__lively.modules__"].evaluationDone(load.name);

      debug && console.log("[lively.vm es6] sourceChange of %s with deps", load.name, updateData.localDeps);

      // ensure dependencies are loaded
      return Promise.all(
        // gather the data we need for the update, this includes looking up the
        // imported modules and getting the module record and module object as
        // a fallback (module records only exist for esm modules)
        updateData.localDeps.map(depName =>
          System.normalize(depName, load.name)
            .then(depFullname => {
                var depModule = System.get(depFullname),
                    record = moduleRecordFor(System, depFullname);
                return depModule && record ?
                  {name: depName, fullname: depFullname, module: depModule, record: record} :
                  System.import(depFullname).then((module) => ({
                    name: depName,
                    fullname: depFullname,
                    module: System.get(depFullname) || module,
                    record: moduleRecordFor(System, depFullname)
                  }));
            })))

      .then(deps => {
        // 1. update dependencies
        var record = moduleRecordFor(System, load.name);
        if (record) record.dependencies = deps.map(ea => ea.record);

        // hmm... for house keeping... not really needed right now, though
        var prevLoad = System.loads && System.loads[load.name];
        if (prevLoad) {
          prevLoad.deps = deps.map(ea => ea.name);
          prevLoad.depMap = deps.reduce((map, dep) => { map[dep.name] = dep.fullname; return map; }, {});
          if (prevLoad.metadata && prevLoad.metadata.entry) {
            prevLoad.metadata.entry.deps = prevLoad.deps;
            prevLoad.metadata.entry.normalizedDeps = deps.map(ea => ea.fullname);
            prevLoad.metadata.entry.declare = updateData.declare;
          }
        }
        // 2. run setters to populate imports
        deps.forEach((d,i) => declared.setters[i](d.module));
        // 3. execute module body
        return declared.execute();
      });
    });
}

function moduleSourceChangeGlobal(System, moduleId, newSource, options) {
  var load = {
    status: 'loading',
    source: newSource,
    name: moduleId,
    address: moduleId,
    linkSets: [],
    dependencies: [],
    metadata: {format: "global"}
  };

  return (System.get(moduleId) ? Promise.resolve() : System.import(moduleId))

    // translate the source and produce a {declare: FUNCTION, localDeps:
    // [STRING]} object
    .then((_) => instrumentSourceOfGlobalModuleLoad(System, load))

    .then(updateData => {
      load.source = updateData.translated;
      var entry = doInstantiateGlobalModule(System, load);
      System.delete(moduleId);
      System.set(entry.name, entry.esModule)
      return entry.module;
    });
}

function doInstantiateGlobalModule(System, load) {

  var entry = __createEntry();
  entry.name = load.name;
  entry.esmExports = true;
  load.metadata.entry = entry;

  entry.deps = [];

  for (var g in load.metadata.globals) {
    var gl = load.metadata.globals[g];
    if (gl)
      entry.deps.push(gl);
  }

  entry.execute = function executeGlobalModule(require, exports, module) {

    // SystemJS exports detection for global modules is based in new props
    // added to the global. In order to allow re-load we remove previously
    // "exported" values
    var prevMeta = metadata(System, module.id),
        exports = prevMeta && prevMeta.entry
               && prevMeta.entry.module && prevMeta.entry.module.exports;
    if (exports)
      Object.keys(exports).forEach(name => {
        try { delete System.global[name]; } catch (e) {
          console.warn(`[lively.modules] executeGlobalModule: Cannot delete global["${name}"]`)
        }
      });

    var globals;
    if (load.metadata.globals) {
      globals = {};
      for (var g in load.metadata.globals)
        if (load.metadata.globals[g])
          globals[g] = require(load.metadata.globals[g]);
    }

    var exportName = load.metadata.exports;

    if (exportName)
      load.source += `\nSystem.global["${exportName}"] = ${exportName};`

    var retrieveGlobal = System.get('@@global-helpers').prepareGlobal(module.id, exportName, globals);

    __evaluateGlobalLoadSource(System, load);

    return retrieveGlobal();
  }

  return runExecuteOfGlobalModule(System, entry);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function __createEntry() {
  return {
    name: null,
    deps: null,
    originalIndices: null,
    declare: null,
    execute: null,
    executingRequire: false,
    declarative: false,
    normalizedDeps: null,
    groupIndex: null,
    evaluated: false,
    module: null,
    esModule: null,
    esmExports: false
  };
}

function __evaluateGlobalLoadSource(System, load) {
  // System clobbering protection (mostly for Traceur)
  var curLoad, curSystem, callCounter = 0, __global = System.global;
  return __exec.call(System, load);

  function preExec(loader, load) {
    if (callCounter++ == 0)
      curSystem = __global.System;
    __global.System = __global.SystemJS = loader;
  }

  function postExec() {
    if (--callCounter == 0)
      __global.System = __global.SystemJS = curSystem;
    curLoad = undefined;
  }

  function __exec(load) {
    // if ((load.metadata.integrity || load.metadata.nonce) && supportsScriptExec)
    //   return scriptExec.call(this, load);
    try {
      preExec(this, load);
      curLoad = load;
      (0, eval)(load.source);
      postExec();
    }
    catch (e) {
      postExec();
      throw new Error(`Error evaluating ${load.address}:\n${e.stack}`);
    }
  };
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function runExecuteOfGlobalModule(System, entry) {
  // if (entry.module) return;

  var exports = {},
      module = entry.module = {exports: exports, id: entry.name};

  // // AMD requires execute the tree first
  // if (!entry.executingRequire) {
  //   for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
  //     var depName = entry.normalizedDeps[i];
  //     var depEntry = loader.defined[depName];
  //     if (depEntry)
  //       linkDynamicModule(depEntry, loader);
  //   }
  // }

  // now execute
  entry.evaluated = true;
  var output = entry.execute.call(System.global, function(name) {
    var dep = entry.deps.find(dep => dep === name),
        loadedDep = (dep && System.get(entry.normalizedDeps[entry.deps.indexOf(dep)]))
                 || System.get(System.normalizeSync(name, entry.name));
    if (loadedDep) return loadedDep;
    throw new Error('Module ' + name + ' not declared as a dependency of ' + entry.name);
  }, exports, module);

  if (output)
    module.exports = output;

  // create the esModule object, which allows ES6 named imports of dynamics
  exports = module.exports;

  // __esModule flag treats as already-named
  var Module = System.get("@system-env").constructor;
  if (exports && (exports.__esModule || exports instanceof Module))
    entry.esModule = exports;
  // set module as 'default' export, then fake named exports by iterating properties
  else if (entry.esmExports && exports !== System.global)
    entry.esModule = System.newModule(exports);
  // just use the 'default' export
  else
    entry.esModule = { 'default': exports };

  return entry;
}
