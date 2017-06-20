import { string, Path, arr } from "lively.lang";
import { parse, isValidIdentifier, stringify, parseFunction } from "lively.ast";
import { resource } from "lively.resources";
import { runEval } from "lively.vm";
import { RuntimeSourceDescriptor } from "./source-descriptors.js";
import { ensurePackage, registerPackage, importPackage, lookupPackage } from "lively.modules/src/packages/package.js";
import module from "lively.modules/src/module.js";
import { toJsIdentifier } from "./util.js";
import { ImportInjector } from "lively.modules/src/import-modification.js";
import ExportLookup from "lively.modules/src/export-lookup.js";
import { adoptObject } from "./runtime.js";

const objectPackageSym = Symbol.for("lively-object-package-data"),
      // defaultBaseURL = System.normalizeSync("lively.morphic/parts/packages/"),
      defaultBaseURL = "local://lively-object-modules",
      globalClasses = Object.keys(System.global).map(ea => {
        let val = System.global[ea];
        return typeof val === "function" && val.name && val;
      }).filter(Boolean);


function normalizeOptions(options) {
  options = { baseURL: defaultBaseURL, System: System, ...options };
  options.baseURL = options.baseURL.replace(/\/$/, "");
  return options;
}

export function addScript(object, funcSource, name, options = {}) {
  var p = options.package || ObjectPackage.lookupPackageForObject(object, options);
  if (!p) throw new Error(`Object is not part of an object package: ${object}`);
  return p.addScript(object, funcSource, name);
}

export function isObjectClass(klass, options) {
  let {System} = normalizeOptions(options),
      modMeta = klass[Symbol.for("lively-module-meta")],
      pname = modMeta ? modMeta.package.name : null,
      {pkg} = pname ? lookupPackage(System, pname) : {};
  return pkg ? !!ObjectPackage.forSystemPackage(pkg) : false
}

export default class ObjectPackage {

  static get packageStore() {
    return this._packageStore || (this._packageStore = {});
  }

  static lookupPackageForObject(object, options) {
    return this.lookupPackageForClass(object.constructor, options);
  }

  static lookupPackageForClass(klass, options) {
    let {System} = normalizeOptions(options),
        modMeta = klass[Symbol.for("lively-module-meta")],
        pname = modMeta ? modMeta.package.name : null,
        {pkg} = pname ? lookupPackage(System, pname) : {};
    return pkg ? ObjectPackage.forSystemPackage(pkg) : null;
  }

  static forSystemPackage(systemPackage) {
    return this.packageStore[systemPackage.name];
  }

  static withId(id, options) {
    return this.packageStore[id]
        || (this.packageStore[id] = new this(id, options));
  }

  constructor(id, options) {
    this._id = id;
    this.options = normalizeOptions(options);
  }

  get id() { return this._id; }
  get name() { return this.id; }
  get System() { return this.options.System; }
  get baseURL() { return this.options.baseURL; }
  get packageURL() { return this.baseURL + `/${this.id}`; }
  get config() { return {name: this.name, version: "0.1.0", lively: {isObjectPackage: true}}; }
  get systemPackage() { return lookupPackage(this.System, this.packageURL, true).pkg; }
  get objectModule() {
    return this._objectModule
        || (this._objectModule = new ObjectModule("index.js", this));
  }
  get objectClass() { return this.objectModule.objectClass; }
  resource(path = "") { return resource(this.packageURL).join(path); }

  load() { return importPackage(this.System, this.packageURL); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // creation

  async ensureExistance() {
    let resource = this.resource("/");
    if (await resource.exists()) return;

    let dirs = [{resource}],
        files = [
          {resource: this.resource("package.json"),
            content: JSON.stringify(this.config, null, 2)}];

    await Promise.all(dirs.map(ea => ea.resource.mkdir()));
    await Promise.all(files.map(async ea =>
      !(await ea.resource.exists()) && await ea.resource.write(ea.content)));
    await this.objectModule.ensureExistance();

    let {System, packageURL, config} = this;
    let p = await ensurePackage(System, packageURL);
    p.registerWithConfig(config);

    console.log(`${this.packageURL} REGISTERED`);

    return this;
  }

  async ensureObjectClass(superClass) {
    await this.ensureExistance();
    return this.objectModule.ensureObjectClass(superClass);
  }

  async adoptObject(object) {
    if (this.objectClass === object.constructor) return;
    var klass = await this.ensureObjectClass(object.constructor);
    adoptObject(object, klass);
  }

  addScript(object, funcSource, name) {
    return this.objectModule.addScript(object, funcSource, name);
  }

  remove() {
    this.systemPackage.remove();
    delete ObjectPackage.packageStore[this.id];
    return this.resource().remove();
  }

  async renameObjectClass(newName, objects = []) {
    let {objectClass: klass, System} = this;

    if (!klass || klass.name === newName) return klass;

    if (!isValidIdentifier(newName))
      throw new Error(`${newName} is not a valid name for a class`);

    let descr = RuntimeSourceDescriptor.for(klass, System),
        {source, ast: {id: {start, end}}} = descr;

    await descr.changeSource(source.slice(0, start) + newName + source.slice(end));

    let newKlass = this.objectClass;
    objects.forEach(ea => {
      ea.constructor = newKlass;
      ea.__proto__ = newKlass.prototype;
    });

    return newKlass;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // forking
  async fork(forkedPackageName, opts) {
    var {System, baseURL, objectClass} = this;
    opts = {System, baseURL, ...opts};
    let descr = RuntimeSourceDescriptor.for(objectClass),
        {moduleSource} = descr._renamedSource(forkedPackageName),
        newPackage = ObjectPackage.withId(forkedPackageName, opts);
    await newPackage.ensureExistance();
    let {objectModule: {systemModule}} = newPackage;
    await systemModule.load({format: "esm"});
    await systemModule.changeSource(moduleSource);
    return newPackage;
  }

}


class ObjectModule {

  constructor(moduleName, objectPackage) {
    if (!moduleName) throw new Error("ObjectModule needs package!");
    if (!objectPackage) throw new Error("ObjectModule needs package!");
    this._moduleName = moduleName;
    this._objectPackage = objectPackage;
  }

  get objectPackage() { return this._objectPackage; }
  get objectClass() {
    let m = this.systemModule;
    return m.isLoaded() ? m.System.get(m.id).default : null;
  }
  get moduleName() { return this._moduleName; }
  get systemModule() { return module(this.System, this.url); }
  get System() { return this.objectPackage.System; }
  get resource() { return this.objectPackage.resource(this.moduleName); }
  get url() { return this.resource.url; }

  read() { return this.resource.read(); }
  write(content) { return this.resource.write(content); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async ensureExistance() {
    let r = this.resource;
    if (!(await r.exists())) {
      await r.write("'format esm';\n");
      this.System.config({meta: {[this.url]: {format: "esm"}}});
    }
    return this;
  }

  ensureObjectClass(superClass) {
    let klass = this.objectClass;
    if (klass && klass.prototype.__proto__ === superClass.prototype)
      return klass;

    return Promise.resolve(this.ensureObjectClassSource(superClass)).then(ensured => {
      let {source, moduleId, className, bindings} = ensured,
          { System } = this,
          mod = module(System, moduleId);

      if (bindings) for (var key in bindings) mod.define(key, bindings[key]);

      let evalResult = runEval(source, {sync: true, targetModule: moduleId, System});
      if (evalResult.isError)
        throw evalResult.value;

      // load the class and change the objects inheritance
      let klass = mod.recorder[className];

      if (!klass)
        throw new Error(`Failed to define class ${className} in ${moduleId}`);

      return klass;
    });
  }

  ensureObjectClassSource(superClass) {
    // If object is instance of a lively object class already then we just
    // need to access its module via a source descriptor
    return this.createDefaultClassDeclaration(superClass);
  }

  async createDefaultClassDeclaration(superClass = Object) {
    // ensure that there exist an object package definition with an object class

    let { System, systemModule: module, objectPackage } = this,
        className = string.capitalize(toJsIdentifier(objectPackage.id)),
        superClassName = superClass.name,
        isAnonymousSuperclass = !superClassName,
        globalSuperClass = globalClasses.includes(superClass),
        source = "",
        bindings = null;

    if (isAnonymousSuperclass) {
      superClassName = "__anonymous_superclass__";
      bindings = {[superClassName]: superClass};

    } else if (!globalSuperClass) {
      var exportForClass = await ExportLookup.findExportOfValue(superClass, System);
      if (exportForClass) {
        var {standaloneImport} = ImportInjector.run(
          System, module.id, module.package(), "", exportForClass);
        source += standaloneImport + '\n\n';
      } else {
        bindings = {[superClassName]: superClass};
      }
    }

    if (className === superClassName) className = "Object" + className;

    var classSource = superClassName === "Object" ?
          `class ${className} {}\n` :
          `class ${className} extends ${superClassName} {}\n`;
    source += `export default ${classSource}\n`;

    await module.changeSource(source);
    await module.load();

    return {source, className, moduleId: this.url, bindings};
  }

  // async renameObjectClass(object, newName) {
  //   var { System } = this;
  // 
  //   if (!isObjectClassFor(object.constructor, object))
  //     throw new Error(`cannot renameObjectClass b/c class of ${object} is not an object class`);
  // 
  //   let oldClass = await this.ensureObjectClass(),
  //       descr = RuntimeSourceDescriptor.for(oldClass, this.System),
  //       {source, ast, module} = descr,
  //       classId = ast.id,
  //       newSource = source.slice(0, ast.id.start) + newName + source.slice(ast.id.end);
  // 
  //   await descr.changeSource(newSource);
  // 
  //   let newClass = module.recorder[newName];
  // 
  //   if (!newClass)
  //     throw new Error(`Failed to define class ${newName} in ${module.id}`);
  // 
  //   if (object.constructor !== newClass) {
  //     object.constructor = newClass;
  //     object.__proto__ = newClass.prototype;
  //   }
  // 
  //   return newClass;
  // }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // object scripting

  async addScript(object, functionOrSource, name) {
    let klass = object.constructor === this.objectClass ?
                  object.constructor :
                  await this.ensureObjectClass(object.constructor),
        funcSource = typeof functionOrSource === "function" ?
          String(functionOrSource) : functionOrSource,
        parsedFunction = parseFunction(funcSource),
        descr = RuntimeSourceDescriptor.for(klass, this.System);

    if (!name) name = Path("id.name").get(parsedFunction);
    if (!name) throw new Error(`No name, cannot add ${string.truncate(funcSource, 30).replace(/\n/g, "")}!`);
    let methodName = toJsIdentifier(name);


    console.assert(
      parsedFunction.type === "FunctionExpression"
   || parsedFunction.type === "ArrowFunctionExpression",
      "not a function expression but: " + parsedFunction.type);

    // we manually rewrite the source to maintain whitespace as much as possible
    var args = parsedFunction.params.map(({start,end}) => funcSource.slice(start, end)),
        body = parsedFunction.body.type === "BlockStatement" ?
          funcSource.slice(parsedFunction.body.start, parsedFunction.body.end) :
            `{ return ${funcSource.slice(parsedFunction.body.start, parsedFunction.body.end)} }`,
        methodSource = `${methodName}(${args.join(",")}) ${body}`;
    if (parsedFunction.type === "ArrowFunctionExpression")
      parsedFunction.type = "FunctionExpression";


    let source = descr.source,
        classDecl = descr.ast;
    if (!classDecl)
      throw new Error("cannot find class decl of " + descr.module.id);

    let existing = classDecl.body.body.find(method =>
                  method.key.name === methodName && !method.static);

    if (existing) {
      source = source.slice(0, existing.start)
                 + methodSource
                 + source.slice(existing.end);
    } else {
      let insertAt = source.lastIndexOf("}"),
          before = source.slice(0, insertAt),
          after = source.slice(insertAt);
      if (!/\n\s*$/m.test(before)) before += "\n";
      methodSource = string.changeIndent(methodSource, "  ", 1);
      if (!/^[ ]*\n/m.test(after)) after = "\n" + after;
      source = before + methodSource + after;
    }

    await descr.changeSource(source);

    return {script: klass.prototype[methodName], klass, module: descr.module.id, methodName};

  }

}
