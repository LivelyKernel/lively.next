#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
import { createRequire } from 'module';
import url from 'node:url';
import { realpathSync } from 'node:fs';

const require = createRequire(import.meta.url);
const System = require('systemjs');
const parseArgs = require('minimist');

global.System = System;
const isMain = process.argv[1] && import.meta.url === url.pathToFileURL(realpathSync(process.argv[1])).href;
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
