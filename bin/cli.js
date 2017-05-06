#!/usr/bin/env node

/*global require, global, process*/
const parseArgs = require('../deps/minimist.js'),
      { string } = (typeof lively !== "undefined" && lively.lang) || require("../deps/lively.lang.min.js"),
      { resource } = (typeof lively !== "undefined" && lively.resources) || require("../deps/lively.resources.js"),
      { join: j, isAbsolute, normalize } = require("path"),
      fs = require("fs"),
      { spawn } = require("child_process"),
      fnp = require("../flat-node-packages.bundle-cjs.js"),
      args = process.argv.slice(2);

if (printHelp(args)) process.exit(0);

let activeDir = process.cwd(),
    command,
    cmdIndex = args.findIndex(arg =>
      ["list", "install", "node", "env", "build"]
        .includes(arg) && (command = arg));

switch (command) {
  case 'list': doList(args.slice(cmdIndex+1)); break;
  case 'install': doInstall(args.slice(cmdIndex+1)); break;
  case 'build': doBuild(args.slice(cmdIndex+1)); break;
  case 'node': doNode(args.slice(cmdIndex+1)); break;
  case 'env': doEnv(args.slice(cmdIndex+1)); break;
  default: strangeInvocation();
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function doList(args) {
  args = parseArgs(args, {alias: {"packages": "P"}});

  let packageDirs = currentPackages(args);
  if (!packageDirs.length) {
    console.error("No package directories specified. Use one or multiple --packages/-P to specify package directoriese.");
    return process.exit(1);
  }

  return Promise.resolve(fnp.getInstalledPackages(packageDirs))
          .then(packageSpecs =>
            console.log(
              string.printTable(
                packageSpecs.map(({config, location}) =>
                  [`${config.name}@${config.version}`, `${location}`]))))
          .then(() => process.exit(0))
          .catch(err => { console.error(err.stack); process.exit(1); });
}

function doNode(args) {
  args = parseArgs(args, {"--": true, alias: {"packages": "P"}});
  if (!args.packages) {
    console.error("No package directories specified. Use one or multiple --packages/-P to specify package directoriese.");
    return process.exit(1);
  }

  if (!fs.existsSync(j(activeDir, "package.json"))) {
    console.error(`No package.json is present in ${activeDir}, cannot install!`)
    process.exit(1);
  }

  var tty = require('tty'),
      spawn = require('child_process').spawn;
  
  console.log(args["--"])
  // var child = spawn(j(__dirname, "bin/node"), args["--"], {stdio: [0,1,2]});
  var child = spawn("node", args["--"], {stdio: [0,1,2]});
  process.stdin.resume();  
  child.on("exit", function(code, signal) {
    process.stdin.pause();
    process.exit(code);
  });

  // setTimeout(() => process.exit(0), 3000);
}

function doInstall(args) {
  args = parseArgs(args, {alias: {"save-dev": "D", "save": "S", "packages": "P"}});

  let packageDirs = currentPackages(args);
  if (!packageDirs.length) {
    console.error("No package directories specified. Use one or multiple --packages/-P to specify package directoriese.");
    return process.exit(1);
  }

  let argv = args._;

  // install current package
  if (!argv || !argv.length) {

    if (!fs.existsSync(j(activeDir, "package.json"))) {
      console.error(`No package.json is present in ${activeDir}, cannot install!`)
      process.exit(1);
    }

    return fnp.installDependenciesOfPackage(
        activeDir,
        packageDirs[0],
        packageDirs,
        ["dependencies", "devDependencies"],
        undefined, true/*verbose*/)
     .then(() => process.exit(0))
      .catch(err => { console.error(err.stack); process.exit(1); })
  }

  console.log(args);
  process.exit(1);
}

function doBuild(args) {
  args = parseArgs(args, {alias: {"packages": "P"}});

  let packageDirs = currentPackages(args);
  if (!packageDirs.length) {
    console.error("No package directories specified. Use one or multiple --packages/-P to specify package directoriese.");
    return process.exit(1);
  }

  let argv = args._;

  // install current package
  if (!argv || !argv.length) {

    if (!fs.existsSync(j(activeDir, "package.json"))) {
      console.error(`No package.json is present in ${activeDir}, cannot build!`)
      process.exit(1);
    }

    return fnp.buildPackage(activeDir, packageDirs)
      .then(() => process.exit(0))
      .catch(err => { console.error(err.stack); process.exit(1); })
  }

  console.log(args);
  process.exit(1);
}

function doEnv(args) {
  console.log(`PATH=${j(__dirname)}:$PATH`)
  process.exit(0);
}

function printHelp(args) {
  if (args.length && !["help", "-h", "--help"].includes(args[0]))
    return false;

  console.log(`
fnp – flat-node-packages

Usage: fnp command [opts]

Commands:
help\t\tprint this help
list\t\tlist installed packages (use with one or multiple --packages/-P)
install\t\tinstalls dependencies (with --save/-S and --save-dev/-D) also adds to package.json in current dir
  `)
  return true;
}

function currentPackages(args) {
  let packages = packagesFromArgs(args);
  if (process.env.FNP_PACKAGE_DIRS) {
    for (let dir of process.env.FNP_PACKAGE_DIRS.split(":"))
      if (!packages.includes(dir)) packages.push(dir);
  }
  return checkPackages(packages);
}

function packagesFromArgs(args) {
 return (typeof args.packages === "string" ? [args.packages] : args.packages || [])
   .map(ea => isAbsolute(ea) ? ea : normalize(j(activeDir, ea)))
}

function checkPackages(packages) {
  packages.forEach(p => {
    if (fs.existsSync(p)) return;
    console.error(`[fnp] package path ${p} does not exist!`)
    process.exit(1);
  });
  return packages;
}

function strangeInvocation() {
  console.error("Unknown arguments: ", args.join(" "));
  process.exit(1)
}
