/*global process,require,System*/

require('./deps/system.src.cjs');

let nodeVersion = process.versions.node;
let majorVersion = Number(nodeVersion.split('.')[0]);
if (majorVersion < 17) {
  console.error("Your node.js version %s is not supported by lively.next.  Please use at least node.js 17.", majorVersion);
  process.exit(1);
}

if (!process.argv[2]) {
  console.error("No installation dir specified!")
  process.exit(1);
}

// System.debug = true;
var path = require('path'),
    installDir = path.resolve(process.argv[2]),
    dependenciesDir = path.join(installDir, "lively.next-node_modules"),
    verbose = false;

// misses a system-install...

console.log("Installing lively.system packages into %s", installDir);
import('lively.installer/install.js').then(installer => {
  installer.install(installDir, dependenciesDir, verbose)
});

// modules.importPackage("./lively.installer")
//   .then(() => modules.importPackage("./flatn")) // bullshit, this does not produce the side effects it used to.
//   .then(() => System.import("lively.installer/install.js"))
//   .then(installer => installer.install(installDir, dependenciesDir, verbose))
//   .catch(err => { console.error("Error!" + err); process.exit(2); })
