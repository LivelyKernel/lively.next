/* global System */
import {
  interactivelyCreatePackage,
  interactivelyLoadPackage,
  interactivelyReloadPackage,
  interactivelyUnloadPackage,
  interactivelyRemovePackage,
  showExportsAndImportsOf
} from './commands/packages.js';

import {
  shortModuleName, addModule,
  interactivelyChangeModule,
  interactivelyReloadModule,
  interactivelyUnloadModule,
  interactivelyRemoveModule,
  interactivelyAddModule,
  modulesInPackage
} from './commands/modules.js';

import { LocalCoreInterface } from './interfaces/local-system.js';
import { HTTPCoreInterface } from './interfaces/http-interface.js';
import { L2LCoreInterface } from './interfaces/l2l-interface.js';

export class Interface {
  constructor (coreInterface) {
    this.coreInterface = coreInterface;
  }

  get isSystemInterface () { return true; }

  get name () { return this.coreInterface.name; }

  dynamicCompletionsForPrefix (mod, prefix, opts) { return this.coreInterface.dynamicCompletionsForPrefix(mod, prefix, opts); }
  runEval (source, options) { return this.coreInterface.runEval(source, options); }
  printSystemConfig (a, b, c) { return this.coreInterface.printSystemConfig(a, b, c); }
  getConfig (a, b, c) { return this.coreInterface.getConfig(a, b, c); }
  getPackages (options) { return this.coreInterface.getPackages(options); }
  getModules (a, b, c) { return this.coreInterface.getModules(a, b, c); }
  getModule (a, b, c) { return this.coreInterface.getModule(a, b, c); }
  getPackage (a, b, c) { return this.coreInterface.getPackage(a, b, c); }
  getPackageForModule (a, b, c) { return this.coreInterface.getPackageForModule(a, b, c); }
  resourcesOfPackage (packageAddress, excludes) { return this.coreInterface.resourcesOfPackage(packageAddress, excludes); }
  systemConfChange (a, b, c) { return this.coreInterface.systemConfChange(a, b, c); }

  registerPackage (packageURL) { return this.coreInterface.registerPackage(packageURL); }
  importPackage (packageURL) { return this.coreInterface.importPackage(packageURL); }
  removePackage (packageURL) { return this.coreInterface.removePackage(packageURL); }
  reloadPackage (packageURL) { return this.coreInterface.reloadPackage(packageURL); }
  packageConfChange (source, confFile) { return this.coreInterface.packageConfChange(source, confFile); }
  keyValueListOfVariablesInModule (moduleName, sourceOrAst) { return this.coreInterface.keyValueListOfVariablesInModule(moduleName, sourceOrAst); }

  interactivelyCreatePackage (requester) { return interactivelyCreatePackage(this.coreInterface, requester); }
  interactivelyLoadPackage (a, b) { return interactivelyLoadPackage(this.coreInterface, a, b); }
  interactivelyReloadPackage (a, b) { return interactivelyReloadPackage(this.coreInterface, a, b); }
  interactivelyUnloadPackage (vmEditor, packageURL, world) { return interactivelyUnloadPackage(this.coreInterface, vmEditor, packageURL, world); }
  interactivelyRemovePackage (requester, pkgURL) { return interactivelyRemovePackage(this.coreInterface, requester, pkgURL); }

  isModuleLoaded (name, isNormalized) { return this.coreInterface.isModuleLoaded(name, isNormalized); }
  doesModuleExist (name, isNormalized) { return this.coreInterface.doesModuleExist(name, isNormalized); }
  createModule (name) { return addModule(this.coreInterface, name); }
  importModule (name) { return this.coreInterface.importModule(name); }
  forgetModule (name, opts) { return this.coreInterface.forgetModule(name, opts); }
  reloadModule (name, opts) { return this.coreInterface.reloadModule(name, opts); }
  moduleFormat (name) { return this.coreInterface.moduleFormat(name); }
  moduleRead (name) { return name.endsWith('js') ? this.coreInterface.moduleRead(name) : this.coreInterface.resourceRead(name); }
  moduleWrite (name, content) { return this.coreInterface.moduleWrite(name, content); }
  getModulesInPackage (name) { return modulesInPackage(this.coreInterface, name); }

  shortModuleName (moduleId, itsPackage) { return shortModuleName(this.coreInterface, moduleId, itsPackage); }
  interactivelyChangeModule (moduleName, newSource, options) { return interactivelyChangeModule(this.coreInterface, moduleName, newSource, options); }
  interactivelyReloadModule (vmEditor, moduleName) { return interactivelyReloadModule(this.coreInterface, vmEditor, moduleName); }
  interactivelyUnloadModule (vmEditor, moduleName) { return interactivelyUnloadModule(this.coreInterface, vmEditor, moduleName); }
  interactivelyRemoveModule (requester, moduleName) { return interactivelyRemoveModule(this.coreInterface, requester, moduleName); }
  interactivelyAddModule (requester, relatedPackageOrModule) { return interactivelyAddModule(this.coreInterface, requester, relatedPackageOrModule); }

  showExportsAndImportsOf (packageAddress, world) { return showExportsAndImportsOf(this.coreInterface, packageAddress, world); }
  exportsOfModules (options) { return this.coreInterface.exportsOfModules(options); }

  // -=-=-=-
  // search
  // -=-=-=-
  searchInPackage (packageURL, searchTerm, options) {
    return this.coreInterface.searchInPackage(packageURL, searchTerm, options);
  }

  async searchInAllPackages (searchTerm, options = {}) {
    let pm = options.progress;
    pm && pm.step('Fetching Packages...', 0);
    let packages = await this.coreInterface.getPackages({ excluded: options.excludedPackages });
    let results = [];
    pm && pm.step('Fetching Packages...', 0.1);
    for (let i = 0; i < packages.length; i++) {
      let { url } = packages[i];
      if (!url || url === 'no group'/* FIXME */) continue;
      pm && pm.step(url.replace(System.baseURL, '').slice(0, 20), 0.1 + (0.9 * (i / packages.length)));
      try {
        let packageResults = await this.coreInterface.searchInPackage(url, searchTerm, options);
        results = results.concat(packageResults);
      } catch (e) { console.error(`Error searching in package ${url}:\n${e.stack}`); }
    }
    return results;
  }

  // -=-=-=-=-
  // testing
  // -=-=-=-=-
  loadMochaTestFile (file, testsByFile) {
    return this.coreInterface.loadMochaTestFile(file, testsByFile);
  }

  runMochaTests (grep, testsByFile, onChange, onError) {
    return this.coreInterface.runMochaTests(grep, testsByFile, onChange, onError);
  }
}

export function systemInterfaceNamed (interfaceSpec) {
  if (!interfaceSpec) interfaceSpec = 'local';

  let systemInterface;

  if (interfaceSpec.isSystemInterface) {
    systemInterface = interfaceSpec;
  } else {
    // "l2l FA3V-ASBDFD3-..."
    if (typeof interfaceSpec === 'string' && interfaceSpec.startsWith('l2l ')) { interfaceSpec = { type: 'l2l', id: interfaceSpec.split(' ')[1] }; }

    if (typeof interfaceSpec !== 'string') {
      if (interfaceSpec.type === 'l2l') { systemInterface = l2lInterfaceFor(interfaceSpec.id, interfaceSpec.info); }
    }

    if (typeof interfaceSpec !== 'string') {
      $world.setStatusMessage(`Unknown system interface ${interfaceSpec}`);
      interfaceSpec = 'local';
    }

    if (!systemInterface) {
      systemInterface = !interfaceSpec || interfaceSpec === 'local'
        ? localInterface
        : serverInterfaceFor(interfaceSpec);
    }
  }

  return systemInterface;
}

export var localInterface = new Interface(new LocalCoreInterface());
const httpInterfaces = {};
export var serverInterfaceFor = url => httpInterfaces[url] || (httpInterfaces[url] = new Interface(new HTTPCoreInterface(url)));
const l2lInterfaces = {};
export var l2lInterfaceFor = (targetId, peer) => l2lInterfaces[targetId] || (l2lInterfaces[targetId] = new Interface(new L2LCoreInterface(targetId, peer)));
