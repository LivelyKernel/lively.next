import { obj, arr } from "lively.lang";

// System accessors
import {
  getSystem, removeSystem, prepareSystem,
  moduleEnv as _moduleEnv,
  moduleRecordFor as _moduleRecordFor,
  sourceOf as _sourceOf,
  printSystemConfig as _printSystemConfig
} from "./src/system.js";

var GLOBAL = typeof window !== "undefined" ? window :
              (typeof global !== "undefined" ? global :
                (typeof self !== "undefined" ? self : this));

var defaultSystem = defaultSystem || prepareSystem(GLOBAL.System);
function changeSystem(newSystem, makeGlobal) {
  defaultSystem = newSystem;
  if (makeGlobal) GLOBAL.System = newSystem;
  return newSystem;
}
function sourceOf(id) { return _sourceOf(defaultSystem, id); }
function moduleEnv(id) { return _moduleEnv(defaultSystem, id); }
function moduleRecordFor(id) { return _moduleRecordFor(defaultSystem, id); }
function printSystemConfig() { return _printSystemConfig(defaultSystem); }
export { defaultSystem as System, getSystem, removeSystem, printSystemConfig, changeSystem, sourceOf, moduleEnv, moduleRecordFor }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { importPackage as _importPackage, registerPackage as _registerPackage, groupIntoPackages as _groupIntoPackages } from './src/packages.js'
function importPackage(packageURL) { return _importPackage(defaultSystem, packageURL); }
function registerPackage(packageURL) { return _registerPackage(defaultSystem, packageURL); }
function groupIntoPackages(moduleNames, packageNames) { return _groupIntoPackages(defaultSystem, moduleNames, packageNames); }
export { importPackage, registerPackage, groupIntoPackages }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// changing modules
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { moduleSourceChange as _moduleSourceChange } from './src/change.js'
function moduleSourceChange(moduleName, newSource, options) { return _moduleSourceChange(defaultSystem, moduleName, newSource, options); }
export { moduleSourceChange };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// dependencies
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import {
  findDependentsOf as _findDependentsOf,
  findRequirementsOf as _findRequirementsOf,
  forgetModule as _forgetModule,
  reloadModule as _reloadModule,
  computeRequireMap
} from './src/dependencies.js'
import { importsAndExportsOf as _importsAndExportsOf } from './src/import-export.js';
function findDependentsOf(module) { return _findDependentsOf(defaultSystem, module); }
function findRequirementsOf(module) { return _findRequirementsOf(defaultSystem, module); }
function forgetModule(module, opts) { return _forgetModule(defaultSystem, module, opts); }
function reloadModule(module, opts) { return _reloadModule(defaultSystem, module, opts); }
function requireMap() { return computeRequireMap(defaultSystem); }
function importsAndExportsOf(System, moduleName, parent) { return _importsAndExportsOf(defaultSystem, moduleName, parent); }
export { findDependentsOf, findRequirementsOf, forgetModule, reloadModule, requireMap, importsAndExportsOf }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// hooks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { isInstalled as _isHookInstalled, install as _installHook, remove as _removeHook } from './src/hooks.js';
function isHookInstalled(methodName, hookOrName) { return _isHookInstalled(defaultSystem, methodName, hookOrName); }
function installHook(hookName, hook) { return _installHook(defaultSystem, hookName, hook); }
function removeHook(methodName, hookOrName) { return _removeHook(defaultSystem, methodName, hookOrName); }
export { isHookInstalled, installHook, removeHook }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// instrumentation
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { wrapModuleLoad as _wrapModuleLoad, unwrapModuleLoad as _unwrapModuleLoad/*, getExceptions, setExceptions*/ } from "./src/instrumentation.js";
function wrapModuleLoad() { _wrapModuleLoad(defaultSystem); }
function unwrapModuleLoad() { _unwrapModuleLoad(defaultSystem); }
export { wrapModuleLoad, unwrapModuleLoad }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// eval
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { runEval as _runEval } from './src/eval.js';
function runEval(code, options) { return _runEval(defaultSystem, code, options); }
export { runEval };

