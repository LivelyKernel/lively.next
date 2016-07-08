import { exec } from "./shell-exec.js";
import { join, read, write, ensureDir, getPackageSpec, readPackageSpec } from "./helpers.js";
import { Package } from "./package.js";
import { copyLivelyWorldIfMissing, copyPartsBinItemIfMissing, downloadPartItem, downloadPartsBin } from "./partsbin-helper.js";
import { createPartSpaceUpdate } from "./partsbin-update.js";

var packageSpecFile = getPackageSpec();

export async function install(baseDir, toURL) {

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
    var knownProjects = await readPackageSpec(packageSpecFile),
        packages = await Promise.all(knownProjects.map(spec =>
          new Package(join(baseDir, spec.name), spec, log).readConfig()))

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // creating packages
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var pBar = hasUI && $world.addProgressBar(), i;

    console.log(`=> Installing and updating ${packages.length} packages`);
    i = 0; for (let p of packages) {
      await p.installOrUpdate(packages);
      pBar && pBar.setValue(++i / packages.length)
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // npm install
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log(`=> npm install`);

    i = 0; for (let p of packages) {
      pBar && pBar.setLabel(`npm install ${p.name}`)
      if (await p.npmInstallNeeded()) {
        console.log(`npm install of ${p.name}...`);
        await p.npmInstall();
      } else {
        console.log(`npm install of ${p.name} not required`);
      }
      pBar && pBar.setValue(++i / packages.length)
    }

    pBar && pBar.remove();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Installing tools into old Lively
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    
    var livelyDir = join(baseDir, "LivelyKernel")
  
    console.log("=> Downloading PartsBin...")
    var {output} = await downloadPartsBin(livelyDir, {log: log});

    if (lively.PartsBin) {
      console.log("=> Installing and updating lively.modules part items...")
      if (!toURL) toURL = URL.root;
      var update = await createPartSpaceUpdate("PartsBin/lively.modules", "https://dev.lively-web.org/", toURL, baseDir, log);
      await update.runUpdates(livelyDir, log);
    } else {
      console.log("=> Installing any missing lively.modules part items...")
      var {output} = await copyPartsBinItemIfMissing("https://dev.lively-web.org/", "PartsBin/lively.modules", "lively.modules-browser-preferences", livelyDir, {log: log});
      console.log(output);
      var {output} = await copyPartsBinItemIfMissing("https://dev.lively-web.org/", "PartsBin/lively.modules", "lively.vm-editor", livelyDir, {log: log});
      console.log(output);
      var {output} = await copyPartsBinItemIfMissing("https://dev.lively-web.org/", "PartsBin/lively.modules", "mocha-test-runner", livelyDir, {log: log});
      console.log(output);
      var {output} = await copyPartsBinItemIfMissing("https://dev.lively-web.org/", "PartsBin/lively.modules", "ModuleEditor", livelyDir, {log: log});
      console.log(output);
    }


    console.log("=> Downloading lively.system worlds...")
    var {output} = await copyLivelyWorldIfMissing("https://dev.lively-web.org/", "development.html", livelyDir, {log: log});
    console.log(output);

    indicator && indicator.remove();

    if (hasUI) $world.inform("Packages successfully updated!\n" + packages.map(ea => ea.name).join("\n"));
    else console.log(`=> Done!\npackages installed and / or updated! You can start a lively server by running 'npm start' inside ${livelyDir}. Afterwards your lively.system development world is running at http://localhost:9001/development.html`)
  } catch (e) {
    console.error("Error occurred during installation: " + e);
    log.push(e.stack || e);
    throw e;
  } finally {
    write(join(baseDir, "lively.installer.log"), log.join(""));
    pBar && pBar.remove();
    indicator && indicator.remove();
  }
}
