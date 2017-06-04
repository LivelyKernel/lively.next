import {
  interactivelyCreatePackage,
  interactivelyLoadPackage,
  interactivelyReloadPackage,
  interactivelyUnloadPackage,
  interactivelyRemovePackage,
  showExportsAndImportsOf
} from "./commands/packages.js";

import {
  shortModuleName,
  interactivelyChangeModule,
  interactivelyReloadModule,
  interactivelyUnloadModule,
  interactivelyRemoveModule,
  interactivelyAddModule,
  modulesInPackage
} from "./commands/modules.js";

import { LocalCoreInterface } from "./interfaces/local-system.js";

export class Interface {

  constructor(coreInterface) {
    this.coreInterface = coreInterface;
  }

  get isSystemInterface() { return true; }

  get name() { return this.coreInterface.name; }

  dynamicCompletionsForPrefix(mod, prefix, opts) { return this.coreInterface.dynamicCompletionsForPrefix(mod, prefix, opts); }
  runEval(source, options)                       { return this.coreInterface.runEval(source, options); }
  printSystemConfig(a, b, c)                     { return this.coreInterface.printSystemConfig(a, b, c); }
  getConfig(a, b, c)                             { return this.coreInterface.getConfig(a, b, c); }
  getPackages(options)                           { return this.coreInterface.getPackages(options); }
  getModules(a, b, c)                            { return this.coreInterface.getModules(a, b, c); }
  getModule(a, b, c)                             { return this.coreInterface.getModule(a, b, c); }
  getPackage(a, b, c)                            { return this.coreInterface.getPackage(a, b, c); }
  getPackageForModule(a, b, c)                   { return this.coreInterface.getPackageForModule(a, b, c); }
  resourcesOfPackage(packageAddress, excludes)   { return this.coreInterface.resourcesOfPackage(packageAddress, excludes); }
  systemConfChange(a, b, c)                      { return this.coreInterface.systemConfChange(a, b, c); }

  registerPackage(packageURL) { return this.coreInterface.registerPackage(packageURL); }
  importPackage(packageURL) { return this.coreInterface.importPackage(packageURL); }
  removePackage(packageURL) { return this.coreInterface.removePackage(packageURL); }
  reloadPackage(packageURL) { return this.coreInterface.reloadPackage(packageURL); }
  packageConfChange(source, confFile) { return this.coreInterface.packageConfChange(source, confFile); }
  keyValueListOfVariablesInModule(moduleName, sourceOrAst) { return this.coreInterface.keyValueListOfVariablesInModule(moduleName, sourceOrAst); }

  interactivelyCreatePackage(requester) { return interactivelyCreatePackage(this.coreInterface, requester); }
  interactivelyLoadPackage(a, b)   { return interactivelyLoadPackage(this.coreInterface, a, b); }
  interactivelyReloadPackage(a, b) { return interactivelyReloadPackage(this.coreInterface, a, b); }
  interactivelyUnloadPackage(vmEditor, packageURL, world) { return interactivelyUnloadPackage(this.coreInterface, vmEditor, packageURL, world); }
  interactivelyRemovePackage(requester, pkgURL) { return interactivelyRemovePackage(this.coreInterface, requester, pkgURL); }

  isModuleLoaded(name, isNormalized) { return this.coreInterface.isModuleLoaded(name, isNormalized); }
  doesModuleExist(name, isNormalized) { return this.coreInterface.doesModuleExist(name, isNormalized); }
  importModule(name)         { return this.coreInterface.importModule(name); }
  forgetModule(name, opts)   { return this.coreInterface.forgetModule(name, opts); }
  reloadModule(name, opts)   { return this.coreInterface.reloadModule(name, opts); }
  moduleFormat(name)         { return this.coreInterface.moduleFormat(name); }
  moduleRead(name)           { return this.coreInterface.moduleRead(name); }
  moduleWrite(name, content) { return this.coreInterface.moduleWrite(name, content); }
  getModulesInPackage(name)  { return modulesInPackage(this.coreInterface, name); }

  shortModuleName(moduleId, itsPackage)                               { return shortModuleName(this.coreInterface, moduleId, itsPackage); }
  interactivelyChangeModule(moduleName, newSource, options)           { return interactivelyChangeModule(this.coreInterface, moduleName, newSource, options); }
  interactivelyReloadModule(vmEditor, moduleName)                     { return interactivelyReloadModule(this.coreInterface, vmEditor, moduleName); }
  interactivelyUnloadModule(vmEditor, moduleName)                     { return interactivelyUnloadModule(this.coreInterface, vmEditor, moduleName); }
  interactivelyRemoveModule(requester, moduleName)                    { return interactivelyRemoveModule(this.coreInterface, requester, moduleName); }
  interactivelyAddModule(requester, relatedPackageOrModule)           { return interactivelyAddModule(this.coreInterface, requester, relatedPackageOrModule); }

  showExportsAndImportsOf(packageAddress, world) { return showExportsAndImportsOf(this.coreInterface, packageAddress, world); }
  exportsOfModules(options) { return this.coreInterface.exportsOfModules(options); }

  // -=-=-=-
  // search
  // -=-=-=-
  searchInPackage(packageURL, searchTerm, options) {
    return this.coreInterface.searchInPackage(packageURL, searchTerm, options);
  }

  async searchInAllPackages(searchTerm, options = {}) {
    var packages = await this.coreInterface.getPackages({excluded: options.excludedPackages}),
        results = [];
    for (let {url} of packages) {
      if (!url || url === "no group"/*FIXME*/) continue;
      try {
        var packageResults = await this.coreInterface.searchInPackage(url, searchTerm, options)
        results = results.concat(packageResults);
      } catch (e) { console.error(`Error searching in package ${url}:\n${e.stack}`); }
    }
    return results;
  }
  
  // -=-=-=-=-
  // testing
  // -=-=-=-=-
  loadMochaTestFile(file, testsByFile) {
    return this.coreInterface.loadMochaTestFile(file, testsByFile);
  }
  runMochaTests(grep, testsByFile, onChange, onError) {
    return this.coreInterface.runMochaTests(grep, testsByFile, onChange, onError);
  }

}

export var localInterface = new Interface(new LocalCoreInterface());
