require("systemjs");
require("lively.modules");
require("socket.io")

// System.debug = true;

var port = 3000;
var hostname = "localhost";
var isMain = !module.parent;

if (isMain) {
  var args = process.argv.slice(1),
      portArgIndex = args.findIndex(arg => arg === "-p" || arg === "--port");
  if (portArgIndex && args[portArgIndex+1] && Number(args[portArgIndex+1]))
    port = Number(args[portArgIndex+1]);
}

System.debug = false;

lively.modules.registerPackage(".")

  .then(() => System.import("./server.js"))
  .then((server) => server.ensure({port, hostname}))
  .then((state) => console.log(`[lively.server] ${state.options.hostname}:${state.options.port} running`))

  .then(() => lively.modules.importPackage("lively-system-interface"))
  .then(() => console.log(`[lively.server] lively-system-interface loaded`))

  .catch(err => {
    console.error(`Error starting server: ${err.stack}`);
    process.exit(1);
  });
