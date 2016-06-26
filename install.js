import { exec } from "lively.installer/shell-exec.js";
import { join, read, write, ensureDir } from "lively.installer/helpers.js";
import { Package } from "lively.installer/package.js";
import { copyLivelyWorld, copyPartsBinItem, downloadPartItem, downloadPartsBin } from "lively.installer/partsbin-helper.js";


var packageSpecFile = System.decanonicalize("lively.installer/packages-config.json");

async function readPackageSpec() {
  return JSON.parse(System.get("@system-env").browser ?
    await (await fetch(packageSpecFile)).text() :
    await read(packageSpecFile));
}

export async function install(baseDir) {

  try {
    var log = [];

    var hasUI = typeof $world !== "undefined";

    if (hasUI) {
      $world.openSystemConsole()
      await lively.lang.promise.delay(300)
      $world.get("LogMessages").targetMorph.clear();
      var indicator = hasUI && await lively.ide.withLoadingIndicatorDo("lively install");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // reading package spec + init base dir
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log("=> Initializing ensuring existance of " + baseDir);
    await ensureDir(baseDir);
    console.log("=> Reading package specs from " + packageSpecFile);
    var knownProjects = await readPackageSpec(),
        packages = await Promise.all(knownProjects.map(spec =>
          new Package(join(baseDir, spec.name), spec, log).readConfig()))

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // creating packages
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var pBar = hasUI && $world.addProgressBar(), i;

    console.log(`=> Installing and updating ${packages.length} packages`);
    i = 0; for (let p of packages) {
      var exists = await p.exists();
      if (!exists) {
        pBar && pBar.setLabel(`git clone – ${p.directory}`)
        await p.ensure();
      } else {
        pBar && pBar.setLabel(`git pull – ${p.directory}`)
        await p.update();
      }
      pBar && pBar.setValue(++i / packages.length)
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // linking modules among themselves
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log(`=> Linking packages`);
    await Promise.all(packages.map(ea => ea.readConfig()));
    for (let p of packages) {
      var deps = await p.findDependenciesIn(packages);
      for (let dep of deps) {
        await dep.symlinkTo("node_modules", p)
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // npm install
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log(`=> npm install`);

    i = 0; for (let p of packages) {
      console.log(`npm install of ${p.name}...`);
      pBar && pBar.setLabel(`npm install ${p.name}`)
      await p.npmInstall()
      pBar && pBar.setValue(++i / packages.length)
    }

    pBar && pBar.remove();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Installing tools into old Lively
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var livelyDir = join(baseDir, "LivelyKernel")

    console.log("=> Downloading PartsBin...\n")
    var {output} = await downloadPartsBin(livelyDir, {log: log});

    console.log("=> Downloading lively.system part items...\n")
    var {output} = await copyPartsBinItem("https://dev.lively-web.org/", "PartsBin/lively.modules", "lively.modules-browser-preferences", livelyDir, {log: log});
    var {output} = await copyPartsBinItem("https://dev.lively-web.org/", "PartsBin/lively.modules", "lively.vm-editor", livelyDir, {log: log});
    var {output} = await copyPartsBinItem("https://dev.lively-web.org/", "PartsBin/lively.modules", "mocha-test-runner", livelyDir, {log: log});

    console.log("=> Downloading lively.system worlds...\n")
    var {output} = await copyLivelyWorld("https://dev.lively-web.org/", "development.html", livelyDir, {log: log});

    indicator && indicator.remove();

    if (hasUI) $world.inform("Packages successfully updated!\n" + packages.map(ea => ea.name).join("\n"));
    else console.log(`=> Done!\npackages installed and / or updated! You can start a lively server by running 'npm start' inside ${livelyDir}. Afterwards your lively.system development world is running at http://localhost:9001/development.html`)
  } catch (e) {
    console.error("Error occurred during installation: " + e);
    throw e
  } finally {
    write(join(baseDir, "lively.installer.log"), log.join(""));
  }
}
