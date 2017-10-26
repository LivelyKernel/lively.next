/*global global,self,__VERSION_PLACEHOLDER__*/
import FreezerModule from "./module.js";
import { obj, graph, arr } from "lively.lang";
import { version } from "./package.json";
import { runtimeDefinition } from "./runtime.js";

export default class Bundle {

  constructor(packageSet) {
    this.modules = {};
    this.packages = packageSet;
    this.graph = {};
    this.entryModule = null;
  }

  async resolveDependenciesStartFrom(moduleName, packageName) {
    let packageSpec = this.findPackage(packageName),
        entryModule =  this.findModuleInPackageWithName(packageSpec, moduleName)
                    || this.addModule(new FreezerModule(moduleName, packageSpec));

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

  findPackage(name) {
    return obj.values(this.packages).find(ea => ea.name === name);
  }

  findModuleWithId(id) {
    return obj.values(this.modules).find(ea => ea._id === id);
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

  standalone(opts = {}) {
    let {
          ensureSystem = true,
          executable = true,
          runtimeGlobal = "lively.FreezerRuntime"
        } = opts,
        entry = this.entryModule,
        g = this.buildGraph(entry),
        moduleOrder = arr.flatten(graph.sortByReference(g.graph, entry.qualifiedName)),
        modules = moduleOrder.map(qName => g.moduleNameMap[qName]).filter(ea => !ea.isExcluded),
        moduleSource = modules.map(ea => ea.transformToRegisterFormat({runtimeGlobal})).join("\n\n");

    if (ensureSystem) {
      let runtimeSrc = String(runtimeDefinition)
                        .replace(/var version/, `var version = "${version}"`)
                        .replace(/lively\.FreezerRuntime/g, runtimeGlobal)
      moduleSource = `(${runtimeSrc})();\n${moduleSource}`
    }
    if (executable) moduleSource += `\n${runtimeGlobal}.load("${entry.qualifiedName}");\n`;

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
      report += `${next.qualifiedName}`;
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

}
