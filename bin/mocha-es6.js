#! /usr/bin/env node

/*global require, process, __dirname*/
require("systemjs")

var modules   = require("lively.modules")
var resource  = lively.resources.resource;
var parseArgs = require('minimist');
var glob      = require('glob');
var mochaEs6  = require("../mocha-es6.js")
var path      = require("path");
var fs        = require("fs");
var flatn     = require("flatn");
var dir       = process.cwd();
var mochaDir  = path.join(__dirname, "..");
var depDir    = path.join(dir, ".dependencies")
var step      = 1;
var args;

lively.lang.promise.chain([
  () => { // prep
    modules.System.trace = true
    cacheMocha(modules.System, "file://" + mochaDir);
    modules.unwrapModuleLoad();
    readProcessArgs();
  },
  () => setupFlatn(),
  () => runPreScript(),
  () => console.log(`${step++}. Looking for test files via globs ${args.files.join(", ")}`),
  () => findTestFiles(args.files),
  (files, state) => state.testFiles = files,
  () => console.log(`${step++}. Preparing lively.modules`),
  () => setupLivelyModulesTestSystem(),
  (_, state) => console.log(`${step++}. Running tests in\n  ${state.testFiles.join("\n  ")}`),
  (_, state) => mochaEs6.runTestFiles(state.testFiles, {package: "file://" + dir}),
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

function runPreScript() {
  var scriptPath = args["pre-script"];
  if (!scriptPath) return;
  if (!path.isAbsolute(scriptPath))
    scriptPath = path.join(process.cwd(), scriptPath);
  console.log(`${step++}. Running pre-script ${scriptPath}`);
  return require(scriptPath)
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

function cacheMocha(System, mochaDirURL) {
  if (typeof System !== "undefined" && !System.get(mochaDirURL + "/mocha-es6.js")) {
    System.config({
      map: {
        "mocha-es6": mochaDirURL + "/index.js",
        "mocha": mochaDirURL + "/dist/mocha.js",
        "chai": mochaDirURL + "/dist/chai.js"
      }
    });
    System.set(mochaDirURL + "/node_modules/lively.modules/dist/lively.modules.js", System.newModule(modules));
    System.set(mochaDirURL + "/index.js", System.newModule(mochaEs6));
    System.set(mochaDirURL + "/mocha-es6.js", System.newModule(mochaEs6));
    System.set(mochaDirURL + "/dist/mocha.js", System.newModule(mochaEs6.mocha));
    System.set(mochaDirURL + "/dist/chai.js", System.newModule(mochaEs6.chai));
  }
}

function setupLivelyModulesTestSystem() {
  var baseURL = "file://" + dir,
      System = lively.modules.getSystem("system-for-test", {baseURL}),
      registry = System["__lively.modules__packageRegistry"] = new modules.PackageRegistry(System),
      env = process.env;
  registry.packageBaseDirs = env.FLATN_PACKAGE_COLLECTION_DIRS.split(":").map(resourcify);
  registry.individualPackageDirs = (env.FLATN_PACKAGE_DIRS || "").split(":").map(resourcify);
  registry.devPackageDirs = env.FLATN_DEV_PACKAGE_DIRS.split(":").map(resourcify);
  lively.modules.changeSystem(System, true);
  cacheMocha(System, "file://" + mochaDir);
  mochaEs6.installSystemInstantiateHook();
  // System.debug = true;
  return registry.update();

  function resourcify(path) { return resource("file://" + path).asDirectory(); }
}

function setupFlatn() {
  // 1. env
  console.log("Preparing flatn environment");
  require("flatn/module-resolver.js");
  let flatnBinDir = path.join(require.resolve("flatn"), "../bin"),
      env = process.env;
  if (!env.PATH.includes(flatnBinDir)) {
    console.log(`Adding ${flatnBinDir} to PATH`);
    env.PATH = flatnBinDir + ":" + env.PATH;
  }
  if (!env.FLATN_DEV_PACKAGE_DIRS || !env.FLATN_DEV_PACKAGE_DIRS.includes(dir)) {
    console.log("Setting FLATN_DEV_PACKAGE_DIRS");
    let dirs = env.FLATN_DEV_PACKAGE_DIRS ? env.FLATN_DEV_PACKAGE_DIRS.split(":") : [];
    env.FLATN_DEV_PACKAGE_DIRS = [dir].concat(dirs).join(":");
  }
  if (env.FLATN_PACKAGE_COLLECTION_DIRS) {
    depDir = env.FLATN_PACKAGE_COLLECTION_DIRS.split(":")[0]
    console.log("Using existing FLATN_PACKAGE_COLLECTION_DIR " + depDir);
  } else {
    console.log("Setting FLATN_PACKAGE_COLLECTION_DIRS");
    env.FLATN_PACKAGE_COLLECTION_DIRS = [depDir].join(":");
  }
  
  let devPackageDirs = env.FLATN_DEV_PACKAGE_DIRS.split(":"),
      packageDirs = (env.FLATN_PACKAGE_DIRS || "").split(":"),
      packageCollectionDirs = env.FLATN_PACKAGE_COLLECTION_DIRS.split(":");

  return flatn.installDependenciesOfPackage(
    dir,
    depDir,
    flatn.buildPackageMap(packageCollectionDirs, packageDirs, devPackageDirs),
    ["dependencies", "devDependencies"],
    false/*verbose*/);
}
