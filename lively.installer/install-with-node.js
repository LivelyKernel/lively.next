/*global process,require,System*/

let nodeVersion = process.versions.node;
let majorVersion = Number(nodeVersion.split('.')[0]);
if (majorVersion < 7) {
  console.error("nodejs version %s not supported by lively.next.  Please use at least nodejs 7.", majorVersion);
  process.exit(1);
}

global.babel = require("./deps/babel.min.js");
require("./deps/system.src.js");
//require("./deps/lively.modules.js");

require('../lively.modules/dist/lively.modules.bootstrap.min.js');

if (!process.argv[2]) {
  console.error("No installation dir specified!")
  process.exit(1);
}

// System.debug = true;
var path = require('path'),
    installDir = path.resolve(process.argv[2]),
    dependenciesDir = path.join(installDir, "lively.next-node_modules"),
    verbose = false;



console.log("Installing lively.system packages into %s", installDir);

lively.modules.importPackage("./lively.installer")
  .then(() => lively.modules.importPackage("./flatn"))
  .then(() => System.import("lively.installer/install.js"))
  .then(installer => installer.install(installDir, dependenciesDir, verbose))
  .catch(err => { console.error("Error!" + err); process.exit(2); })
