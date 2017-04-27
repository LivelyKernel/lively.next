#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

var start = require("../index.js");

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

start(hostname, port, rootDirectory);
