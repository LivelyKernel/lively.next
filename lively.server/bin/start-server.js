#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"

import start from "../index.js";
//var start = require("./server.min.js");
import parseArgs from 'minimist';
import url from 'url'

const isMain = import.meta.url === url.pathToFileURL(process.argv[1]).href;
const defaultRootDirectory = process.cwd();

if (isMain) {
  var args = parseArgs(process.argv.slice(2), {
    alias: {port: "p", "root-directory": "d"}
  });
  start(
    args.hostname,
    args.port,
    args.config,
    args["root-directory"] || defaultRootDirectory);
}

