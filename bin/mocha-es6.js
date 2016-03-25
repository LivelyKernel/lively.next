#! /usr/bin/env node

var parseArgs = require('minimist');
var glob      = require('glob');
var System    = require("systemjs");
var path      = require("path");
var fs        = require("fs");

var dir = process.cwd();
var index = "file://" + path.join(__dirname, "../index.js");
var args;

Promise.resolve()
  .then(readProcessArgs)
  .then(() => loadConfig())
  .then(() => findTestFiles())
  .then(testFiles =>
    System.import(index)
      .then(tester =>
        tester.runTestFiles(testFiles, {reporter: args.reporter})))
  .then(failureCount => process.exit(failureCount))
  .catch(err => {
    console.log(systemConfPrint());
    err = err.originalErr || err;
    console.error(err.stack);
  })


function readProcessArgs() {
  args = parseArgs(process.argv.slice(2), {
    alias: {}
  });
  args.files = args._;
}

function findTestFiles() {
  return Promise.resolve()
    .then(() => {
      if (!args.files || !args.files.length)
        throw new Error("No test files specfied!");
      return Promise.all(args.files.map(f =>
        new Promise((resolve, reject) =>
          glob(f, {nodir: true, cwd: dir}, (err, files) =>
            err ? reject(err) : resolve(files))))); })
    .then(allFiles => allFiles.reduce((all, files) => all.concat(files)))
    .then(files => files.map(f => "file://" + path.join(dir, f)))
}

function loadConfig() {

  if (args.config) require(args.config)
  else {

    var pkgCfgPaths = ["file://" + path.join(__dirname, "../package.json")];

    var projectConf = path.join(dir, "package.json");
    if (fs.existsSync(projectConf) && dir !== path.join(__dirname, "..")) {
      pkgCfgPaths = pkgCfgPaths.concat([
        "file://" + path.join(dir, "package.json"),
        "file://" + path.join(dir, "node_modules/*/package.json")])
      
      // FIXME! super ugly, packageConfigPaths should be recursively required...
      // but they arent!
      try {
        var json = require(path.join(dir, "package.json"));
        pkgCfgPaths = pkgCfgPaths.concat(json.systemjs.packageConfigPaths);
      } catch (e) {}
    }

    System.config({
      baseURL: "file://" + dir,
      transpiler: "babel",
      "babel": path.join(__dirname, "../node_modules/babel-core/browser.js"),
      defaultJSExtensions: true,
      map: {"mocha-es6": path.join(__dirname, "..")},
      packageConfigPaths: pkgCfgPaths
    });

  }
}

function systemConfPrint() {
  var S = System;
  var json = {
    baseURL: S.baseURL,
    transpiler: S.transpiler,
    map: S.map,
    meta: S.meta,
    packages: S.packages,
    paths: S.paths,
    packageConfigPaths: S.packageConfigPaths,
  }
  return JSON.stringify(json, null, 2);
}