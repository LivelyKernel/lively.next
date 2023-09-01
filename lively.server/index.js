/*global process,require,__dirname,module,global*/
import "systemjs";
import * as modules from "lively.modules";
import { resource } from 'lively.resources';
import { obj } from 'lively.lang';
import "socket.io";
import util from 'node:util';
import winston from "winston";
import { setupSystem } from "lively.installer";

const defaultServerDir = process.cwd();
var livelySystem;
var config = {
  serverDir: defaultServerDir,
  port: 9011,
  hostname: "localhost",
  rootDirectory: null,
  plugins: []
};

export default async function start(hostname, port, configFile, rootDirectory, serverDir) {
  config.rootDirectory = rootDirectory || process.cwd();
  config.serverDir = serverDir || defaultServerDir;
  setupLogger();
  var step = 1;
  console.log(`[lively.server] system base directory: ${rootDirectory}`);
  return setupSystem(config.rootDirectory)
    .then(sys => livelySystem = sys)
    .then(() => console.log(`[lively.server] ${step++}. preparing system`))
    .then(() => modules.registerPackage(config.serverDir))

    // 1. This loads the lively system
    .then(() => livelySystem.import("lively.resources"))
    .then(resources => resources.ensureFetch())
    .then(() => modules.importPackage("lively.storage"))
    .then(() => livelySystem.import("lively.vm"))
    .then(() => livelySystem.import("lively.classes"))
    .then(() => livelySystem.import('lively.modules'))
    .then(modules => {
      // migrate the system over 
      modules.changeSystem(livelySystem);
      modules.unwrapModuleResolution(livelySystem);
      modules.wrapModuleResolution(livelySystem);
      // what about the package registry???
      const oldRegistry = livelySystem['__lively.modules__packageRegistry'];
      delete livelySystem['__lively.modules__packageRegistry'];
      const newRegistry = livelySystem['__lively.modules__packageRegistry'] = modules.PackageRegistry.ofSystem(livelySystem);
      Object.assign(newRegistry, obj.select(oldRegistry, [
        'packageMap', 'individualPackageDirs', 'devPackageDirs', 'packageBaseDirs'
      ]));
      newRegistry.resetByURL();
    }).then(() =>
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
  let logger = new winston.createLogger();
const myFormat = winston.format.printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});
  logger.add(new winston.transports.Console({
	format: winston.format.combine(
		winston.format.colorize(),
		winston.format.timestamp(),
                myFormat
		)
	}));
  console.livelyLogger = logger;
  console.log = function() { logger.info.apply(logger, formatArgs(arguments)); };
  console.info = function() { logger.info.apply(logger, formatArgs(arguments)); };
  console.warn = function() { logger.warn.apply(logger, formatArgs(arguments)); };
  console.error = function() { logger.error.apply(logger, formatArgs(arguments)); };
  console.debug = function() { logger.debug.apply(logger, formatArgs(arguments)); };
  return logger;
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
