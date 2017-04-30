/*global System, require, process*/

if (typeof System !== "undefined") {
  var j = System._nodeRequire("path").join,
      fs = System._nodeRequire("fs"),
      x = System._nodeRequire("child_process").execSync;
} else {
  var j = require("path").join,
      fs = require("fs"),
      x = require("child_process").execSync;
}

var baseDir = process.cwd(),
    installerDir = j(baseDir, "lively.installer"),
    packageConfig = j(installerDir, "packages-config.json");

if (fs.existsSync(installerDir) && fs.existsSync(packageConfig)) {
  var livelyModules = JSON.parse(fs.readFileSync(packageConfig)).map(ea => ea.name);
}

if (!livelyModules) {
  livelyModules = [
    "lively.lang",
    "lively.bindings",
    "lively.ast",
    "lively.source-transform",
    "lively.classes",
    "lively.vm",
    "lively.modules",
    "mocha-es6",
    "lively.resources",
    "lively.storage",
    "lively-system-interface",
    "lively.installer",
    "lively.serializer2",
    "lively.graphics",
    "lively.morphic",
    "lively.mirror",
    "lively.sync",
    "lively.notifications",
    "lively.changesets",
    "lively.shell",
    "lively.server",
    "lively.2lively",
    "lively.user",
    "lively.git",
    "lively.traits"
  ];
}


livelyModules.forEach(modDir => {
  var dir = j(baseDir, modDir),
      config = JSON.parse(fs.readFileSync(j(dir, "package.json"))),
      deps = Object.assign(config.dependencies || {}, config.devDependencies || {}),
      livelyDeps = Object.keys(deps).filter(ea => livelyModules.indexOf(ea) > -1);

  if (!fs.existsSync(j(dir, "node_modules")))
    fs.mkdirSync(j(dir, "node_modules"));

  // console.log(modDir, livelyDeps);

  let unlinkedLivelyDeps = fs.readdirSync(j(dir, "node_modules")).filter(ea => {
    if (!livelyModules.includes(ea) || livelyDeps.includes(ea)) return false;
    try { fs.readlinkSync(j(dir, "node_modules", ea)); } catch (err) { return true; }
    return false;
  })

  livelyDeps.concat(unlinkedLivelyDeps).forEach(ea => {
    console.log(`[${dir}] ln -s ${j("../..", ea)} ${j("node_modules", ea)}`);
    x(`rm -rf ${j(dir, "node_modules", ea)}`);
    x(`ln -s ${j("../..", ea)} ${j("node_modules", ea)}`, {cwd: dir});
  });

});
