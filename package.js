import { resource } from "lively.resources";

export default class FreezerPackage {

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
    this._config = config;
  }
}