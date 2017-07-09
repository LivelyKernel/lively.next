import { module } from "d3/package.json";
#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

var start = require("../server.js");

var parseArgs = require('minimist'),
    defaultRootDirectory = process.cwd(),
    isMain = !module.parent;

if (isMain) {
  var args = parseArgs(process.argv.slice(2));
  start(args.hostname, args.port, args.userdb);
}
