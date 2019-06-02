import { arr }  from "lively.lang";
import { emit } from "lively.notifications";
import module from "./module.js";
import {
  instrumentSourceOfEsmModuleLoad,
  instrumentSourceOfGlobalModuleLoad
} from "./instrumentation.js";
import { scheduleModuleExportsChange } from "./import-export.js";

async function moduleSourceChange(System, moduleId, newSource, format, options) {
  try {
    var changeResult;
    System.debug && console.log(`[module change] ${moduleId} ${newSource.slice(0,50).replace(/\n/g, "")} ${format}`)

    if (!format || format === "es6" || format === "esm" || format === "register" || format === "defined") {
      changeResult = await moduleSourceChangeEsm(System, moduleId, newSource, options);
    } else if (format === "global") {
      changeResult = await moduleSourceChangeGlobal(System, moduleId, newSource, options);
    } else {
      throw new Error(`moduleSourceChange is not supported for module ${moduleId} with format ${format}`);
    }
    
    emit("lively.modules/modulechanged", {
      module: moduleId, newSource, options }, Date.now(), System);
    
    return changeResult;
  } catch (error) {
    emit("lively.modules/modulechanged", {
      module: moduleId, newSource, error, options }, Date.now(), System);
    throw error;
  }
}

async function moduleSourceChangeEsm(System, moduleId, newSource, options) {
  var debug = System.debug,
      load = {
        status: 'loading',
        source: newSource,
        name: moduleId,
        address: moduleId,
        linkSets: [],
        dependencies: [],
        metadata: {format: "esm"}
      };

  // translate the source and produce a {declare: FUNCTION, localDeps:
  // [STRING]} object
  var updateData = await instrumentSourceOfEsmModuleLoad(System, load);

  // evaluate the module source, to get the register module object with execute
  // and setters fields
  var _exports = (name, val) => scheduleModuleExportsChange(System, load.name, name, val, true),
      declared = updateData.declare(_exports);

  debug && console.log("[lively.vm es6] sourceChange of %s with deps", load.name, updateData.localDeps);


  // ensure dependencies are loaded
  var deps = [];
  for (let depName of updateData.localDeps) {
    // gather the data we need for the update, this includes looking up the
    // imported modules and getting the module record and module object as
    // a fallback (module records only exist for esm modules)
    let depId = await System.normalize(depName, load.name),
        depModule = module(System, depId),
        exports = await depModule.load();
    deps.push({name: depName, fullname: depId, module: depModule, exports});
  }

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

  var mod = module(System, load.name),
      record = mod.record();

  // 1. update the record so that when its dependencies change and cause a
  // re-execute, the correct code (new version) is run
  deps.forEach((ea, i) => mod.addDependencyToModuleRecord(ea.module, declared.setters[i]));
  if (record) record.execute = declared.execute;

  // 2. run setters to populate imports
  deps.forEach((d,i) => declared.setters[i](d.exports));

  // 3. execute module body
  return declared.execute();
}

async function moduleSourceChangeGlobal(System, moduleId, newSource, options) {
  var load = {
    status: 'loading',
    source: newSource,
    name: moduleId,
    address: moduleId,
    linkSets: [],
    dependencies: [],
    metadata: {format: "global"}
  };

  if (!System.get(moduleId)) await System["import"](moduleId);

  // translate the source and produce a {declare: FUNCTION, localDeps: [STRING]} object
  var updateData = await instrumentSourceOfGlobalModuleLoad(System, load);

  load.source = updateData.translated;
  var entry = doInstantiateGlobalModule(System, load);
  System.delete(moduleId);
  System.set(entry.name, entry.esModule)
  return entry.module;
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

  entry.execute = function executeGlobalModule(require, exports, m) {

    // SystemJS exports detection for global modules is based in new props
    // added to the global. In order to allow re-load we remove previously
    // "exported" values
    var prevMeta = module(System, m.id).metadata(),
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
                 || System.get(System.decanonicalize(name, entry.name));
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

export { moduleSourceChange };
