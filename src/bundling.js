import { Path, arr } from "lively.lang";
import * as ast from "lively.ast";
import { writeFile, removeFile } from "../tests/helpers.js";
export { bundle }

function bundle(System, bundleFile, files) {
  // files = [{moduleName, nameInBundle}]
  return Promise.all(files.map(ea => {
        var moduleName = typeof ea === "string" ? ea : ea.moduleName;
        if (!moduleName) throw new Error("Error bundling module " + ea);
        var newName = ea.nameInBundle || moduleName;
        return System.normalize(moduleName)
          .then(url =>
            (System.get(url)  ? Promise.resolve() : System.import(url))
              .then(() => createRegisterModuleFor(System, url, ea.nameInBundle)));
      }))
    .then(sources =>
      System.normalize(bundleFile)
        .then(outFile => writeFile(outFile, sources.join('\n'))));
}

function createRegisterModuleFor(System, url, nameInBundle, formatOverride) {
  var load = System.loads && System.loads[url];
  if (!load) throw new Error(url + " not loaded / traced!");
  var format = formatOverride || load.metadata.format;
  if (format === "json") {
    return createJSONRegisterDynamicModuleFromLoad(System, url, nameInBundle, load);
  } else if (format === "esm" || format === "es6") {
    return createRegisterModuleFromLoad(load, nameInBundle);
  } else if (format === "global") {
    return createGlobalRegisterDynamicModule(System, url, nameInBundle, load.source, load.deps);
  } else if (format === "cjs") {
    return createCommonJSRegisterDynamicModule(System, url, nameInBundle, load.metadata.entry.executingRequire, load.deps);
  } else {
    throw new Error("Cannot create register module for " + url + " with format " + format);
  }
}

function createRegisterModuleFromLoad(load, nameInBundle) {
  return new Promise((resolve, reject) => {
    var name = load.name;
  
    if (!load.source) return reject(new Error("No source for " + name));
    
    var parsed = ast.parse(load.source);
    
    if ("CallExpression" !== Path("body.0.expression.type").get(parsed))
      return reject(new Error("Load source is not a call Expression (" + name + ")"));
    if ("CallExpression" !== Path("body.0.expression.callee.body.body.0.expression.type").get(parsed))
      return reject(new Error("Load source body inner is not a System.register call expressions (" + name + ")"));
    if ("System"         !== Path("body.0.expression.callee.body.body.0.expression.callee.object.name").get(parsed))
      return reject(new Error("Not a call to System! (" + name + ")"));
    if ("register"       !== Path("body.0.expression.callee.body.body.0.expression.callee.property.name").get(parsed))
      return reject(new Error("Not a call to System.register! (" + name + ")"));
    
    var moduleName = nameInBundle || Path("body.0.expression.arguments.0.value").get(parsed);
    
    if (!moduleName)
      return reject(new Error("Could not extract module name from " + name));

    var registerCall = Path("body.0.expression.callee.body.body.0.expression").get(parsed)
    registerCall["arguments"].unshift({type: "Literal", value: moduleName})
  
    resolve(ast.stringify(registerCall));
  });
}

function createGlobalRegisterDynamicModule(System, url, nameInBundle, source, deps) {
  var modSource = `var _retrieveGlobal = System.get("@@global-helpers").prepareGlobal(module.id, null, null);\n`
                + `(function() {\n${source}\n})();\n`
                + "return _retrieveGlobal();"
  return createRegisterDynamicModuleWithSource(System, url, nameInBundle, modSource, false, deps);  
}

function createCommonJSRegisterDynamicModule(System, url, nameInBundle, executingRequire, deps) {
  // FIXME! deps...
  var load = {status: 'loading', address: url, name: url, linkSets: [], dependencies: [], metadata: {}};
  return System.fetch(load).then(source =>
    createRegisterDynamicModuleWithSource(System, url, nameInBundle, source, executingRequire, deps));
}

function createJSONRegisterDynamicModuleFromLoad(System, url, nameInBundle, load) {
  return createRegisterDynamicModuleWithSource(System, url, nameInBundle, "return " + load.source, false, []);
}

function createRegisterDynamicModuleWithSource(System, url, nameInBundle, source, executingRequire, deps) {
  var depsString = "[" + (deps.length ? "'" + deps.join("', '") + "'" : "") + "]";
  return Promise.resolve(
    `System.registerDynamic('${nameInBundle || url}', ${depsString}, ${!!executingRequire}, `
  + `function(require, exports, module) {\n${source}\n});\n`);
}
