# lively.modules [![Build Status](https://travis-ci.org/LivelyKernel/lively.modules.svg)](https://travis-ci.org/LivelyKernel/lively.modules)

JavaScript package and module system for interactive development.

![](http://lively-web.org/users/robertkrahn/uploads/Screen_Shot_2016-03-26_at_8.30.54_PM.png)

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


## Usage

To load lively.modules you can use the pre-build `dist/lively.modules.js` file.
Once that happens the `lively.modules` global will provide an interface for
loading packages, modifying modules, evaluating source code in module contexts
etc.

See the examples in [examples/browser/](examples/browser/) and
[examples/nodejs/](examples/nodejs/) for more details.

## API

<!---DOC_GENERATED_START--->

<!---DOC_GENERATED_END--->

## Development

To bootstrap lively.modules please see the example in
[examples/bootstrap/](examples/bootstrap/). lively.modules is completely
capable to "develop itself" and was done so from the beginning :)

To build a new version yourself run `npm run build`.
