#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
import System from 'systemjs';
import parseArgs from 'minimist';
import url from 'url'

global.System = System;

const isMain = import.meta.url === url.pathToFileURL(process.argv[1]).href;
const defaultRootDirectory = process.cwd();

if (isMain) {
  var args = parseArgs(process.argv.slice(2), {
    alias: {port: "p", "root-directory": "d"}
  });
  import("../index.js").then(({ default: start }) => {
  start( 
    args.hostname,
    args.port,
    args.config,
    args["root-directory"] || defaultRootDirectory);
  });
}

