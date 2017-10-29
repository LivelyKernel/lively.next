/*global global,self,__VERSION_PLACEHOLDER__*/
import { Module } from "./module.js";
import { obj, num, graph, arr } from "lively.lang";
import { version } from "./package.json";
import { runtimeDefinition } from "./runtime.js";
import { join } from "lively.resources/src/helpers.js";

export default class Bundle {

  constructor(packageSet) {
    this.modules = {};
    this.packages = packageSet;
    this.graph = {};
    this.entryModule = null;
  }

  async resolveDependenciesStartFrom(moduleNameOrId, packageName) {
    let packageSpec, entryModule;
    if (packageName) {
      packageSpec = this.findPackage(packageName);
    } else {
      entryModule = this.findModuleWithId(moduleNameOrId);
      if (entryModule) packageSpec = entryModule.package;
      else {
        let [_, pName, moduleName] = moduleNameOrId.match(/^([^\/]+)\/(.*)/);
        if (pName) {
          packageSpec = this.findPackage(pName);
          moduleNameOrId = moduleName;
        }
      }
    }
    if (!entryModule) {
      entryModule =  this.findModuleInPackageWithName(packageSpec, moduleNameOrId)
                  || this.addModule(Module.create({name: moduleNameOrId, package: packageSpec}));
    }

    this.entryModule = entryModule;

    let seen = {}, unresolved = [entryModule];

    while (unresolved.length) {
      let next = unresolved.shift();
      if (seen[next.qualifiedName]) continue;
      seen[next.qualifiedName] = true;

      // console.log(`Resolving ${next.qualifiedName}`);

      await next.resolveImports(this);

      this.modules[next.qualifiedName] = next;

      for (let [mod, _] of next.dependencies)
        if (!seen[mod.qualifiedName] && !mod.isExcluded)
          unresolved.push(mod);
    }

    return this;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package / module specifics
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  normalizeModuleName(name) {
    // references a package?
    let p = this.findPackage(name);
    if (p) return join(p.qualifiedName, p.main);
    let m = this.findModuleWithId(name);
    if (m) return m.qualifiedName;
    return null;
  }

  findPackage(name) {
    return obj.values(this.packages).find(ea => ea.name === name || ea.qualifiedName === name);
  }

  findModuleWithId(id) {
    return obj.values(this.modules).find(ea => ea._id === id || ea.qualifiedName === id);
  }

  findModuleInPackageWithName(fromModulePackage, name) {
    return obj.values(this.modules).find(ea => ea.package === fromModulePackage && ea.name === name);
  }

  addModule(module) {
    this.modules[module.qualifiedName] = module;
    return module;
  }


  buildGraph(module, graph = {}, moduleNameMap = {}) {
    if (graph[module.qualifiedName]) return graph;
    moduleNameMap[module.qualifiedName] = module;
    let entries = graph[module.qualifiedName] = []
    for (let dep of module.dependencies.keys()) {
      entries.push(dep.qualifiedName)
      this.buildGraph(dep, graph, moduleNameMap);
    }
    return {graph: graph, moduleNameMap};
  }

  async standalone(opts = {}) {
    let {
          addRuntime = false,
          isExecutable = false,
          runtimeGlobal = "lively.FreezerRuntime",
          entryModule: entryId
        } = opts,
        cacheKey = [runtimeGlobal, isExecutable, addRuntime, entryId].join("-");

    if (this._standaloneCached && this._standaloneCacheKey === cacheKey) {
      return this._standaloneCached;
    }

    if (!entryId && !this.entryModule)
      throw new Error(`Needs entry module`);

    if (entryId) {
      await this.resolveDependenciesStartFrom(entryId);
    }

    let entry = this.entryModule,
        g = this.buildGraph(entry),
        moduleOrder = arr.flatten(graph.sortByReference(g.graph, entry.qualifiedName)),
        modules = moduleOrder.map(qName => g.moduleNameMap[qName]).filter(ea => !ea.isExcluded),
        moduleSource = modules.map(ea => ea.transformToRegisterFormat({runtimeGlobal})).join("\n\n");

    if (addRuntime) {
      let runtimeSrc = String(runtimeDefinition)
                        .replace(/var version/, `var version = "${version}"`)
                        .replace(/lively\.FreezerRuntime/g, runtimeGlobal)
      moduleSource = `(${runtimeSrc})();\n${moduleSource}`
    }

    if (isExecutable) moduleSource += `\n${runtimeGlobal}.load("${entry.qualifiedName}");\n`;

    this._standaloneCacheKey = cacheKey;
    return this._standaloneCached = moduleSource;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // report / debugging
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  reportModuleSizes() {
    let seen = {}, unreported = [this.entryModule], report = "";

    let recorded = [];
    while (unreported.length) {
      let next = unreported.shift();
      if (seen[next.qualifiedName]) continue;
      seen[next.qualifiedName] = true;
      if (next._source) recorded.push({module: next, size: next._source.length});
      unreported.push(...Array.from(next.dependencies.keys()).filter(ea => !seen[ea.qualifiedName]));
    }

    if (this._standaloneCached) {
      report += `complete: ${num.humanReadableByteSize(this._standaloneCached.length)}\n\n`
    }

    report += arr.sortBy(recorded, ea => ea.size)
      .map(ea => `${num.humanReadableByteSize(ea.size)}\t${ea.module.qualifiedName}`)
      .join("\n");

    return report;
  }

  report() {
    let seen = {}, unreported = [this.entryModule], report = "";

    if (this._standaloneCached) {
      report += `standalone size: ${num.humanReadableByteSize(this._standaloneCached.length)}\n\n`
    }

    let excludedModules = this.excludedModules();
    if (excludedModules.length) {
      report += `external modules:\n  ${excludedModules.join("\n  ")}\n\n`
    }

    while (unreported.length) {
      let next = unreported.shift();
      if (seen[next.qualifiedName]) continue;
      seen[next.qualifiedName] = true;
      report += `${next.qualifiedName}`
      if (next._source) report += ` (${num.humanReadableByteSize(next._source.length)})`;
      if (next.exports.length)
        report += `\n  => ${next.exports.map(ea => `${ea.exported}${ea.local && ea.exported !== ea.local ? ` (${ea.local})` : ""}`).join(", ")}`;
      let deps = Array.from(next.dependencies.keys());
      if (deps.length)
        report += "\n  " + deps.map(dep => `<= ${dep.qualifiedName} ${next.dependencies.get(dep).imports.map(({imported, local, exported}) => `${imported}${(local || exported) !== imported ? ` (${local || exported})` : ""}`).join(", ")}`).join("\n  ");
      report += "\n\n"
      unreported.push(...Array.from(next.dependencies.keys()).filter(ea => !seen[ea.qualifiedName]));
    }

    return report;
  }
  
  shortReport() {
    let report = "";

    if (this._standaloneCached) {
      report += `standalone size: ${num.humanReadableByteSize(this._standaloneCached.length)}\n\n`
    }

    let excludedModules = this.excludedModules();
    if (excludedModules.length) {
      let externalPackages = lively.lang.arr.uniq(excludedModules.map(name => {
        let mod = this.findModuleWithId(name);
        if (mod.package) return mod.package.qualifiedName;
        return mod.id.split("/")[0];
      })).sort();
      
      report += `external packages:\n  ${externalPackages.join("\n  ")}\n\n`
    }

    return report;
  }

  excludedModules() {    
    let missing = {};
    for (let modName in this.modules) {
      let mod = this.modules[modName];
      if (!mod.dependencies) continue;
      for (let dep of mod.dependencies.keys())
        if (dep.isExcluded || !this.modules[dep.qualifiedName])
          missing[dep.qualifiedName] = true
    }
    return Object.keys(missing);
  }
}