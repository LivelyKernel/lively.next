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
    "lively-system-interface",
    "lively.2lively",
    "lively.ast",
    "lively.bindings",
    "lively.changesets",
    "lively.graphics",
    "lively.installer",
    "lively.installer",
    "lively.lang",
    "lively.modules",
    "lively.morphic",
    "lively.notifications",
    "lively.resources",
    "lively.serializer2",
    "lively.server",
    "lively.shell",
    "lively.sync",
    "lively.vm",
    "lively.classes"
  ]
}


livelyModules.forEach(modDir => {
  var dir = j(baseDir, modDir),
      config = JSON.parse(fs.readFileSync(j(dir, "package.json"))),
      deps = Object.assign(config.dependencies || {}, config.devDependencies || {}),
      livelyDeps = Object.keys(deps).filter(ea => livelyModules.indexOf(ea) > -1);

  if (!fs.existsSync(j(dir, "node_modules")))
    fs.mkdirSync(j(dir, "node_modules"));

  // console.log(modDir, livelyDeps);

  livelyDeps.forEach(ea => {
    console.log(`[${dir}] ln -s ${j("../..", ea)} ${j("node_modules", ea)}`);
    x(`rm -rf ${j(dir, "node_modules", ea)}`);
    x(`ln -s ${j("../..", ea)} ${j("node_modules", ea)}`, {cwd: dir});
  });
});
