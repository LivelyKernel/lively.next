import path from "path";
import { arr, obj, string, graph, properties, classHelper } from "lively.lang";
import * as ast from "lively.ast";
import * as evaluator from "./evaluator";
import * as cjs from "./commonjs-interface.js";
import { Module } from "module";
var __require = (name, parent) => Module._load(name, parent);

var GLOBAL = typeof window !== "undefined" ? window : (typeof Global !== "undefined" ? Global : global);

function currentSystem() { return GLOBAL.System; }

var SystemLoader = currentSystem().constructor;

SystemLoader.prototype.__defineGetter__("__lively_vm__", function() {
  return {
    envFor: envFor,
    evaluationDone: function(moduleId) {
      var env = envFor(moduleId);
      addGetterSettersForNewVars(moduleId, env);
      runScheduledExportChanges(moduleId);
    },
    dumpConfig: function() {
      var System = currentSystem(),
          json = {
            baseURL: System.baseURL,
            transpiler: System.transpiler,
            map: System.map,
            meta: System.meta,
            packages: System.packages,
            paths: System.paths,
            packageConfigPaths: System.packageConfigPaths
          }
      return JSON.stringify(json, null, 2);
    },
    loadedModules: this.__lively_vm__loadedModules || (this.__lively_vm__loadedModules = {})
  }
});

var isNode = currentSystem().get("@system-env").node;

var debug = false;
// var debug = true;

function relative(a, b) {
  return !path || !path.relative ? b : relative(a,b);
}

function relativeName(name) {
  var base = currentSystem().baseURL.replace(/^[\w]+:\/\//, ""),
      abs = name.replace(/^[\w]+:\/\//, "");
  return relative(base, abs);
}

function join(pathA, pathB) {
  return pathA.replace(/\/$/, "") + "/" + pathB.replace(/^\//, "");
}

var node_modulesDir = resolve("lively.vm/node_modules/");

var exceptions = [
      // id => id.indexOf(resolve("node_modules/")) > -1,
      id => canonicalURL(id).indexOf(node_modulesDir) > -1,
      id => string.include(id, "babel-core/browser.js") || string.include(id, "system.src.js"),
      // id => lang.string.include(id, "lively.ast.es6.bundle.js"),
      id => id.slice(-3) !== ".js"
    ],
    pendingConfigs = [], configInitialized = false,
    esmFormatCommentRegExp = /['"]format (esm|es6)['"];/,
    cjsFormatCommentRegExp = /['"]format cjs['"];/,
    // Stolen from SystemJS
    esmRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;

function getExceptions() { return exceptions; }
function setExceptions(v) { return exceptions = v; }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// configuration
function init(cfg) {
  var SystemLoader = currentSystem().constructor;

  debug && console.log("[lively.vm es6] defining new System");
  GLOBAL.System = new SystemLoader();
  currentSystem().trace = true;

  // _currentSystem.__defineGetter__("__lively_vm__", () => module.exports);

  cfg = obj.merge({transpiler: 'babel', babelOptions: {}}, cfg);
  if (currentSystem().get("@system-env").node) {
    var nodejsCoreModules = ["addons", "assert", "buffer", "child_process",
        "cluster", "console", "crypto", "dgram", "dns", "domain", "events", "fs",
        "http", "https", "module", "net", "os", "path", "punycode", "querystring",
        "readline", "repl", "stream", "stringdecoder", "timers", "tls",
        "tty", "url", "util", "v8", "vm", "zlib"],
        map = nodejsCoreModules.reduce((map, ea) => { map[ea] = "@node/" + ea; return map; }, {});
    cfg.map = obj.merge(map, cfg.map);
    // for sth l ike map: {"lively.lang": "node_modules:lively.lang"}
    cfg.paths = obj.merge({"node_modules:*": "./node_modules/*"}, cfg.paths);
    cfg.packageConfigPaths = cfg.packageConfigPaths || ['./node_modules/*/package.json'];
    if (!cfg.hasOwnProperty("defaultJSExtensions")) cfg.defaultJSExtensions = true;
  }
  config(cfg);
}

function config(cfg) {
  // First config call needs to have baseURL. To still allow setting other
  // config parameters we cache non-baseURL calls that come before and run them
  // as soon as we get the baseURL
  if (!configInitialized && !cfg.baseURL) {
    debug && console.log("[lively.vm es6 config call queued]");
    pendingConfigs.push(cfg);
    return;
  }
  debug && console.log("[lively.vm es6 System] config");
  currentSystem().config(cfg);
  if (!configInitialized) {
    configInitialized = true;
    pendingConfigs.forEach(ea => currentSystem().config(ea));
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// loading
function importES6Module(path, options) {
  if (typeof options !== "undefined") config(options);
  return currentSystem().import(path);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module environment + runtime state
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function instrumentedFiles() { return Object.keys(currentSystem().__lively_vm__.loadedModules); }
function isLoaded(fullname) { return fullname in currentSystem().__lively_vm__.loadedModules; }

function canonicalURL(url) {
  // removes double slashes, doesn't resolve relative parts yet
  var m = url.match(/([^:]+:\/\/)(.*)/);
  if (m) {
    var protocol = m[1];
    url = m[2];
  }
  url = url.replace(/([^:])\/[\/]+/g, "$1/");
  return (protocol || "") + url;
}

function resolve(name, parentName, parentAddress) {
  // if (name.match(/^([\w+_]+:)?\/\//)) return name;
  return canonicalURL(currentSystem().normalizeSync(name, parentName, parentAddress));
}

function addGetterSettersForNewVars(moduleId, env) {
  // after eval we modify the env so that all captures vars are wrapped in
  // getter/setter to be notified of changes
  // FIXME: better to not capture via assignments but use func calls...!
  var prefix = "__lively.vm__";
  Object.keys(env).forEach(key => {
    if (key.indexOf(prefix) === 0 || env.__lookupGetter__(key)) return;
    env[prefix + key] = env[key];
    env.__defineGetter__(key, () => env[prefix + key]);
    env.__defineSetter__(key, (v) => {
      scheduleModuleExportsChange(moduleId, key, v, false/*add export*/);
      return env[prefix + key] = v;
    });
  });
}

function envFor(fullname) {
  if (currentSystem().__lively_vm__.loadedModules[fullname]) return currentSystem().__lively_vm__.loadedModules[fullname];
  var env = currentSystem().__lively_vm__.loadedModules[fullname] = {
    loadError: undefined,
    recorderName: "__rec__",
    // recorderName: "__lvVarRecorder",
    dontTransform: ["__lively_vm__", "__rec__", "__lvVarRecorder", "global", "System", "_moduleExport", "_moduleImport"].concat(ast.query.knownGlobals),
    recorder: Object.create(GLOBAL, {
      _moduleExport: {
        get() { return (name, val) => scheduleModuleExportsChange(fullname, name, val, true/*add export*/); }
      },
      _moduleImport: {
        get: function() {
          return (moduleName, name) => {
            var fullModuleName = resolve(moduleName, fullname),
                imported = currentSystem()._loader.modules[fullModuleName];
            if (!imported) throw new Error(`import of ${name} failed: ${moduleName} (tried as ${fullModuleName}) is not loaded!`);
            if (name == undefined)
              return imported.module;
            if (!imported.module.hasOwnProperty(name))
              console.warn(`import from ${moduleName}: Has no export ${name}!`);
            return imported.module[name];
            // var fullModuleName = resolve(moduleName, fullname),
            //     rec = moduleRecordFor(fullModuleName);
            // if (!rec) throw new Error(`import of ${name} failed: ${moduleName} (tried as ${fullModuleName}) is not loaded!`);
            // return rec.exports[name];
          }
        }
      }
    })
  }
  return env;
}

function moduleRecordFor(fullname) {
  var record = currentSystem()._loader.moduleRecords[fullname];
  if (!record) return null;
  if (!record.hasOwnProperty("__lively_vm__")) record.__lively_vm__ = {
    evalOnlyExport: {}
  };
  return record;
}

function updateModuleRecordOf(fullname, doFunc) {
  var record = moduleRecordFor(fullname);
  if (!record) throw new Error(`es6 environment global of ${fullname}: module not loaded, cannot get export object!`);
  record.locked = true;
  try {
    doFunc(record);
  } finally { record.locked = false; }
}

function sourceOf(moduleName, parent) {
  var name = resolve(moduleName),
      load = (currentSystem().loads && currentSystem().loads[name]) || {
        status: 'loading', address: name, name: name,
        linkSets: [], dependencies: [], metadata: {}};
  return currentSystem().fetch(load);
}

function importsAndExportsOf(moduleName) {
  return currentSystem().normalize(moduleName)
  .then(id =>
    Promise.resolve(sourceOf(id))
      .then(source => {
        var parsed = ast.parse(source),
            scope = ast.query.scopes(parsed);

        // compute imports
        var imports = scope.importDecls.reduce((imports, node) => {
          var nodes = ast.query.nodesAtIndex(parsed, node.start);
          var importStmt = arr.without(nodes, scope.node)[0];
          if (!importStmt) return imports;

          var from = importStmt.source ? importStmt.source.value : "unknown module";
          if (!importStmt.specifiers.length) // no imported vars
            return imports.concat([{
              localModule:     id,
              local:           null,
              imported:        null,
              fromModule:      from,
              importStatement: importStmt
            }]);

          return imports.concat(importStmt.specifiers.map(importSpec => {
            var imported;
            if (importSpec.type === "ImportNamespaceSpecifier") imported = "*";
            else if (importSpec.type === "ImportDefaultSpecifier") imported = "default";
            else if (importStmt.source) imported = importStmt.source.name;
            else imported = null;
            return {
              localModule:     id,
              local:           importSpec.local ? importSpec.local.name : null,
              imported:        imported,
              fromModule:      from,
              importStatement: importStmt
            }
          }))
        }, []);

        var exports = scope.exportDecls.reduce((exports, node) => {
          var nodes = ast.query.nodesAtIndex(parsed, node.start);
          var exportsStmt = arr.without(nodes, scope.node)[0];
          if (!exportsStmt) return exports;

          if (exportsStmt.type === "ExportAllDeclaration") {
            var from = exportsStmt.source ? exportsStmt.source.value : null;
            return exports.concat([{
              localModule:     id,
              local:           null,
              exported:        "*",
              fromModule:      from,
              exportStatement: exportsStmt
            }])
          }

          return exports.concat(exportsStmt.specifiers.map(exportSpec => {
            return {
              localModule:     id,
              local:           exportSpec.local ? exportSpec.local.name : null,
              exported:        exportSpec.exported ? exportSpec.exported.name : null,
              fromModule:      id,
              exportStatement: exportsStmt
            }
          }))
        }, []);

        return {
          imports: arr.uniqBy(imports, (a, b) => a.local == b.local && a.imported == b.imported && a.fromModule == b.fromModule),
          exports: arr.uniqBy(exports, (a, b) => a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule)
        }
      }))
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// update exports
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var pendingExportChanges = {};

function scheduleModuleExportsChange(moduleId, name, value, addNewExport) {
  var rec = moduleRecordFor(moduleId);
  if (rec && (name in rec.exports || addNewExport)) {
    var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
    pending[name] = value;
  }
}

function runScheduledExportChanges(moduleId) {
  var keysAndValues = pendingExportChanges[moduleId];
  if (!keysAndValues) return;
  clearPendingModuleExportChanges(moduleId);
  updateModuleExports(moduleId, keysAndValues);
}

function clearPendingModuleExportChanges(moduleId) {
  delete pendingExportChanges[moduleId];
}

function updateModuleExports(moduleId, keysAndValues) {
  updateModuleRecordOf(moduleId, (record) => {

    var newExports = [], existingExports = [];

    Object.keys(keysAndValues).forEach(name => {
      var value = keysAndValues[name];
      debug && console.log("[lively.vm es6 updateModuleExports] %s export %s = %s", relativeName(moduleId), name, String(value).slice(0,30).replace(/\n/g, "") + "...");

      var isNewExport = !(name in record.exports);
      if (isNewExport) record.__lively_vm__.evalOnlyExport[name] = true;
      // var isEvalOnlyExport = record.__lively_vm__.evalOnlyExport[name];
      record.exports[name] = value;

      if (isNewExport) newExports.push(name);
      else existingExports.push(name);
    });


    // if it's a new export we don't need to update dependencies, just the
    // module itself since no depends know about the export...
    // HMM... what about *-imports?
    newExports.forEach(name => {
      var oldM = currentSystem()._loader.modules[moduleId].module,
          m = currentSystem()._loader.modules[moduleId].module = new oldM.constructor(),
          pNames = Object.getOwnPropertyNames(record.exports);
      for (var i = 0; i < pNames.length; i++) (function(key) {
        Object.defineProperty(m, key, {
          configurable: false, enumerable: true,
          get() { return record.exports[key]; }
        });
      })(pNames[i]);
      // Object.defineProperty(System._loader.modules[fullname].module, name, {
      //   configurable: false, enumerable: true,
      //   get() { return record.exports[name]; }
      // });
    });

    // For exising exports we find the execution func of each dependent module and run that
    // FIXME this means we run the entire modules again, side effects and all!!!
    if (existingExports.length) {
      debug && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, relativeName(moduleId));
      for (var i = 0, l = record.importers.length; i < l; i++) {
        var importerModule = record.importers[i];
        if (!importerModule.locked) {
          var importerIndex = importerModule.dependencies.indexOf(record);
          importerModule.setters[importerIndex](record.exports);
          importerModule.execute();
        }
      }
    }

  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// code instrumentation
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function prepareCodeForCustomCompile(source, fullname, env) {
  source = String(source);
  var tfmOptions = {
        topLevelVarRecorder: env.recorder,
        varRecorderName: env.recorderName,
        dontTransform: env.dontTransform,
        recordGlobals: true
      },
      header = (debug ? `console.log("[lively.vm es6] executing module ${relativeName(fullname)}");\n` : "")
            + `var __lively_vm__ = System.__lively_vm__, ${env.recorderName} = __lively_vm__.envFor("${fullname}").recorder;\n`,
      footer = `\n__lively_vm__.evaluationDone("${fullname}");`;

  try {
    return header + evaluator.evalCodeTransform(source, tfmOptions) + footer;
  } catch (e) {
    console.error("Error in prepareCodeForCustomCompile", e.stack);
    return source;
  }
}

function getCachedNodejsModule(load) {
  // On nodejs we might run alongside normal node modules. To not load those
  // twice we have this little hack...
  try {
    var Module = __require("module").Module,
        id = Module._resolveFilename(load.name.replace(/^file:\/\//, "")),
        nodeModule = Module._cache[id];
    return nodeModule;
  } catch (e) {
    debug && console.log("[lively.vm es6 getCachedNodejsModule] %s unknown to nodejs", relativeName(load.name));
  }
  return null;
}

function addNodejsWrapperSource(load) {
  // On nodejs we might run alongside normal node modules. To not load those
  // twice we have this little hack...
  var m = getCachedNodejsModule(load);
  if (m) {
    load.source = `export default System._nodeRequire('${m.id}');\n`;
    load.source += properties.allOwnPropertiesOrFunctions(m.exports).map(k =>
      classHelper.isValidIdentifier(k) ?
        `export var ${k} = System._nodeRequire('${m.id}')['${k}'];` :
        `/*ignoring export "${k}" b/c it is not a valid identifier*/`).join("\n")
    debug && console.log("[lively.vm es6 customTranslate] loading %s from nodejs module cache", relativeName(load.name));
    return true;
  }
  debug && console.log("[lively.vm es6 customTranslate] %s not yet in nodejs module cache", relativeName(load.name));
  return false;
}

function customTranslate(proceed, load) {
  // load like
  // {
  //   address: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
  //   name: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
  //   metadata: { deps: [/*...*/], entry: {/*...*/}, format: "esm", sourceMap: ... },
  //   source: "..."
  // }

  if (exceptions.some(exc => exc(load.name))) {
    debug && console.log("[lively.vm es6 customTranslate ignoring] %s", relativeName(load.name));
    return proceed(load);
  }
  if (currentSystem().get("@system-env").node && addNodejsWrapperSource(load)) {
    debug && console.log("[lively.vm es6] loaded %s from nodejs cache", relativeName(load.name))
    return proceed(load);
  }

  var start = Date.now();

  var isEsm = load.metadata.format == 'esm' || load.metadata.format == 'es6'
           || (!load.metadata.format && esmFormatCommentRegExp.test(load.source.slice(0,5000)))
           || (!load.metadata.format && !cjsFormatCommentRegExp.test(load.source.slice(0,5000)) && esmRegEx.test(load.source)),
      isCjs = load.metadata.format == 'cjs',
      isGlobal = load.metadata.format == 'global';
  // console.log(load.name + " isEsm? " + isEsm)

  if (isEsm) {
    load.metadata.format = "esm";
    load.source = prepareCodeForCustomCompile(load.source, load.name, envFor(load.name));
    load.metadata["lively.vm instrumented"] = true;
    debug && console.log("[lively.vm es6] loaded %s as es6 module", relativeName(load.name))
    // debug && console.log(load.source)
  } else if (isCjs && isNode) {
    load.metadata.format = "cjs";
    var id = cjs.resolve(load.address.replace(/^file:\/\//, ""));
    load.source = cjs._prepareCodeForCustomCompile(load.source, id, cjs.envFor(id));
    load.metadata["lively.vm instrumented"] = true;
    debug && console.log("[lively.vm es6] loaded %s as instrumented cjs module", relativeName(load.name))
    // console.log("[lively.vm es6] no rewrite for cjs module", load.name)
  } else if (isGlobal) {
    load.source = prepareCodeForCustomCompile(load.source, load.name, envFor(load.name));
    load.metadata["lively.vm instrumented"] = true;
  } else {
    debug && console.log("[lively.vm es6] customTranslate ignoring %s b/c don't know how to handle global format", relativeName(load.name));
  }

  debug && console.log("[lively.vm es6 customTranslate] done %s after %sms", relativeName(load.name), Date.now()-start);
  return proceed(load);
}

function wrapModuleLoad() {
  if (!currentSystem().origTranslate) {
    currentSystem().origTranslate = currentSystem().translate
    currentSystem().translate = function(load) {
      return customTranslate(currentSystem().origTranslate.bind(currentSystem()), load);
    }
  }
}

function unwrapModuleLoad() {
  if (currentSystem().origTranslate) {
    currentSystem().translate = currentSystem().origTranslate;
    delete currentSystem().origTranslate;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// evaluation

function ensureImportsAreLoaded(code, parentModule) {
  var body = ast.parse(code).body,
      imports = body.filter(node => node.type === "ImportDeclaration");
  return Promise.all(imports.map(node => {
    var fullName = resolve(node.source.value, parentModule);
    return moduleRecordFor(fullName) ? undefined : currentSystem().import(fullName);
  })).catch(err => {
    console.error("Error ensuring imports: " + err.message);
    throw err;
  });
}

function runEval(code, options) {
  options = obj.merge({
    targetModule: null, parentModule: null,
    parentAddress: null
  }, options);

  return Promise.resolve().then(() => {
    // if (!options.targetModule) return reject(new Error("options.targetModule not defined"));
    if (!options.targetModule) {
      options.targetModule = "*scratch*"
      // resolve(options.targetModule);
    } else {
      options.targetModule = resolve(options.targetModule, options.parentModule || currentSystem().baseURL, options.parentAddress);
    }

    var fullname = options.targetModule;

    // throw new Error(`Cannot load module ${options.targetModule} (tried as ${fullName})\noriginal load error: ${e.stack}`)

    return importES6Module(fullname)
      .then(() => ensureImportsAreLoaded(code, options.targetModule))
      .then(() => {
        var env = envFor(fullname),
            rec = env.recorder,
            recName = env.recorderName,
            header = `var ${recName} = System.__lively_vm__.envFor("${fullname}").recorder,\n`
                   + `    _moduleExport = ${recName}._moduleExport,\n`
                   + `    _moduleImport = ${recName}._moduleImport;\n`;


        options = obj.merge(
          {waitForPromise: true},
          options, {
            recordGlobals: true,
            dontTransform: env.dontTransform,
            varRecorderName: recName,
            topLevelVarRecorder: rec,
            sourceURL: options.sourceURL || options.targetModule,
            context: rec,
            es6ExportFuncId: "_moduleExport",
            es6ImportFuncId: "_moduleImport",
            header: header
          });

        clearPendingModuleExportChanges(fullname);

        return evaluator.runEval(code, options).then(result => {
          currentSystem().__lively_vm__.evaluationDone(fullname); return result; })
      })
      // .catch(err => console.error(err) || err)
  });
}

function sourceChange(moduleName, newSource, options) {
  var fullname = resolve(moduleName),
      load = {
        status: 'loading',
        source: newSource,
        name: fullname,
        linkSets: [],
        dependencies: [],
        metadata: {format: "esm"}
      };

  return (currentSystem().get(fullname) ? Promise.resolve() : importES6Module(fullname))
    .then((_) => _systemTranslateParsed(load))
    .then(updateData => {
      var record = moduleRecordFor(fullname),
          _exports = (name, val) => scheduleModuleExportsChange(fullname, name, val),
          declared = updateData.declare(_exports);

      currentSystem().__lively_vm__.evaluationDone(fullname);

      // ensure dependencies are loaded
      debug && console.log("[lively.vm es6] sourceChange of %s with deps", fullname, updateData.localDeps);

      return Promise.all(
        // gather the data we need for the update, this includes looking up the
        // imported modules and getting the module record and module object as
        // a fallback (module records only exist for esm modules)
        updateData.localDeps.map(depName =>
          currentSystem().normalize(depName, fullname)
            .then(depFullname => {
                var depModule = currentSystem().get(depFullname),
                    record = moduleRecordFor(depFullname);
                return depModule && record ?
                  {name: depName, fullname: depFullname, module: depModule, record: record} :
                  importES6Module(depFullname).then((module) => ({
                    name: depName,
                    fullname: depFullname,
                    module: currentSystem().get(depFullname) || module,
                    record: moduleRecordFor(depFullname)
                  }));
            })))

      .then(deps => {
        // 1. update dependencies
        record.dependencies = deps.map(ea => ea.record);
        // hmm... for house keeping... not really needed right now, though
        var load = currentSystem().loads && currentSystem().loads[fullname];
        if (load) {
          load.deps = deps.map(ea => ea.name);
          load.depMap = deps.reduce((map, dep) => { map[dep.name] = dep.fullname; return map; }, {});
          if (load.metadata && load.metadata.entry) {
            load.metadata.entry.deps = load.deps;
            load.metadata.entry.normalizedDeps = deps.map(ea => ea.fullname);
            load.metadata.entry.declare = updateData.declare;
          }
        }
        // 2. run setters to populate imports
        deps.forEach((d,i) => declared.setters[i](d.module));
        // 3. execute module body
        return declared.execute();
      });
    });
}

function _systemTranslateParsed(load) {
  // brittle!
  // The result of System.translate is source code for a call to
  // System.register that can't be run standalone. We parse the necessary
  // details from it that we will use to re-define the module
  // (dependencies, setters, execute)
  return currentSystem().translate(load).then(translated => {
    // translated looks like
    // (function(__moduleName){System.register(["./some-es6-module.js", ...], function (_export) {
    //   "use strict";
    //   var x, z, y;
    //   return {
    //     setters: [function (_someEs6ModuleJs) { ... }],
    //     execute: function () {...}
    //   };
    // });

    var parsed            = ast.parse(translated),
        call              = parsed.body[0].expression,
        moduleName        = call.arguments[0].value,
        registerCall      = call.callee.body.body[0].expression,
        depNames          = arr.pluck(registerCall["arguments"][0].elements, "value"),
        declareFuncNode   = call.callee.body.body[0].expression["arguments"][1],
        declareFuncSource = translated.slice(declareFuncNode.start, declareFuncNode.end),
        declare           = eval(`var __moduleName = "${moduleName}";(${declareFuncSource});\n//@ sourceURL=${moduleName}\n`);
    if (typeof $morph !== "undefined" && $morph("log")) $morph("log").textString = declare;
    return {localDeps: depNames, declare: declare};
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module dependencies

function modulesMatching(stringOrRegExp) {
  var re = stringOrRegExp instanceof RegExp ? stringOrRegExp : new RegExp(stringOrRegExp);
  return Object.keys(currentSystem()._loader.modules).filter(ea => stringOrRegExp.test(ea));
}

function forgetEnvOf(fullname) {
  delete currentSystem().__lively_vm__.loadedModules[fullname]
}

function forgetModuleDeps(moduleName, opts) {
  opts = obj.merge({forgetDeps: true, forgetEnv: true}, opts)
  var id = resolve(moduleName),
      deps = findDependentsOf(id);
  deps.forEach(ea => {
    currentSystem().delete(ea);
    if (currentSystem().loads) delete currentSystem().loads[ea];
    opts.forgetEnv && forgetEnvOf(ea);
  });
  return id;
}

function forgetModule(moduleName, opts) {
  opts = obj.merge({forgetDeps: true, forgetEnv: true}, opts);
  var id = opts.forgetDeps ? forgetModuleDeps(moduleName, opts) : resolve(moduleName);
  currentSystem().delete(moduleName);
  currentSystem().delete(id);
  if (currentSystem().loads) {
    delete currentSystem().loads[moduleName];
    delete currentSystem().loads[id];
  }
  if (opts.forgetEnv) {
    forgetEnvOf(id);
    forgetEnvOf(moduleName);
  }
}

function reloadModule(moduleName, opts) {
  opts = obj.merge({reloadDeps: true, resetEnv: true}, opts);
  var id = resolve(moduleName),
      toBeReloaded = [id];
  if (opts.reloadDeps) toBeReloaded = findDependentsOf(id).concat(toBeReloaded);
  forgetModule(id, {forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv});
  return Promise.all(toBeReloaded.map(ea => ea !== id && importES6Module(ea)))
      .then(() => importES6Module(id));
}

// function computeRequireMap() {
//   return Object.keys(_currentSystem.loads).reduce((requireMap, k) => {
//     requireMap[k] = lang.obj.values(_currentSystem.loads[k].depMap);
//     return requireMap;
//   }, {});
// }

function computeRequireMap() {
  if (currentSystem().loads) {
    var store = currentSystem().loads,
        modNames = arr.uniq(Object.keys(currentSystem().__lively_vm__.loadedModules).concat(Object.keys(store)));
    return modNames.reduce((requireMap, k) => {
      var depMap = store[k] ? store[k].depMap : {};
      requireMap[k] = Object.keys(depMap).map(localName => {
        var resolvedName = depMap[localName];
        if (resolvedName === "@empty") return `${resolvedName}/${localName}`;
        return resolvedName;
      })
      return requireMap;
    }, {});
  }

  return Object.keys(currentSystem()._loader.moduleRecords).reduce((requireMap, k) => {
    requireMap[k] = currentSystem()._loader.moduleRecords[k].dependencies.filter(Boolean).map(ea => ea.name);
    return requireMap;
  }, {});
}

function findDependentsOf(id) {
  // which modules (module ids) are (in)directly import module with id
  // Let's say you have
  // module1: export var x = 23;
  // module2: import {x} from "module1.js"; export var y = x + 1;
  // module3: import {y} from "module2.js"; export var z = y + 1;
  // `findDependentsOf` gives you an answer what modules are "stale" when you
  // change module1 = module2 + module3
  return graph.hull(graph.invert(computeRequireMap()), resolve(id));
}

function findRequirementsOf(id) {
  // which modules (module ids) are (in)directly required by module with id
  // Let's say you have
  // module1: export var x = 23;
  // module2: import {x} from "module1.js"; export var y = x + 1;
  // module3: import {y} from "module2.js"; export var z = y + 1;
  // `findRequirementsOf("./module3")` will report ./module2 and ./module1
  return graph.hull(computeRequireMap(), resolve(id));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packaging
function importPackage(packageLocation, options) {
  options = obj.deepMerge({modules: [], config: {}}, options);

  // add the package to the System's config
  currentSystem().config({
    packages: {
      [packageLocation]: options.config
    },
    // hmm, indicate package.json, what if non existing?
    packageConfigPaths: [join(packageLocation, "package.json")]
  });

  // either load default entrypoint or when options.modules is defined chain-
  // load those modules
  var mods = options.modules.map(ea =>
    ea.indexOf(packageLocation) === 0 ?
      ea : join(packageLocation, ea));

  return mods.length ?
    new Promise((resolve, reject) => {
      var loadedModules = [];
      mods.reduce(                    // load chain
        (nextLoad, modName) =>
          () => importES6Module(modName)
            .then(mod => loadedModules.push(mod))
            .then(nextLoad),
        () => resolve(loadedModules))().catch(reject)
    }) : importES6Module(packageLocation);
}
/*

importPackage("http://localhost:9001/acorn", {modules: ["dist/acorn.js", "dist/walk.js", "dist/acorn_loose.js"]})
  .then(show.curry("%o"))
  .catch(show.curry("%s"))

forgetModule("http://localhost:9001/acorn/src/index.js")

Object.keys(computeRequireMap()).grep("9001/acorn").forEach(ea => forgetModule(ea));

var c = {map: {"./src.js": "http://localhost:9001/acorn/src/index.js"}}
var opts = {modules: ["src/index.js", "src/walk/index.js", "src/loose/index.js"], config: c}
importPackage("http://localhost:9001/acorn", opts)
  .then(show.curry("%s"))
  .catch(show.curry("%s"))


importPackage("http://localhost:9001/lively.ast-es6", {
  modules: ["index.js"],
  config: {}
}).then(show.curry("%s")).catch(show.curry("%s"))

*/

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/*

  function matchNames(name) { return name.startsWith("http://localhost:9001/acorn") && !name.include("dist/"); }
  function transformNames(name) { return name.replace(/http:\/\/localhost:9001\//, ""); }

  // URL.root.withFilename("traced.json").asWebResource().put(JSON.stringify(trace, null, 2));

  var outfile = 'test-acorn-bundle.js'
  var c = {
    baseURL: ".",
    transpiler: "babel",
    defaultJSExtensions: true,
    map: {
      babel: join(lively.shell.WORKSPACE_LK, "node_modules/babel-core/browser.js")
    }
  }

  exportTrace("acorn", outfile, matchNames, transformNames, c, {transpiler: "babel", defaultJSExtensions: true}).then(() => show("OK")).catch(show.curry("%s"))

*/

function exportTrace(bundleName, outfile, matchNames, transformNames, builderConfig, bundleConfig) {
  var trace = Object.keys(currentSystem().loads)
    .filter(matchNames)
    .reduce((trace, name) => {
      var load = currentSystem().loads[name];
      load.metadata && load.metadata && load.metadata.entry && (delete load.metadata.entry);
      // delete load.source
      load.source = getOrigSource(name)
      if (load.name) load.name = transformNames(load.name);
      if (load.address) load.address = transformNames(load.address);
      load.depMap = Object.keys(load.depMap).reduce((depMap, name) => {
        depMap[name] = transformNames(load.depMap[name]);
        return depMap;
      }, {});
      // load.metadata && load.metadata && load.metadata.entry && (load.metadata.entry.module = null);
      trace[name] = load;
      return trace;
    }, {});

  return _runBuilderInNodejs(bundleName, outfile, trace, builderConfig, bundleConfig);

  function getOrigSource(address) {
    return new URL(address).asWebResource().get().content
  }
}

function _runBuilderInNodejs(bundleName, outfile, trace, builderConfig, bundleConfig) {
  
  var names = Object.keys(trace).map(name => trace[name].name);

  if (!bundleConfig.bundles) bundleConfig.bundles = {};
  bundleConfig.bundles[bundleName] = names;
  
  var program = `var trace = ${JSON.stringify(trace, null, 2)};\n`;
  program += `var outputFile = '${outfile}';\n`
  program += `var builderConfig = ${JSON.stringify(builderConfig, null, 2)};\n`;
  program += `var bundleConfig = ${JSON.stringify(bundleConfig, null, 2)};\n`;
  program += `var livelyVMDir = '${join(lively.shell.WORKSPACE_LK, "node_modules/lively.vm/")}';\n`;
  program += `var path = require("path");
var Builder = require(livelyVMDir + 'node_modules/systemjs-builder');
var builder = new Builder();
builder.config(builderConfig);

  // delete require.cache[require.resolve("/Users/robert/Lively/LivelyKernel2/traced.json")]
  // var x = require("/Users/robert/Lively/LivelyKernel2/traced.json")

  // Object.keys(x).forEach(name => {
  //   x[name].source = String(fs.readFileSync(name.replace("http://localhost:9001/", "/Users/robert/Lively/LivelyKernel2/")))
  // });

builder.bundle(trace, outputFile)
  .then(() => {
    require("fs").appendFileSync(outputFile, '\\nSystem.config(' + JSON.stringify(bundleConfig, null, 2) + ');\\n');
    console.log("%s bundled", outputFile);
  })
  .catch(err => { console.error(err); process.exit(1); });
`

  var programFile = join(lively.shell.WORKSPACE_LK, ".lively.modules-bundle-program.js");

  return writeProgram()
    .then(() => runProgram())
    // .then(() => deleteProgram(), (err) => { deleteProgram(); throw err; });
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function runProgram() {
    return new Promise((resolve, reject) => {
      lively.shell.run("node " + programFile, {cwd: lively.shell.WORKSPACE_LK},
        (err, cmd) => cmd.getCode() > 0 ? reject(new Error(cmd.resultString(true))) : resolve())
    })
  }

  function writeProgram() {
    return new Promise((resolve, reject) =>
        lively.shell.writeFile(programFile, program,
        (cmd) => cmd.getCode() > 0 ? reject(cmd.resultString(true)) : resolve()))
  }
  
  function deleteProgram() {
    return new Promise((resolve, reject) => lively.shell.rm(programFile, (err) => err ? reject(err) : resolve()));
  }
}

function groupIntoPackages(moduleNames, packageNames) {

  return arr.groupBy(moduleNames, groupFor);

  function groupFor(moduleName) {
    var fullname = resolve(moduleName),
        matching = packageNames.filter(p => fullname.indexOf(p) === 0);
    return matching.length ?
      matching.reduce((specific, ea) => ea.length > specific.length ? ea : specific) :
      "no group";
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// update after source changes...
if (currentSystem().origTranslate) { unwrapModuleLoad(); wrapModuleLoad(); }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  // internals
  currentSystem,
  init as _init,
  config,
  moduleRecordFor as _moduleRecordFor,
  updateModuleRecordOf as _updateModuleRecordOf,
  updateModuleExports as _updateModuleExports,
  computeRequireMap as _computeRequireMap,
  getExceptions,
  setExceptions,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  sourceOf,
  envFor,
  // status,
  // statusForPrinted,
  importsAndExportsOf,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // eval + changes
  runEval,
  sourceChange,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // loading + dependencies
  resolve,
  modulesMatching,
  importES6Module as import,
  // reloadModule: reloadModule,
  reloadModule,
  forgetModule,
  forgetModuleDeps,
  findRequirementsOf,
  findDependentsOf,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // packaging
  groupIntoPackages,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // instrumentation
  wrapModuleLoad,
  unwrapModuleLoad
}
