#!/usr/bin/env node

const parseArgs = require('./deps/minimist.js'),
      System = require('./deps/system.src.js'),
      babel = global.babel = require('./deps/babel.min.js'),
      lvm = require('./deps/lively.modules.min.js'),
      {resource} = lively.resources,
      {string} = lively.lang,
      args = process.argv.slice(2);

if (printHelp(args)) process.exit(0);

let command = args[0];

if (command === "list") doList(args.slice(1));
if (command === "install") doInstall(args.slice(1));
else strangeInvocation();


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function doList(args) {
  args = parseArgs(args, {alias: {"save-dev": "D", "save": "S", "packages": "p"}});

  if (!args.packages) {
    console.error("No package directories specified. Use one or multiple --packages/-p to specify package directoriese.");
    return process.exit(1);
  }

  return lvm.importPackage(`file://${__dirname}/`)
    .then(({getInstalledPackages}) => getInstalledPackages(typeof args.packages === "string" ? [args.packages] : args.packages || []))
    .then(packageSpecs => {
      console.log(
        string.printTable(
          packageSpecs.map(({config, location}) =>
            [`${config.name}@${config.version}`, `${resource(location).path()}`])));
      process.exit(0);
    })
    .catch(err => { console.error(err); process.exit(1); });
}

function doInstall(args) {
  args = parseArgs(args, {alias: {"save-dev": "D", "save": "S", "packages": "p"}});

  if (!args.packages) {
    console.error("No package directories specified. Use one or multiple --packages/-p to specify package directoriese.");
    return process.exit(1);
  }

console.log(args);
process.exit(1);

  return lvm.importPackage(`file://${__dirname}/`)
    .then(({getInstalledPackages}) => getInstalledPackages(typeof args.packages === "string" ? [args.packages] : args.packages || []))
    .then(packageSpecs => {
      console.log(
        string.printTable(
          packageSpecs.map(({config, location}) =>
            [`${config.name}@${config.version}`, `${resource(location).path()}`])));
      process.exit(0);
    })
    .catch(err => { console.error(err); process.exit(1); });
}

function printHelp(args) {
  if (args.length && !["help", "-h", "--help"].includes(args[0]))
    return false;

  console.log(`
fnp – flat-node-packages

Usage: fnp command [opts]

Commands:
help\t\tprint this help
list\t\tlist installed packages (use with one or multiple --packages/-p)
install\t\tinstalls dependencies (with --save/-S and --save-dev/-D) also adds to package.json in current dir
  `)
  return true;
}

function strangeInvocation() {
  console.error("Unknown arguments: ", args.join(" "));
  process.exit(1)
}

// if ("port" in args) port = args.port;
// if ("hostname" in args) hostname = args.hostname;
// if ("root-directory" in args) rootDirectory = args["root-directory"];

// // #!/bin/sh
// ':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
// 
// var start = require("../index.js");
// 
// var parseArgs = require('minimist'),
//     port = 3000,
//     hostname = "localhost",
//     rootDirectory = process.cwd(),
//     isMain = !module.parent;
// 
// if (isMain) {
//   var args = parseArgs(process.argv.slice(2), {
//     alias: {port: "p", "root-directory": "d"}
//   });
// 
//   if ("port" in args) port = args.port;
//   if ("hostname" in args) hostname = args.hostname;
//   if ("root-directory" in args) rootDirectory = args["root-directory"];
// }
// 
// start(hostname, port, rootDirectory);
