import { obj, arr } from "lively.lang";
import { getSystem } from "./src/system.js";

var defaultSystem = getSystem("default");
export { defaultSystem as System }

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