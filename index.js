/*global process,require,__dirname,module*/
require("systemjs");
let modules = require("lively.modules");
let resource = lively.resources.resource;
require("socket.io");

const defaultServerDir = __dirname;
var livelySystem;

module.exports = function start(hostname, port, rootDirectory, serverDir) {
  if (!rootDirectory) rootDirectory = process.cwd();
  if (!serverDir) serverDir = defaultServerDir;

  var step = 1;
  console.log(`Lively server starting with root dir ${rootDirectory}`);

  return setupLivelyModulesTestSystem(rootDirectory)
    .then(() => console.log(`[lively.server] ${step++}. preparing system...`))
    .then(() => lively.modules.registerPackage(serverDir))
    // 1. This loads the lively system
    .then(() => livelySystem.import("lively.resources"))
    .then(resources => resources.ensureFetch())
    .then(() => livelySystem.import("lively.storage"))
    .then(() => livelySystem.import("lively-system-interface"))
    // 2. this loads and starts the server
    .then(() => console.log(`[lively.server] ${step++}. starting server...`))
    .then(() => livelySystem.import(serverDir + "/server.js"))
    .then(serverMod => startServer(serverMod, serverDir, port, hostname, rootDirectory))
    .then(server => {
      console.log(`[lively.server] ${step++}. ${server} running`);
      return server;
    })
    .catch(err => {
      console.error(`Error starting server: ${err.stack}`);
      console.log(err)
      process.exit(1);
    });
};


function setupLivelyModulesTestSystem(rootDirectory) {
  var baseURL = "file://" + rootDirectory;
  livelySystem = lively.modules.getSystem("lively", {baseURL});
  lively.modules.changeSystem(livelySystem, true);
  var registry = livelySystem["__lively.modules__packageRegistry"] = new modules.PackageRegistry(livelySystem);
  registry.packageBaseDirs = process.env.FLATN_PACKAGE_COLLECTION_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.devPackageDirs = process.env.FLATN_DEV_PACKAGE_DIRS.split(":").map(ea => resource(`file://${ea}`));
  return registry.update();
}

function startServer(serverMod, serverDir, port, hostname, rootDirectory) {
  var opts = {port, hostname, plugins: [], jsdav: {rootDirectory}};
  return Promise.all(
    [
      serverDir + "/plugins/cors.js",
      serverDir + "/plugins/proxy.js",
      serverDir + "/plugins/socketio.js",
      serverDir + "/plugins/eval.js",
      serverDir + "/plugins/l2l.js",
      serverDir + "/plugins/remote-shell.js",
      serverDir + "/plugins/world-loading.js",
      serverDir + "/plugins/lib-lookup.js",
      serverDir + "/plugins/dav.js",
      serverDir + "/plugins/moduleBundler.js",
      serverDir + "/plugins/user.js",
      serverDir + "/plugins/discussion.js"
    ].map(path => livelySystem.import(path).then(mod =>
                    opts.plugins.push(new mod.default(opts))))
  ).then(() => serverMod.start(opts));
}
