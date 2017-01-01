import { string, Path, arr, obj } from "lively.lang";
import { parse, stringify, parseFunction } from "lively.ast";
import { resource } from "lively.resources";
import { runEval } from "lively.vm";
import { RuntimeSourceDescriptor } from "./source-descriptors.js";
import { registerPackage, getPackage } from "lively.modules/src/packages.js";
import module from "lively.modules/src/module.js";
import { toJsIdentifier } from "./util.js";

const objectPackageSym = Symbol.for("lively-object-package-data"),
      defaultBaseURL = "local://lively-object-modules";

function normalizeOptions(options) {
  return {
    baseURL: defaultBaseURL,
    System: System,
    ...options
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// package related
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function packageIdOfObject(obj) {
  let packageId = obj[objectPackageSym] && obj[objectPackageSym].packageId;
  if (!packageId) {
    packageId = string.newUUID();
    if (!obj[objectPackageSym]) obj[objectPackageSym] = {};
    obj[objectPackageSym].packageId = packageId;
  }
  return packageId;
}


export async function ensureLocalPackage(packageId, options) {
  options = normalizeOptions(options);

  let r = resource(options.baseURL),
      config = {name: packageId, version: "0.1.0"},
      dirs = [{path: `/${packageId}/`}],
      files = [
        {path: `/${packageId}/index.js`, content: "'format esm';\n"},
        {path: `/${packageId}/package.json`,
         content: JSON.stringify(config, null, 2)}];

  await Promise.all(dirs.map(({path}) => r.join(path).mkdir()));
  await Promise.all(files.map(async ({path, content}) => {
    var file = r.join(path);
    if (!(await file.exists())) await file.write(content)
  }));

  var packageURL = r.join(`/${packageId}/`).url;
  await registerPackage(options.System, packageURL, config);

  return packageURL;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// object class
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var globalClasses = Object.keys(System.global).map(ea => {
  var val = System.global[ea];
  return typeof val === "function" && val.name && val;
}).filter(Boolean);


function findDefaultClass(moduleSource) {
  var stmts = parse(moduleSource).body, classDecl;

  for (var i = 0; i < stmts.length; i++)
    if (stmts[i].type === "ExportDefaultDeclaration"
     && stmts[i].declaration.type === "ClassDeclaration") {
       classDecl = stmts[i].declaration;
       break;
    }

  return classDecl ?
    {node: classDecl, sourceLocation: obj.select(classDecl, ["start", "end"])} :
    null
}

async function ensureObjectClassSource(obj, options) {
  let packageId = packageIdOfObject(obj);

  // If object is instance of a lively object class already then we just
  // need to access its module via a source descriptor
  let klass = obj.constructor;
  if (klass.isLivelyObjectClass) {
    var descr = RuntimeSourceDescriptor.for(klass, options.System);
    return {
      source: descr.source,
      className: klass.name,
      moduleId: descr.module.id,
      bindings: null
    };
  }

  await ensureLocalPackage(packageId, options);

  return createDefaultClassDeclarationForObject(obj, packageId, options);
}

async function createDefaultClassDeclarationForObject(obj, packageId, options = {}) {
  // ensure that there exist a local package definition with an object class

  let className = obj.name ? string.capitalize(toJsIdentifier(obj.name)) : "ObjectClass",
      superClass = obj.constructor,
      superClassName = superClass.name,
      isAnonymousSuperclass = !superClassName,
      globalSuperClass = globalClasses.includes(superClass),
      bindings = null;

  if (isAnonymousSuperclass) {
    superClassName = "__anonymous_superclass__";
    bindings = {[superClassName]: superClass};

  } else if (!globalSuperClass) {
    bindings = {[superClassName]: superClass};
  }

  var classSource = superClassName === "Object" ?
        `class ${className} {}\n` :
        `class ${className} extends ${superClassName} {}\n`,
      source = `export default ${classSource}\n`
             + `${className}.isLivelyObjectClass = true;`;

  var defaultResource = resource(options.baseURL).join(`/${packageId}/index.js`);
  await defaultResource.write(source);
  return {source, className, moduleId: defaultResource.url, bindings};
}

export async function ensureObjectClass(obj, opts) {
  if (obj.constructor.isLivelyObjectClass)
    return obj.constructor;

  opts = normalizeOptions(opts);

  var {source, moduleId, className, bindings} = await ensureObjectClassSource(obj, opts),
      mod = module(opts.System, moduleId);  

  if (bindings) for (var key in bindings) mod.define(key, bindings[key]);

  runEval(source, {sync: true, targetModule: moduleId, System: opts.System});

  // load the class and change the objects inheritance
  let klass = mod.recorder[className];

  if (!klass)
    throw new Error(`Failed to define class ${className} in ${moduleId}`)

  if (obj.constructor !== klass) {
    obj.constructor = klass;
    obj.__proto__ = klass.prototype;
  }

  return klass;
}

async function addScriptToClass(obj, klass, funcSource, name, options) {
  options = normalizeOptions(options);

  let methodName = toJsIdentifier(name),
      packageId = packageIdOfObject(obj),
      descr = RuntimeSourceDescriptor.for(klass, options.System);

  let parsedFunction = parseFunction(funcSource);
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

  return {script: obj[methodName], klass, obj, module: descr.module.id, methodName};
}

export async function addScript(obj, funcSource, name, options) {
  options = normalizeOptions(options);
  let klass = options.targetClass || await ensureObjectClass(obj, options);
  return await addScriptToClass(obj, klass, funcSource, name, options);
}
