/*global global,self,__VERSION_PLACEHOLDER__*/
import FreezerModule from "./module.js";
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
                  || this.addModule(new FreezerModule(moduleNameOrId, packageSpec));
    }

    this.entryModule = entryModule;

    let seen = {}, unresolved = [entryModule];

    while (unresolved.length) {
      let next = unresolved.shift();
      if (seen[next.qualifiedName]) continue;
      seen[next.qualifiedName] = true;

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
        } = opts;

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

    return moduleSource;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // report / debugging
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  report() {
    let seen = {}, unreported = [this.entryModule],
        report = "";

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
