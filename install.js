import { exec } from "./shell-exec.js";
import { join, getPackageSpec, readPackageSpec } from "./helpers.js";
import { Package } from "./package.js";
import { buildPackageMap, installDependenciesOfPackage, buildPackage } from "flatn";

var resource = lively.resources.resource,
    packageSpecFile = getPackageSpec(),
    timestamp = new Date().toJSON().replace(/[\.\:]/g, "_");

// var baseDir = "/home/lively/lively-web.org/lively.next/";
// var baseDir = "/Users/robert/Lively/lively-dev4/";
// var dependenciesDir = "/Users/robert/Lively/lively-dev4/lively.next-node_modules";

export async function install(baseDir, dependenciesDir, verbose) {

  try {
    var log = [];

    var hasUI = typeof $world !== "undefined";

    // FIXME
    if (false && hasUI) {
      $world.openSystemConsole();
      await lively.lang.promise.delay(300)
      $world.get("LogMessages").targetMorph.clear();
      var indicator = hasUI && await lively.ide.withLoadingIndicatorDo("lively install");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // reading package spec + init base dir
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log("=> Ensuring existance of " + baseDir);
    if (baseDir.startsWith("/")) baseDir = "file://" + baseDir;
    if (dependenciesDir.startsWith("/")) dependenciesDir = "file://" + dependenciesDir;
    await resource(baseDir).asDirectory().ensureExistance();
    await resource(dependenciesDir).asDirectory().ensureExistance();

    console.log("=> Reading package specs from " + packageSpecFile);
    var knownProjects = await readPackageSpec(packageSpecFile),
        packages = await Promise.all(knownProjects.map(spec =>
          new Package(join(baseDir, spec.name), spec, log).readConfig())),
        packageMap = await buildPackageMap([dependenciesDir], [], packages.map(ea => ea.directory));

    console.log("=> Preparing flatn environment");
    let flatnBinDir = join(packageMap.lookup("flatn").location, "bin"),
        env = process.env;
    if (!env.PATH.includes(flatnBinDir)) {
      console.log(`Adding ${flatnBinDir} to PATH`);
      env.PATH = flatnBinDir + ":" + env.PATH;
    }
    if (env.FLATN_DEV_PACKAGE_DIRS !== packageMap.devPackageDirs.join(":")) {
      console.log("Setting FLATN_DEV_PACKAGE_DIRS");
      env.FLATN_DEV_PACKAGE_DIRS = packageMap.devPackageDirs.join(":");
    }
    if (env.FLATN_PACKAGE_COLLECTION_DIRS !== packageMap.packageCollectionDirs.join(":")) {
      console.log("Setting FLATN_PACKAGE_COLLECTION_DIRS");
      env.FLATN_PACKAGE_COLLECTION_DIRS = packageMap.packageCollectionDirs.join(":");
    }


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // creating packages
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var pBar = false && hasUI && $world.addProgressBar(), i;

    console.log(`=> Installing and updating ${packages.length} packages`);
    i = 0; for (let p of packages) {
      if (pBar) pBar.setLabel(`updating ${p.name}`);
      else console.log(`${p.name}`);
      await p.installOrUpdate();
      pBar && pBar.setValue(++i / packages.length);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // installing dependencies
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log(`=> installing dependencies`);
    for (let p of packages) {
      console.log(`installing dependencies of ${p.name}`);
      await installDependenciesOfPackage(
        p.directory, dependenciesDir, packageMap, ["dependencies"], verbose);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // build scripts
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log(`=> running install scripts of ${packageMap.allPackages().length} packages`);

    pBar && pBar.setValue(0)
    i = 0; for (let p of packages) {
      pBar && pBar.setLabel(`npm setup ${p.name}`);
      console.log(`build ${p.name} and its dependencies`);
      await buildPackage(p.directory, packageMap, ["dependencies"]);
      pBar && pBar.setValue(++i / packages.length)
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // initial world files
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    console.log(`=> setting up scripts and assets`);
    let toRemove = [
      "rebuild.sh",
      "backup.sh",
      "package.json",
      "index.js",
      "index.html",
      "mirror.js",
      "mirror.html",
      "fix-links.js"]
    for (let fn of toRemove)
      await safelyRemove(resource(baseDir), resource(baseDir).join(fn));

    await resource(baseDir).join("lively.installer/assets/start.sh").copyTo(resource(baseDir).join("start.sh"));
    await resource(baseDir).join("lively.installer/assets/update.sh").copyTo(resource(baseDir).join("update.sh"));
    await resource(baseDir).join("lively.morphic/assets/favicon.ico").copyTo(resource(baseDir).join("favicon.ico"));

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    pBar && pBar.remove();
    indicator && indicator.remove();

    var livelyServerDir = baseDir
    if (hasUI) $world.inform("Packages successfully updated!\n" + packages.map(ea => ea.name).join("\n"));
    else console.log(`=> Done!\npackages installed and / or updated! `
                   + `You can start a lively server by running './start.sh' inside ${livelyServerDir}.\n`
                   + `Afterwards your first lively.next world is ready to run at http://localhost:9011/index.html`);

  } catch (e) {
    console.error("Error occurred during installation: " + e.stack);
    log.push(e.stack || e);
    throw e;

  } finally {
    resource(join(baseDir, "lively.installer.log")).write(log.join(""));
    pBar && pBar.remove();
    indicator && indicator.remove();
  }
}


async function safelyRemove(baseDir, file) {
  // stores conflicting files of the base directory into a backup dir

  if (!await file.exists()) return;

  let backupDir = baseDir.join(`${timestamp}_install-backup/`);
  await backupDir.ensureExistance();

  let backupFile = backupDir.join(file.relativePathFrom(baseDir));
  await backupFile.parent().ensureExistance();
  await file.rename(backupFile);

  console.log(`>>> Moving old file ${file.url} to ${backupDir.url} <<<`);
}
