import { string, Path, arr } from "lively.lang";
import { parse, stringify, parseFunction } from "lively.ast";
import { resource } from "lively.resources";
import { runEval } from "lively.vm";
import { RuntimeSourceDescriptor } from "./source-descriptors.js";
import { registerPackage, importPackage, getPackage } from "lively.modules/src/packages.js";
import module from "lively.modules/src/module.js";
import { toJsIdentifier } from "./util.js";
import { ImportInjector } from "lively.modules/src/import-modification.js";
import ExportLookup from "lively.modules/src/export-lookup.js";

const objectPackageSym = Symbol.for("lively-object-package-data"),
      defaultBaseURL = "local://lively-object-modules",
      globalClasses = Object.keys(System.global).map(ea => {
        var val = System.global[ea];
        return typeof val === "function" && val.name && val;
      }).filter(Boolean);


function getObjectPackageId(obj) {
  return obj[objectPackageSym] ? obj[objectPackageSym].packageId : null;
}

function addNewPackageIdTo(obj) {
  let packageId = string.newUUID(),
      parentPackageId = null,
      meta = obj[objectPackageSym];
  if (!meta) meta = obj[objectPackageSym] = {};
  else parentPackageId = meta.packageId;
  Object.assign(meta, {packageId, parentPackageId});
  return packageId;
}

export function addScript(object, funcSource, name, options = {}) {
  return ObjectPackage.forObject(object, options).addScript(funcSource, name);
}

export function isObjectClassFor(klass, obj) {
  let packageId = getObjectPackageId(obj);
  if (!packageId) return false;
  var modMeta = klass[Symbol.for("lively-module-meta")];
  var packageName = modMeta && modMeta.package && modMeta.package.name || null;
  return packageName === packageId;
}

export default class ObjectPackage {

  static get packageStore() {
    return this._packageStore || (this._packageStore = {});
  }

  static forObject(object, options) {
    var id = getObjectPackageId(object) || addNewPackageIdTo(object);
    return this.withIdAndObject(id, object, options);
  }

  static fork(object, options) {
    var id = addNewPackageIdTo(object);
    return this.withIdAndObject(id, object, options);
  }

  static withIdAndObject(id, object, options) {
    return this.packageStore[id]
        || (this.packageStore[id] = new this(id, object, options));
  }

  constructor(id, object, options) {
    this._id = id;
    this._object = object;
    this.options = this.normalizeOptions(options);
  }

  normalizeOptions(options) {
    options = { baseURL: defaultBaseURL, System: System, ...options };
    options.baseURL = options.baseURL.replace(/\/$/, "");
    return options;
  }

  get id() { return this._id; }
  get name() { return this.id; }
  get object() { return this._object; }
  get System() { return this.options.System; }
  get baseURL() { return this.options.baseURL; }
  get packageURL() { return this.baseURL + `/${this.id}`; }
  get config() { return {name: this.name, version: "0.1.0"}; }
  get objectModule() {
    return this._objectModule
        || (this._objectModule = new ObjectModule("index.js", this));
  }
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
    await Promise.all(files.map(async ea => {
      if (!(await ea.resource.exists())) await ea.resource.write(ea.content);
    }));
    await this.objectModule.ensureExistance();

    await registerPackage(this.System, this.packageURL, this.config);
    
    console.log(`${this.packageURL} REGISTERED`)

    return this;
  }

  async ensureObjectClass() {
    await this.ensureExistance();
    return this.objectModule.ensureObjectClass();
  }

  async addScript(funcSource, name) {
    await this.ensureObjectClass();
    return this.objectModule.addScript(funcSource, name);
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
  get moduleName() { return this._moduleName; }
  get object() { return this.objectPackage.object; }
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

  async ensureObjectClass() {
    var { object, System } = this;

    if (isObjectClassFor(object.constructor, object))
      return object.constructor;

    var {source, moduleId, className, bindings} = await this.ensureObjectClassSource(),
        mod = module(System, moduleId);

    if (className === object.constructor.name)
      throw new Error(`Name of new object class equals name of existing class: ${className}`);

    if (bindings) for (var key in bindings) mod.define(key, bindings[key]);

    var evalResult = runEval(source, {sync: true, targetModule: moduleId, System});
    if (evalResult.isError)
      throw evalResult.value;

  // load the class and change the objects inheritance
    let klass = mod.recorder[className];

    if (!klass)
      throw new Error(`Failed to define class ${className} in ${moduleId}`);

    if (object.constructor !== klass) {
      object.constructor = klass;
      object.__proto__ = klass.prototype;
    }

    return klass;
  }

  ensureObjectClassSource() {
    // If object is instance of a lively object class already then we just
    // need to access its module via a source descriptor
    let klass = this.object.constructor;
    if (!isObjectClassFor(klass, this.object))
      return this.createDefaultClassDeclarationForObject();

    var descr = RuntimeSourceDescriptor.for(klass, this.System);
    return {
      source: descr.source,
      className: klass.name,
      moduleId: descr.module.id,
      bindings: null
    };
  }

  async createDefaultClassDeclarationForObject() {
    // ensure that there exist a local package definition with an object class

    let { System, object, systemModule: module } = this,
        className = object.name ? string.capitalize(toJsIdentifier(object.name)) : "ObjectClass",
        superClass = object.constructor,
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
        var {standaloneImport} = ImportInjector.run(System, module.id, module.package(), "", exportForClass);
        source += standaloneImport + '\n\n';
      } else {
        bindings = {[superClassName]: superClass};
      }
    }

    var classSource = superClassName === "Object" ?
          `class ${className} {}\n` :
          `class ${className} extends ${superClassName} {}\n`;
    source += `export default ${classSource}\n`;

    await module.changeSource(source);
    await module.load();

    return {source, className, moduleId: this.url, bindings};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // object scripting

  async addScript(funcSource, name) {
    let klass = await this.ensureObjectClass(),
        descr = RuntimeSourceDescriptor.for(klass, this.System),
        parsedFunction = parseFunction(funcSource);

    if (!name) name = Path("id.name").get(parsedFunction);
    if (!name) throw new Error(`No name, cannot add ${string.truncate(funcSource, 30).replace(/\n/g, "")}!`);
    let methodName = toJsIdentifier(name);

    console.assert(
      parsedFunction.type === "FunctionExpression",
      "not a function expression but: " + parsedFunction.type);

    // we manually rewrite the source to maintain whitespace as much as possible
    funcSource = funcSource.replace(/.*function\s*([^\(]+)?/, methodName);

    let source = descr.source,
        classDecl = descr.ast;
    if (!classDecl)
      throw new Error("cannot find class decl of " + descr.module.id);

    let existing = classDecl.body.body.find(method =>
                  method.key.name === methodName && !method.static);

    if (existing) {
      source = source.slice(0, existing.start)
                 + funcSource
                 + source.slice(existing.end);
    } else {
      let insertAt = source.lastIndexOf("}"),
          before = source.slice(0, insertAt),
          after = source.slice(insertAt);
      if (!/\n\s*$/m.test(before)) before += "\n";
      funcSource = string.changeIndent(funcSource, "  ", 1);
      if (!/^[ ]*\n/m.test(after)) after = "\n" + after;
      source = before + funcSource + after;
    }

    await descr.changeSource(source);

    return {script: klass.prototype[methodName], klass, module: descr.module.id, methodName};

  }

}
