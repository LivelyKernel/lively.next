/*global process,System,global*/
import { exec } from "./shell-exec.js";
import { join, getPackageSpec, readPackageSpec } from "./helpers.js";
import { Package } from "./package.js";
import { buildPackageMap, installDependenciesOfPackage, buildPackage, resetPackageMap } from "flatn";
import { resource } from 'lively.resources';
import { promise } from 'lively.lang';
import * as babel from  "@babel/core";
import * as modules from "lively.modules";

// hack
global.babel = babel;

var packageSpecFile = getPackageSpec(),
    timestamp = new Date().toJSON().replace(/[\.\:]/g, "_");

// var baseDir = "/home/lively/lively-web.org/lively.next/";
// var baseDir = "/Users/robert/Lively/lively-dev4/";
// var dependenciesDir = "/Users/robert/Lively/lively-dev4/lively.next-node_modules";

export async function install(baseDir, dependenciesDir, verbose) {

  var log = [],
      hasUI = typeof $world !== "undefined",
      errored = false;

  let step1_ensureDirectories = true,
      step2_cloneLivelyPackages = false,
      step3_setupFlatn = true,
      step4_installPackageDeps = true,
      step5_runPackageInstallScripts = true,
      step6_setupObjectDB = true,
      step6_syncWithObjectDB = false,
      step7_setupAssets = true,
      step8_runPackageBuildScripts = false;

  try {

    // FIXME
    if (false && hasUI) {
      $world.openSystemConsole();
      await promise.delay(300)
      $world.get("LogMessages").targetMorph.clear();
      var indicator = $world.showLoadingIndicatorFor($world, "lively install");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // reading package spec + init base dir
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step1_ensureDirectories) {
      console.log("=> Ensuring existance of " + baseDir);
      if (baseDir.startsWith("/")) baseDir = "file://" + baseDir;
      if (dependenciesDir.startsWith("/")) dependenciesDir = "file://" + dependenciesDir;
      await resource(baseDir).asDirectory().ensureExistance();
      await resource(dependenciesDir).asDirectory().ensureExistance();
      await resource(baseDir).join("custom-npm-modules/").ensureExistance();
    }

    console.log("=> Reading package specs from " + packageSpecFile);
    var knownProjects = await readPackageSpec(packageSpecFile),
        packages = await Promise.all(knownProjects.map(spec =>
          new Package(join(baseDir, spec.name), spec, log).readConfig()));


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // creating packages
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var pBar = false && hasUI && $world.addProgressBar(), i;

    if (step2_cloneLivelyPackages) {
      console.log(`=> Installing and updating ${packages.length} packages`);
      i = 0; for (let p of packages) {
        if (pBar) pBar.setLabel(`updating ${p.name}`);
        else console.log(`${p.name}`);
        await p.installOrUpdate();
        pBar && pBar.setValue(++i / packages.length);
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // flatn setup
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var packageMap = await buildPackageMap([dependenciesDir], [], packages.map(ea => ea.directory));
    if (step3_setupFlatn) {
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
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // installing dependencies
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step4_installPackageDeps) {
      console.log(`=> installing dependencies`);
      for (let p of packages) {
        console.log(`installing dependencies of ${p.name}`);
        await installDependenciesOfPackage(
          p.directory, dependenciesDir, packageMap, ["dependencies"], verbose);
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // build scripts
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step5_runPackageInstallScripts) {
      console.log(`=> running install scripts of ${packageMap.allPackages().length} packages`);
      // upon first install this is not yet inside the lookup
      const nodeGyp = packageMap.lookup('node-gyp');
      await exec('ln -s ' + join(nodeGyp.location, nodeGyp.bin['node-gyp']) + ' node-gyp')
      pBar && pBar.setValue(0)
      i = 0; for (let p of packages) {
        pBar && pBar.setLabel(`npm setup ${p.name}`);
        console.log(`build ${p.name} and its dependencies`);
        await buildPackage(p.directory, packageMap, ["dependencies"]);
        pBar && pBar.setValue(++i / packages.length)
      }
      await exec('rm node-gyp');
    }

    if (step8_runPackageBuildScripts) {
      let env = process.env, status;
      pBar && pBar.setValue(0)
      console.log(env.FLATN_DEV_PACKAGE_DIRS)
      console.log(env.FLATN_PACKAGE_COLLECTION_DIRS) 
      i = 0; for (let p of packages) {
        if (p.config.scripts && p.config.scripts.build) {
          pBar && pBar.setLabel(`npm build ${p.name}`);
          await installDependenciesOfPackage(
            p.directory, dependenciesDir, packageMap, ["devDependencies"], verbose);
          console.log(`compiling ${p.name}`);
          status = await exec('npm run build', {cwd: p.directory});
          //if (status.code) {
            console.log(status.output)
          //}
        }
        pBar && pBar.setValue(++i / packages.length)
      }
    }


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // ObjectDB init
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    if (step6_setupObjectDB) {
      await setupSystem(baseDir);
      await setupObjectDB(baseDir, packageMap);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // ObjectDB sync
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step6_syncWithObjectDB) {
      await setupSystem(baseDir);
      await replicateObjectDB(baseDir);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // initial world files
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step7_setupAssets) {
      console.log(`=> setting up scripts and assets`);

      // FIXME, this is old stuff...
      let toRemove = [
        "rebuild.sh",
        "backup.sh",
        "package.json",
        "index.js",
        "index.html",
        "mirror.js",
        "mirror.html",
        "fix-links.js"],
          toInstall = [
            {path: "lively.installer/assets/config.js", canBeLinked: false, overwrite: false},
            {path: "lively.installer/assets/localconfig.js", canBeLinked: false, overwrite: false},
            {path: "lively.morphic/assets/favicon.ico", canBeLinked: true, overwrite: true},
          ];

      for (let fn of toRemove)
        await safelyRemove(resource(baseDir), resource(baseDir).join(fn));

      for (let {path, overwrite, canBeLinked} of toInstall) {
        let from = resource(baseDir).join(path),
            to = resource(baseDir).join(from.name());
        if (await to.exists()) {
          if (!overwrite) continue;
          if (await to.read() !== await from.read())
            await safelyRemove(resource(baseDir), to);
        }
        if (!canBeLinked || process.platform === "win32") {
          await from.copyTo(to);
        } else {
          await exec(`ln -sf ${from.path()} ${to.path()}`);
        }
      }

      await exec("chmod a+x start.sh", {cwd: resource(baseDir).path()});
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    pBar && pBar.remove();
    indicator && indicator.remove();

    var livelyServerDir = baseDir
    if (hasUI) $world.inform("Packages successfully updated!\n" + packages.map(ea => ea.name).join("\n"));
    else console.log(`=> Done!\npackages installed and / or updated! `
                   + `You can start a lively server by running './start.sh' inside ${livelyServerDir}.\n`
                   + `Afterwards your first lively.next world is ready to run at http://localhost:9011/index.html`);

  } catch (e) {
    errored = true;
    console.error("Error occurred during installation: " + e.stack);
    log.push(e.stack || e);
    throw e;

  } finally {
    resource(join(baseDir, "lively.installer.log")).write(log.join(""));
    pBar && pBar.remove();
    indicator && indicator.remove();

    process.exit(errored ? 1 : 0);
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

export async function setupSystem(baseURL) {
  await import("lively.modules/systemjs-init.js");
  let livelySystem = modules.getSystem("lively", {baseURL, _nodeRequire: System._nodeRequire });
  modules.changeSystem(livelySystem, true);
  var registry = livelySystem["__lively.modules__packageRegistry"] = new modules.PackageRegistry(livelySystem);
  registry.packageBaseDirs = process.env.FLATN_PACKAGE_COLLECTION_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.devPackageDirs = process.env.FLATN_DEV_PACKAGE_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.individualPackageDirs = process.env.FLATN_PACKAGE_DIRS.split(":").map(ea => ea.length > 0 ? resource(`file://${ea}`) : false).filter(Boolean);
  await registry.update();
  // also reset the flatn package map, so that native requires wont fail
  resetPackageMap();
  return livelySystem;
}

async function setupObjectDB(baseDir, packageMap) {
  let { ensureFetch, resource } = await modules.importPackage(join(baseDir, "/lively.resources"));
  await ensureFetch();
  if (!global.navigator) global.navigator = {};

  let { ObjectDB, Database } = await modules.importPackage(join(baseDir, "/lively.storage/"));
  await resource(baseDir).join("lively.morphic/objectdb/morphicdb/snapshots/").ensureExistance();
  await resource(baseDir).join("lively.morphic/objectdb/morphicdb-commits/").ensureExistance();
  await resource(baseDir).join("lively.morphic/objectdb/morphicdb-version-graph/").ensureExistance();
}

async function replicateObjectDB(baseDir) {
  let config = await System.import(resource(baseDir).join("config.js").url);
  console.log(`=> synchronizing with object database from ${resource(config.remoteCommitDB).host()}...`);
  
  console.time("replication");

  let remoteCommitDB = Database.ensureDB(config.remoteCommitDB),
      remoteVersionDB = Database.ensureDB(config.remoteVersionDB),
      toSnapshotLocation = resource(config.remoteSnapshotLocation);

  try {
    
    let db = ObjectDB.named("lively.morphic/objectdb/morphicdb", {
      snapshotLocation: resource(System.decanonicalize(baseDir + "/lively.morphic/objectdb/morphicdb/snapshots/"))
    });
    
    let sync = db.replicateFrom(remoteCommitDB, remoteVersionDB, toSnapshotLocation, {debug: false, retry: true, live: true});

    await sync.whenPaused();
    await sync.safeStop();
    await sync.waitForIt();

    await db.close();
    await remoteVersionDB.close();
    await remoteCommitDB.close();

  } finally {
    console.timeEnd("replication");
  }
}
