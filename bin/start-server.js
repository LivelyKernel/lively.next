#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

var start = require("../index.js");

var parseArgs = require('minimist'),
    defaultRootDirectory = process.cwd(),
    isMain = !module.parent;

if (isMain) {
  var args = parseArgs(process.argv.slice(2), {
    alias: {port: "p", "root-directory": "d"}
  });
  start(args.hostname, args.port, args.config, args["root-directory"] || defaultRootDirectory);
}

