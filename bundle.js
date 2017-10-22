import FreezerModule from "./module.js";
import { resource } from "lively.resources";
import { join, parent } from "lively.resources/src/helpers.js";
import { isURL } from "lively.modules/src/url-helpers.js";
import { obj } from "lively.lang";

export default class Bundle {

  constructor(packages) {
    this.modules = {};
    this.packages = packages;
    this.graph = {};
    this.entryModule = null;
  }

  async build(moduleName, packageName) {
    let packageSpec = this.findPackage(packageName),
        entryModule =  this.findModuleInPackageWithName(packageSpec, moduleName)
                    || this.addModule(new FreezerModule(moduleName, packageSpec));

    this.entryModule = entryModule;

    let seen = {}, unresolved = [entryModule];
    
    while (unresolved.length) {
      let next = unresolved.shift();
      if (seen[next.qualifiedName]) continue;
      seen[next.qualifiedName] = true;

      await next.prepareBundling(this);

      this.modules[next.qualifiedName] = next;

      for (let [mod, {isExternal}] of next.dependencies)
        if (!isExternal && !seen[mod.qualifiedName]) {
          unresolved.push(mod);
        }
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

  resolveModuleImport(fromModule, localName) {
    // FIXME: move module resolution somewhere else?!

    if (isURL(localName)) {
      return {
        isExternal: true,
        module: this.findModuleWithId(localName)
             || this.addModule(new FreezerModule(localName, null, localName))
      };
    }

    if (localName.startsWith(".")) {
      if (!fromModule.package) throw new Error("local module needs package!");
      let name = join(parent(fromModule.name), localName);
      return {
        isExternal: false,
        module: this.findModuleInPackageWithName(fromModule.package, name)
             || this.addModule(new FreezerModule(name, fromModule.package))
      };
    }

    let packageName = localName.includes("/") ? localName.slice(0, localName.indexOf.includes("/")) : localName,
        nameInPackage = localName.slice(packageName.length),
        packageSpec = this.findPackage(packageName),
        isExternal = true,
        isPackageImport = !nameInPackage;

    if (!packageSpec)
      throw new Error(`Cannot resolve package ${packageName}`);

    if (isPackageImport) {
      nameInPackage = packageSpec.main || (packageSpec.systemjs && packageSpec.systemjs.main) || "index.js"
    }

    return {
      isExternal, isPackageImport,
      module: this.findModuleInPackageWithName(packageSpec, nameInPackage)
           || this.addModule(new FreezerModule(nameInPackage, packageSpec))
    };
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
