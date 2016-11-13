#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

require("systemjs");
require("lively.modules");
require("socket.io");

var parseArgs = require('minimist'),
    port = 3000,
    hostname = "localhost",
    isMain = !module.parent,
    step = 1;

if (isMain) {
  var args = parseArgs(process.argv.slice(2), {
    alias: {port: "p"}
  });
  if ("port" in args) port = args.port;
  if ("hostname" in args) hostname = args.hostname;
}

lively.modules.registerPackage(".")
  .then(() => console.log(`[lively.server] ${step++}. preparing system...`))
  .then(() => System.import("lively.resources"))
  .then(resources => resources.ensureFetch())
  .then(() => lively.modules.importPackage("lively-system-interface"))

  .then(() => console.log(`[lively.server] ${step++}. starting server...`))
  .then(() => System.import("./server.js"))
  .then((server) => server.ensure({port, hostname}))
  .then((state) => console.log(`[lively.server] ${step++}. Lively server at ${state.hostname}:${state.port} running`))

  .catch(err => {
    console.error(`Error starting server: ${err.stack}`);
    process.exit(1);
  });
