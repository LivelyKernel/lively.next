import { exec } from "./shell-exec.js";
import { join, getPackageSpec, readPackageSpec } from "./helpers.js";
import { Package } from "./package.js";

var packageSpecFile = getPackageSpec();
export async function install(baseDir, toURL) {

  try {
    var log = [];

    var hasUI = typeof $$world !== "undefined";

    // FIXME
    if (false && hasUI) {
      $$world.openSystemConsole();
      await lively.lang.promise.delay(300)
      $$world.get("LogMessages").targetMorph.clear();
      var indicator = hasUI && await lively.ide.withLoadingIndicatorDo("lively install");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // reading package spec + init base dir
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log("=> Initializing ensuring existance of " + baseDir);

    if (baseDir.startsWith("/")) baseDir = "file://" + baseDir;
    await lively.resources.resource(baseDir).asDirectory().ensureExistance();
    console.log("=> Reading package specs from " + packageSpecFile);
    var knownProjects = await readPackageSpec(packageSpecFile),
        packages = await Promise.all(knownProjects.map(spec =>
          new Package(join(baseDir, spec.name), spec, log).readConfig()))

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // creating packages
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var pBar = false && hasUI && $$world.addProgressBar(), i;

    console.log(`=> Installing and updating ${packages.length} packages`);
    i = 0; for (let p of packages) {
      if (pBar) pBar.setLabel(`updating ${p.name}`);
      else console.log(`${p.name}`);
      await p.installOrUpdate(packages);
      pBar && pBar.setValue(++i / packages.length);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // npm install
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log(`=> npm install`);

    pBar && pBar.setValue(0)
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

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // initial world files
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log(`=> setting up initial lively world`);
    var baseDirForExec = baseDir.replace(/^file:\/\//, ""),
        {code, output} = await exec(`cp ${baseDirForExec}/lively.morphic/examples/initial/* ${baseDirForExec}`);
    if (code) console.error("workspace setup failed", output);
    var {code, output} = await exec(`cp ${baseDirForExec}/lively.morphic/assets/favicon.ico ${baseDirForExec}`);
    if (code) console.error("asset setup failed", output);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    pBar && pBar.remove();
    indicator && indicator.remove();

    var livelyServerDir = join(baseDir, "lively.installer/")
    if (hasUI) $$world.inform("Packages successfully updated!\n" + packages.map(ea => ea.name).join("\n"));
    else console.log(`=> Done!\npackages installed and / or updated! You can start a lively server by running './start.sh' inside ${livelyServerDir}.\nAfterwards your first lively.next world is ready to run at http://localhost:9011/index.html`);
  } catch (e) {
    console.error("Error occurred during installation: " + e.stack);
    log.push(e.stack || e);
    throw e;

  } finally {
    lively.resources.resource(join(baseDir, "lively.installer.log")).write(log.join(""));
    pBar && pBar.remove();
    indicator && indicator.remove();
  }
}
