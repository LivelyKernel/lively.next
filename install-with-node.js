require("systemjs");
var modules = require("lively.modules");

// System.debug = true;
var installDir = process.argv[2];

if (!installDir) {
  console.error("No installation dir specified!")
  process.exit(1);
}

console.log("Installing lively.system packages into %s", installDir);

lively.modules.importPackage(".")
  .then(() => System.import("./install.js"))
  .then(installler => installler.install(installDir))
  .catch(err => { console.err("Error!" + err); process.exit(2); })
