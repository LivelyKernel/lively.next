/* global System */
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// lookup exports of modules
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { obj } from 'lively.lang';
import { subscribe, unsubscribe } from 'lively.notifications';
import module from './module.js';

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
  static forSystem (System) {
    if (!this._forSystemMap) this._forSystemMap = new WeakMap();
    let lookup = this._forSystemMap.get(System);
    if (lookup) return lookup;
    lookup = new this(System);
    this._forSystemMap.set(System, lookup);
    return lookup;
  }

  static run (_System = System, options) {
    return this.forSystem(_System).systemExports(options);
  }

  static async findExportOfValue (value, _System = System) {
    let exports = await this.run(_System);
    return exports.find(({ local, moduleId }) => {
      let m = module(_System, moduleId);
      let values = m.recorder || _System.get(m.id) || {};
      try { return values[local] === value; } catch (e) { return false; }
    });
  }

  constructor (System) {
    this.System = System;
    this.subscribeToSystemChanges();
  }

  subscribeToSystemChanges () {
    if (this._notificationHandlers) return;
    let S = this.System;
    this._notificationHandlers = [
      subscribe('lively.modules/moduleloaded', evt => this.clearCacheFor(evt.module), S),
      subscribe('lively.modules/modulechanged', evt => this.clearCacheFor(evt.module), S),
      subscribe('lively.vm/doitresult', evt => this.clearCacheFor(evt.targetModule), S)
    ];
  }

  unsubscribeFromSystemChanges () {
    if (!this._notificationHandlers) return;
    let S = this.System;
    unsubscribe('lively.modules/moduleloaded', this._notificationHandlers[0], S);
    unsubscribe('lively.modules/modulechanged', this._notificationHandlers[1], S);
    unsubscribe('lively.vm/doitresult', this._notificationHandlers[2], S);
    this._notificationHandlers = null;
  }

  get exportByModuleCache () {
    return this._exportByModuleCache || (this._exportByModuleCache = {});
  }

  clearCacheFor (moduleId) {
    this.exportByModuleCache[moduleId] = null;
  }

  async systemExports (options) {
    let exportsByModule = await this.rawExportsByModule(options);
    Object.keys(exportsByModule).forEach(id =>
      this.resolveExportsOfModule(id, exportsByModule));

    return Object.keys(exportsByModule).flatMap(id => exportsByModule[id] ? exportsByModule[id].resolvedExports || exportsByModule[id].rawExports : []);
  }

  async rawExportsByModule (options) {
    options = options || {};
    let System = this.System;
    let livelyEnv = System.get('@lively-env') || {};
    let mods = Object.keys(livelyEnv.loadedModules || {});
    let exportsByModule = {};
    let progressLogger = i => {
      if (i % 50 < 1 && options.progress.step) { options.progress.step('Scanning ...', i / mods.length); }
    };
    await Promise.all(
      mods.map((moduleId, i) => {
        if (options.progress) progressLogger(i);
        return this.rawExportsOfModule(moduleId, options, exportsByModule).then(
          result => (result ? (exportsByModule[moduleId] = result) : null));
      }));

    return exportsByModule;
  }

  async rawExportsOfModule (moduleId, opts = {}) {
    let { System, exportByModuleCache: cache } = this;
    let excludedPackages = opts.excludedPackages || [];
    let excludedURLs = opts.excludedURLs ||
                    (opts.excludedURLs = excludedPackages.filter(ea => typeof ea === 'string'));
    let excludeFns = opts.excludeFns ||
                  (opts.excludeFns = excludedPackages.filter(ea => typeof ea === 'function'));
    let excludedPackageURLs = opts.excludedPackageURLs ||
                           (opts.excludedPackageURLs = excludedURLs.concat(excludedURLs.map(url =>
                             System.decanonicalize(url.replace(/\/?$/, '/')).replace(/\/$/, ''))));

    if (cache[moduleId]) {
      let result = cache[moduleId].rawExports;
      return excludedPackageURLs.includes(result.packageURL) ||
          excludeFns.some(fn => fn(result.packageURL))
        ? null
        : cache[moduleId];
    }

    let mod = module(System, moduleId);
    let pathInPackage = mod.pathInPackage();
    let p = mod.package();
    let isMain = p && p.main && pathInPackage === p.main;
    let packageURL = p ? p.url : '';
    let packageName = p ? p.name : '';
    let packageVersion = p ? p.version : '';
    let result = {
      moduleId,
      isMain,
      pathInPackage,
      packageName,
      packageURL,
      packageVersion,
      exports: []
    };

    if (excludedPackageURLs.includes(packageURL) ||
     excludeFns.some(fn => fn(packageURL))) return null;

    try {
      let format = mod.format();
      if (['register', 'es6', 'esm'].includes(format)) {
        const cached = await System._livelyModulesTranslationCache.fetchStoredModuleSource(mod.id);
        if (cached && cached.exports) result.exports = JSON.parse(cached.exports);
        else result.exports = await mod.exports();
      } else {
        let values = await mod.load();
        result.exports = [];
        for (let key in values) {
          if (key === '__useDefault' || key === 'default') continue;
          result.exports.push({ exported: key, local: key, type: 'id' });
        }
      }
    } catch (err) { result.error = err; }

    return cache[moduleId] = { rawExports: result };
  }

  resolveExportsOfModule (moduleId, exportsByModule, locked = {}) {
    // takes the `rawExports` in `exportsByModule` that was produced by
    // `rawExportsByModule` and resolves all "* from" exports. Extends the
    // `rawExportsByModule` map with a `resolvedExports` property

    // prevent endless recursion
    if (locked[moduleId]) return;
    locked[moduleId] = true;

    let data = exportsByModule[moduleId];
    if (!data || data.resolvedExports) return;
    let System = this.System;
    let base = obj.select(data.rawExports, [
      'moduleId', 'isMain', 'packageName', 'packageURL',
      'packageVersion', 'pathInPackage']);

    data.resolvedExports = data.rawExports.exports.flatMap(({ type, exported, local, fromModule }) => {
      if (type !== 'all') return [{ ...base, type, exported, local, fromModule }];

      // resolve "* from"
      let fromId = System.decanonicalize(fromModule, moduleId);
      this.resolveExportsOfModule(fromId, exportsByModule, locked);
      return (exportsByModule[fromId] && exportsByModule[fromId].resolvedExports || []).map(resolvedExport => {
        let { type, exported, local, fromModule: resolvedFromModule } = resolvedExport;
        return { ...base, type, exported, local, fromModule: resolvedFromModule || fromModule };
      });
    });

    locked[moduleId] = false;
  }
}
