import { resource } from "lively.resources";

export default class FreezerPackage {

  static async buildPackageMap(packageDirs) {
    let packages = {};
    for (let dir of packageDirs) {
      let p  = new FreezerPackage(null, null, dir)
      await p.readConfig();
      packages[p.qualifiedName] = p;
    }
    return packages;
  }

  constructor(name, version, path) {
    this.name = name;
    this.version = version;
    this.path = path;
    this.reset();
  }

  reset() {
    this._config = null;
  }

  get resource() { return resource(this.path).asDirectory(); }

  get qualifiedName() { return `${this.name}@${this.version}`; }

  get id() { return resource(this.path).asFile().url; }
  
  async readConfig() {
    let config = await this.resource.join("package.json").readJson();
    this.version = config.version;
    this.name = config.name;
    this._config = config;
  }
}