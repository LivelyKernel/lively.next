import { resource } from "lively.resources";

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
    return Object.values(bundle.modules).filter(m => m.package === this)
  }

  canBeReplaceByStandalone(bundle) {
    // if in the current bundle, all dependents of my modules which are NOT also part of a standalone
    // package, are referncing my exports via main, then I can be replace by a static global variable
    // which allows me to be removed from the part runtime during standalon() compilation
    let externalModules = [], index = 'local://' + bundle.normalizeModuleName(this.qualifiedName);
    if (!this.standaloneGlobal) return false;
    for (let m of this.getModules(bundle)) {
      if (m.qualifiedName == index) continue; // skip index
      externalModules.push(...[...m.dependents].filter(m => m.package != this && m.package && !m.package.standaloneGlobal))
    }
    if (externalModules.length > 0) {
      console.log(`Can not standalone ${this.name} because of following dependents: `, externalModules);
      return false;
    } else {
      return true;
    }
  }
}