/*global require, process*/
'use strict';

let { join: j, basename } = require("path"),
    fs = require("fs"),
    env = process.env,
    livelyDir = j(env.HOME, "/repos/lively.next/"),
    packageDepDir = j(livelyDir, "lively.next-node_modules"),
    flatnDir = j(livelyDir, "flatn"),
    flatnBin = j(flatnDir, "bin"),
    flatnModuleResolver = j(flatnDir, "module-resolver.js"),
    appPath;

main().catch(err => {
  console.error("Error starting lively.app:", err);
  process.exist(1);
});

async function main() {
  await new Promise(resolve => app.on("ready", () => resolve()));
  appPath = '/home/linus/repos/lively.next';
  return /*needsInitialize() ? initialize() :*/ startServer();
}

function needsInitialize() {
  if (!fs.existsSync(livelyDir)) return true;

  if (!fs.existsSync(j(livelyDir, "app-info.json"))) return true;

  try {
    var appInfo = JSON.parse(fs.readFileSync(j(livelyDir, "app-info.json"))),
        semver = require(j(appPath, "./semver/semver.5.3.0.js")),
        packageJson = JSON.parse(fs.readFileSync(j(appPath, "package.json")));
    if (semver.lt(appInfo.version, packageJson.version, true))
      return true;
  } catch (err) {
    console.error("error in needsInitialize:", err);
    return true; 
  }
  return false;
}

async function initialize() {

  var logWindow = await openLogWindow();

  let removed = moveOldLivelyFolderToThrash();
  if (removed) log(`Moving old ${livelyDir} to ${removed}, initializing new version...`);
  else log(`${livelyDir} does not exist yet, initializing...`);

  try {
    let extract = require(j(appPath, "./deploy/extract.js"));
    await extract(livelyDir, j(appPath, "lively.next.tar.gz"));
    log(`lively.app initialized`);
    await new Promise(resolve => setTimeout(() => resolve(), 1000));

  } catch (err) {
    log(`Error initializing: ` + err.stack);
    await new Promise((resolve, reject) => setTimeout(() => reject(err), 2000));
  }

  app.relaunch();

  setTimeout(() => process.exit(), 100);

  // FIXME redundancy with start-server.js!
  function openLogWindow() {
    return new Promise((resolve, reject) => {
      if (logWindow && !logWindow.isDestroyed()) {
        logWindow.show();
        return resolve(logWindow);
      }
      logWindow = new BrowserWindow({width: 800, height: 600, show: false});
      logWindow.loadURL("file://" + appPath + "/logger.html");
      logWindow.once('ready-to-show', () => {
        logWindow.show();
        resolve(logWindow);
      })
    })
  }
  
  function log(content) {
    console.log(content);
    logWindow.webContents.send("log", {type: "log", content});  
  }
}


function moveOldLivelyFolderToThrash() {
  if (!fs.existsSync(livelyDir)) return null;
  if (shell.moveItemToTrash(livelyDir)) return "Thrash";
  let outOfMyWayDir = j(env.HOME, ".lively" + timestamp() + "/");
  copyFolderRecursiveSync(livelyDir, outOfMyWayDir);
  return outOfMyWayDir;
}

function copyFolderRecursiveSync(source, target) {
  console.log(`Copying ${source} to ${target}`);

  var files = [];

  // check if folder needs to be created or integrated
  var targetFolder = j(target, basename(source));
  if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder);

  // copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function(file) {
      var curSource = j(source, file);
      if (fs.lstatSync(curSource).isDirectory())
        copyFolderRecursiveSync(curSource, targetFolder);
      else
        copyFileSync(curSource, targetFolder);
    });
  }

  function copyFileSync(source, target) {
    var targetFile = target;
    // if target is a directory a new file with the same name will be created
    if (fs.existsSync(target)) {
      if (fs.lstatSync(target).isDirectory()) {
        targetFile = j(target, basename(source));
      }
    }
    
    fs.writeFileSync(targetFile, fs.readFileSync(source));
  }
}

function timestamp() {
  return new Date().toString()
    .replace(/^[^\s]+\s/, "")
    .replace(/\s[^\s]+\s[^\s]+$/, "")
    .replace(/[\s:]/g, "-");
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function startServer() {
  let livelyPackages = fs.readdirSync(livelyDir)
        .map(ea => j(livelyDir, ea))
        .filter(ea => ea != packageDepDir && fs.statSync(ea).isDirectory()),
      collectionDirs = (env.FLATN_PACKAGE_COLLECTION_DIRS || "").split(":").filter(Boolean),
      devDirs = (env.FLATN_PACKAGE_COLLECTION_DIRS || "").split(":").filter(Boolean);
      
  if (!collectionDirs.includes(packageDepDir)) collectionDirs.push(packageDepDir);
  env.FLATN_PACKAGE_COLLECTION_DIRS = collectionDirs.join(":")
  
  for (let p of livelyPackages) if (!devDirs.includes(p)) devDirs.push(p);
  env.FLATN_DEV_PACKAGE_DIRS = devDirs.join(":");
  
  if (!env.PATH.includes(flatnBin)) env.PATH = flatnBin + ":" + env.PATH;
  
  if (!require.cache[flatnModuleResolver]) require(flatnModuleResolver);
  
  require("./start-server.js").start(livelyDir);  
}
