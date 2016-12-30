import { string, Path, arr, obj } from "lively.lang";
import { parse, stringify, parseFunction } from "lively.ast";
import { registerPackage } from "lively.modules/src/packages.js";
import { resource } from "lively.resources";
import { runEval } from "lively.vm";
import { module } from "lively.modules";
import { SourceDescriptor, RuntimeSourceDescriptor } from "./source-descriptors.js";
import { getPackage } from "lively.web/lively.modules/src/packages.js";

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
      backend = r.localBackend,
      config = {name: packageId, version: "0.1.0"},
      dirs = [{path: `/${packageId}/`}],
      files = [
        {path: `/${packageId}/index.js`, content: "'format esm';\n"},
        {path: `/${packageId}/package.json`,
         content: JSON.stringify(config, null, 2)}];

  dirs.forEach(dir => backend.mkdir(dir.path));
  files.forEach(({path, content}) => !backend.get(path) && backend.write(path, content));

  var packageURL = r.join(`/${packageId}/`).url;
  registerPackage(options.System, packageURL, config);
  return packageURL;
}

function packageIndexResource(packageId, options) {
  options = normalizeOptions(options);
  return resource(options.baseURL).join(`/${packageId}/index.js`);
}

function readPackageIndex(packageId, options) {
  let r = packageIndexResource(packageId, options),
      backend = r.localBackend;
  return backend.read(r.path());
}

function writePackageIndex(packageId, content, options) {
  let r = packageIndexResource(packageId, options),
      backend = r.localBackend;
  return backend.write(r.path(), content);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// object class
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function createDefaultClassDeclarationForObject(obj, packageId, options = {}) {
  // ensure that there exist a local package definition with an object class
  let className = obj.name ? string.capitalize(obj.name) : "ObjectClass",
      superClassName = obj.constructor.name || "Object",
      classSource = superClassName === "Object" ?
        `class ${className} {}\n` :
        `class ${className} extends ${superClassName} {}\n`,
      source = `export default ${classSource}\n`
             + `${className}.isLivelyObjectClass = true;`;

  writePackageIndex(packageId, source, options);
  var moduleId = packageIndexResource(packageId, options).url;
  return {source, className, moduleId};
}


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


function sourceDescriptorOfObjectClass(klass, packageId, options) {
  if (!klass.isLivelyObjectClass)
    throw new Error("Not an object class: " + klass)

  options = normalizeOptions(options)

  let classModuleResource = resource(options.baseURL).join(`/${packageId}/index.js`),
      modMeta = klass[Symbol.for("lively-module-meta")],
      {package: {name: pName}, pathInPackage: mName} = modMeta, mId;

  if (mName.includes("://")) mId = mName
  else mId = resource(getPackage(options.System, pName).url).join(mName).url;

  if (mId !== classModuleResource.url)
    throw new Error(`lively object class "${klass.name}" is not in expected module ${classModuleResource.url} but in ${mId}`);

  let source = readPackageIndex(packageId, options);
  if (!source)
    throw new Error(`lively object class "${klass.name}" is defined but cannot find its source code (tried ${classModuleResource})`);

  return RuntimeSourceDescriptor.forObjectWithModuleSource(klass, source, options.System);
}

function ensureObjectClassSource(obj, options = {}) {
  options = normalizeOptions(options);

  let packageId = packageIdOfObject(obj);

  // If object is instance of a lively object class already then we just
  // need to access its module via a source descriptor
  let klass = obj.constructor;
  if (klass.isLivelyObjectClass) {
    var descr = sourceDescriptorOfObjectClass(klass, packageId, options);
    return {
      source: descr.sourceSync,
      className: klass.name,
      moduleId: descr.module.id
    };
  }

  ensureLocalPackage(packageId, options);
  return createDefaultClassDeclarationForObject(obj, packageId, options);
}

export function ensureObjectClass(obj, opts) {
  if (obj.constructor.isLivelyObjectClass)
    return obj.constructor;

  var {source, moduleId, className} = ensureObjectClassSource(obj, opts);
  debugger;

  runEval(source, {
    sync: true, waitForPromise: false,
    targetModule: moduleId
  });

  // 4. load the class and change the objects inheritance
  let klass = module(moduleId).recorder[className];

  if (!klass)
    throw new Error(`Failed to define class ${className} in ${moduleId}`)

  if (obj.constructor !== klass) {
    obj.constructor = klass;
    obj.__proto__ = klass.prototype;
  }

  return klass;
}

export function addScript(obj, funcSource, name, options) {
  let klass = ensureObjectClass(obj, options),
      packageId = packageIdOfObject(obj),
      descr = sourceDescriptorOfObjectClass(klass, packageId, options);

  let parsedFunction = parseFunction(funcSource);
  console.assert(
    parsedFunction.type === "FunctionExpression",
    "not a function expression but: " + parsedFunction.type);

  // we manually rewrite the source to maintain whitespace as much as possible
  funcSource = funcSource.replace(/.*function\s*([^\(]+)?/, name);

  let source = descr.sourceSync,
      classDecl = descr.astSync;
  if (!classDecl)
    throw new Error("cannot find class decl of " + descr.module.id);

  let existing = classDecl.body.body.find(method =>
                  method.key.name === name && !method.static);

  if (existing) {
    source = source.slice(0, existing.start)
                 + funcSource
                 + source.slice(existing.end);
  } else {
    let insertAt = source.lastIndexOf("}");
    source = source.slice(0, insertAt)
                    + funcSource
                    + source.slice(insertAt);
  }

  if (false) {
    // descr.changeSource(source);
  } else {
  debugger;
    descr.changeSourceSync(source);
    // descr.changeSource(source);
    // runEval(descr.sourceDescriptor.moduleSource, {
    //   sync: true, waitForPromise: false,
    //   targetModule: descr.module.id
    // });
  }

  return obj[name];
}
