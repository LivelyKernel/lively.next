/*global process,require,__dirname,module*/
require("systemjs");
const modules = require("lively.modules");
const resource = lively.resources.resource;
require("socket.io");
const util = require('util');
const winston = require("winston")


const defaultServerDir = __dirname;
var livelySystem;
var config = {
  serverDir: defaultServerDir,
  port: 9011,
  hostname: "localhost",
  rootDirectory: null,
  plugins: []
};

setupSystem(process.cwd())
  .then(() => modules.registerPackage(defaultServerDir))

  // 1. This loads the lively system
  .then(() => livelySystem.import("lively.resources"))
  .then(resources => resources.ensureFetch())
  .then(() => livelySystem.import("lively.storage"))
  .then(() => livelySystem.import("lively.vm"))
  .then(vm => lively.vm = vm)
  .then(() => livelySystem.import("lively.classes"))
  .then(klass => lively.classes = klass)
  .then(() => livelySystem.import('lively.modules'))
  .then(modules => {
    // migrate the system over 
    modules.changeSystem(livelySystem);
    modules.unwrapModuleResolution();
    modules.wrapModuleResolution();
  }).then(() =>
    silenceDuring(
      // we use "GLOBAL" as normally declared var, nodejs doesn't seem to care...
      data => !String(data).includes("DeprecationWarning: 'GLOBAL'"),
      livelySystem.import("lively-system-interface")))
  .then(() => livelySystem.import('lively.2lively'))
  .then(l2l => lively.l2l = l2l)
  // 2. this loads and starts the server
  .then(() => console.log(`starting headless session`))
  .then(() => livelySystem.import(config.serverDir + "/server.js"))

  .catch(err => {
    console.error(`Error starting server: ${err.stack}`);
    process.exit(1);
  });

async function silenceDuring(filter, promise) {
  let {stdout, stderr} = process,
      {write: stdoutWrite} = stdout,
      {write: stderrWrite} = stderr;
  stdout.write = d => filter(d) && stdoutWrite.call(stdout, d);
  stderr.write = d => filter(d) && stderrWrite.call(stderr, d);
  try { return await promise; } finally {
    stdout.write = stdoutWrite;
    stderr.write = stderrWrite;
  }
}

function setupSystem(rootDirectory) {
  var baseURL = "file://" + rootDirectory;
  livelySystem = modules.getSystem("lively", {baseURL});
  modules.changeSystem(livelySystem, true);
  var registry = livelySystem["__lively.modules__packageRegistry"] = new modules.PackageRegistry(livelySystem);
  registry.packageBaseDirs = process.env.FLATN_PACKAGE_COLLECTION_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.devPackageDirs = process.env.FLATN_DEV_PACKAGE_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.individualPackageDirs = process.env.FLATN_PACKAGE_DIRS.split(":").map(ea => ea.length > 0 ? resource(`file://${ea}`) : false).filter(Boolean);
  return registry.update();
}

