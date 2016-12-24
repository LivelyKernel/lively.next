import { string, arr } from "lively.lang";
import module from "lively.modules/src/module.js";
import { parse, query } from "lively.ast";

const srcLocSym = Symbol.for("lively-source-location"),
      moduleSym = Symbol.for("lively-module-meta"),
      descriptorCache = new WeakMap();

export default class SourceDescriptor {

  static for(obj, optSystem) {
    var descr = descriptorCache.get(obj);
    if (descr) return descr;
    descr = new this(obj, optSystem);
    descriptorCache.set(obj, descr);
    return descr;
  }

  constructor(obj, System) {
    this.obj = obj;
    this.System = System;
  }

  get System() { return this._System || System; }
  set System(S) { this._System = S; }

  get module() {
    var {obj, System} = this;
    if (!obj[moduleSym])
      throw new Error(`runtime object of ${this} has no module data`)
    var {package: {name: packageName}, pathInPackage} = obj[moduleSym];
    // FIXME
    return module(System, packageName + "/" + pathInPackage);
  }

  get sourceLocation() {
    var {obj, System} = this;
    if (!obj[srcLocSym])
      throw new Error(`runtime object of ${this} has no source location data`)
    return obj[srcLocSym];
  }

  async declaredAndUndeclaredNames() {
    var parsed = await this.ast(),
        declaredNames = query.topLevelDeclsAndRefs(await this.module.ast()).declaredNames,
        declaredImports = arr.uniq((await this.module.imports()).map(({local}) => local)),
        localDeclaredNames = arr.withoutAll(declaredNames, declaredImports),
        undeclaredNames = arr.withoutAll(query.findGlobalVarRefs(parsed).map(ea => ea.name), declaredNames);

    return {
      declaredNames,
      declaredImports,
      localDeclaredNames,
      undeclaredNames
    }
  }
  
  async source() { return this._source || this.read(); }

  async ast() { return Promise.resolve(this.source()).then(parse); }

  async read() {
    var {start, end} = this.sourceLocation;
    return this._source = (await this.module.source()).slice(start, end);
  }

  async write(newSource) {
    this._source = newSource;
    var {module, sourceLocation: {start, end}} = this;
    await module.changeSourceAction(oldSource =>
      oldSource.slice(0, start) + newSource + oldSource.slice(end));
    return this;
  }

  toString() {
    var objString = string.truncate(this._source || String(this.obj), 35).replace(/\n/g, ""),
        modId; try { modId = this.module.id } catch (e) { modId = "NO MODULE!" };
    return `${this.constructor.name}(${objString} in ${modId})`;
  }

}
