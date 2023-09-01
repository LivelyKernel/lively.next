
import { emit } from 'lively.notifications';
import {
  instrumentSourceOfEsmModuleLoad,
  instrumentSourceOfGlobalModuleLoad
} from './instrumentation.js';
import { scheduleModuleExportsChange } from './import-export.js';
import { classHolder } from './cycle-breaker.js';

async function moduleSourceChangeEsm (System, moduleId, newSource, options) {
  let debug = System.debug;
  let load = {
    status: 'loading',
    source: newSource,
    name: moduleId,
    address: moduleId,
    linkSets: [],
    dependencies: [],
    metadata: { format: 'esm' }
  };

  // translate the source and produce a {declare: FUNCTION, localDeps:
  // [STRING]} object
  let updateData = await instrumentSourceOfEsmModuleLoad(System, load);

  // evaluate the module source, to get the register module object with execute
  // and setters fields
  let _exports = (name, val) => scheduleModuleExportsChange(System, load.name, name, val, true);
  let declared = updateData.declare(_exports);

  debug && console.log('[lively.vm es6] sourceChange of %s with deps', load.name, updateData.localDeps);

  // ensure dependencies are loaded
  let deps = [];
  for (let depName of updateData.localDeps) {
    // gather the data we need for the update, this includes looking up the
    // imported modules and getting the module record and module object as
    // a fallback (module records only exist for esm modules)
    let depId = await System.normalize(depName, load.name);
    let depModule = classHolder.module(System, depId);
    let exports = await depModule.load();
    deps.push({ name: depName, fullname: depId, module: depModule, exports });
  }

  // hmm... for house keeping... not really needed right now, though
  let prevLoad = System.loads && System.loads[load.name];
  if (prevLoad) {
    prevLoad.deps = deps.map(ea => ea.name);
    prevLoad.depMap = deps.reduce((map, dep) => { map[dep.name] = dep.fullname; return map; }, {});
    if (prevLoad.metadata && prevLoad.metadata.entry) {
      prevLoad.metadata.entry.deps = prevLoad.deps;
      prevLoad.metadata.entry.normalizedDeps = deps.map(ea => ea.fullname);
      prevLoad.metadata.entry.declare = updateData.declare;
    }
  }

  let mod = classHolder.module(System, load.name);
  let record = mod.record();

  // 1. update the record so that when its dependencies change and cause a
  // re-execute, the correct code (new version) is run
  deps.forEach((ea, i) => mod.addDependencyToModuleRecord(ea.module, declared.setters[i]));
  if (record) record.execute = declared.execute;

  // 2. run setters to populate imports
  deps.forEach((d, i) => declared.setters[i](d.exports));

  // 3. execute module body
  return declared.execute();
}

function doInstantiateGlobalModule (System, load) {
  let entry = __createEntry(); // eslint-disable-line no-use-before-define
  entry.name = load.name;
  entry.esmExports = true;
  load.metadata.entry = entry;

  entry.deps = [];

  for (let g in load.metadata.globals) {
    let gl = load.metadata.globals[g];
    if (gl) { entry.deps.push(gl); }
  }

  entry.execute = function executeGlobalModule (require, exports, m) {
    // SystemJS exports detection for global modules is based in new props
    // added to the global. In order to allow re-load we remove previously
    // "exported" values
    let prevMeta = classHolder.module(System, m.id).metadata();
    exports = prevMeta && prevMeta.entry &&
               prevMeta.entry.module && prevMeta.entry.module.exports;
    if (exports) {
      Object.keys(exports).forEach(name => {
        try { delete System.global[name]; } catch (e) {
          console.warn(`[lively.modules] executeGlobalModule: Cannot delete global["${name}"]`);
        }
      });
    }

    let globals;
    if (load.metadata.globals) {
      globals = {};
      for (let g in load.metadata.globals) {
        if (load.metadata.globals[g]) { globals[g] = require(load.metadata.globals[g]); }
      }
    }

    let exportName = load.metadata.exports;

    if (exportName) { load.source += `\nSystem.global["${exportName}"] = ${exportName};`; }

    let retrieveGlobal = System.get('@@global-helpers').prepareGlobal(m.id, exportName, globals);

    __evaluateGlobalLoadSource(System, load); // eslint-disable-line no-use-before-define

    return retrieveGlobal();
  };

  return runExecuteOfGlobalModule(System, entry); // eslint-disable-line no-use-before-define
}

async function moduleSourceChangeGlobal (System, moduleId, newSource, options) {
  let load = {
    status: 'loading',
    source: newSource,
    name: moduleId,
    address: moduleId,
    linkSets: [],
    dependencies: [],
    metadata: { format: 'global' }
  };

  if (!System.get(moduleId)) await System.import(moduleId);

  // translate the source and produce a {declare: FUNCTION, localDeps: [STRING]} object
  let updateData = await instrumentSourceOfGlobalModuleLoad(System, load);

  load.source = updateData.translated;
  let entry = doInstantiateGlobalModule(System, load);
  System.delete(moduleId);
  System.set(entry.name, entry.esModule);
  return entry.module;
}

async function moduleSourceChange (System, moduleId, newSource, format, options) {
  try {
    let changeResult;
    System.debug && console.log(`[module change] ${moduleId} ${newSource.slice(0, 50).replace(/\n/g, '')} ${format}`);

    if (!format || format === 'es6' || format === 'esm' || format === 'register' || format === 'defined') {
      changeResult = await moduleSourceChangeEsm(System, moduleId, newSource, options);
    } else if (format === 'global') {
      changeResult = await moduleSourceChangeGlobal(System, moduleId, newSource, options);
    } else {
      throw new Error(`moduleSourceChange is not supported for module ${moduleId} with format ${format}`);
    }

    emit('lively.modules/modulechanged', { module: moduleId, newSource, options }, Date.now(), System);

    return changeResult;
  } catch (error) {
    emit('lively.modules/modulechanged', { module: moduleId, newSource, error, options }, Date.now(), System);
    throw error;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function __createEntry () {
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

function __evaluateGlobalLoadSource (System, load) {
  // System clobbering protection (mostly for Traceur)
  let curSystem; let callCounter = 0; let __global = System.global;
  return __exec.call(System, load); // eslint-disable-line no-use-before-define

  function preExec (loader, load) {
    if (callCounter++ === 0) { curSystem = __global.System; }
    __global.System = __global.SystemJS = loader;
  }

  function postExec () {
    if (--callCounter === 0) { __global.System = __global.SystemJS = curSystem; }
  }

  function __exec (load) {
    // if ((load.metadata.integrity || load.metadata.nonce) && supportsScriptExec)
    //   return scriptExec.call(this, load);
    try {
      preExec(this, load);
      (0, eval)(load.source);
      postExec();
    } catch (e) {
      postExec();
      throw new Error(`Error evaluating ${load.address}:\n${e.stack}`);
    }
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function runExecuteOfGlobalModule (System, entry) {
  // if (entry.module) return;

  let exports = {};
  let module = entry.module = { exports: exports, id: entry.name };

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
  let output = entry.execute.call(System.global, function (name) {
    let dep = entry.deps.find(dep => dep === name);
    let loadedDep = (dep && System.get(entry.normalizedDeps[entry.deps.indexOf(dep)])) ||
                 System.get(System.decanonicalize(name, entry.name));
    if (loadedDep) return loadedDep;
    throw new Error('Module ' + name + ' not declared as a dependency of ' + entry.name);
  }, exports, module);

  if (output) { module.exports = output; }

  // create the esModule object, which allows ES6 named imports of dynamics
  exports = module.exports;

  // __esModule flag treats as already-named
  let Module = Object.getPrototypeOf(System.get('@system-env'));
  if (exports && (exports.__esModule || Object.getPrototypeOf(exports) === Module)) entry.esModule = exports;
  // set module as 'default' export, then fake named exports by iterating properties
  else if (entry.esmExports && exports !== System.global) entry.esModule = System.newModule(exports);
  // just use the 'default' export
  else entry.esModule = { default: exports };

  return entry;
}

export { moduleSourceChange };
