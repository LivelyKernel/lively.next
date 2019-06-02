#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

/*global require, process, module*/

require("systemjs")
var parseArgs = require('minimist'),
    lvm = require('lively.modules'),
    path = require('path'),
    defaultRootDirectory = process.cwd(),
    isMain = !module.parent,
    baseURL = "file://" + path.resolve(path.join(__dirname, ".."));

if (isMain) {
  var args = parseArgs(process.argv.slice(2));
  if (!args.userdb)
    throw new Error("Need --userdb, a path to the user database!")

  Promise.resolve()
    .then(() => setupSystem())
    .then(() => lively.modules.registerPackage(baseURL))
    .then(() => lvm.module(baseURL + "/server/server.js").load())
    .then(serverMod => serverMod.start(args))
    .catch(err => {
      console.error(`Error starting server: ${err.stack}`);
      process.exit(1);
    });
}


function setupSystem() {
  var livelySystem = lively.modules.getSystem("lively-for-auth-server", {baseURL});
  lively.modules.changeSystem(livelySystem, true);
  var registry = livelySystem["__lively.modules__packageRegistry"] = new lvm.PackageRegistry(livelySystem);
  if (process.env.FLATN_PACKAGE_COLLECTION_DIRS)
    registry.packageBaseDirs = process.env.FLATN_PACKAGE_COLLECTION_DIRS.split(":").map(ea => lively.resources.resource(`file://${ea}`));
  if (process.env.FLATN_PACKAGE_DIRS)
    registry.packageDirs = process.env.FLATN_PACKAGE_DIRS.split(":").map(ea => lively.resources.resource(`file://${ea}`));
  if (process.env.FLATN_DEV_PACKAGE_DIRS)
    registry.devPackageDirs = process.env.FLATN_DEV_PACKAGE_DIRS.split(":").map(ea => lively.resources.resource(`file://${ea}`));
  return registry.update();
}
