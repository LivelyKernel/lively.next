import { obj, arr } from "lively.lang";
import { getSystem, removeSystem, moduleEnv as _moduleEnv, moduleRecordFor as _moduleRecordFor, sourceOf as _sourceOf, printSystemConfig as _printSystemConfig } from "./src/system.js";

// System accessors
var GLOBAL = typeof window !== "undefined" ? window :
              (typeof global !== "undefined" ? global :
                (typeof self !== "undefined" ? self : this));

var defaultSystem = defaultSystem || getSystem("default");
function changeSystem(newSystem, makeGlobal) {
  defaultSystem = newSystem;
  if (makeGlobal) GLOBAL.System = newSystem;
}
function sourceOf(id) { return _sourceOf(defaultSystem, id); }
function moduleEnv(id) { return _moduleEnv(defaultSystem, id); }
function moduleRecordFor(id) { return _moduleRecordFor(defaultSystem, id); }
function printSystemConfig() { return _printSystemConfig(defaultSystem); }
export { defaultSystem as System, getSystem, removeSystem, printSystemConfig, changeSystem, sourceOf, moduleEnv, moduleRecordFor }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { registerPackage as _registerPackage } from './src/packages.js'
function registerPackage(packageURL) { return _registerPackage(defaultSystem, packageURL); }
export { registerPackage }

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
  reloadModule as _reloadModule
} from './src/dependencies.js'
function findDependentsOf(module) { return _findDependentsOf(defaultSystem, module); }
function findRequirementsOf(module) { return _findRequirementsOf(defaultSystem, module); }
function forgetModule(module, opts) { return _forgetModule(defaultSystem, module, opts); }
function reloadModule(module, opts) { return _reloadModule(defaultSystem, module, opts); }
export { findDependentsOf, findRequirementsOf, forgetModule, reloadModule }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// hooks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { isInstalled as _isHookInstalled, install as _installHook, remove as _removeHook } from './src/hooks.js';
function isHookInstalled(methodName, hookOrName) { return _isHookInstalled(defaultSystem, methodName, hookOrName); }
function installHook(hookName, hook) { return _installHook(defaultSystem, hookName, hook); }
function removeHook(methodName, hookOrName) { return _removeHook(defaultSystem, methodName, hookOrName); }
export { isHookInstalled, installHook, removeHook }