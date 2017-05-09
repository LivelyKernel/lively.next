# flatn [![Build Status](https://travis-ci.org/rksm/flatn.svg?branch=master)](https://travis-ci.org/rksm/flatn)

flat node dependencies (flatn) is a nodejs package organizer that supports flat file system structures for nodejs package dependencies.  It is fully compatible with npm and provides an alternative for workflows where npm falls short.

![](flatn.png)

__TL;DR__
flatn installs packages into one or multiple directories and tells nodejs how to resolve packages in there so normal `require(...)` statements still work.


## Rationale

npm installs package dependencies into node_modules folder inside of packages that require them.  The internal module resolve mechanism in nodejs then traverses the file system tree upward when it wants to load (require) one module from another one, looking into the node_modules folder to the matching package.

This has a number of negative consequences:
1. __During development__: When you develop multiple packages that depend on each other you typically don't want them to be installed like normal dependencies but rather link the packages to each other.  `npm link` allows to do this but installs the links globally, so you cannot use multiple versions of you packages under development at the same time.

2. __Performance__: In the current npm version 4, linked packages (either symlinked by hand or via `npm link` sometimes seem to lead to very slow install / update operations, sometimes freezing the install / update process completely.

3. __Sharing__: Local packages that depend on the same dependencies each install a seperate version of them, even when `npm link`ed.  Depending on how many packages you develop this can waste considerable disk space (gigabytes) and considerably slows down install / update processes.

4. __Simplicity of module resolution algorithm and usage with other module systems__: Since npm version 3, npm tries to partially flatten out the dependency tree to avoid redundancies.  However, this has now the drawback that you cannot rely on the package.json dependency fields to find packages anymore deeper down in the tree.  You basically need to resolve packages via nodejs or use your own implementation of the npm lookup algorithm if you want to find packages with a different module system.  This complicates using node_modules especially in the browser context and with EcmaScript modules and System loaders such as SystemJS.

### Solution

1. __Custom package directories__: To solve these problems, flattn can install packages in one or multiple shared directories that differ from the normal node_modules folders.  This directory / directories can either be local to your own packages or reside somewhere else on your file system.

2. __Directories can be shared but are not global__ By specifying which directories to use via environment variables or command line arguments, installed packages can be shared by multiple local packages.  This allows to minimize the number of installed dependencies.

3. __Directory structure is flat and straightforward__: No nested package structures are necessary, packages are installed via name@version inside the specified directories, github dependencies are supported. Finding packages is done by comparing the version of the package with the version requirement of the callsite.

Unlike `yarn install --flat` multiple versions of the same dependency can coexist.

By importing [module-resolver.js](module-resolver.js) into your nodejs process and specifying the package directories via environment variables, nodejs will then use those directories when it tries to load modules.  Alternatively to manually importing `module-resolver.js` you can use [bin/node](bin/node) to start nodejs.

### Example

Let's say we have a local package `foo` with package.json

```json
{
  "name": "foo",
  "version": "0.1.0",
  "dependencies": {
    "chalk": "^1"
  }
}
```

#### Install + require

We want to use a custom folder inside the projects directory to store the dependencies.  By running
```sh
$ mkdir deps
$ flatn --packages deps install
```

we install the "chalk" dependency inside the deps folder.  We can now set the `FLATN_PACKAGE_COLLECTION_DIRS` environment variable and run nodejs:
```sh
$ eval $( flatn --packages deps env )
$ node -p 'require("chalk").blue.bgRed.bold("it works!!!");'`
```

#### Using local packages without install

Let's say we have another module `bar` that is local and that we want to use from foo:

```sh
$ eval $( flatn --packages deps --dev-package /path/to/foo env )
$ node -p 'require("foo").doSomething(here)'`
```


## Command line usage

`npm install -g flatn` then

```
flatn – flat node dependencies

Usage: flatn [generic args] command [command args]

Generic args:
  --packages / -C	Specifies a directory whose subdirectories are expected to be all packages ("package collection" dir)
  --dev-package / -D	Specifies a development package. Dev packages will always
                    	be built and will override all packages with the same name.  When a module
                    	requires the name of a dev package, the package will always match, no matter
                    	its version.
  --package/ -P	Specifies the path to a single package
(Repeat -C/-D/-P multiple times to specify any number of directories.)



Commands:
help		Print this help
list		List all packages that can be reached via the flatn package directories
    		specified in the environment and via generic arguments.

install		Usage without name: Downloads dependencies of the package in the
       		current directory and runs build tasks (with --save and --save-dev) also adds
       		to package.json in current dir
install name	Installs the package name in the first collection package dir
       		specified. With arguments --save or --save-dev it adds this package to the
       		dependencies or devDepedencies entry of the current package's package.json
node		Starts a new nodejs process that resolves modules usin the specified
    		package directories. To path arguments to nodejs use "--" followed by any
    		normal nodejs argument(s).

Environment:
Use the environment variables
  - FLATN_PACKAGE_COLLECTION_DIRS
  - FLATN_PACKAGE_DIRS
  - FLATN_DEV_PACKAGE_DIRS
to specify package directories.  The variables correspond to the -C, -P, and -D
generic arguments.  Use ":" to specify multiple directories, e.g.
FLATN_DEV_PACKAGE_DIRS=/home/user/package1:/home/user/package2.
Note: All directories have to be absolute.
```
