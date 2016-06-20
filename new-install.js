// node new-install.js path/to/Lively

var execSync = require("child_process").execSync,
    fs = require("fs"),
    join = require("path").join;
var https = require("https");
var join = require("path").join;
var fs = require("fs");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers:

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}

function pullDir(targetDirectory, gitRepo, projectName, branch) {
  if (!branch) branch = "master";
  var projDir = join(targetDirectory, projectName);
  if (!fs.existsSync(projDir)) {
    execSync(`git clone -b ${branch} ${gitRepo} ${projectName}`, {cwd: targetDirectory});
    execSync("npm install", {cwd: projDir})
  }
}

function copyLivelyWorld(livelyURL, pathOfWorld, livelyDir) {
  return GET(livelyURL + pathOfWorld)
    .then(content => fs.writeFileSync(join(livelyDir, pathOfWorld)))
    .catch(err => console.error(`Error downloading lively world ${pathOfWorld}: ${err}`));
}

function copyPartsBinItem(livelyURL, partsSpace, name, livelyDir) {
  // partsbinURL sth like "https://dev.lively-web.org/"
  // partsSpace sth like "PartsBin/lively.modules"
  // name like "lively.modules-browser-preferences"
  var metainfo = livelyURL + join(partsSpace, name + ".metainfo"),
      json = livelyURL + join(partsSpace, name + ".json"),
      html = livelyURL + join(partsSpace, name + ".html");
  return Promise.all([
    GET(metainfo), GET(json), GET(html)
  ]).then((contents) => {
    var metainfoContent = contents[0],
        jsonContent = contents[1],
        htmlContent = contents[2];
    fs.writeFileSync(join(livelyDir, partsSpace, name + ".metainfo"), metainfoContent);
    fs.writeFileSync(join(livelyDir, partsSpace, name + ".json"), jsonContent);
    fs.writeFileSync(join(livelyDir, partsSpace, name + ".html"), htmlContent);
  })
  .catch(err => console.error(`Error copying part ${name}: ${err}`));
}

function GET(url) {
  console.log(url)
  return new Promise((resolve, reject) => {
    var req = https.request(url, (res) => {
      res.setEncoding('utf8');
      var data = ""
      res.on('data', (chunk) => data += String(chunk));
      res.on('end', () => resolve(data))
      res.on('error', (err) => reject(err))
    })
    req.on('error', (e) => reject(e));
    req.end();
  })
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// the actual program starts here:

var args = process.argv.slice(2);

if (!args.length) {
  console.error("Please specify the directory to install stuff to");
  process.exit(1);
}

// read the target directory from the commandline
var targetDirectory = args[0]
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

ensureDir(packagesDir);

pullDir(
  packagesDir,
  "https://github.com/LivelyKernel/lively.resources",
  "lively.resources");

pullDir(
  packagesDir,
  "https://github.com/LivelyKernel/lively-system-interface",
  "lively-system-interface");

pullDir(
  packagesDir,
  "https://github.com/LivelyKernel/lively.installer",
  "lively.installer");

pullDir(
  packagesDir,
  "https://github.com/LivelyKernel/lively.serializer",
  "lively.serializer");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

console.log("Finished pulling packages from git")

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


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

console.log("Finished linking projects")

process.env.WORKSPACE_LK = livelyDir

new Promise((resolve, reject) => require(join(livelyDir, "bin/helper/download-partsbin.js"))((err) => err ? reject(err) : resolve()))
.then(() => ensureDir(join(livelyDir, "PartsBin/lively.modules")))
.then(() => 
  Promise.all([
    copyPartsBinItem(
      "https://dev.lively-web.org/",
      "PartsBin/lively.modules",
      "lively.modules-browser-preferences",
      livelyDir),
  
    copyPartsBinItem(
      "https://dev.lively-web.org/",
      "PartsBin/lively.modules",
      "lively.vm-editor",
      livelyDir),
  
    copyPartsBinItem(
      "https://dev.lively-web.org/",
      "PartsBin/lively.modules",
      "mocha-test-runner",
      livelyDir),
  
    copyLivelyWorld(
      "https://dev.lively-web.org/",
      "development.html",
      livelyDir),
  ])
  .then(() => console.log("Everything installed!"))
  .catch(err => console.error(err)));
