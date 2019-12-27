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

module.exports = function start(hostname, port, configFile, rootDirectory, serverDir) {
  config.rootDirectory = rootDirectory || process.cwd();
  config.serverDir = serverDir || defaultServerDir;
  setupLogger();
  var step = 1;
  console.log(`[lively.server] system base directory: ${rootDirectory}`);
  return setupSystem(config.rootDirectory)
    .then(() => console.log(`[lively.server] ${step++}. preparing system`))
    .then(() => modules.registerPackage(config.serverDir))

    // 1. This loads the lively system
    .then(() => livelySystem.import("lively.resources"))
    .then(resources => resources.ensureFetch())
    .then(() => livelySystem.import("lively.storage"))
    .then(() => livelySystem.import("lively.vm"))
    .then(vm => lively.vm = vm)
    .then(() =>
      silenceDuring(
        // we use "GLOBAL" as normally declared var, nodejs doesn't seem to care...
        data => !String(data).includes("DeprecationWarning: 'GLOBAL'"),
        livelySystem.import("lively-system-interface")))
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
    .then(() => console.log(`[lively.server] ${step++}. starting server`))
    .then(() => livelySystem.import(config.serverDir + "/server.js"))
    .then(serverMod => startServer(serverMod, config))
    .then(server => {
      console.log(`[lively.server] ${step++}. server sucessfully started`);
      return server;
    })

    .catch(err => {
      console.error(`Error starting server: ${err.stack}`);
      process.exit(1);
    });
};

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

function formatArgs(args){
  return [util.format.apply(util.format, Array.prototype.slice.call(args))];
}

function setupLogger() {
  let logger = new winston.Logger();
  logger.add(winston.transports.Console, {colorize: true, timestamp: true});
  console.livelyLogger = logger;
  console.log = function() { logger.info.apply(logger, formatArgs(arguments)); };
  console.info = function() { logger.info.apply(logger, formatArgs(arguments)); };
  console.warn = function() { logger.warn.apply(logger, formatArgs(arguments)); };
  console.error = function() { logger.error.apply(logger, formatArgs(arguments)); };
  console.debug = function() { logger.debug.apply(logger, formatArgs(arguments)); };
  return logger;
}

function setupSystem(rootDirectory) {
  var baseURL = "file://" + rootDirectory;
  livelySystem = modules.getSystem("lively", {baseURL});
  modules.changeSystem(livelySystem, true);
  var registry = livelySystem["__lively.modules__packageRegistry"] = new modules.PackageRegistry(livelySystem);
  registry.packageBaseDirs = process.env.FLATN_PACKAGE_COLLECTION_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.devPackageDirs = process.env.FLATN_DEV_PACKAGE_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.individualPackageDirs = process.env.FLATN_PACKAGE_DIRS.split(":").map(ea => resource(`file://${ea}`));
  return registry.update();
}

function startServer(serverMod, config) {
  let {serverDir, port, hostname, rootDirectory, authServerURL, freezer} = config,
      serverConfig = {port, hostname, plugins: [], jsdav: {rootDirectory}, authServerURL, freezer};
  return Promise.all(
    config.plugins.map(path =>
      livelySystem.import(path)
        .then(mod => serverConfig.plugins.push(new mod.default(serverConfig)))
        .catch(err => { console.error(`Error loading plugin ${path}`); throw err; }))
  ).then(() => serverMod.start(serverConfig));
}
