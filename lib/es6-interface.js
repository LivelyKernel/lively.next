/*global process, require, global, __dirname*/

var evaluator = require("./evaluator");
var System = require("systemjs");
System.config({transpiler: 'babel', babelOptions: {}});

// var Module = require("module").Module;
// var vm = require("../../index.js");
// var uuid = require("node-uuid");
// var path = require("path");
// var lang = require("lively.lang");


// maps filenames to envs = {isLoaded: BOOL, loadError: ERROR, recorder: OBJECT}
// var loadedModules = {};
// var originalCompile = null;
// var exceptions = [module.filename];
// var scratchModule = path.join(__dirname, "es6-scratch.js"); // fallback eval target

function instrumentedFiles() {}
function isLoaded(fileName) {}

function ensureEnv(fullName, thenDo) {
  var modRec = System._loader.moduleRecords[fullName];
  if (modRec) return modRec;

  System.import(fullName)
    .then(m => thenDo(null, System._loader.moduleRecords[fullName]))
    .catch(thenDo)
}

function ensureRecorder(fullName) {}

var loadedModules = {}, exceptions = [];

function instrumentedFiles() { return Object.keys(loadedModules); }
function isLoaded(fileName) { return fileName in loadedModules; }
function ensureRecorder(fullName) { return ensureEnv(fullName).recorder; }

function ensureEnv(fullName) {
  return loadedModules[fullName]
    || (loadedModules[fullName] = {
      isInstrumented: false,
      loadError: undefined,
      // recorderName: "eval_rec_" + path.basename(fullName).replace(/[^a-z]/gi, "_"),
      recorderName: "eval_rec_" + fullName.replace(/[^a-z]/gi, "_"),
      recorder: Object.create(global)
    });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function prepareCodeForCustomCompile(source, filename, env) {
  source = String(source);
  var tfmOptions = {
        topLevelVarRecorder: env.recorder,
        varRecorderName: env.recorderName,
        dontTransform: [env.recorderName, "global"],
        recordGlobals: true
      },
      header = "var " + env.recorderName + " = global." + env.recorderName + ";\n";

  try {
    return (header + "\n"
          + ";(function() {\n"
          + evaluator.evalCodeTransform(source, tfmOptions)
          + "\n})();");
  } catch (e) { return e; }
}

function customTranslate(load) {
  // load like
  // {
  //   address: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
  //   name: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
  //   metadata: { deps: [/*...*/], entry: {/*...*/}, format: "esm", sourceMap: ... },
  //   source: "..."
  // }

  var env = ensureEnv(load.name);
  load.source = prepareCodeForCustomCompile(load.source, load.name, env);
  // console.log(load.source);
  return Promise.resolve(load);
}

function wrapModuleLoad() {
  if (System.origTranslate) return;
  System.origTranslate = System.translate
  System.translate = function(load) {
    return customTranslate(load).then(load =>
      System.origTranslate.call(System, load))
  }
}

function unwrapModuleLoad() {
  System.translate = System.origTranslate;
  delete System.origTranslate;
}

function envFor(moduleName) {}
function evalIn(moduleName, code, options) {}
function evalInAndPrint(code, module, options, thenDo) {}
function status(thenDo) {}
function statusForPrinted(moduleName, options, thenDo) {}
function reloadModule(moduleName) {}
function forgetModule(moduleName) {}
function findDependentModules(id, moduleMap) {}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function importES6Module(path, options) {
  // console.log(options);
  if (typeof options !== "undefined")
    System.config(options);
  return System.import(path);
}

module.exports = {
  import: importES6Module,
  config: System.config.bind(System),

  wrapModuleLoad: wrapModuleLoad,
  unwrapModuleLoad: unwrapModuleLoad,
  // envFor: envFor,
  // evalIn: evalIn,
  // evalInAndPrint: evalInAndPrint,
  // status: status,
  // statusForPrinted: statusForPrinted,
  // instrumentedFiles: instrumentedFiles,
  // prepareCodeForCustomCompile: prepareCodeForCustomCompile,
  // reloadModule: reloadModule,
  // forgetModule: forgetModule
}
