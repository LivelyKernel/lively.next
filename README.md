# flatn [![Build Status](https://travis-ci.org/rksm/flatn.svg?branch=master)](https://travis-ci.org/rksm/flatn)

flat node dependencies (flatn) is a nodejs package organizer that supports flat file system structures for nodejs package dependencies.  It is fully compatible with npm.


## Command line usage

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
