import { parseJsonLikeObj } from "../helpers.js";
import { arr } from "lively.lang";
import { resource } from "lively.resources";

function todo(methodName) {
  throw new Error(`${methodName} is not yet implemented!`);
}

export class AbstractCoreInterface {

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix(moduleName, prefix, options) { todo("dynamicCompletionsForPrefix") }
  runEval(source, options)                                       { todo("runEval") }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resources
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  resourceExists(url)                      { todo("resourceExists") }
  resourceEnsureExistance(url, optContent) { todo("resourceEnsureExistance") }
  resourceMkdir(url)                       { todo("resourceMkdir") }
  resourceRead(url)                        { todo("resourceRead") }
  resourceRemove(url)                      { todo("resourceRemove") }
  resourceWrite(url, source)               { todo("resourceWrite") }
  resourceCreateFiles(baseDir, spec)       { todo("resourceCreateFiles") }
  resourceDirList(baseDir, depth, opts)    { todo("resourceDirList") }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  normalizeSync(name, parentName, isPlugin) { todo("normalizeSync") }
  normalize(name, parent, parentAddress)    { todo("normalize") }
  printSystemConfig()                       { todo("printSystemConfig") }
  getConfig()                               { todo("getConfig") }
  setConfig(conf)                           { todo("setConfig") }
  getPackages()                             { todo("getPackages") }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  async getModules() {
    return arr.flatmap(await this.getPackages(), ea => ea.modules);
  }
  
  async getModule(name) {
    return (await this.getModules()).find(ea => ea.name === name);
  }
  
  async getPackage(name) {
    name = name.replace(/\/+$/, "");
    return (await this.getPackages()).find(ea => ea.address === name || ea.name === name);
  }
  
  async getPackageForModule(name) {
    return (await this.getPackages())
      .find(ea => ea.modules.some(mod => mod.name === name));
  }
  
  systemConfChange(source) {
    var jso = parseJsonLikeObj(source),
        exceptions = ["baseURL"];
    exceptions.forEach(ea => delete jso[ea]);
    // Object.keys(jso).forEach(k => modules.System[k] = jso[k]);
    return this.setConfig(jso);
  }

  async resourcesOfPackage(
    packageOrAddress,
    exclude = [".git", "node_modules", ".optimized-loading-cache"]
  ) {
    var p = packageOrAddress.address ? packageOrAddress : await this.getPackage(packageOrAddress),
        resourceURLs = (await this.resourceDirList(p.address, 'infinity', {exclude})).map(ea => ea.url),
        loadedModules = arr.groupByKey(p.modules, "name");
    return resourceURLs.map(url => {
      var nameInPackage = url.replace(p.address, "").replace(/^\//, "");
      return url in loadedModules ?
        {...loadedModules[url][0], isLoaded: true, nameInPackage, package: p} :
        {isLoaded: false, name: url, nameInPackage, package: p};
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-  
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async registerPackage(packageURL)         { todo("registerPackage") }
  async importPackage(packageURL)           { todo("importPackage") }
  async removePackage(packageURL)           { todo("removePackage") }
  async reloadPackage(packageURL)           { todo("reloadPackage") }
  async packageConfChange(source, confFile) { todo("packageConfChange") }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  importModule(name)                                       { todo("importModule") }
  forgetModule(name, opts)                                 { todo("forgetModule") }
  reloadModule(name, opts)                                 { todo("reloadModule") }
  moduleFormat(moduleName)                                 { todo("moduleFormat") }
  moduleRead(moduleName)                                   { todo("moduleRead") }
  moduleSourceChange(moduleName, newSource, options)       { todo("moduleSourceChange") }
  importsAndExportsOf(modId, sourceOrAst)                  { todo("importsAndExportsOf") }
  keyValueListOfVariablesInModule(moduleName, sourceOrAst) { todo("keyValueListOfVariablesInModule") }

  moduleWrite(moduleName, newSource) {
    return this.moduleSourceChange(moduleName, newSource);
  }

}
