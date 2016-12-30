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

// ExportLookup.unsubscribeFromSystemChanges()
// ExportLookup.exportByModuleCache

export class ExportLookup {

  static get exportByModuleCache() {
    return this._exportByModuleCache || (this._exportByModuleCache = {});
  }

  static clearCacheFor(moduleId) {
    this.exportByModuleCache[moduleId] = null;
  }

  static subscribeToSystemChanges() {
    if (this._notificationHandlers) return;
    this._notificationHandlers = [
      subscribe("lively.modules/moduleloaded", evt => this.clearCacheFor(evt.module)),
      subscribe("lively.modules/modulechanged", evt => this.clearCacheFor(evt.module)),
      subscribe("lively.vm/doitresult", evt => this.clearCacheFor(evt.targetModule))
    ]
  }

  static unsubscribeFromSystemChanges() {
    if (!this._notificationHandlers) return;
    unsubscribe("lively.modules/moduleloaded", this._notificationHandlers[0]);
    unsubscribe("lively.modules/modulechanged", this._notificationHandlers[1]);
    unsubscribe("lively.vm/doitresult", this._notificationHandlers[2]);
    this._notificationHandlers = null;
  }

  static run(System) {
    this.subscribeToSystemChanges();
    return new this().systemExports(System);
  }

  async systemExports(System) {
    var exportsByModule = await this.rawExportsByModule(System);
    Object.keys(exportsByModule).forEach(id =>
      this.resolveExportsOfModule(System, id, exportsByModule))

    return arr.flatmap(Object.keys(exportsByModule),
      id => exportsByModule[id].resolvedExports || exportsByModule[id].rawExports)
  }

  async rawExportsByModule(System) {
    var livelyEnv = System.get("@lively-env") || {},
        mods = Object.keys(livelyEnv.loadedModules || {}),
        cache = ExportLookup.exportByModuleCache,
        exportsByModule = {}

    await Promise.all(mods.map(moduleId => {
      if (cache[moduleId]) return exportsByModule[moduleId] = cache[moduleId];

      var mod = lively.modules.module(moduleId),
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

  resolveExportsOfModule(System, moduleId, exportsByModule, locked = {}) {
    // takes the `rawExports` in `exportsByModule` that was produced by
    // `rawExportsByModule` and resolves all "* from" exports. Extends the
    // `rawExportsByModule` map woth a `resolvedExports` property

    // prevent endless recursion
    if (locked[moduleId]) return;
    locked[moduleId] = true;

    var data = exportsByModule[moduleId];
    if (!data || data.resolvedExports) return;

    var base = obj.select(data.rawExports, [
      "moduleId", "isMain", "packageName", "packageURL",
      "packageVersion", "pathInPackage"]);

    data.resolvedExports = arr.flatmap(data.rawExports.exports, ({type, exported, local, fromModule}) => {
      if (type !== "all") return [{...base, type, exported, local, fromModule}];

      // resolve "* from"
      var fromId = System.decanonicalize(fromModule, moduleId);
      this.resolveExportsOfModule(System, fromId, exportsByModule, locked);
      return (exportsByModule[fromId].resolvedExports || []).map(resolvedExport => {
        var {type, exported, local, fromModule: resolvedFromModule} = resolvedExport;
        return {...base, type, exported, local, fromModule: resolvedFromModule || fromModule};
      })
    });

    locked[moduleId] = false;
  }
}
