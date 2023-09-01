/*

  ### `lively.modules.importPackage(packageName)`

  To load a project into your runtime you will typically use
  `lively.modules.importPackage('some-package-name')`. `'some-package-name'`
  should resolve to a directory with a JSON package config file (typically
  package.json) that at least defines a `name` field. The package will be
  imported, i.e. the main module of the package will be loaded via
  `lively.modules.System.import('some-package-name/index.js')`. By default the
  name of main is `'index.js'` but this can be customized via the `main` field
  of the package config file.

  The result of the importPackage call is the promise for loading the main module.

  #### Specifics of the lively package format

  The main purpose of the lively package format is to make it easy to integrate
  dependent packages in the lively.module and es6 module systems. It allows you
  to define a `"lively"` field in the main JSON that allows to set a separate
  main module, a `"packageMap"` object that maps names that can be used in
  `import` statements to directories of sub-packages. When sub-packages are
  discovered while importing a package, those are recursively imported as well.

  Here is an example how a config inside a package.json file could look like.

  ```json
  {
    "name": "some-package",
    "main": "main-for-non-es6.js",
    "lively": {
      "main": "for-es6.js",
      "packageMap": {
        "dep1": "./node_modules/dep1",
        "dep2": "./libs/dep2"
      }
    }
  }
  ```

  For more examples, see [lively.modules/package.json](https://github.com/LivelyKernel/lively.modules/package.json), or [lively.ast/package.json](https://github.com/LivelyKernel/lively.ast/package.json).

  ### `lively.modules.System`

  The main lively.modules interface provides access to a System loader object
  (currently from the [SystemJS library](https://github.com/systemjs/systemjs)
  that has some improvements added, e.g.   the name normalization respects the
  lively package conventions, translate is   used to instrument code by
  default, etc.

  By default the loader instance is the same as the global loader (e.g.
  window.System). Note: *The System instance can be easily changed* to support
  multiple, isolated environnments.

  Example:

  ```js
  var testSystem = lively.modules.getSystem("my-test-system");
  lively.modules.changeSystem(testSystem, true); // true: make the System global
  System.import("some-module"); // uses the new System loader
  ```

  Now all state (what modules are loaded, their metadata, etc) are stored in
  `testSystem`. Changing to another System allows to define different name
  resolution approach etc.

  Side note: Since all System related implementation functions defined in the
  modules in src/ will take a System loader object as first parameter, the
  implementation is loader independent.

  ### Loader state / module state

  - `lively.modules.loadedModules()`: Returns a list of ids of the currently loaded modules.

  - lively.modules.printSystemConfig(): Returns a stringified version of the [SystemJS config](https://github.com/systemjs/systemjs/blob/master/docs/config-api.md). Useful for debugging SystemJS issues

  #### `lively.modules.requireMap()`

  Will return a JS object whose keys are module ids and the corresponding
  values are lists of module ids of those modules that dependent on the key
  module (including the key module itself). I.e. the importers of that module.

  ### instrumentation

  By default lively.modules will hook into the `System.translate` process so that source code of modules get transformed to allow recording of their internal evaluation state (that is then captured in `moduleEnv`s). You can enable and disable this behavior by implementing the translate callback in the plugin provided.

  ### evaluation

  * This is handled by the [lively.vm module](https://github.com/LivelyKernel/lively.vm)!

  ### ModuleInterface

  #### `lively.modules.module(moduleId)`

  Returns an instance of ModuleInterface with the following methods:

  ##### `ModuleInterface>>dependents()`

  Which modules (module ids) are (in)directly import module with id.

  Let's say you have

  - module1.js: `export var x = 23;`
  - module2.js: `import {x} from "module1.js"; export var y = x + 1;`
  - module3.js: `import {y} from "module2.js"; export var z = y + 1;`

  `module("module1.js").dependents()` returns [module("module2"), module("module3")]

  ##### `ModuleInterface>>requirements()`

  which modules (module ids) are (in)directly required by module with id?

  Let's say you have

  - module1: `export var x = 23;`
  - module2: `import {x} from "module1.js"; export var y = x + 1;`
  - module3: `import {y} from "module2.js"; export var z = y + 1;`

  `module("module3").requirements()` will report [module("module2"), module("module1")]

  ##### `async ModuleInterface>>changeSource(newSource, options)`

  To redefine a module's source code at runtime you can use the
  changeSource method. Given `a.js` from the previous example you can run
  `module('a.js').changeSource('var x = 24;\nexport x;')`.
  This will a) evaluate the changed code and b) try to modify the actual file
  behind the module. In browser environments this is done via a `PUT` request,
  in node.js `fs.writeFile` is used.

  ##### `async ModuleInterface>>reload(options)``

  Will re-import the module identified by `moduleName`. By default this will
  also reload all direct and indirect dependencies of that module. You can
  control that behavior via `options`, the default value of it is
  `{reloadDeps: true, resetEnv: true}`.

  ##### `ModuleInterface>>unload(options)`

  Will remove the module from the loaded module set of lively.modules.System.
  `options` are by default `{forgetDeps: true, forgetEnv: true}`.

  ##### `async ModuleInterface>>imports()` and `async ModuleInterface>>exports()`

  Import and export state. For exports this includes the local name of the
  exported variable, its export name, etc. For imports it includes the imported
  variable name, the module from where it was imported etc.

  Example:

  ```js
  await module("lively.modules/index.js").exports();
    // =>
    //   [{
    //       exported: "getSystem",
    //       local: "getSystem",
    //       fromModule: "http://localhost:9001/node_modules/lively.modules/index.js",
    //     }, ...]

  await module("lively.modules/index.js").imports();
    //   [{
    //       fromModule: "lively.lang",
    //       local: "obj",
    //       localModule: "http://localhost:9001/node_modules/lively.modules/index.js"
    //     }, {
    //       fromModule: "./src/system.js",
    //       local: "getSystem",
    //       localModule: "http://localhost:9001/node_modules/lively.modules/index.js"
    //     }, ...]
    //   })
  ```

  ##### `async ModuleInterface>>source()`

  Returns the source code of the module.

  ##### `async ModuleInterface>>env()`

  Returns the evaluation environment of the module.

  A "module env" is the object used for recording the evaluation state. Each
  module that is loaded with source instrumentation enabled as an according
  moduleEnv It is populated when the module is imported and then used and
  modified when users run evaluations using `lively.vm.runEval()` or change the module's
  code with `ModuleInterface>>changeSource()`. You can get access to the internal module
  state via `module(...).env().recorder` the recorder is a map of
  variable and function names.

  Example: When lively.modules is bootstrapped you can access the state of its
  main module via:

  ```js
  var id = System.decanonicalize("lively.modules/index.js");
  Object.keys(lively.modules.moduleEnv("lively.modules/index.js").recorder);
    // => ["defaultSystem", "changeSystem", "loadedModules", "sourceOf", "moduleEnv", ...]
  lively.modules.moduleEnv("lively.modules/index.js").recorder.changeSystem
    // => function() {...} The actual object defined in the module scope
  ```

  ### hooks

  lively.modules provides an easy way to customize the behavior of the System
  loader object via `installHook` and `removeHook`. To extend the behavior of
  of `lively.modules.System.fetch` you can for example do

  ```js
  installHook("fetch", function myFetch(proceed, load) {
    if (load.name === "my-custom-module.js") return "my.custom.code()";
    return proceed(load); // default behavior
  });
  ```

  ### notification

  There are five types of system-wide notifications:

  1. `{type: "lively.modules/moduleloaded", module}`
  2. `{type: "lively.modules/modulechanged", module, oldSource, newSource, error, options}`
  3. `{type: "lively.modules/moduleunloaded", module}`
  4. `{type: "lively.modules/packageregistered", package}`
  5. `{type: "lively.modules/packageremoved", package}`

  These notifications are all emitted with `lively.notifications`.

 */

/* global global, self */
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// System accessors
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import {
  getSystem, removeSystem, prepareSystem,
  printSystemConfig as _printSystemConfig,
  unwrapModuleResolution as _unwrapModuleResolution,
  wrapModuleResolution as _wrapModuleResolution,
  whenLoaded as _whenLoaded
} from './src/system.js';
import _module, {
  doesModuleExist as _doesModuleExist,
  isModuleLoaded as _isModuleLoaded
} from './src/module.js';

let GLOBAL = typeof window !== 'undefined'
  ? window
  : (typeof global !== 'undefined'
      ? global
      : (typeof self !== 'undefined' ? self : this));

var defaultSystem = defaultSystem || prepareSystem(GLOBAL.System); // eslint-disable-line no-use-before-define, no-var
function changeSystem (newSystem, makeGlobal) {
  defaultSystem = newSystem;
  if (makeGlobal) GLOBAL.System = newSystem;
  newSystem._scripting = scripting; // eslint-disable-line no-use-before-define
  return newSystem;
}
function wrapModuleResolution () { _wrapModuleResolution(defaultSystem); }
function unwrapModuleResolution () { _unwrapModuleResolution(defaultSystem); }
function loadedModules () { return Object.keys(requireMap()); } // eslint-disable-line no-use-before-define
function module (id) { return _module(defaultSystem, id); }
function isModuleLoaded (name, isNormalized) {
  return _isModuleLoaded(defaultSystem, name, isNormalized);
}
function doesModuleExist (name, isNormalized) {
  return _doesModuleExist(defaultSystem, name, isNormalized);
}
function printSystemConfig () { return _printSystemConfig(defaultSystem); }
function whenLoaded (moduleName, callback) {
  return _whenLoaded(defaultSystem, moduleName, callback);
}
export {
  defaultSystem as System,
  getSystem,
  removeSystem,
  loadedModules,
  printSystemConfig,
  whenLoaded,
  changeSystem,
  module,
  doesModuleExist,
  isModuleLoaded,
  unwrapModuleResolution,
  wrapModuleResolution
};

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import {
  Package,
  getPackage as _getPackage,
  ensurePackage as _ensurePackage,
  getPackageSpecs,
  applyConfig as _applyPackageConfig,
  importPackage as _importPackage,
  removePackage as _removePackage,
  reloadPackage as _reloadPackage,
  registerPackage as _registerPackage,
  lookupPackage as _lookupPackage
} from './src/packages/package.js';

function importPackage (packageURL) { return _importPackage(defaultSystem, packageURL); }
function registerPackage (packageURL, optPkgConfig) { return _registerPackage(defaultSystem, packageURL, optPkgConfig); }
function removePackage (packageURL) { return _removePackage(defaultSystem, packageURL); }
function reloadPackage (packageURL, opts) { return _reloadPackage(defaultSystem, packageURL, opts); }
function getPackages () { return getPackageSpecs(defaultSystem); }
function getPackage (packageURL, isNormalized = false) { return _getPackage(defaultSystem, packageURL, isNormalized); }
function getPackageOfModule (moduleId) { return Package.forModuleId(defaultSystem, moduleId); }
function ensurePackage (packageURL) { return _ensurePackage(defaultSystem, packageURL); }
function applyPackageConfig (packageConfig, packageURL) { return _applyPackageConfig(defaultSystem, packageConfig, packageURL); }
function lookupPackage (packageURL, isNormalized = false) { return _lookupPackage(defaultSystem, packageURL, isNormalized); }

export {
  importPackage,
  registerPackage,
  removePackage,
  reloadPackage,
  getPackages,
  getPackage,
  getPackageOfModule,
  ensurePackage,
  applyPackageConfig,
  lookupPackage
};

import { PackageRegistry } from './src/packages/package-registry.js';
export { PackageRegistry };
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// changing modules
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { moduleSourceChange as _moduleSourceChange } from './src/change.js';
function moduleSourceChange (moduleName, newSource, options) {
  return _moduleSourceChange(defaultSystem, moduleName, newSource, options);
}
export { moduleSourceChange };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// dependencies
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import {
  computeRequireMap
} from './src/dependencies.js';
function requireMap () { return computeRequireMap(defaultSystem); }
export { requireMap };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// hooks
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import {
  isInstalled as _isHookInstalled,
  install as _installHook,
  remove as _removeHook
} from './src/hooks.js';
function isHookInstalled (methodName, hookOrName) {
  return _isHookInstalled(defaultSystem, methodName, hookOrName);
}
function installHook (hookName, hook) {
  return _installHook(defaultSystem, hookName, hook);
}
function removeHook (methodName, hookOrName) {
  return _removeHook(defaultSystem, methodName, hookOrName);
}
export { isHookInstalled, installHook, removeHook };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// export / import tooling
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
export { default as ExportLookup } from './src/export-lookup.js';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// cjs
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import * as cjs from './cjs/dependencies.js';
export { cjs };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// semver
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
export { default as semver } from 'semver';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// object scripting capabilities
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { ImportInjector } from './src/import-modification.js';

const scripting = defaultSystem._scripting = {
  module: _module,
  ensurePackage: _ensurePackage,
  registerPackage: _registerPackage,
  importPackage: _importPackage,
  lookupPackage: _lookupPackage,
  ImportInjector
};
import { defaultClassToFunctionConverterName } from 'lively.vm';
import { runtime as classRuntime } from 'lively.classes';
defaultSystem.global[defaultClassToFunctionConverterName] = classRuntime.initializeClass;
import { classHolder } from './src/cycle-breaker.js';
import ModulePackageMapping from './src/packages/module-package-mapping.js';
classHolder.ModulePackageMapping = ModulePackageMapping;
classHolder.Package = Package;
classHolder.PackageRegistry = PackageRegistry;

export { scripting };
