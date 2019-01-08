import { resource } from "lively.resources";
import { arr, obj } from "lively.lang";
import { isSubset, intersect } from "lively.lang/array.js";

export default class FreezerPackage {

  static async buildPackageMap(packageSpecs) {
    let packages = {};
    for (let name in packageSpecs) {
      let spec = packageSpecs[name];
      let p  = new FreezerPackage(spec)
      if (p.path && !p.isExcluded) await p.readConfig();
      packages[p.qualifiedName] = p;
    }
    return packages;
  }

  constructor(opts = {}) {
    let {name, version, path, isExcluded = false, standaloneGlobal = false} = opts;
    Object.assign(this, {name, version, path, isExcluded, standaloneGlobal});
    this.reset();
  }

  reset() {
    this._config = null;
  }

  get resource() { return resource(this.path).asDirectory(); }

  get qualifiedName() { return this.version ? `${this.name}@${this.version}` : this.name; }

  get id() { return resource(this.path).asFile().url; }

  get main() {
    let {_config: c} = this;
    var main;
    if (c) {
      if (c.systemjs && c.systemjs.main) main = c.systemjs.main;
      else if (c.main) main = c.main;
      if (main && !main.match(/\.[^\/\.]+/)) main += ".js";
    }
    return main || "index.js";
  }

  async readConfig() {
    let config = await this.resource.join("package.json").readJson();
    this.version = config.version;
    this.name = config.name;
    this._config = config;
  }

  getModules(bundle) {
    return obj.values(bundle.modules).filter(m => m.package === this)
  }

  tryToEnforceStandalone(bundle) {
    // traverse all the foreign modules, which directly import one of the submodules
    // and resolve them to import the package's root instead
    let foreignModuleImports = [],
        succ = true,        
        index = 'local://' + bundle.normalizeModuleName(this.qualifiedName),
        rootModule = this.getModules(bundle).find(m => m.name == `/${this.main}`);
    for (let m of this.getModules(bundle)) {
      if (m.qualifiedName == index) continue; // skip index
      foreignModuleImports.push(...m.getDependentsOutsideOfPackage(this))
    }
    for (let m of arr.compact(foreignModuleImports)) {
      for (let depToReplace of m.getDependenciesLocatedIn(this)) {
         // check if the rootModule has all the exports that are required
         // to replace the dependency
         if (depToReplace === rootModule) continue;
         const correspondingImport = rootModule.dependencies.get(depToReplace);
         if (!correspondingImport) {
           console.log(`Could not turn ${
              this.name
           } standalone, because the root module does not export ${
              depToReplace.name
           } at all!`);
           succ = false;
           continue;
         }
         const providedImports = rootModule.dependencies.get(depToReplace).imports.map(i => i.imported).filter(Boolean),
               requiredImports = m.dependencies.get(depToReplace).imports.map(i => i.imported).filter(Boolean);
         if (!providedImports.includes('*') && !isSubset(requiredImports, providedImports)) {
           console.log(`Could not turn ${
             this.name
           } standalone, because ${
             m.name
           } demands ${
             requiredImports
           } from ${
             depToReplace.name
           }`);
           succ = false;
           continue;
         }
      }
    }
    if (succ) {
      console.log(`replaced ${this.name} by standalone`);
    }
    return succ;
  }

  canBeReplacedByStandalone(bundle) {
    // if in the current bundle, all dependents of my 
    // modules which are NOT also part of a standalone
    // package, are referncing my exports via main, 
    // then I can be replaced by a static global variable
    // which allows me to be removed from the part 
    // runtime during standalon() compilation
    let externalModules = [],
        index = 'local://' + bundle.normalizeModuleName(this.qualifiedName);
    for (let m of this.getModules(bundle)) {
      if (m.qualifiedName == index) continue; // skip index
      externalModules.push(...m.getDependentsOutsideOfPackage(this))
    }
    if (externalModules.length > 0) {
      console.log(`Can not standalone ${this.name} because of following dependents: `, externalModules);
      return false;
    } else {
      return true;
    }
  }
}