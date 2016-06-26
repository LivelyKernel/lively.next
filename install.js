import { exec } from "lively.installer/shell-exec.js";
import { join, read, ensureDir } from "lively.installer/helpers.js";
import { Package } from "lively.installer/package.js";
import { copyLivelyWorld, copyPartsBinItem, downloadPartItem, downloadPartsBin } from "lively.installer/partsbin-helper.js";


var _show = typeof show !== "undefined" ? show : function() { console.log.apply(console, arguments) };
var logger = {push: msg => msg.match(/^\s*\$/) ? undefined : _show(msg)};
var silentLogger = {push: function(msg) {}}

var packageSpecFile = System.decanonicalize("lively.installer/packages-config.json");

async function readPackageSpec() {
  return JSON.parse(System.get("@system-env").browser ?
    await (await fetch(packageSpecFile)).text() :
    await read(packageSpecFile));
}

var hasUI = typeof $world !== "undefined";

export async function install(baseDir) {

  try {

    var indicator = hasUI && await lively.ide.withLoadingIndicatorDo("lively install");

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // reading package spec + init base dir
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    logger.push("Initializing ensuring existance of " + baseDir);
    await ensureDir(baseDir);
    logger.push("Reading package specs from " + packageSpecFile);
    var knownProjects = await readPackageSpec(),
        packages = await Promise.all(knownProjects.map(spec =>
          new Package(join(baseDir, spec.name), spec).readConfig()))

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // creating packages
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var pBar = hasUI && $world.addProgressBar(), i;

    logger.push(`Installing and updating ${packages.length} packages`);
    i = 0; for (let p of packages) {
      var exists = await p.exists();
      if (!exists) {
        pBar && pBar.setLabel(`git clone – ${p.directory}`)
        await p.ensure(logger);
      } else {
        pBar && pBar.setLabel(`git pull – ${p.directory}`)
        await p.update(logger);
      }
      pBar && pBar.setValue(++i / packages.length)
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // npm install
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    logger.push(`Running npm install`);

    i = 0; for (let p of packages) {
      logger.push(`npm install of ${p.name}...`);
      pBar && pBar.setLabel(`npm install ${p.name}`)
      await p.npmInstall(logger)
      pBar && pBar.setValue(++i / packages.length)
    }

    pBar && pBar.remove();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Installing tools into old Lively
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var livelyDir = join(baseDir, "LivelyKernel")

    logger.push("Downloading PartsBin...\n")
    var {output} = await downloadPartsBin(livelyDir, logger);

    logger.push("Downloading lively.system part items...\n")
    var {output} = await copyPartsBinItem("https://dev.lively-web.org/", "PartsBin/lively.modules", "lively.modules-browser-preferences", livelyDir, logger);
    var {output} = await copyPartsBinItem("https://dev.lively-web.org/", "PartsBin/lively.modules", "lively.vm-editor", livelyDir, logger);
    var {output} = await copyPartsBinItem("https://dev.lively-web.org/", "PartsBin/lively.modules", "mocha-test-runner", livelyDir, logger);

    logger.push("Downloading lively.system worlds...\n")
    var {output} = await copyLivelyWorld("https://dev.lively-web.org/", "development.html", livelyDir, logger);

    indicator && indicator.remove();

    if (hasUI) $world.inform("lively.system successfully installed!");
    else console.log(`lively.system installed! You can start a lively server by running 'npm start' inside ${livelyDir}. Afterwards your lively.system development world is running at http://localhost:9001/development.html`)
  } catch (e) {
    console.error("Error occurred during installation: " + e);
    throw e
  }
}
