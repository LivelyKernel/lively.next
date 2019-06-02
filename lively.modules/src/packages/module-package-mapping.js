import { arr, promise, obj } from "lively.lang";
import { unsubscribe, subscribe } from "lively.notifications";
import { Package } from './package.js'
import { knownModuleNames } from '../system.js'

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// This deals with which modules are mapped to which packages. There is
// actually not a static ownership of packages to modules but based on the
// currently loaded packages we compute what modules are mapped to which package
// based on the module id / url and the package url. Since it is to expensive
// to compute every time a module wants to know its package or a package its
// modules we have a cache that is invalidated whenever new packages are loaded or
// existing ones removed.

export default class ModulePackageMapping {

  static forSystem(System) {
    var existing = System["__lively.modules__modulePackageMapCache"];
    if (existing) return existing;
    var instance = new this(System);
    System["__lively.modules__modulePackageMapCache"] = instance;
    return instance;
  }

  constructor(System) {
    this.System = System;
    this._notificationHandlers = null;
    this.clearCache();
    this.subscribeToSystemChanges();
  }

  subscribeToSystemChanges() {
    if (this._notificationHandlers) return;
    var S = this.System;
    this._notificationHandlers = [
      subscribe("lively.modules/moduleloaded", evt => this.addModuleIdToCache(evt.module), S),
      subscribe("lively.modules/moduleunloaded", evt => this.removeModuleFromCache(evt.module), S),
      subscribe("lively.modules/packageregistered", evt => this.clearCache(), S),
      subscribe("lively.modules/packageremoved", evt => this.clearCache(), S)
    ];
  }

  unsubscribeFromSystemChanges() {
    if (!this._notificationHandlers) return;
    var S = this.System;
    unsubscribe("lively.modules/moduleloaded",      this._notificationHandlers[0], S),
    unsubscribe("lively.modules/moduleunloaded",    this._notificationHandlers[1], S),
    unsubscribe("lively.modules/packageregistered", this._notificationHandlers[2], S),
    unsubscribe("lively.modules/packageremoved",    this._notificationHandlers[3], S)
    this._notificationHandlers = null;
  }

  clearCache() {
    this._cacheInitialized = false;
    this.packageToModule = {};
    this.modulesToPackage = {};
    this.modulesWithoutPackage = {};
  }

  ensureCache() {
    // The cache is invalidated when packages are added or removed.
    // If a new module gets loaded it is added to the caches.
    // When a module gets removed it is also removed from both maps.
    let {
      System,
      _cacheInitialized,
      packageToModule,
      modulesToPackage,
      modulesWithoutPackage
    } = this;

    if (_cacheInitialized) return this;

    let packageNames = Package.allPackageURLs(System);

    for (let j = 0; j < packageNames.length; j++)
      packageToModule[packageNames[j]] = [];

    // bulk load the cache
    let modules = knownModuleNames(System);
    for (let i = 0; i < modules.length; i++) {
      let moduleId = modules[i], itsPackage;
      for (let j = 0; j < packageNames.length; j++) {
        let packageName = packageNames[j];
        if (moduleId.startsWith(packageName)
         && (!itsPackage || itsPackage.length < packageName.length))
           itsPackage = packageName;
      }
      if (!itsPackage) {
        modulesWithoutPackage[moduleId] = {};
      } else {
        packageToModule[itsPackage].push(moduleId);
        modulesToPackage[moduleId] = itsPackage;
      }
    }

    this._cacheInitialized = true;

    return this;
  }

  addModuleIdToCache(moduleId) {
    this.ensureCache();
    let {packageToModule, modulesToPackage, modulesWithoutPackage} = this;
    if (modulesToPackage[moduleId]) return modulesToPackage[moduleId];
    if (modulesWithoutPackage[moduleId]) return null;

    let packageNames = Object.keys(packageToModule), itsPackage;
    for (let j = 0; j < packageNames.length; j++) {
      let packageName = packageNames[j];
      if (moduleId.startsWith(packageName)
       && (!itsPackage || itsPackage.length < packageName.length))
         itsPackage = packageName;
    }
    if (!itsPackage) {
      modulesWithoutPackage[moduleId] = {};
      return null;
    } else {
      let modules = packageToModule[itsPackage] || (packageToModule[itsPackage] = []);
      modules.push(moduleId);
      return modulesToPackage[moduleId] = itsPackage;
    }
  }

  removeModuleFromCache(moduleId) {
    if (!this._cacheInitialized) return;
    let {packageToModule, modulesToPackage, modulesWithoutPackage} = this;
    if (modulesWithoutPackage.hasOwnProperty(moduleId)) {
      delete modulesWithoutPackage[moduleId];
      return;
    }
    var itsPackage = modulesToPackage[moduleId];
    if (!itsPackage) return;
    delete modulesToPackage[moduleId];
    if (packageToModule[itsPackage])
      arr.remove(packageToModule[itsPackage], moduleId);
  }

  getPackageURLForModuleId(moduleId) {
    return this.modulesToPackage[moduleId] || this.addModuleIdToCache(moduleId);
  }

  getModuleIdsForPackageURL(packageURL) {
    this.ensureCache();
    return this.packageToModule[packageURL] || [];
  }

}
