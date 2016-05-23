# Rationale

lively.modules provides a framework for loading, defining and interactively
modifying JavaScript modules. A module is an entity containing JavaScript
source code that adheres to the definition of the 
[ECMAScript Language Specification](https://tc39.github.io/ecma262/#sec-modules).

## Live development

lively.modules provides an interface to support interactive development with
[es6 modules](http://exploringjs.com/es6/ch_modules.html). In particular it
allows to capture the runtime state (internal variables and definitions) of
modules to allow to access local state when evaluating code in module contexts.
It also allows to iteratively update the runtime state of a module (e.g.
modifying a function or adding a new definition) and will take care that
dependencies are updated accordingly.

## Packages

Since the EcmaScript standard does not define a package concept (package = set
of modules belonging together), lively.modules adds a very lightweight
convention for identifying and loading packages that is mostly based on
the [npm package conventions](https://docs.npmjs.com/how-npm-works/packages).

This is crucial because es6 modules leave name resolution open to the
[module loader implementation](https://tc39.github.io/ecma262/#sec-hostresolveimportedmodule).

Consider an import statement like

```js
import { foo } from 'some-package/bar.js';
```

To what specific resource (modules don't need to be files!)
`'some-package/bar.js'` is resolved is up to the loader, i.e. up to
lively.modules. Using the package concept we can have simple conventions that
define how a resource like `some-package` can be found.

## Lively ecosystem

A flexible and lightweight notion of packages can help us to make Lively more
"approachable", meaning that the system can be broken into clearly defined
sub-systems thus reducing the complexity of an otherwise monolithic system,
Also, those package can be reused outside the main Lively system.

## Debugging

The main problem we faced when implementing the source-transformation-based
debugging approach was code management: Once the number of modules approaches
non-trivial numbers it becomes a resource intensive task to manage rewritten
and original code in a way that is performant enough for convenient interactive
development. This especially posed a problem b/c the semantics of JavaScript
allow lexical scoping and with that "hiding" internal module state. Once a
not-transformed conventional JS "module" is defined there is no generic way to
instrument it later.

es6 modules provide a new restriction between modules: Module boundaries are
clear and can be statically determined. Imports and exports are restricted to
well defined notion of bindings that allows live updates and circular
references. By treating modules as "black boxes", a source-transformation
debugger can gradually transform modules, redefining them but maintaining their
exported state.

## PartsBin

A tension that exists in the PartsBin workflow up to this point is the mix of
state (think "binary" blobs of serialized objects) and source code. So far, the
existing Lively module system and serialized objects don't share a common
concept, making them harder to learn and use. Modules and packages might offer
an interesting alternative: Since a module can be any kind of resource, not
just JS statements, we can mix code and serialized objects in our package
concept. This would allow to combine both approaches from the ground up.

...

