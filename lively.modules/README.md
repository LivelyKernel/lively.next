# lively.modules

JavaScript package and module system for interactive development.

## Goals

lively.modules provides a framework for loading, defining and interactively
modifying *JavaScript modules*. A module is an entity containing JavaScript
source code that adheres to the definition of the
[ECMAScript Language Specification](https://tc39.github.io/ecma262/#sec-modules).

<small>For an intro to the topic see [ES6 In Depth: Modules at mozilla.org](https://hacks.mozilla.org/2015/08/es6-in-depth-modules/)</small>

Its main purpose is to

- Provide an interface to load modules and groups of modules (packages)
- Provide an interface to access and modify the runtime state of a module, i.e. its
    - dependencies (modules imported and modules that import it)
    - imported and exported values
    - source code
    - internal definitions
- Provide a user friendly and practical implementation of how imported modules
  are resolved <a name="resolve-module-note">*</a>.
- For the purpose of grouping modules together and providing a method for
  module lookup introduce a lightweight concept of a *package*.


<small><sup>[*](#resolve-module-note)</sup> The ES specification explicitly
[leaves the semantics for "HostResolveImportedModule" open to module
implementations](https://tc39.github.io/ecma262/#sec-hostresolveimportedmodule)</small>

For more please see [doc/rationale.md](doc/rationale.md).


## Usage


To load lively.modules you can use the pre-build
`dist/lively.modules-with-lively.vm.js` file. Once that happens the
`lively.modules` global will provide an interface for loading packages,
modifying modules, evaluating source code in module contexts etc.

So on a webpage you would typically link via

```html
<script src="../node_modules/lively.modules/dist/lively.modules-with-lively.vm.js"></script>
```

See the examples in
[lively-system-examples](https://github.com/LivelyKernel/lively-system-examples)
for more details.


## API

### [main interface](index.js)

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

By default lively.modules will hook into the `System.translate` process so that source code of modules get transformed to allow recording of their internal evaluation state (that is then captured in `moduleEnv`s). You can enable and disable this behavior via

- `lively.modules.wrapModuleLoad()`
- `lively.modules.unwrapModuleLoad()`



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

##### `async ModuleInterface>>recorder`

In order to support dynamic evaluation of source code and real time updating of modules, we have to capture all the objects and values referenced in the scope of the module.
These values are stored in the recorder object, which lends its name from the concept of *recording* the objects and values yielded during the evaluation of a module.

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

### Interoperability with SystemJS 0.21

The `lively.modules` system was originally based on SystemJS 0.19 (or prior versions). Unlike SystemJS 0.21, the versions < 0.19 where much more "transparent" implementations of SystemJS that came with a lot of runtime inspection capabilities.
This simpyfied the initial implementations of `lively.modules` quite a bit.

The main issue with the old SystemJS versions is the missing support for loading `system` format bundles.
The `system` bundle format is essential for proper code splitting support in rollup.
We therefore moved over utilising the `system` format for most of the `lively.freezer` builds in `lively.next` in particular with regards to the bootstrapping bundles.

For a while we therefore had a SystemJS version transition in place where SystemJS 0.21 would perform the loading of the bootstrapping bundle and then replace itself with SystemJS version 0.19 in order to finalize the load of `lively.next`.
This version swapping is no longer viable for fast loading support of `lively.next` since we would need to keep 2 different versions of SystemJS alive in parallel. This not only breaks a bunch of code in `lively.next` itself, it is also not really possible to have SystemJS work that way, at least from our findings.

As mentioned in the beginning, one of the big challenges in the migration to 0.21 was the fact that alot of the hooks and metadata provided is no longer openly accessible and hidden.
This is particulary the case for the internal registry, configuration and metadata of SystemJS all of which are hidden behind instance variables that cen only be received via internal Symbols.

The current solution for this problem is to retrieve these properties by `Object.values(System)` and then extracting each of the hidden objects by matching their characteristic attributes. This solution is hacky, but will likely work for the currently available versions of SystemJS (including 6).

Another big shift of 0.21 compared to 0.19 is the deprecation of various hooks that where previously available directly on the SystemJS instance, but now have to be accessed via a plugin interface. These include: `instantiate`, `locate`, `fetch` and `translate`.
Further the semantics of `translate` have been changed, such that part of the translate instrumentation needs to devided between `translate` and `instantiate`, further complicating the implementation.

### notification

There are five types of system-wide notifications:

1. `{type: "lively.modules/moduleloaded", module}`
2. `{type: "lively.modules/modulechanged", module, oldSource, newSource, error, options}`
3. `{type: "lively.modules/moduleunloaded", module}`
4. `{type: "lively.modules/packageregistered", package}`
5. `{type: "lively.modules/packageremoved", package}`

These notifications are all emitted with `lively.notifications`.

## Development

### Fast Loading

By default, lively.modules requires a relatively long time to complete the load of all the packages and modules required for a lively.next session. This is because every module has to be read, parsed, instrumented and finally evaluated one by one in order to complete the initialisation of the system.

A simple optimization strategy is to skip the reading and instrumentation step, by caching the translated module source codes inside the local storage of the browser. This has a quite significant effect on loading performance and speeds up the entire process by 60-70%.
However we still end up with the need to separately create and evaluate thousands of module objects, which still requires 10-20 seconds loading time.

A further optimization is, to reduce the total number of module objects that we need to create upon initialization of the system. This can be achieved by:
 1. Including a larger part of the entire system inside the bootstrapping bundle.
 2. Keep utilizing as much code as possible from the bundle, instead of loading the system via module objects.

Step 1 will result in a slightly slower load of the boostrapping bundle, however this is offset by the speedup we achieve via 2 where in practice we can avoid loading 95% of all the module objects in the system.

The remaining 5% modules that *need* to still be initialized are modules that are either dynamically changed at runtime, by chaning source code in the system (i.e. updating the implementation of layout code in lively.morphic/layout.js) or modules that have been updated since the last time the bootstrapping bundle was created.

When a module is loaded via a module object, it is initialised in a fashion that *embedds* the module's entities into the loaded boostrapping bundle. This is done by feeding the imports from other modules that stem from the bootstrap bundle into the module evaluation while using the exports of the module object and injecting them into the initialized boostrapping bundle.
This flexibility is enabled by bundling lively.next as a *resurrection build*. Resurrection builds are explained in more detail inside lively.freezer.

## LICENSE

[MIT](LICENSE)
