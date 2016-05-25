#! /usr/bin/env node

require("systemjs")

global.babel  = require("babel-core")
var parseArgs = require('minimist');
var glob      = require('glob');
var modules   = require("lively.modules")
var mochaEs6  = require("../mocha-es6")
var path      = require("path");
var fs        = require("fs");
var dir       = process.cwd();
var mochaDir  = path.join(__dirname, "..");
var args;

lively.lang.promise.chain([
  () => { // prep
    modules.System.trace = true
    cacheMocha("file://" + mochaDir);
    modules.unwrapModuleLoad();
    readProcessArgs();
  },
  () => console.log("1. Linking node_modules to local projects"),
  () => require("./link-node_modules-into-packages.js")(dir),
  () => console.log("1. Importing project at " + dir),
  () => modules.importPackage("file://" + dir),
  () => console.log("2. Looking for test files via globs " + args.files.join(", ")),
  () => findTestFiles(args.files),
  (files, state) => state.testFiles = files,
  (_, state) => console.log("3. Running tests in\n  " + state.testFiles.join("\n  ")),
  (_, state) => mochaEs6.runTestFiles(state.testFiles),
  failureCount => process.exit(failureCount)
]).catch(err => {
  console.error(err.stack || err);
  process.exit(1);
})

function readProcessArgs() {
  args = parseArgs(process.argv.slice(2), {
    alias: {}
  });
  args.files = args._;
}

function findTestFiles(files) {
  return Promise.resolve()
    .then(() => {
      if (!files || !files.length)
        throw new Error("No test files specfied!");
      return Promise.all(files.map(f =>
        new Promise((resolve, reject) =>
          glob(f, {nodir: true, cwd: dir}, (err, files) =>
            err ? reject(err) : resolve(files))))); })
    .then(allFiles => allFiles.reduce((all, files) => all.concat(files)))
    .then(files => files.map(f => "file://" + path.join(dir, f)))
}

function cacheMocha(mochaDirURL) {
  if (typeof System !== "undefined" && !System.get(mochaDirURL + "/mocha-es6.js")) {
    System.config({map: {"mocha-es6": mochaDirURL}});
    System.set(mochaDirURL + "index.js", System.newModule(mochaEs6));
    System.set(mochaDirURL + "mocha-es6.js", System.newModule(mochaEs6));
  }
}