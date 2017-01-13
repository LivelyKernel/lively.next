#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

require("systemjs");
require("lively.modules");
require("socket.io");

var parseArgs = require('minimist'),
    port = 3000,
    hostname = "localhost",
    rootDirectory = process.cwd(),
    isMain = !module.parent,
    step = 1;

if (isMain) {
  var args = parseArgs(process.argv.slice(2), {
    alias: {port: "p", "root-directory": "d"}
  });

  if ("port" in args) port = args.port;
  if ("hostname" in args) hostname = args.hostname;
  if ("root-directory" in args) rootDirectory = args["root-directory"];
}

var System = lively.modules.getSystem("lively", {baseURL: `file://${rootDirectory}`});
lively.modules.changeSystem(System, true);

lively.modules.registerPackage(".")
  .then(() => console.log(`[lively.server] ${step++}. preparing system...`))
  
  // 1. This loads the lively system
  .then(() => System.import("lively.resources"))
  .then(resources => resources.ensureFetch())
  .then(() => lively.modules.importPackage("lively-system-interface"))

  // 2. this loads and starts the server
  .then(() => console.log(`[lively.server] ${step++}. starting server...`))
  .then(() => System.import("./server.js"))
  .then(serverMod => {
    var opts = {port, hostname, plugins: [], jsdav: {rootDirectory}};
    return Promise.all([
        "./plugins/cors.js",
        "./plugins/proxy.js",
        "./plugins/socketio.js",
        "./plugins/eval.js",
        "./plugins/l2l.js",
        "./plugins/remote-shell.js",
        "./plugins/dav.js"
      ].map(path => System.import(path).then(mod => opts.plugins.push(new mod.default(opts))))
    ).then(() => serverMod.start(opts));
  })
  .then((server) => console.log(`[lively.server] ${step++}. ${server} running`))

  .catch(err => {
    console.error(`Error starting server: ${err.stack}`);
    process.exit(1);
  });
