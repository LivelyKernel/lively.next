#!/usr/bin/env node

/*
Example:

  ./tools/browserify-js-git.js \
    -m fs-db,create-tree,formats,read-combiner,pack-ops,walkers \
    -o dist/js-git-browser.js
*/



"use strict";
const fs = require("fs"),
      path = require("path"),
      browserify = require('browserify'),
      alias = {h: "help", l: "list-mixins", o: "outfile", m: "mixins"},
      argv = require('minimist')(process.argv.slice(2), {alias}),
      defaultMixins = [
        "mem-db",
        "create-tree",
        "formats",
        "read-combiner",
        "pack-ops",
        "walkers"
      ],
      defaultOutfile = "dist/js-git-browser.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

if (argv.help) {
  console.log(`js-git browserifier
options:
  -h  --help        print this text and exit
  -l  --list-mixins list available mixins and exit
  -o  --outfile     the browserified file to generate. If not specified ${defaultOutfile} is used.
  -m  --mixins      comma-seperated list of mixins like -m mem-cache,walkers.
                    If not specified the following list of default mixins is used:
                    ${defaultMixins.join(",")}
`);
  process.exit(0);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function mixinPath() {
  let jsGitDir;
  for (let nmDir of module.paths) {
    let p = path.join(nmDir, "js-git")
    if (fs.existsSync(p)) { jsGitDir = p; break; }
  }

  if (!jsGitDir) {
    console.error("Cannot find js-git! Did you run 'npm install'?")
    process.exit(1);
  }

  return path.join(jsGitDir, "mixins");
}

function findAvailableMixins() {
  return fs.readdirSync(mixinPath())
    .map(ea => ea.replace(".js", ""));
}

if (argv["list-mixins"]) {  
  console.log(`Available mixins are:
  ${findAvailableMixins().join("\n  ")}`)
  process.exit(0);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// if (argv.l || argv.list)
let mixins = argv.mixins ? argv.mixins.split(",") : defaultMixins,
    mixinsAvailable = findAvailableMixins(),
    source = String(fs.readFileSync(path.join(__dirname, "js-git-index.js.template"))),
    mixinRequires = "",
    mixinRepoCalls = "";

for (let m of mixins) {
  if (mixinsAvailable.indexOf(m) === -1) {
    console.error(`Mixin ${m} not available! Valid mixins are:\n${mixinsAvailable.join(", ")}`);
    process.exit(1);
  }

  let mixinIdentifier = m.replace(/-(.)/g, (_, char) => char.toUpperCase()),
      mixinAssign = `mixins.${mixinIdentifier} = require('js-git/mixins/${m}');`,
      repoCall = `mixins.${mixinIdentifier}(repo);`;
  mixinRequires += `\n${mixinAssign}`;
  mixinRepoCalls += `\n  ${repoCall}`;
}

source = source.replace("__INSERT_MIXINS_REQUIRES_HERE__", mixinRequires)
               .replace("__INSERT_MIXINS_REPO_CALLS_HERE__", mixinRepoCalls);

let browserifyEntry = ".js-git-index.browserify-input.js",
    outfile = argv.outfile || defaultOutfile;
fs.writeFileSync(browserifyEntry, source);

browserify(
  [browserifyEntry],
  {standalone: "jsgit"}
).bundle((err, buf) => {
  let rewritten = String(buf)
    .replace(/(repo.refPrefix = prefix;)/, "$1\n  repo.loadRaw = loadRaw;\n  repo.db = db;");
  fs.writeFileSync(outfile, rewritten);
  fs.unlinkSync(browserifyEntry);
  console.log(`js-git successfully bundled into ${outfile}.\nMixins used: ${mixins.join(", ")}`);
});

