import module from "./module.js"


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Changing exports of module
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function scheduleModuleExportsChange(System, moduleId, name, value, addNewExport) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
      rec = module(System, moduleId).record();
  if (rec && (name in rec.exports || addNewExport)) {
    var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
    pending[name] = value;
  }
}

export function runScheduledExportChanges(System, moduleId) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
      keysAndValues = pendingExportChanges[moduleId];
  if (!keysAndValues) return;
  clearPendingModuleExportChanges(System, moduleId);
  updateModuleExports(System, moduleId, keysAndValues);
}

function clearPendingModuleExportChanges(System, moduleId) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges;
  delete pendingExportChanges[moduleId];
}

function updateModuleExports(System, moduleId, keysAndValues) {
  var debug = System.debug;
  module(System, moduleId).updateRecord((record) => {

    var newExports = [], existingExports = [];

    Object.keys(keysAndValues).forEach(name => {
      var value = keysAndValues[name];
      debug && console.log("[lively.vm es6 updateModuleExports] %s export %s = %s", moduleId, name, String(value).slice(0,30).replace(/\n/g, "") + "...");

      var isNewExport = !(name in record.exports);
      if (isNewExport) record.__lively_modules__.evalOnlyExport[name] = true;
      // var isEvalOnlyExport = record.__lively_vm__.evalOnlyExport[name];
      record.exports[name] = value;

      if (isNewExport) newExports.push(name);
      else existingExports.push(name);
    });

    // if it's a new export we don't need to update dependencies, just the
    // module itself since no depends know about the export...
    // HMM... what about *-imports?
    if (newExports.length) {
      var m = System.get(moduleId);
      if (Object.isFrozen(m)) {
        console.warn("[lively.vm es6 updateModuleExports] Since module %s is frozen a new module object was installed in the system. Note that only(!) exisiting module bindings are updated. New exports that were added will only be available in already loaded modules after those are reloaded!", moduleId);
        System.set(moduleId, System.newModule(record.exports))
      } else {
        debug && console.log("[lively.vm es6 updateModuleExports] adding new exports to %s", moduleId);
        newExports.forEach(name => {
          Object.defineProperty(m, name, {
            configurable: false, enumerable: true,
            get() { return record.exports[name]; },
            set() { throw new Error("exports cannot be changed from the outside") }
          });
        });
      }
    }

    if (existingExports.length) {
      debug && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, moduleId);
      for (var i = 0, l = record.importers.length; i < l; i++) {
        var importerModule = record.importers[i];
        if (!importerModule.locked) {
          // via the module bindings to importer modules we refresh the values
          // bound in those modules by triggering the setters defined in the
          // records of those modules
          var importerIndex,
              found = importerModule.dependencies.some((dep, i) => {
                importerIndex = i;
                return dep && dep.name === record.name
              });

          if (found) {
            if (debug) {
              let mod = module(System, importerModule.name);
              console.log(`[lively.vm es6 updateModuleExports] calling setters of ${mod["package"]().name}/${mod.pathInPackage()}`);
            }

            // We could run the entire module again with
            //   importerModule.execute();
            // but this has too many unwanted side effects, so just run the
            // setters:
            module(System, importerModule.name).evaluationStart();
            importerModule.setters[importerIndex](record.exports);
            module(System, importerModule.name).evaluationEnd();
          }
        }
      }
    }
  });
}



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// lookup exports of modules
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { arr, obj } from "lively.lang";
import { subscribe, unsubscribe } from "lively.notifications";

// Computes exports of all modules
// 
// Returns a list of objects like
// {
//   exported: "Interface",
//   fromModule: null, // if re-exported
//   isMain: true,     // is the exporting module the main module of its package?
//   local: "Interface",
//   moduleId: "http://localhost:9001/node_modules/lively-system-interface/index.js",
//   packageName: "lively-system-interface",
//   packageURL: "http://localhost:9001/node_modules/lively-system-interface",
//   packageVersion: "0.2.0",
//   pathInPackage: "index.js",
//   type: "class"
// }
// 
// Usage
// var exports = await ExportLookup.run(System)
// ExportLookup._forSystemMap.has(System)

export class ExportLookup {

  static forSystem(System) {
    if (!this._forSystemMap) this._forSystemMap = new WeakMap();
    var lookup = this._forSystemMap.get(System);
    if (lookup) return lookup;
    lookup = new this(System);
    this._forSystemMap.set(System, lookup);
    return lookup;
  }

  static run(_System = System) {
    return this.forSystem(_System).systemExports();
  }

  static async findExportOfValue(value, _System = System) {
    var exports = await this.run(_System);
    return exports.find(({local, moduleId}) =>
      module(_System, moduleId).recorder[local] === value);
  }

  constructor(System) {
    this.System = System;
    this.subscribeToSystemChanges();
  }

  subscribeToSystemChanges() {
    if (this._notificationHandlers) return;
    var S = this.System;
    this._notificationHandlers = [
      subscribe("lively.modules/moduleloaded", evt => this.clearCacheFor(evt.module), S),
      subscribe("lively.modules/modulechanged", evt => this.clearCacheFor(evt.module), S),
      subscribe("lively.vm/doitresult", evt => this.clearCacheFor(evt.targetModule), S)
    ]
  }

  unsubscribeFromSystemChanges() {
    if (!this._notificationHandlers) return;
    var S = this.System;
    unsubscribe("lively.modules/moduleloaded", this._notificationHandlers[0], S);
    unsubscribe("lively.modules/modulechanged", this._notificationHandlers[1], S);
    unsubscribe("lively.vm/doitresult", this._notificationHandlers[2], S);
    this._notificationHandlers = null;
  }

  get exportByModuleCache() {
    return this._exportByModuleCache || (this._exportByModuleCache = {});
  }

  clearCacheFor(moduleId) {
    this.exportByModuleCache[moduleId] = null;
  }
  
  async systemExports() {
    var exportsByModule = await this.rawExportsByModule();
    Object.keys(exportsByModule).forEach(id =>
      this.resolveExportsOfModule(id, exportsByModule))

    return arr.flatmap(Object.keys(exportsByModule),
      id => exportsByModule[id].resolvedExports || exportsByModule[id].rawExports)
  }

  async rawExportsByModule() {
    var System = this.System,
        livelyEnv = System.get("@lively-env") || {},
        mods = Object.keys(livelyEnv.loadedModules || {}),
        cache = this.exportByModuleCache,
        exportsByModule = {}

    await Promise.all(mods.map(moduleId => {
      if (cache[moduleId]) return exportsByModule[moduleId] = cache[moduleId];

      var mod = module(System, moduleId),
          pathInPackage = mod.pathInPackage(),
          p = mod.package(),
          isMain = p.main && pathInPackage === p.main,
          packageURL = p.url,
          packageName = p.name,
          packageVersion = p.version,
          result = {
            moduleId, isMain,
            pathInPackage, packageName, packageURL, packageVersion,
            exports: []
          }
      return mod.exports()
        .then(exports => result.exports = exports)
        .catch(e => { result.error = e; return result; })
        .then(() => cache[moduleId] = exportsByModule[moduleId] = {rawExports: result})
    }))

    return exportsByModule;
  }

  resolveExportsOfModule(moduleId, exportsByModule, locked = {}) {
    // takes the `rawExports` in `exportsByModule` that was produced by
    // `rawExportsByModule` and resolves all "* from" exports. Extends the
    // `rawExportsByModule` map woth a `resolvedExports` property

    // prevent endless recursion
    if (locked[moduleId]) return;
    locked[moduleId] = true;

    var data = exportsByModule[moduleId];
    if (!data || data.resolvedExports) return;
    var System = this.System;
    var base = obj.select(data.rawExports, [
      "moduleId", "isMain", "packageName", "packageURL",
      "packageVersion", "pathInPackage"]);

    data.resolvedExports = arr.flatmap(data.rawExports.exports, ({type, exported, local, fromModule}) => {
      if (type !== "all") return [{...base, type, exported, local, fromModule}];

      // resolve "* from"
      var fromId = System.decanonicalize(fromModule, moduleId);
      this.resolveExportsOfModule(fromId, exportsByModule, locked);
      return (exportsByModule[fromId].resolvedExports || []).map(resolvedExport => {
        var {type, exported, local, fromModule: resolvedFromModule} = resolvedExport;
        return {...base, type, exported, local, fromModule: resolvedFromModule || fromModule};
      })
    });

    locked[moduleId] = false;
  }
}
