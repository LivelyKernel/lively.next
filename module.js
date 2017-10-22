import { resource } from "lively.resources";
import { parse, query } from "lively.ast";
import { findUniqJsName } from "./util.js";

export default class FreezerModule {

  constructor(name, _package, id) {
    this._id = id;
    this.name = name;
    this.package = _package;
    this.reset();
  }

  reset() {
    this._source = null;
    this.rawDependencies = null;
    this.rawExports = null;
    this.rawImports = null;
    this.parsed = null;
    this.scope = null;
    this.exports = [];
    this.dependencies = new Map();
    this.dependents = new Set();
  }

  addDependency(otherModule, importSpec) {
    this.dependencies.set(otherModule, importSpec);
    otherModule.addDependent(this);
    return otherModule;
  }

  addDependent(otherModule) { this.dependents.add(otherModule); }

  get id() {
    if (this._id) return this._id;
    if (this.package) return this.package.id + "/" + this.name;
    throw new Error(`id: Needs package or _id! (${this.name})`);
  }

  get qualifiedName() {
    if (this.package) return this.package.qualifiedName + "/" + this.name;
    if (this.id) return this.id;
    throw new Error(`qualifiedName: Needs package or id!`);
  }

  findUniqJsName(boundNames = []) {
    return findUniqJsName(this.qualifiedName, boundNames);
  }

  get resource() {
    let {package: p} = this;
    if (this.package) return p ? p.resource.join(this.name) : resource(this.id);
  }

  async source() {
    return this._source || (this._source = await this.resource.read());
  }

  async parse() {
    if (this._parsed) return this;

    let parsed, scope, rawImports,
        exports = [], rawExports, source,
        dependencies = {};
  
    try {
      source = await this.source();
      parsed = parse(source, {addAstIndex: true});
      scope = query.scopes(parsed);
      rawImports = query.imports(scope);
      rawExports = query.exports(scope);
    } catch (err) { throw new Error(`Error parsing ${this.name}: ${err.stack}`); }
  
    for (let i of rawImports) {
      let {fromModule, imported, local, node} = i,
          dep = dependencies[fromModule] || (dependencies[fromModule] = {imports: []});
      dep.imports.push({imported, local, node});
    }
  
    for (let e of rawExports) {
      let {fromModule, imported, exported, local, node} = e;
      if (fromModule) {
        let dep = dependencies[fromModule] || (dependencies[fromModule] = {imports: []});
        dep.imports.push({imported, exported, node});
      }
      exports.push({exported, local});
    }
  
    this.rawDependencies = dependencies;
    this.parsed = parsed;
    this.scope = scope;
    this.exports = exports;
    this.rawExports = rawExports;
    this.rawImports = rawImports;

    return this;
  }

  async prepareBundling(bundle) {
    // 1. try to resolve the "from" part of local imports
    // 2. find local var names for object capturing imports

    await this.parse();

    let {rawDependencies, scope, dependencies} = this;
        // boundNames = query.declarationsOfScope(scope).map(ea => ea.name);
  
    for (let localName in rawDependencies) {
      let {imports} = rawDependencies[localName];

      let {
        module: otherModule,
        isExternal, isPackageImport
      } = bundle.resolveModuleImport(this, localName);

console.log(`${this.qualifiedName} => ${localName} ${otherModule.package && otherModule.package.name} ${otherModule.name}`)

      this.addDependency(otherModule, {imports, localName, isExternal, isPackageImport});

      // boundNames.push(dep.varName = findUniqJsName(localName, boundNames));
    }
  
    return this
  }

}