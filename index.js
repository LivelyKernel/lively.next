/*global process,require,__dirname,module*/
require("systemjs");
let modules = require("lively.modules");
let resource = lively.resources.resource;
require("socket.io");

const defaultServerDir = __dirname;
var livelySystem;
var config = {
  serverDir: defaultServerDir,
  port: 9011,
  hostname: "localhost",
  rootDirectory: null,
  plugins: []
};

module.exports = function start(hostname, port, configFile, rootDirectory, serverDir) {
  config.rootDirectory = rootDirectory || process.cwd();
  config.serverDir = serverDir || defaultServerDir;
  setupLogger();
  var step = 1;
  console.log(`[lively.server] system base directory: ${rootDirectory}`);
  return setupSystem(config.rootDirectory)
    .then(() => console.log(`[lively.server] ${step++}. preparing system`))
    .then(() => lively.modules.registerPackage(config.serverDir))

  return setupLivelyModulesTestSystem(rootDirectory)
    .then(() => console.log(`[lively.server] ${step++}. preparing system...`))
    .then(() => lively.modules.registerPackage(serverDir))
    // 1. This loads the lively system
    .then(() => livelySystem.import("lively.resources"))
    .then(resources => resources.ensureFetch())
    .then(() => livelySystem.import("lively.storage"))
    .then(() => livelySystem.import("lively-system-interface"))
    .then(() => configFile ? console.log(`[lively.server] ${step++}. loading ${configFile}`) : null)
    .then(() => configFile ? livelySystem.import(configFile) : null)
    .then(configMod => {
      if (!configMod || !configMod.default || !configMod.default.server) return;
      Object.assign(config, configMod.default.server);
      // passed in arguments take precedence
      if (hostname) config.hostname = hostname;
      if (port) config.port = port;
     })

    // 2. this loads and starts the server
    .then(() => console.log(`[lively.server] ${step++}. starting server...`))
    .then(() => livelySystem.import(serverDir + "/server.js"))
    .then(serverMod => startServer(serverMod, serverDir, port, hostname, rootDirectory))
    .then(() => livelySystem.import(config.serverDir + "/server.js"))
    .then(serverMod => startServer(serverMod, config))
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

function startServer(serverMod, config) {
  let {serverDir, port, hostname, rootDirectory} = config,
      serverConfig = {port, hostname, plugins: [], jsdav: {rootDirectory}};
  return Promise.all(
    config.plugins.map(path =>
      livelySystem.import(path).then(mod =>
        serverConfig.plugins.push(new mod.default(serverConfig))))
  ).then(() => serverMod.start(serverConfig));
}
