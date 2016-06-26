import { exec } from "./shell-exec.js";

// node new-install.js path/to/Lively

// var execSync = require("child_process").execSync,
//     fs = require("fs"),
//     join = require("path").join.join,
//     https = require("https");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers:

var GET_code = `
var https = require("https")
function GET(url) {
  return new Promise((resolve, reject) => {
    var req = https.request(url, (res) => {
      res.setEncoding("utf8");
      var data = ""
      res.on("data", (chunk) => data += String(chunk));
      res.on("end", () => resolve(data))
      res.on("error", (err) => reject(err))
    })
    req.on("error", (e) => reject(e));
    req.end();
  })
}`;

var copyLivelyWorld_code = `
${GET_code}
var fs = require("fs"), join = require("path").join;
function copyLivelyWorld(livelyURL, pathOfWorld, livelyDir) {
  return GET(livelyURL + pathOfWorld)
    .then(content => fs.writeFileSync(join(livelyDir, pathOfWorld), content))
    .then(() => console.log("Copied %s into %s", pathOfWorld, livelyDir))
    .catch(err => { console.error("Error downloading lively world %s: %s", pathOfWorld, err); throw err; });
}
`;

var copyPBItem_code = `
var fs = require("fs"), join = require("path").join;
${GET_code}

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir); }

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
  .then(() => console.log("Part %s copied!", name))
  .catch(err => { console.error("Error copying part %s: %s", name, err); throw err; });
}`

export function downloadPartsBin(livelyDir, opts = {log: []}) {
  var nodeCode = `node -e '
process.env.WORKSPACE_LK = "${livelyDir}";
new Promise((resolve, reject) => require("./bin/helper/download-partsbin.js")(err => err ? reject(err) : resolve()))
  .then(
    () => console.log("PartsBin installed"),
    (err) => { console.error("PartsBin installation falure: " + err); process.exit(1); });
'`
  return exec(nodeCode, {cwd: livelyDir, log: opts.log});
}

export function copyPartsBinItem(fromURL, partSpace, partName, livelyDir, opts = {log: []}) {
  // "https://dev.lively-web.org/",
  // "PartsBin/lively.modules",
  // "lively.modules-browser-preferences",
  var nodeCode = `node -e '
${copyPBItem_code}
ensureDir(join("${livelyDir}", "${partSpace}"));
copyPartsBinItem("${fromURL}", "${partSpace}", "${partName}", "${livelyDir}").catch(_ => process.exit(1));
'`;
  return exec(nodeCode, {cwd: livelyDir, log: opts.log});
}

export function copyLivelyWorld(fromURL, pathToWorld, livelyDir, opts = {log: []}) {
  var nodeCode = `node -e '
${copyLivelyWorld_code}
copyLivelyWorld("${fromURL}", "${pathToWorld}", "${livelyDir}").catch(_ => process.exit(1))
'`;
  return exec(nodeCode, {cwd: livelyDir, log: opts.log});
}
