#!/usr/bin/env node

/*global require, global, process*/
const parseArgs = require('../deps/minimist.js'),
      { string } = (typeof lively !== "undefined" && lively.lang) || require("../deps/lively.lang.min.js"),
      { resource } = (typeof lively !== "undefined" && lively.resources) || require("../deps/lively.resources.js"),
      { join: j, isAbsolute, normalize } = require("path"),
      fs = require("fs"),
      { spawn } = require("child_process"),
      flatn = require("../flatn-cjs.js"),
      args = process.argv.slice(2);

if (printHelp(args)) process.exit(0);

let activeDir = process.cwd(),
    command,
    cmdIndex = args.findIndex(arg =>
      ["list", "install", "node", "env"]
        .includes(arg) && (command = arg));

switch (command) {
  case 'list':    doList(   args.slice(0, cmdIndex), args.slice(cmdIndex+1)); break;
  case 'install': doInstall(args.slice(0, cmdIndex), args.slice(cmdIndex+1)); break;
  case 'node':    doNode(   args.slice(0, cmdIndex), args.slice(cmdIndex+1)); break;
  case 'env':     doEnv(    args.slice(0, cmdIndex), args.slice(cmdIndex+1)); break;
  default: strangeInvocation();
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// processing arguments

function readGenericArgs(args, requireAtLeastOnePackageDir = true) {
  return currentPackages(
    parseArgs(args, {
      alias: {
        packages: "C",
        "dev-package": "D",
        package: "P"
      }
    }), requireAtLeastOnePackageDir);
  // let {packageCollectionDirs, individualPackageDirs, devPackageDirs} = currentPackages(args);
}

function currentPackages(args, requireAtLeastOnePackageDir) {
  let fromArgs = packagesFromArgs(args),
      fromEnv = flatn.packageDirsFromEnv(),
      packageCollectionDirs = uniq(fromArgs.packageCollectionDirs.concat(fromEnv.packageCollectionDirs)),
      individualPackageDirs = uniq(fromArgs.individualPackageDirs.concat(fromEnv.individualPackageDirs)),
      devPackageDirs = uniq(fromArgs.devPackageDirs.concat(fromEnv.devPackageDirs));

  if (process.env.FLATN_PACKAGE_DIRS) {
    for (let dir of process.env.FLATN_PACKAGE_DIRS.split(":"))
      if (!packageCollectionDirs.includes(dir)) packageCollectionDirs.push(dir);
  }
  return checkPackages(
    packageCollectionDirs,
    individualPackageDirs,
    devPackageDirs,
    requireAtLeastOnePackageDir
  );
}

function packagesFromArgs(args) {
  return {
    packageCollectionDirs: normalizeDirs(args["packages"]),
    individualPackageDirs: normalizeDirs(args["package"]),
    devPackageDirs: normalizeDirs(args["dev-package"])
  };
}

function normalizeDirs(dirs) {
  return (dirs && typeof dirs === "string" ? [dirs] : dirs || [])
     .map(ea => isAbsolute(ea) ? ea : normalize(j(activeDir, ea)))
     .filter(Boolean);
}

function checkPackages(
  packageCollectionDirs,
  individualPackageDirs,
  devPackageDirs,
  requireAtLeastOnePackageDir
) {
  [].concat(packageCollectionDirs)
    .concat(individualPackageDirs)
    .concat(devPackageDirs)
    .forEach(p => {
      if (fs.existsSync(p)) return;
      console.error(`[flatn] package path ${p} does not exist!`);
      process.exit(1);
    });

  if (requireAtLeastOnePackageDir) {
    if (![].concat(packageCollectionDirs)
           .concat(individualPackageDirs)
           .concat(devPackageDirs).length) {
      console.error("No package directories specified.\n"
                  + "Use one or multiple --packages/-C, --package/-P, and --dev-package/-D\n"
                  + "to specify package directories.");
      return process.exit(1);
    }
  }

  return {packageCollectionDirs, individualPackageDirs, devPackageDirs};
}

function unexpectedArgs(args, expected, commandName) {
  expected = expected.concat("_");
  let unexpected = Object.keys(args).filter(ea => !expected.includes(ea));
  if (unexpected.length) {
    console.error(`command "${commandName}" does not expect arguments ${unexpected.map(JSON.stringify).join(", ")}`);
    process.exit(1);
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// commands

function doNode(genericArgs, args) {
  // starts a node process that uses the package dirs from arguments and from
  // the process env to resolve package names

  let cmdArgs = parseArgs(args, {"--": true});
  unexpectedArgs(cmdArgs, ["--"], "node");

  // so node knows about the package dirs passed by arguments....
  let {packageCollectionDirs, individualPackageDirs, devPackageDirs} = readGenericArgs(genericArgs);
  flatn.setPackageDirsOfEnv(packageCollectionDirs, individualPackageDirs, devPackageDirs);

  if (!fs.existsSync(j(activeDir, "package.json"))) {
    console.error(`No package.json is present in ${activeDir}, cannot install!`)
    process.exit(1);
  }

  var tty = require('tty'),
      spawn = require('child_process').spawn;

  var child = spawn("node", cmdArgs["--"], {stdio: [0,1,2]});
  process.stdin.resume();  
  child.on("exit", function(code, signal) {
    process.stdin.pause();
    process.exit(code);
  });

  // setTimeout(() => process.exit(0), 3000);
}




function doList(genericArgs, args) {
  let cmdArgs = parseArgs(args, {alias: {}});
  unexpectedArgs(cmdArgs, [], "list");

  let {packageCollectionDirs, individualPackageDirs, devPackageDirs} = readGenericArgs(genericArgs);
  flatn.setPackageDirsOfEnv(packageCollectionDirs, individualPackageDirs, devPackageDirs);

  return Promise.resolve(
    flatn
      .buildPackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs)
      .allPackages())
    .then(packageSpecs =>
      console.log(
        string.printTable(
          packageSpecs.map(({config, location}) => [
            `${config.name}@${config.version}`,
            `${location}`
          ]))))
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err.stack);
      process.exit(1);
    });
}



function doInstall(genericArgs, args) {
  let cmdArgs = parseArgs(args, {
    boolean: ["save-dev", "save"],
    alias: {
      "save-dev": "D",
      save: "S",
      "no-build": "nb",
      "force-build": "fb"
    }
  });

  unexpectedArgs(
    cmdArgs,
    ["save-dev", "D", "save", "S", "no-build", "nb", "force-build", "fb"],
    "install"
  );
  let {packageCollectionDirs, individualPackageDirs, devPackageDirs} = readGenericArgs(genericArgs);
  flatn.setPackageDirsOfEnv(packageCollectionDirs, individualPackageDirs, devPackageDirs);

  let packagesToInstall = cmdArgs._;

  // plain invocation: install current package
  if (!packagesToInstall || !packagesToInstall.length) {

    if (!fs.existsSync(j(activeDir, "package.json"))) {
      console.error(`No package.json is present in ${activeDir}, cannot install!`)
      process.exit(1);
    }

    let packageMap;

    return Promise.resolve()
      .then(() => console.log("[flatn] Phase 1/2: downloading packages"))
      .then(() => {
        packageMap = flatn.buildPackageMap(
          packageCollectionDirs,
          individualPackageDirs,
          devPackageDirs);
        return flatn.installDependenciesOfPackage(
            activeDir,
            packageCollectionDirs[0],
            packageMap,
            ["dependencies", "devDependencies"],
            false/*verbose*/);
      })
     .then(() => {
       if (args["no-build"]) {
         console.log("[flatn] Phase 2/2: skipping build phase");
         return;
       }
       console.log("[flatn] Phase 2/2: building packages");
       // rk 2017-05-06: FIXME currently it is only possible to either build
       // deps and devDep of *all* packages.  Usually the root packages are build
       // with devDeps and the rest only with deps....
       return flatn.buildPackage(
         activeDir,
         packageMap,
         ["dependencies"],
         false/*verbose*/,
         !!args["force-build"]);
     })
     .then(() => process.exit(0))
     .catch(err => { console.error(err.stack); process.exit(1); })
  }


  packagesToInstall.reduce((installP, pNameAndRange) =>
      installP.then(() =>
        flatn.addDependencyToPackage(
          activeDir,
          pNameAndRange,
          packageCollectionDirs[0],
          flatn.buildPackageMap(
            packageCollectionDirs,
            individualPackageDirs,
            devPackageDirs),
          cmdArgs["save-dev"] ? "dev-dependencies" : "dependencies",
          true)),
    Promise.resolve())
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err.stack);
    process.exit(1);
  });
}

function doEnv(genericArgs, args) {
  let cmdArgs = parseArgs(args);
  unexpectedArgs(cmdArgs, [], "env");

  let {packageCollectionDirs, individualPackageDirs, devPackageDirs} = readGenericArgs(genericArgs);
  flatn.setPackageDirsOfEnv(packageCollectionDirs, individualPackageDirs, devPackageDirs);

  let {PATH, FLATN_DEV_PACKAGE_DIRS, FLATN_PACKAGE_DIRS, FLATN_PACKAGE_COLLECTION_DIRS} = process.env;
  FLATN_DEV_PACKAGE_DIRS = FLATN_DEV_PACKAGE_DIRS || "";
  FLATN_PACKAGE_DIRS = FLATN_PACKAGE_DIRS || "";
  FLATN_PACKAGE_COLLECTION_DIRS = FLATN_PACKAGE_COLLECTION_DIRS || "";
  let bindir = normalize(j(__dirname, "../bin"))
  if (!PATH.includes(bindir+":")) PATH = bindir + ":" + PATH;
  
  let printedEnv = "";
  console.log(`
PATH=${PATH}
FLATN_PACKAGE_COLLECTION_DIRS=${FLATN_PACKAGE_COLLECTION_DIRS}
FLATN_PACKAGE_DIRS=${FLATN_PACKAGE_DIRS}
FLATN_DEV_PACKAGE_DIRS=${FLATN_DEV_PACKAGE_DIRS}
  `)

  process.exit(0);
}


function printHelp(args) {
  if (args.length && !["help", "-h", "--help"].includes(args[0]))
    return false;

  console.log(`
flatn – flat node dependencies

Usage: flatn [generic args] command [command args]

Generic args:
  --packages / -C\tSpecifies a directory whose subdirectories are expected to be all packages ("package collection" dir)
  --dev-package / -D\tSpecifies a development package. Dev packages will always
                    \tbe built and will override all packages with the same name.  When a module
                    \trequires the name of a dev package, the package will always match, no matter
                    \tits version.
  --package/ -P\tSpecifies the path to a single package
(Repeat -C/-D/-P multiple times to specify any number of directories.)



Commands:
help\t\tPrint this help
list\t\tList all packages that can be reached via the flatn package directories
    \t\tspecified in the environment and via generic arguments.

install\t\tUsage without name: Downloads dependencies of the package in the
       \t\tcurrent directory and runs build tasks (with --save and --save-dev) also adds
       \t\tto package.json in current dir
install name\tInstalls the package name in the first collection package dir
       \t\tspecified. With arguments --save or --save-dev it adds this package to the
       \t\tdependencies or devDepedencies entry of the current package's package.json
node\t\tStarts a new nodejs process that resolves modules usin the specified
    \t\tpackage directories. To path arguments to nodejs use "--" followed by any
    \t\tnormal nodejs argument(s).

Environment:
Use the environment variables
  - FLATN_PACKAGE_COLLECTION_DIRS
  - FLATN_PACKAGE_DIRS
  - FLATN_DEV_PACKAGE_DIRS
to specify package directories.  The variables correspond to the -C, -P, and -D
generic arguments.  Use ":" to specify multiple directories, e.g.
FLATN_DEV_PACKAGE_DIRS=/home/user/package1:/home/user/package2.
Note: All directories have to be absolute.
  `)
  return true;
}

function strangeInvocation() {
  console.error("Unknown arguments: ", args.join(" "));
  process.exit(1)
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
// 

function uniq(array) {
  if (!array.length) return array;
  var result = [array[0]];
  for (var _i = 1; _i < array.length; _i++) {
    var _val = array[_i];
    if (result.indexOf(_val) === -1) result.push(_val);
  }
  return result;
}
