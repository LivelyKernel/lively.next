/*global process,require,System, global*/
import path from 'path';

let nodeVersion = process.versions.node;
let majorVersion = Number(nodeVersion.split('.')[0]);
if (majorVersion < 18) {
  console.error("Your node.js version %s is not supported by lively.next.  Please use at least node.js 18.", majorVersion);
  process.exit(1);
}

if (!process.argv[2]) {
  console.error("No installation dir specified!")
  process.exit(1);
}

// System.debug = true;
var installDir = path.resolve(process.argv[2]),
    dependenciesDir = path.join(installDir, "lively.next-node_modules"),
    verbose = false;

// misses a system-install...

console.log("Installing lively.system packages into %s", installDir);
global.$__curScript = undefined;
import('systemjs').then(import('lively.installer/install.js').then(installer => {
  installer.install(installDir, dependenciesDir, verbose)
}));
