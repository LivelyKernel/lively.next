// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// lookup exports of modules
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { arr, obj } from "lively.lang";
import { subscribe, unsubscribe } from "lively.notifications";
import module from "./module.js";

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

export default class ExportLookup {

  static forSystem(System) {
    if (!this._forSystemMap) this._forSystemMap = new WeakMap();
    var lookup = this._forSystemMap.get(System);
    if (lookup) return lookup;
    lookup = new this(System);
    this._forSystemMap.set(System, lookup);
    return lookup;
  }

  static run(_System = System, options) {
    return this.forSystem(_System).systemExports(options);
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
  
  async systemExports(options) {
    var exportsByModule = await this.rawExportsByModule(options);
    Object.keys(exportsByModule).forEach(id =>
      this.resolveExportsOfModule(id, exportsByModule))

    return arr.flatmap(Object.keys(exportsByModule),
      id => exportsByModule[id].resolvedExports || exportsByModule[id].rawExports)
  }

  async rawExportsByModule(options) {
    options = options || {}
    var System = this.System,
        excludedPackages = options.excludedPackages || [],
        excludedPackageURLs = excludedPackages.concat(excludedPackages.map(url =>
          System.decanonicalize(url.replace(/\/?$/, "/")).replace(/\/$/, ""))),
        livelyEnv = System.get("@lively-env") || {},
        mods = Object.keys(livelyEnv.loadedModules || {}),
        cache = this.exportByModuleCache,
        exportsByModule = {}

    await Promise.all(mods.map(moduleId => {
      if (cache[moduleId]) {
        var result = cache[moduleId].rawExports;
        return excludedPackageURLs.includes(result.packageURL) ? null :
          exportsByModule[moduleId] = cache[moduleId];
      }

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
          };

      if (excludedPackageURLs.includes(packageURL)) return;

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
