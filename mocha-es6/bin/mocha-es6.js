#!/usr/bin/env -S node --experimental-import-meta-resolve

/*global require, process, __dirname*/
global.System = require("systemjs")

var modules   = require("lively.modules")
var resource  = require("lively.resources").resource;
var lang      = require("lively.lang");
var parseArgs = require('minimist');
var glob      = require('glob');
var mochaEs6  = require("../index.js")
var path      = require("path");
var fs        = require("fs");
var fileURLToPath = require("url").fileURLToPath;
var dir       = process.cwd();
var mochaDir  = path.join(__dirname, "..");
var step      = 1;
var args;

lang.promise.chain([
  () => { // prep
    modules.System.trace = true
    cacheMocha(modules.System, "file://" + mochaDir);
    readProcessArgs();
  },
  () => setupWorkspace(),
  () => console.log(`${step++}. Looking for test files via globs ${args.files.join(", ")}`),
  () => findTestFiles(args.files),
  (files, state) => state.testFiles = files,
  () => console.log(`${step++}. Preparing lively.modules`),
  () => setupLivelyModulesTestSystem(),
  () => runPreScript(),
  () => setupL2l(),
  (_, state) => console.log(`${step++}. Running tests in\n  ${state.testFiles.join("\n  ")}`),
  (_, state) => mochaEs6.runTestFiles(state.testFiles, {package: "file://" + packageDirOf(state.testFiles[0])}),
  failureCount => !args.l2l && process.exit(failureCount)
]).catch(err => {
  console.error(err.stack || err);
  if (!args || !args.l2l) process.exit(1);
});

function readProcessArgs() {
  args = parseArgs(
    process.argv.slice(2),
    {alias: {}, boolean: ["l2l"]});
  args.files = args._;
}

function runPreScript() {
  var scriptPath = args["pre-script"];
  if (!scriptPath) return;
  if (!path.isAbsolute(scriptPath))
    scriptPath = path.join(process.cwd(), scriptPath);
  console.log(`${step++}. Running pre-script ${scriptPath}`);
  return import(require("url").pathToFileURL(scriptPath).href)
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

function packageDirOf(testFile) {
  let current = path.dirname(fileURLToPath(testFile));
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "package.json"))) return current;
    current = path.dirname(current);
  }
  return dir;
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
    System.set(mochaDirURL + "/dist/mocha.js", System.newModule(mochaEs6.mocha));
    System.set(mochaDirURL + "/dist/chai.js", System.newModule(mochaEs6.chai));
  }
}

async function setupLivelyModulesTestSystem() {
  var baseURL = "file://" + dir,
      System = modules.getSystem("system-for-test", {baseURL}),
      registry = System["__lively.modules__packageRegistry"] = new modules.PackageRegistry(System);
  Object.assign(System, require("lively.modules/src/node-resolver.js"));
  const { discoverPackageRootPaths } = require("../../lively.installer/helpers.cjs");
  let packageRoots = discoverPackageRootPaths(require("url").pathToFileURL(path.join(mochaDir, "..")).href);
  if (!packageRoots.includes(dir)) packageRoots.push(dir);
  let rootNodeModules = path.join(mochaDir, "..", "node_modules");
  registry.packageBaseDirs = [resourcify(rootNodeModules)];
  registry.nodeModulesDirs = [rootNodeModules, ...packageRoots.map(root => path.join(root, "node_modules"))].map(resourcify);
  registry.individualPackageDirs = [];
  registry.devPackageDirs = packageRoots.map(resourcify);
  modules.changeSystem(System, true);
  require("lively.source-transform/babel/plugin.js").setupBabelTranspiler(System);
  cacheMocha(System, "file://" + mochaDir);
  mochaEs6.installSystemInstantiateHook();
  // System.debug = true;
  await registry.update();
  // The live loader and test harness must use one instrumented module graph.
  // Mixing native and SystemJS copies splits recorders and class update state.
  modules = await System.import("lively.modules");
  modules.changeSystem(System, true);
  modules.unwrapModuleResolution(System);
  modules.wrapModuleResolution(System);
  mochaEs6 = await System.import("mocha-es6");
  global.lively = Object.assign(global.lively || {}, {
    modules,
    lang: await System.import("lively.lang"),
    ast: await System.import("lively.ast"),
    classes: await System.import("lively.classes"),
    vm: await System.import("lively.vm"),
    sourceTransform: await System.import("lively.source-transform")
  });
  return registry;

  function resourcify(path) { return resource("file://" + path).asDirectory(); }
}

function setupWorkspace() {
  console.log("Using Bun workspace dependencies");
}

function setupL2l() {
  // node
  if (!args.l2l) return;
  global.io = require("socket.io-client");
  require("lively.2lively/dist/lively.2lively_client_no-deps.js");
  let url = `http://localhost:9011/lively-socket.io`;
  lively.l2l.client = lively.l2l.L2LClient.ensure({
    url, namespace: "l2l", info: {type: "l2l from node repl"}});
  lively.l2l.client.whenRegistered(20 * 1000).then(() => console.log("[l2l] online")).catch(err => console.error("[l2l] failed:", err));
}
