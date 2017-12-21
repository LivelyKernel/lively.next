/*global System*/
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// lookup exports of modules
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { arr, fun, obj } from "lively.lang";
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
    return exports.find(({local, moduleId}) => {
      var m = module(_System, moduleId),
          values = m.recorder || _System.get(m.id) || {};
      try { return values[local] === value; } catch (e) { return false; }
    });
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
        livelyEnv = System.get("@lively-env") || {},
        mods = Object.keys(livelyEnv.loadedModules || {}),
        cache = this.exportByModuleCache,
        exportsByModule = {},
        progressLogger = i => {
          if (i % 50 < 1) options.progress.step("Scanning ...", i / mods.length)
        };
    await Promise.all(
      mods.map((moduleId, i) => {
        if (options.progress) progressLogger(i);
        this.rawExportsOfModule(moduleId, options, exportsByModule).then(
          result => (result ? (exportsByModule[moduleId] = result) : null))}));

    return exportsByModule;
  }

  async rawExportsOfModule(moduleId, opts = {}) {
    let {System, exportByModuleCache: cache} = this,
        excludedPackages = opts.excludedPackages || [],
        excludedURLs = opts.excludedURLs
                    || (opts.excludedURLs = excludedPackages.filter(ea => typeof ea === "string")),
        excludeFns = opts.excludeFns
                  || (opts.excludeFns = excludedPackages.filter(ea => typeof ea === "function")),
        excludedPackageURLs = opts.excludedPackageURLs
                           || (opts.excludedPackageURLs = excludedURLs.concat(excludedURLs.map(url =>
                                System.decanonicalize(url.replace(/\/?$/, "/")).replace(/\/$/, "")))),
        livelyEnv = opts.livelyEnv || (opts.livelyEnv = System.get("@lively-env") || {}),
        mods = opts.modes || (opts.modes = Object.keys(livelyEnv.loadedModules || {}));

    if (cache[moduleId]) {
      let result = cache[moduleId].rawExports;
      return excludedPackageURLs.includes(result.packageURL)
          || excludeFns.some(fn => fn(result.packageURL))
            ? null : cache[moduleId];
    }

    let mod = module(System, moduleId),
        pathInPackage = mod.pathInPackage(),
        p = mod.package(),
        isMain = p && p.main && pathInPackage === p.main,
        packageURL = p ? p.url : "",
        packageName = p ? p.name : "",
        packageVersion = p ? p.version : "",
        result = {
          moduleId, isMain,
          pathInPackage, packageName, packageURL, packageVersion,
          exports: []
        };

    if (excludedPackageURLs.includes(packageURL)
     || excludeFns.some(fn => fn(packageURL))) return null;

    try {
      var format = mod.format();
      if (["register", "es6", "esm"].includes(format)) {
        result.exports = await mod.exports();
      } else {
        let values = await mod.load();
        result.exports = [];
        for (var key in values) {
          if (key === "__useDefault" || key === "default") continue;
          result.exports.push({exported: key, local: key, type: "id"})
        }
      }
    } catch (err) { result.error = err; }

    return cache[moduleId] = {rawExports: result};
  }

  resolveExportsOfModule(moduleId, exportsByModule, locked = {}) {
    // takes the `rawExports` in `exportsByModule` that was produced by
    // `rawExportsByModule` and resolves all "* from" exports. Extends the
    // `rawExportsByModule` map with a `resolvedExports` property

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
