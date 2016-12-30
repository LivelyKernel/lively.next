import { string, arr } from "lively.lang";
import module from "lively.modules/src/module.js";
import { parse, query } from "lively.ast";
import { runEval } from "lively.vm";

const srcLocSym = Symbol.for("lively-source-location"),
      moduleSym = Symbol.for("lively-module-meta"),
      descriptorCache = new WeakMap();

// SourceDescriptor: Represents a code object specified by a {start, end}
// sourceLocation inside source code (moduleSource).
// Can derive useful things from it and modify the code objects source.
export class SourceDescriptor {

  constructor(sourceLocation, moduleSource) {
    if (sourceLocation && moduleSource)
      this.update(moduleSource, sourceLocation);
    else this.reset();
  }

  reset() {
    this._sourceLocation = null;
    this._source = "";
    this._ast = null;
    this._moduleSource = "";
    this._moduleAst = null;
    this._moduleScope = null;
    this._moduleImports = null;
    this._declaredAndUndeclaredNames = null;
  }

  update(moduleSource, sourceLocation) {
    if (this._moduleSource === moduleSource && 
        sourceLocation && this._sourceLocation &&
        sourceLocation.start === this._sourceLocation.start &&
        sourceLocation.end === this._sourceLocation.end
    ) return;
    this.reset();
    this._moduleSource = moduleSource;
    this._sourceLocation = sourceLocation;
  }

  get sourceLocation() {
    if (!this._sourceLocation) throw new Error("_sourceLocation not defined");
    return this._sourceLocation;
  }
  get moduleSource() {
    if (!this._moduleSource) throw new Error("_moduleSource not defined!");
    return this._moduleSource;
  }
  get moduleAst() { return this._moduleAst || (this._moduleAst = parse(this.moduleSource)); }
  get moduleScope() { return this._moduleScope || (this._moduleScope = query.topLevelDeclsAndRefs(this.ast).scope); }
  get moduleImports() { return this._moduleImports || (this._moduleImports = query.imports(this.moduleScope)); }
  get ast() {
    if (this._ast) return this._ast;
    // be as concrete as possible
    var parsed = parse(this.source), node = parsed.body[0];
    if (node.type === "ExpressionStatement") node = node.expression;
    return this._ast = node;
  }
  get source() {
    if (this._source) return this._source;
    var {moduleSource, sourceLocation: {start, end}} = this;
    return this._source = moduleSource.slice(start, end);
  }
  get type() { return this.ast.type; }

  get declaredAndUndeclaredNames() {
    if (this._declaredAndUndeclaredNames)
      return this._declaredAndUndeclaredNames;

    var parsed = this.ast,
        declaredNames = query.topLevelDeclsAndRefs(this.moduleAst).declaredNames,
        declaredImports = arr.uniq(this.moduleImports.map(({local}) => local)),
        localDeclaredNames = arr.withoutAll(declaredNames, declaredImports),
        undeclaredNames = arr.withoutAll(query.findGlobalVarRefs(parsed).map(ea => ea.name), declaredNames);

    return this._declaredAndUndeclaredNames = {
      declaredNames,
      declaredImports,
      localDeclaredNames,
      undeclaredNames
    }
  }

  changeSource(newSource) {
    var {moduleSource, sourceLocation: {start, end}} = this,
        newModuleSource = moduleSource.slice(0, start) + newSource + moduleSource.slice(end),
        newSourceLocation = {start, end: start + newSource.length}
    this.update(newModuleSource, newSourceLocation);
    this._source = newSource;
    return this;
  }

  toString() {
    var objString = string.truncate(this._source || "NO SOURCE", 35).replace(/\n/g, "");
    return `${this.constructor.name}(${objString})`;
  }

}

// RuntimeSourceDescriptor: Binding between a runtime object such as an actual
// class or function and it's source code representation. The runtime object is
// expected to have two property symbols:
// - Symbol.for("lively-module-meta"): {package: {name, version}, pathInPackage}
// - Symbol.for("lively-source-location"): value {start, end} indexes into code
// Via those the RuntimeSourceDescriptor can retrieve code and other
// code-related things of a runtime object and change its definition

export class RuntimeSourceDescriptor {

  static forObjectWithModuleSource(obj, moduleSource, optSystem) {
    var descr = this.for(obj, optSystem);
    descr.ensureSourceDescriptor(descr.sourceLocation, moduleSource);;
    return descr;
  }

  static for(obj, optSystem) {
    var descr = descriptorCache.get(obj);
    if (!descr) {
      descr = new this(obj, optSystem);
      descriptorCache.set(obj, descr);
    }
    return descr;
  }

  constructor(obj, System) {
    this.obj = obj;
    this.System = System;
    this.reset();
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

  reset() { this._sourceDescriptor = null; }

  ensureSourceDescriptor(loc, source) {
    if (!this._sourceDescriptor)
      this._sourceDescriptor = new SourceDescriptor(loc, source);
    else
      this._sourceDescriptor.update(source, loc);
    return this._sourceDescriptor;
  }

  get sourceDescriptor() {
    return this._sourceDescriptor
        || this.module.source().then(source =>
            this.ensureSourceDescriptor(this.sourceLocation, source));
  }

  async descriptorProp(name) { return (await this.sourceDescriptor)[name]; }
  get moduleSource() { return this.descriptorProp("moduleSource"); }
  get ast() { return this.descriptorProp("ast"); }
  get source() { return this.descriptorProp("source"); }
  get declaredAndUndeclaredNames() { return this.descriptorProp("declaredAndUndeclaredNames"); }

  get sourceSync() { return this._sourceDescriptor ? this._sourceDescriptor.source : ""; }
  get astSync() { return this._sourceDescriptor ? this._sourceDescriptor.ast : ""; }

  changeSourceSync(newSource) {
    var {module, _sourceDescriptor: d} = this;
    if (d && !d.moduleSource) d = null;
    if (!d && module._source) d = this.ensureSourceDescriptor(this.sourceLocation, module._source);
    if (!d) throw new Error(`Cannot changeSourceSync b/c ${this} does not have module source`);
    var source = this.updateSource(d.moduleSource, newSource);
    this.module.changeSource(source, {doEval: false});
    runEval(source, {sync: true, targetModule: this.module.id});
    return this;
  }

  async changeSource(newSource) {
    await module.changeSourceAction(oldSource =>
      this.updateSource(oldSource, newSource));
    return this;
  }

  updateSource(oldModuleSource, newDescriptorSource) {
    var {module, _sourceDescriptor: d} = this;
    if (d && d.moduleSource !== oldModuleSource) this._sourceDescriptor = d = null;
    if (!d) d = this.ensureSourceDescriptor(this.sourceLocation, oldModuleSource);
    d.changeSource(newDescriptorSource)
    Object.assign(this.sourceLocation, d.sourceLocation);
    return d.moduleSource;
  }

  toString() {
    var source = this._sourceDescriptor ? this._sourceDescriptor.source : String(this.obj),
        objString = string.truncate(source, 35).replace(/\n/g, ""),
        modName; try { modName = this.module.shortName() } catch (e) { modName = "NO MODULE!" };
    return `${this.constructor.name}(${objString} in ${modName})`;
  }

}
