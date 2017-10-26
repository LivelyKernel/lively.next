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
    let {name, version, path, isExcluded = false} = opts;
    Object.assign(this, {name, version, path, isExcluded});
    this.reset();
  }

  reset() {
    this._config = null;
  }

  get resource() { return resource(this.path).asDirectory(); }

  get qualifiedName() { return this.version ? `${this.name}@${this.version}` : this.name; }

  get id() { return resource(this.path).asFile().url; }
  
  async readConfig() {
    let config = await this.resource.join("package.json").readJson();
    this.version = config.version;
    this.name = config.name;
    this._config = config;
  }
}