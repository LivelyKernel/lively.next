import { relative } from "path";
import * as lang from "lively.lang";
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
    loadedModules: this.__loadedModules || (this.__loadedModules = {})
  }
});

var debug = false;

function relativeName(name) {
  var base = currentSystem().baseURL.replace(/^[\w]+:\/\//, ""),
      abs = name.replace(/^[\w]+:\/\//, "");
  return relative(base, abs);
}

var exceptions = [
      id => id.indexOf(resolve("node_modules/")) > -1,
      // id => id.indexOf(resolve("lively.vm/node_modules/")) > -1,
      id => lang.string.include(id, "babel-core/browser.js") || lang.string.include(id, "system.src.js"),
      // id => lang.string.include(id, "lively.ast.es6.bundle.js"),
      id => id.slice(-3) !== ".js"
    ],
    pendingConfigs = [], configInitialized = false,
    esmFormatCommentRegExp = /['"]format (esm|es6)['"];/,
    cjsFormatCommentRegExp = /['"]format cjs['"];/,
    // Stolen from SystemJS
    esmRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;
    
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// configuration
function init(cfg) {
  var SystemLoader = currentSystem().constructor;

  debug && console.log("[lively.vm es6] defining new System");
  GLOBAL.System = new SystemLoader();
  currentSystem().trace = true;
  
  // _currentSystem.__defineGetter__("__lively_vm__", () => module.exports);
  
  cfg = lang.obj.merge({transpiler: 'babel', babelOptions: {}}, cfg);
  if (currentSystem().get("@system-env").node) {
    var nodejsCoreModules = ["addons", "assert", "buffer", "child_process",
        "cluster", "console", "crypto", "dgram", "dns", "domain", "events", "fs",
        "http", "https", "module", "net", "os", "path", "punycode", "querystring",
        "readline", "repl", "stream", "stringdecoder", "timers", "tls",
        "tty", "url", "util", "v8", "vm", "zlib"],
        map = nodejsCoreModules.reduce((map, ea) => { map[ea] = "@node/" + ea; return map; }, {});
    cfg.map = lang.obj.merge(map, cfg.map);
    // for sth l ike map: {"lively.lang": "node_modules:lively.lang"}
    cfg.paths = lang.obj.merge({"node_modules:*": "./node_modules/*"}, cfg.paths);
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
function instrumentedFiles() { return Object.keys(currentSystem().__lively_vm__.loadedModules); }
function isLoaded(fullname) { return fullname in currentSystem().__lively_vm__.loadedModules; }

function resolve(name, parentName, parentAddress) {
  // if (name.match(/^([\w+_]+:)?\/\//)) return name;
  return currentSystem().normalizeSync(name, parentName, parentAddress);
}

function envFor(fullname) {
  if (currentSystem().__lively_vm__.loadedModules[fullname]) return currentSystem().__lively_vm__.loadedModules[fullname];
  var env = currentSystem().__lively_vm__.loadedModules[fullname] = {
    isInstrumented: false,
    loadError: undefined,
    recorderName: "__lvVarRecorder",
    dontTransform: ["__lvVarRecorder", "global", "System", "_moduleExport", "_moduleImport"],
    recorder: Object.create(GLOBAL, {
      _moduleExport: {
        get() { return updateModuleExports.bind(null, fullname); }
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


function updateModuleExports(fullname, name, value) {
  updateModuleRecordOf(fullname, (record) => {
    debug && console.log("[lively.vm es6 updateModuleExports] %s export %s = %s", relativeName(fullname), name, String(value));

    var isNewExport = !(name in record.exports);
    if (isNewExport) record.__lively_vm__.evalOnlyExport[name] = true;
    var isEvalOnlyExport = record.__lively_vm__.evalOnlyExport[name];
    record.exports[name] = value;

    if (isEvalOnlyExport) {
      // if it's a new export we don't need to update dependencies, just the
      // module itself since no depends know about the export...
      // HMM... what about *-imports?
      if (isNewExport) {
        var oldM = currentSystem()._loader.modules[fullname].module;
        var m = currentSystem()._loader.modules[fullname].module = new oldM.constructor();
        var pNames = Object.getOwnPropertyNames(record.exports);
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
      }
    } else {
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

function prepareCodeForCustomCompile(source, fullname, env) {
  source = String(source);
  var tfmOptions = {
        topLevelVarRecorder: env.recorder,
        varRecorderName: env.recorderName,
        dontTransform: env.dontTransform,
        recordGlobals: true
      },
      header = (debug ? `console.log("[lively.vm es6] executing module ${relativeName(fullname)}");\n` : "")
            + `var ${env.recorderName} = System.__lively_vm__.envFor("${fullname}").recorder;\n`;

  try {
    return header + evaluator.evalCodeTransform(source, tfmOptions);
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
    load.source += lang.properties.allOwnPropertiesOrFunctions(m.exports).map(k =>
      lang.classHelper.isValidIdentifier(k) ? 
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

  if (currentSystem().get("@system-env").node) {
    var isEsm = load.metadata.format == 'esm' || load.metadata.format == 'es6'
             || (!load.metadata.format && esmFormatCommentRegExp.test(load.source.slice(0,5000)))
             || (!load.metadata.format && !cjsFormatCommentRegExp.test(load.source.slice(0,5000)) && esmRegEx.test(load.source)),
        isCjs = load.metadata.format == 'cjs';
    // console.log(load.name + " isEsm? " + isEsm)

    if (isEsm) {
      load.metadata.format = "esm";
      load.source = prepareCodeForCustomCompile(load.source, load.name, envFor(load.name));
      load.metadata["lively.vm instrumented"] = true;
      debug && console.log("[lively.vm es6] loaded %s as es6 module", relativeName(load.name))
      // debug && console.log(load.source)
    } else if (isCjs) {
      load.metadata.format = "cjs";
      var id = cjs.resolve(load.address.replace(/^file:\/\//, ""));
      load.source = cjs._prepareCodeForCustomCompile(load.source, id, cjs.envFor(id));
      load.metadata["lively.vm instrumented"] = true;
      debug && console.log("[lively.vm es6] loaded %s as instrumented cjs module", relativeName(load.name))
      // console.log("[lively.vm es6] no rewrite for cjs module", load.name)
    } else {
      debug && console.log("[lively.vm es6] customTranslate ignoring %s b/c don't know how to handle global format", relativeName(load.name));
    }
  } else {
    // on non-nodejs systems currently only esm format is supported
    load.source = prepareCodeForCustomCompile(load.source, load.name, envFor(load.name));
    load.metadata["lively.vm instrumented"] = true;
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
  options = lang.obj.merge({
    targetModule: null, parentModule: null,
    parentAddress: null, printed: null
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
            recName = env.recorderName;
        options = lang.obj.merge(
          {waitForPromise: true},
          options, {
            recordGlobals: true,
            dontTransform: env.dontTransform,
            varRecorderName: recName,
            topLevelVarRecorder: rec,
            sourceURL: options.targetModule,
            context: rec,
            es6ExportFuncId: "_moduleExport",
            es6ImportFuncId: "_moduleImport"
          });


        code = `var ${env.recorderName} = ${env.recorderName} || System.__lively_vm__.envFor("${fullname}").recorder;\n`
             + `var _moduleExport = ${env.recorderName}._moduleExport, _moduleImport = ${env.recorderName}._moduleImport;\n${code}`;

        return evaluator.runEval(code, options);
      })
      .then(result => {
        // if (options.printed) result.value = printResult(result, options.printed);
        // if (options.printed) result.value = String(result.value);
        return result;
      });
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

  return _systemTranslateParsed(load).then(updateData => {
    var record = moduleRecordFor(fullname),
        _exports = (name, val) => updateModuleExports(fullname, name, val),
        declared = updateData.declare(_exports);

    return Promise.all(updateData.localDeps.map(depName => {
      var depFullname = resolve(depName),
          depRecord = moduleRecordFor(depFullname);
      return depRecord ? depRecord :
        importES6Module(depFullname).then(() =>
          ({name: depName, fullname: depFullname, record: moduleRecordFor(depFullname)}));
    }))
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
      record.dependencies.forEach((d,i) => declared.setters[i](d.exports));
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
    var parsed = ast.parse(translated)
    var call = parsed.body[0].expression;
    var moduleName = call.arguments[0].value;
    var registerCall = call.callee.body.body[0].expression;
    var depNames = lang.arr.pluck(registerCall["arguments"][0].elements, "value").map(ea => resolve(ea, moduleName))
    var declareFuncNode = call.callee.body.body[0].expression["arguments"][1]
    var declareFuncSource = translated.slice(declareFuncNode.start, declareFuncNode.end)
    var declare = eval(`var __moduleName = "${moduleName}";(${declareFuncSource});`)
    return {localDeps: depNames, declare: declare};
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module dependencies

function forgetModuleDeps(moduleName) {
  var id = resolve(moduleName),
      deps = findDependentsOf(id);
  deps.forEach(ea => currentSystem().delete(ea));
  return id;
}

function forgetModule(moduleName) {
  currentSystem().delete(forgetModuleDeps(moduleName));
}

// function computeRequireMap() {
//   return Object.keys(_currentSystem.loads).reduce((requireMap, k) => {
//     requireMap[k] = lang.obj.values(_currentSystem.loads[k].depMap);
//     return requireMap;
//   }, {});
// }

function computeRequireMap() {
  return Object.keys(currentSystem()._loader.moduleRecords).reduce((requireMap, k) => {
    requireMap[k] = currentSystem()._loader.moduleRecords[k].dependencies.map(ea => ea.name);
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
  return lang.graph.hull(lang.graph.invert(computeRequireMap()), resolve(id));
}

function findRequirementsOf(id) {
  // which modules (module ids) are (in)directly required by module with id
  // Let's say you have
  // module1: export var x = 23;
  // module2: import {x} from "module1.js"; export var y = x + 1;
  // module3: import {y} from "module2.js"; export var z = y + 1;
  // `findRequirementsOf("./module3")` will report ./module2 and ./module1
  return lang.graph.hull(computeRequireMap(), resolve(id));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  // internals
  currentSystem,
  init as _init,
  config,
  moduleRecordFor as _moduleRecordFor,
  updateModuleRecordOf as _updateModuleRecordOf,
  updateModuleExports as _updateModuleExports,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  sourceOf,
  envFor,
  // status,
  // statusForPrinted,
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // eval + changes
  runEval,
  sourceChange,
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // loading + dependencies
  resolve,
  importES6Module as import,
  // reloadModule: reloadModule,
  forgetModule,
  forgetModuleDeps,
  findRequirementsOf,
  findDependentsOf,
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // instrumentation
  wrapModuleLoad,
  unwrapModuleLoad
}
