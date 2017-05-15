import { exec } from "./shell-exec.js";
import { join, getPackageSpec, readPackageSpec } from "./helpers.js";
import { Package } from "./package.js";
import { buildPackageMap, installDependenciesOfPackage, buildPackage } from "flatn";

var resource = lively.resources.resource,
    packageSpecFile = getPackageSpec();

// var baseDir = "/home/lively/lively-web.org/lively.next/";
// var baseDir = "/Users/robert/Lively/lively-dev3/";
// var dependenciesDir = "/Users/robert/Lively/lively-dev3/lively.next-node_modules";

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
    // console.log(`=> setting up initial lively world`);
    // await saveConflictingInitialFiles(baseDir, async () => {
    //   var baseDirForExec = baseDir.replace(/^file:\/\//, ""),
    //       {code, output} = await exec(`cp ${baseDirForExec}/lively.morphic/examples/initial/* ${baseDirForExec}`);
    //   if (code) console.error("workspace setup failed", output);
    //   var {code, output} = await exec(`cp ${baseDirForExec}/lively.morphic/assets/favicon.ico ${baseDirForExec}`);
    //   if (code) console.error("asset setup failed", output);
    // });

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


async function saveConflictingInitialFiles(baseDir, whileFn) {
  // stores conflicting files of the base directory into a backup dir

  var initialLivelyFilesDir = join(baseDir, `/lively.morphic/examples/initial/`),
      existingFiles = (await resource(baseDir).dirList(1))
        .filter(ea => !ea.isDirectory())
        .map(ea => ea.name()),
      conflictingFiles = [];

  for (let fn of existingFiles) {
    var existing = resource(baseDir).join(fn),
        initial = resource(initialLivelyFilesDir).join(fn);
    if (!await initial.exists()) continue;
    if (await initial.read() !== await existing.read()) conflictingFiles.push(fn)
  }

  if (!conflictingFiles.length) {
    await whileFn();
    return [];
  }

  var timestamp = new Date().toJSON().replace(/[\.\:]/g, "_"),
      backupDir = resource(baseDir).join(`${timestamp}_install-backup/`);

  await backupDir.ensureExistance();
  for (let fn of conflictingFiles)
    resource(baseDir).join(fn).copyTo(resource(backupDir.join(fn)));

  try {
    await whileFn();
  } finally {
    console.log(`[lively.installer] There are conflicting files in the base directory:`)
    for (let fn of conflictingFiles) {
      var local = resource(baseDir).join(fn);
      console.log(local.url);
    }
    console.log(`[lively.installer] These files were updated and your version of of them was put into ${backupDir.url}.`);
  }
}
