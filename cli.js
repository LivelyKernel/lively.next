#!/usr/bin/env node

const parseArgs = require('./deps/minimist.js'),
      System = require('./deps/system.src.js'),
      babel = global.babel = require('./deps/babel.min.js'),
      lvm = require('./deps/lively.modules.min.js'),
      {resource} = lively.resources,
      {string} = lively.lang,
      args = process.argv.slice(2),
      { join: j, isAbsolute, normalize } = require("path"),
      fs = require("fs"),
      { spawn } = require("child_process"),
      fetchPonyfill = require("fetch-ponyfill");

if (printHelp(args)) process.exit(0);

if (!resource)
Object.assign(global, fetchPonyfill());

let activeDir = process.cwd(),
    command,
    cmdIndex = args.findIndex(arg =>
      ["list", "install", "node"].includes(arg) && (command = arg));

switch (command) {
  case 'list': doList(args.slice(cmdIndex+1)); break;
  case 'install': doInstall(args.slice(cmdIndex+1)); break;
  case 'node': doNode(args.slice(cmdIndex+1)); break;
  default: strangeInvocation();
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function doList(args) {
  args = parseArgs(args, {alias: {"packages": "P"}});

  if (!args.packages) {
    console.error("No package directories specified. Use one or multiple --packages/-P to specify package directoriese.");
    return process.exit(1);
  }

  return withFnpFunctionDo("getInstalledPackages",
    getInstalledPackages =>
      getInstalledPackages(checkPackages(packagesFromArgs(args)))
        .then(packageSpecs =>
          console.log(
            string.printTable(
              packageSpecs.map(({config, location}) =>
                [`${config.name}@${config.version}`, `${resource(location).path()}`]))))
        .then(() => process.exit(0)));
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

  // let proc = spawn(j(__dirname, "bin/node"), args["--"]);
  // proc.stdout.pipe(process.stdout);
  // proc.stderr.pipe(process.stderr);
  // proc.on("exit", code => process.exit(code));
  
  var tty = require('tty'),
      spawn = require('child_process').spawn;
  
  console.log(args["--"])
  // var child = spawn(j(__dirname, "bin/node"), args["--"], {stdio: [0,1,2]});
  var child = spawn("node", args["--"], {stdio: [0,1,2]});
  // child.stdout.pipe(process.stdout);
  // child.stderr.pipe(process.stderr);
  // process.stdin.pipe(child.stdin);
  process.stdin.resume();
  // process.stdin.setRawMode(true);
  // child.stdin.setRawMode(true);
  
  child.on('exit', function(code, signal) {
      process.stdin.pause();
      process.exit(code);
  });

  // setTimeout(() => process.exit(0), 3000);
}

function doInstall(args) {
  args = parseArgs(args, {alias: {"save-dev": "D", "save": "S", "packages": "p"}});

  if (!args.packages) {
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

    let packages = checkPackages(packagesFromArgs(args));
    return withFnpFunctionDo("installDependenciesOfPackage", installDependenciesOfPackage =>
      installDependenciesOfPackage(
        activeDir,
        packages[0],
        packages,
        ["dependencies", "devDependencies"],
        undefined, true/*verbose*/)
      ).then(() => process.exit(0));
  }

  console.log(args);
  process.exit(1);
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

function withFnpFunctionDo(fnName, doFn) {
  return lvm.importPackage(`file://${__dirname}/`)
    .then(fnp => doFn(fnp[fnName]))
    .catch(err => { console.error(err); process.exit(1); });
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
