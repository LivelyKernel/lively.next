'format esm';

import { execSync } from "child_process";
import * as fs from "fs";
import { join } from "path";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}

function pullDir(targetDirectory, gitRepo, projectName, branch = "master") {
  var projDir = join(targetDirectory, projectName);
  if (!fs.existsSync(projDir)) {
    execSync(`git clone -b ${branch} ${gitRepo} ${projectName}`, {cwd: targetDirectory});
    execSync("npm install", {cwd: projDir})
  }
}

var targetDirectory = "/Users/robert/Lively/LivelyKernel2/test-dir"
// execSync("rm -rf " + targetDirectory)

ensureDir(targetDirectory);

pullDir(
  targetDirectory,
  "https://github.com/LivelyKernel/node-lively-loader",
  "lively-loader")

pullDir(
  targetDirectory,
  "https://github.com/LivelyKernel/lively.lang",
  "lively.lang")

pullDir(
  targetDirectory,
  "https://github.com/LivelyKernel/lively.ast",
  "lively.ast")

pullDir(
  targetDirectory,
  "https://github.com/LivelyKernel/lively.vm",
  "lively.vm")

pullDir(
  targetDirectory,
  "https://github.com/LivelyKernel/lively.modules",
  "lively.modules")

pullDir(
  targetDirectory,
  "https://github.com/LivelyKernel/lively-system-examples",
  "lively-system-examples")

pullDir(
  targetDirectory,
  "https://github.com/rksm/mocha-es6",
  "mocha-es6")

pullDir(
  targetDirectory,
  "https://github.com/LivelyKernel/LivelyKernel",
  "LivelyKernel",
  "new-module-system")

var livelyDir = join(targetDirectory, "LivelyKernel"),
    packagesDir = join(livelyDir, "packages");

ensureDir(packagesDir)

pullDir(
  packagesDir,
  "https://github.com/LivelyKernel/lively.resources",
  "lively.resources")

pullDir(
  packagesDir,
  "https://github.com/LivelyKernel/lively-system-interface",
  "lively-system-interface")



var currentDir = join(targetDirectory, "lively-loader/node_modules");
execSync("rm -rf lively.lang; ln -s ../../lively.lang lively.lang", {cwd: currentDir});

var currentDir = join(targetDirectory, "lively.ast/node_modules")
execSync("rm -rf lively.lang; ln -s ../../lively.lang lively.lang", {cwd: currentDir})
execSync("rm -rf mocha-es6; ln -s ../../mocha-es6 mocha-es6", {cwd: currentDir})

var currentDir = join(targetDirectory, "lively.vm/node_modules")
execSync("rm -rf lively.lang; ln -s ../../lively.lang lively.lang", {cwd: currentDir})
execSync("rm -rf lively.ast; ln -s ../../lively.ast lively.ast", {cwd: currentDir})
execSync("rm -rf mocha-es6; ln -s ../../mocha-es6 mocha-es6", {cwd: currentDir})

var currentDir = join(targetDirectory, "lively.modules/node_modules")
execSync("rm -rf lively.lang; ln -s ../../lively.lang lively.lang", {cwd: currentDir})
execSync("rm -rf lively.ast; ln -s ../../lively.ast lively.ast", {cwd: currentDir})
execSync("rm -rf lively.vm; ln -s ../../lively.vm lively.vm", {cwd: currentDir})
execSync("rm -rf mocha-es6; ln -s ../../mocha-es6 mocha-es6", {cwd: currentDir})

var currentDir = join(targetDirectory, "lively-system-examples/node_modules")
execSync("rm -rf lively.modules; ln -s ../../lively.modules lively.modules", {cwd: currentDir})
execSync("rm -rf lively.vm; ln -s ../../lively.vm lively.vm", {cwd: currentDir})

var currentDir = join(targetDirectory, "mocha-es6/node_modules")
execSync("rm -rf lively.modules; ln -s ../../lively.modules lively.modules", {cwd: currentDir})


var currentDir = join(targetDirectory, "LivelyKernel/node_modules")
execSync("rm -rf lively-loader;  ln -s ../../lively-loader lively-loader", {cwd: currentDir})
execSync("rm -rf lively.ast;     ln -s ../../lively.ast lively.ast", {cwd: currentDir})
execSync("rm -rf lively.lang;    ln -s ../../lively.lang lively.lang", {cwd: currentDir})
execSync("rm -rf lively.vm;      ln -s ../../lively.vm lively.vm", {cwd: currentDir})
execSync("rm -rf lively.modules; ln -s ../../lively.modules lively.modules", {cwd: currentDir})
execSync("rm -rf mocha-es6;      ln -s ../../mocha-es6 mocha-es6", {cwd: currentDir})


var currentDir = join(packagesDir, "lively.resources/node_modules")
ensureDir(currentDir);
execSync("rm -rf mocha-es6; ln -s ../../../../mocha-es6 mocha-es6", {cwd: currentDir});

var currentDir = join(packagesDir, "lively-system-interface/node_modules")
ensureDir(currentDir);
execSync("rm -rf lively.modules;   ln -s ../../../../lively.modules", {cwd: currentDir})
execSync("rm -rf lively.resources; ln -s ../../../../lively.resources", {cwd: currentDir})
execSync("rm -rf lively.lang;      ln -s ../../../../lively.lang", {cwd: currentDir})
execSync("rm -rf lively.ast;       ln -s ../../../../lively.ast", {cwd: currentDir})
execSync("rm -rf mocha-es6;        ln -s ../../../../mocha-es6 mocha-es6", {cwd: currentDir})
