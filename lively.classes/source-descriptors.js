/* global global,self */
import { string, arr, Path } from 'lively.lang';
import { parse, query } from 'lively.ast';
import { runEval } from 'lively.vm';
import { isOverridden } from './util.js';

const objMetaSym = Symbol.for('lively-object-meta');
const moduleSym = Symbol.for('lively-module-meta');
let G = typeof window !== 'undefined'
  ? window
  : typeof global !== 'undefined'
    ? global
    : typeof self !== 'undefined' ? self : this;
// descriptorCache = new WeakMap();
const descriptorCache = new Map();
const localSystem = G.System;

// SourceDescriptor: Represents a code object specified by a {start, end}
// sourceLocation inside source code (moduleSource).
// Can derive useful things from it and modify the code objects source.
export class SourceDescriptor {
  constructor (sourceLocation, moduleSource) {
    if (sourceLocation && moduleSource) { this.update(moduleSource, sourceLocation); } else this.reset();
  }

  reset () {
    this._sourceLocation = null;
    this._source = '';
    this._ast = null;
    this._moduleSource = '';
    this._moduleAst = null;
    this._moduleScope = null;
    this._moduleImports = null;
    this._declaredAndUndeclaredNames = null;
  }

  update (moduleSource, sourceLocation) {
    if (this._moduleSource === moduleSource &&
        sourceLocation && this._sourceLocation &&
        sourceLocation.start === this._sourceLocation.start &&
        sourceLocation.end === this._sourceLocation.end
    ) return;
    this.reset();
    this._moduleSource = moduleSource;
    this._sourceLocation = sourceLocation;
  }

  get sourceLocation () {
    if (!this._sourceLocation) throw new Error('_sourceLocation not defined');
    return this._sourceLocation;
  }

  get moduleSource () {
    if (!this._moduleSource) throw new Error('_moduleSource not defined!');
    return this._moduleSource;
  }

  get moduleAst () { return this._moduleAst || (this._moduleAst = parse(this.moduleSource, { withComments: true })); }
  get moduleScope () { return this._moduleScope || (this._moduleScope = query.topLevelDeclsAndRefs(this.ast).scope); }
  get moduleImports () { return this._moduleImports || (this._moduleImports = query.imports(this.moduleScope)); }
  get ast () {
    if (this._ast) return this._ast;
    // be as concrete as possible
    let parsed = parse(this.source, { withComments: true }); let node = parsed.body[0];
    if (node.type === 'ExpressionStatement') node = node.expression;
    return this._ast = node;
  }

  get source () {
    if (this._source) return this._source;
    let { moduleSource, sourceLocation: { start, end } } = this;
    return this._source = moduleSource.slice(start, end);
  }

  get type () { return this.ast.type; }

  get declaredAndUndeclaredNames () {
    if (this._declaredAndUndeclaredNames) { return this._declaredAndUndeclaredNames; }

    let parsed = this.ast;
    let declaredNames = query.topLevelDeclsAndRefs(this.moduleAst).declaredNames;
    let declaredImports = arr.uniq(this.moduleImports.map(({ local }) => local));
    let localDeclaredNames = arr.withoutAll(declaredNames, declaredImports);
    let undeclaredNames = arr.withoutAll(query.findGlobalVarRefs(parsed).map(ea => ea.name), declaredNames);

    return this._declaredAndUndeclaredNames = {
      declaredNames,
      declaredImports,
      localDeclaredNames,
      undeclaredNames
    };
  }

  changeSource (newSource) {
    let { moduleSource, sourceLocation: { start, end } } = this;
    let newModuleSource = moduleSource.slice(0, start) + newSource + moduleSource.slice(end);
    let newSourceLocation = { start, end: start + newSource.length };
    this.update(newModuleSource, newSourceLocation);
    this._source = newSource;
    return this;
  }

  toString () {
    let objString = string.truncate(this._source || 'NO SOURCE', 35).replace(/\n/g, '');
    return `${this.constructor.name}(${objString})`;
  }
}

// RuntimeSourceDescriptor: Binding between a runtime object such as an actual
// class or function and it's source code representation. The runtime object is
// expected to have two property symbols:
// - Symbol.for("lively-module-meta"): {package: {name, version}, pathInPackage}
// - Symbol.for("lively-object-meta"): value {start, end} indexes into code
// Via those the RuntimeSourceDescriptor can retrieve code and other
// code-related things of a runtime object and change its definition

export class RuntimeSourceDescriptor {
  static forObjectWithModuleSource (obj, moduleSource, optSystem) {
    let descr = this.for(obj, optSystem);
    descr.ensureSourceDescriptor(descr.sourceLocation, moduleSource);
    return descr;
  }

  static for (obj, optSystem) {
    let descr = descriptorCache.get(obj);
    if (!descr) {
      descr = new this(obj, optSystem);
      descriptorCache.set(obj, descr);
    }
    return descr;
  }

  constructor (obj, System) {
    this.obj = obj;
    this.System = System;
    this.reset();
  }

  reset () {
    this._source = '';
    this._sourceLocation = null;
    this._ast = null;
    this._moduleSource = '';
    this._moduleAst = null;
    this._moduleScope = null;
    this._moduleImports = null;
    this._declaredAndUndeclaredNames = null;
  }

  resetIfChanged () {
    let { moduleSource } = this.meta;
    if (this._moduleSource && moduleSource && this._moduleSource !== moduleSource) { this.reset(); }
  }

  get System () { return this._System || localSystem; }
  set System (S) { this._System = S; }

  get module () {
    let { obj, System } = this;
    if (!obj[moduleSym]) { throw new Error('runtime object of source descriptor has no module data'); }

    let { package: { name: pName }, pathInPackage: mName } = obj[moduleSym];
    let mId = mName.includes('://') ? mName : pName + '/' + mName;
    let m = this.System._scripting.module(System, mId);

    if (!m._frozenModule && !m._source && this.moduleSource) {
      m.setSource(this.moduleSource);
    }
    return m;
  }

  get meta () {
    let { obj } = this;
    if (!obj[objMetaSym]) { throw new Error('runtime object of source descriptor has no lively meta data'); }
    return obj[objMetaSym];
  }

  set meta (meta) {
    this.obj[objMetaSym] = meta;
    if (meta.hasOwnProperty('start') && meta.hasOwnProperty('end')) { this._sourceLocation = { start: meta.start, end: meta.end }; }
    if (meta.hasOwnProperty('moduleSource')) { this._moduleSource = meta.moduleSource; }
  }

  get sourceLocation () {
    this.resetIfChanged();
    if (this._sourceLocation) return this._sourceLocation;
    let { meta: { start, end } } = this;
    if (start === undefined || end === undefined) { throw new Error('lively meta data has no start/end'); }
    return this._sourceLocation = { start, end };
  }

  get moduleSource () {
    this.resetIfChanged();
    if (this._moduleSource) return this._moduleSource;
    let { meta: { moduleSource } } = this;
    if (moduleSource === undefined) { throw new Error('lively meta data has no moduleSource'); }
    return this._moduleSource = moduleSource;
  }

  get moduleAst () {
    this.resetIfChanged();
    return this._moduleAst || (this._moduleAst = parse(this.moduleSource, { withComments: true }));
  }

  get moduleScope () {
    this.resetIfChanged();
    return this._moduleScope || (this._moduleScope = query.topLevelDeclsAndRefs(this.moduleAst).scope);
  }

  get moduleImports () {
    this.resetIfChanged();
    return this._moduleImports || (this._moduleImports = query.imports(this.moduleScope));
  }

  get declaredAndUndeclaredNames () {
    this.resetIfChanged();
    if (this._declaredAndUndeclaredNames) { return this._declaredAndUndeclaredNames; }

    let parsed = this.ast;
    let { declaredNames } = query.topLevelDeclsAndRefs(this.moduleAst, { jslintGlobalComment: true });
    let declaredImports = arr.uniq(this.moduleImports.map(({ local }) => local));
    let localDeclaredNames = arr.withoutAll(declaredNames, declaredImports);
    let undeclaredNames = arr.withoutAll(
      query.findGlobalVarRefs(parsed).map(ea => ea.name),
      declaredNames);

    return this._declaredAndUndeclaredNames = {
      declaredNames,
      declaredImports,
      localDeclaredNames,
      undeclaredNames
    };
  }

  get source () {
    this.resetIfChanged();
    if (this._source) return this._source;
    let { sourceLocation: { start, end }, moduleSource } = this;
    return this._source = moduleSource.slice(start, end);
  }

  get ast () {
    this.resetIfChanged();
    if (this._ast) return this._ast;
    // be as concrete as possible
    let parsed = parse(this.source, { withComments: true }); let node = parsed.body[0];
    if (node.type === 'ExpressionStatement') node = node.expression;
    return this._ast = node;
  }

  get type () { return this.ast.type; }

  get name () {
    if (this.type === 'ClassDeclaration') {
      let { start, end } = this.ast.id;
      return this.source.slice(start, end);
    }
    return 'unknown';
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  changeSourceSync (newSource) {
    let { System } = this;
    this._basicChangeSource(newSource);
    this.module.changeSource(this.moduleSource, { doSave: true });
    let result = runEval(newSource, { sync: true, targetModule: this.module.id, System });
    if (result.isError) throw result.value;
    return this;
  }

  async changeSource (newSource) {
    let { module } = this;
    await module.changeSourceAction(oldSource => {
      if (oldSource !== this.moduleSource) {
        throw new Error(`source of module ${module.id} and source of ${this} don't match`);
      }
      this._basicChangeSource(newSource);
      return this.moduleSource;
    });
    return this;
  }

  _modifiedSource (newSource) {
    let { moduleSource, sourceLocation: { start, end } } = this;
    return {
      moduleSource: moduleSource.slice(0, start) + newSource + moduleSource.slice(end),
      sourceLocation: { start, end: start + newSource.length }
    };
  }

  _renamedSource (newName) {
    let { type, id: { start, end } } = this.ast;
    if (type !== 'ClassDeclaration') { throw new Error(`Don't know how to rename ${type}`); }
    return this._modifiedSource(
      this.source.slice(0, start) +
      newName +
      this.source.slice(end));
  }

  _basicChangeSource (newSource) {
    let { meta } = this;
    let { moduleSource, sourceLocation } = this._modifiedSource(newSource);
    this.reset();
    this.meta = { ...meta, moduleSource, ...sourceLocation };
    this._sourceLocation = sourceLocation;
    this._moduleSource = moduleSource;
    this._source = newSource;
    return this;
  }

  toString () {
    let source = this.source || String(this.obj);
    let objString = string.truncate(source, 35).replace(/\n/g, '');
    let modName; try { modName = this.module.shortName(); } catch (e) { modName = 'NO MODULE!'; }
    return `${this.constructor.name}(${objString} in ${modName})`;
  }
}

export function lexicalClassMembers (klass) {
  const { ast: parsed, type } = RuntimeSourceDescriptor.for(klass);
  if (type !== 'ClassDeclaration') { throw new Error(`Expected class but got ${type}`); }

  const members = Path('body.body').get(parsed);

  return members.map(node => {
    const { static: isStatic, kind, key: { type: keyType, name: id, value: literalId } } = node;
    const name = id || literalId;
    const overridden = isOverridden(klass, name);
    const base = isStatic ? klass : klass.prototype;
    const value = kind === 'get'
      ? base.__lookupGetter__(name)
      : kind === 'set'
        ? base.__lookupSetter__(name)
        : base[name];
    return { static: isStatic, name, value, kind, owner: klass, overridden };
  });
}
