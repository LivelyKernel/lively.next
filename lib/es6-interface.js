/*global process, require, global, __dirname*/

var System = require("systemjs");

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
function prepareCodeForCustomCompile(source, filename, env) {}
function customCompile(content, filename) {}
function wrapModuleLoad() {}
function unwrapModuleLoad() {}
function envFor(moduleName) {}
function evalIn(moduleName, code, options) {}
function evalInAndPrint(code, module, options, thenDo) {}
function status(thenDo) {}
function statusForPrinted(moduleName, options, thenDo) {}
function reloadModule(moduleName) {}
function forgetModule(moduleName) {}
function findDependentModules(id, moduleMap) {}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = {
  // wrapModuleLoad: wrapModuleLoad,
  // unwrapModuleLoad: unwrapModuleLoad,
  envFor: envFor,
  evalIn: evalIn,
  evalInAndPrint: evalInAndPrint,
  status: status,
  statusForPrinted: statusForPrinted,
  instrumentedFiles: instrumentedFiles,
  prepareCodeForCustomCompile: prepareCodeForCustomCompile,
  reloadModule: reloadModule,
  forgetModule: forgetModule
}
