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
import { HTTPCoreInterface } from "./interfaces/http-interface.js";

export class Interface {

  constructor(coreInterface) {
    this.coreInterface = coreInterface;
  }

  dynamicCompletionsForPrefix(mod, prefix, opts) { return this.coreInterface.dynamicCompletionsForPrefix(mod, prefix, opts); }
  runEval(source, options)                       { return this.coreInterface.runEval(source, options); }
  printSystemConfig(a, b, c)                     { return this.coreInterface.printSystemConfig(a, b, c); }
  getConfig(a, b, c)                             { return this.coreInterface.getConfig(a, b, c); }
  getPackages()                                  { return this.coreInterface.getPackages(); }
  getModules(a, b, c)                            { return this.coreInterface.getModules(a, b, c); }
  getModule(a, b, c)                             { return this.coreInterface.getModule(a, b, c); }
  getPackage(a, b, c)                            { return this.coreInterface.getPackage(a, b, c); }
  getPackageForModule(a, b, c)                   { return this.coreInterface.getPackageForModule(a, b, c); }
  systemConfChange(a, b, c)                      { return this.coreInterface.systemConfChange(a, b, c); }

  importPackage(packageURL) { return this.coreInterface.importPackage(packageURL); }
  removePackage(packageURL) { return this.coreInterface.removePackage(packageURL); }
  reloadPackage(packageURL) { return this.coreInterface.reloadPackage(packageURL); }
  packageConfChange(source, confFile) { return this.coreInterface.packageConfChange(source, confFile); }
  keyValueListOfVariablesInModule(moduleName, sourceOrAst) { return this.coreInterface.keyValueListOfVariablesInModule(moduleName, sourceOrAst); }

  interactivelyCreatePackage(a, b) { return interactivelyCreatePackage(this.coreInterface, a, b); }
  interactivelyLoadPackage(a, b)   { return interactivelyLoadPackage(this.coreInterface, a, b); }
  interactivelyReloadPackage(a, b) { return interactivelyReloadPackage(this.coreInterface, a, b); }
  interactivelyUnloadPackage(a, b) { return interactivelyUnloadPackage(this.coreInterface, a, b); }
  interactivelyRemovePackage(a, b) { return interactivelyRemovePackage(this.coreInterface, a, b); }

  importModule(name)         { return this.coreInterface.importModule(name); }
  forgetModule(name, opts)   { return this.coreInterface.forgetModule(name, opts); }
  reloadModule(name, opts)   { return this.coreInterface.reloadModule(name, opts); }
  moduleFormat(name)         { return this.coreInterface.moduleFormat(name); }
  moduleRead(name)           { return this.coreInterface.moduleRead(name); }
  moduleWrite(name, content) { return this.coreInterface.moduleWrite(name, content); }
  getModulesInPackage(name)  { return modulesInPackage(this.coreInterface, name); }

  shortModuleName(moduleId, itsPackage)                               { return shortModuleName(this.coreInterface, moduleId, itsPackage); }
  showExportsAndImportsOf(a, b)                                       { return showExportsAndImportsOf(this.coreInterface, a, b); }
  interactivelyChangeModule(vmEditor, moduleName, newSource, options) { return interactivelyChangeModule(this.coreInterface, vmEditor, moduleName, newSource, options); }
  interactivelyReloadModule(vmEditor, moduleName)                     { return interactivelyReloadModule(this.coreInterface, vmEditor, moduleName); }
  interactivelyUnloadModule(vmEditor, moduleName)                     { return interactivelyUnloadModule(this.coreInterface, vmEditor, moduleName); }
  interactivelyRemoveModule(vmEditor, moduleName)                     { return interactivelyRemoveModule(this.coreInterface, vmEditor, moduleName); }
  interactivelyAddModule(vmEditor, relatedPackageOrModule)            { return interactivelyAddModule(this.coreInterface, vmEditor, relatedPackageOrModule); }

  searchInPackage(packageURL, searchTerm, options) { return this.coreInterface.searchInPackage(packageURL, searchTerm, options); }
  async searchInAllPackages(searchTerm, options) {
    var packages = this.coreInterface.getPackages(), results = [];
    for (let {url} of packages) {
      if (url)
        results = results.concat(await this.coreInterface.searchInPackage(url, searchTerm, options));
    }
    return results;
  }
}

export var localInterface = new Interface(new LocalCoreInterface());
export var serverInterfaceFor = (url) => new Interface(new HTTPCoreInterface(url));
