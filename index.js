require("systemjs");
require("lively.modules");
require("socket.io");

const defaultServerDir = __dirname;

module.exports = function start(hostname, port, rootDirectory, serverDir) {
  if (!rootDirectory) rootDirectory = process.cwd();
  if (!serverDir) serverDir = defaultServerDir;

  var step = 1;
  console.log(`Lively server starting with root dir ${rootDirectory}`);
  var System = lively.modules.getSystem("lively", {
    baseURL: `file://${rootDirectory}`
  });
  lively.modules.changeSystem(System, true);

  return (
    lively.modules.registerPackage(serverDir)
      .then(() => console.log(`[lively.server] ${step++}. preparing system...`))
      // 1. This loads the lively system
      .then(() => System.import("lively.resources"))
      .then(resources => resources.ensureFetch())
      .then(() => System.import("lively.storage"))
      .then(() => lively.modules.importPackage("lively-system-interface"))
      // 2. this loads and starts the server
      .then(() => console.log(`[lively.server] ${step++}. starting server...`))
      .then(() => System.import(serverDir + "/server.js"))
      .then(serverMod => {
        var opts = {port, hostname, plugins: [], jsdav: {rootDirectory}};
        return Promise.all(
          [
            serverDir + "/plugins/cors.js",
            serverDir + "/plugins/proxy.js",
            serverDir + "/plugins/socketio.js",
            serverDir + "/plugins/eval.js",
            serverDir + "/plugins/l2l.js",
            serverDir + "/plugins/remote-shell.js",
            serverDir + "/plugins/dav.js",
            serverDir + "/plugins/moduleBundler.js",
            serverDir + "/plugins/user.js",
            serverDir + "/plugins/discussion.js"
          ].map(path => System.import(path).then(mod =>
                          opts.plugins.push(new mod.default(opts))))
        ).then(() => serverMod.start(opts));
      })
      .then(server => console.log(`[lively.server] ${step++}. ${server} running`))
      .catch(err => {
        console.error(`Error starting server: ${err.stack}`);
        process.exit(1);
      })
  );
};
