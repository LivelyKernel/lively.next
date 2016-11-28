import { arr, obj } from "lively.lang";

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

export class ExportLookup {

  static run(System) {
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
        exportsByModule = {}

    await Promise.all(mods.map(async moduleId => {
      var mod = lively.modules.module(moduleId),
          pathInPackage = mod.pathInPackage().replace(/^\.\//, ""),
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
      try { result.exports = await mod.exports(); } catch(e) { result.error = e;  }
      exportsByModule[moduleId] = {rawExports: result};
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
