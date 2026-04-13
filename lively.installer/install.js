/*global process,System,global*/
import { buildPackageMap, installDependenciesOfPackage, buildPackage, resetPackageMap } from "flatn";
import { exec } from "./shell-exec.js";
import { Package } from "./package.js";
import { resource } from 'lively.resources';
import { promise, string } from 'lively.lang';

var modules, join, getPackageSpec, readPackageSpec;

// ── Logging helpers ──
const log = {
  step:    (msg) => console.log(`   ${msg}`),
  warn:    (msg) => console.log(`   [!] ${msg}`),
  error:   (msg) => console.error(`   [ERROR] ${msg}`),
  indent:  (msg) => console.log(`       ${msg}`),
};

function elapsed (t0) { return ((Date.now() - t0) / 1000).toFixed(1) + 's'; }

const spinner = {
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  idx: 0, timer: null, text: '', baseText: '', active: false,
  _origLog: console.log, _origWarn: console.warn, _origError: console.error,
  _clearLine () {
    if (!process.stdout.isTTY) return;
    if (typeof process.stdout.clearLine === 'function' && typeof process.stdout.cursorTo === 'function') {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      return;
    }
    process.stdout.write('\r\x1b[K');
  },
  start (text) {
    if (this.text === text && this.active) return;
    if (this.active) this._completeLine();
    this.text = text; this.baseText = text; this.idx = 0; this.active = true;
    this._hookConsole();
    if (!process.stdout.isTTY) { this._origLog.call(console, `   ${text}`); return; }
    this.render();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.render(), 80);
  },
  update (text) {
    // Update spinner text without completing the previous line
    this.text = text;
    if (this.active && process.stdout.isTTY) this.render();
  },
  render () {
    const frame = this.frames[this.idx++ % this.frames.length];
    this._clearLine();
    process.stdout.write(`   ${frame} ${this.text}`);
  },
  _completeLine () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (process.stdout.isTTY && this.baseText) {
      this._clearLine();
      process.stdout.write(`   \x1b[32m✓\x1b[0m ${this.baseText}\n`);
    }
  },
  _hookConsole () {
    if (console.log === this._wrappedLog) return;
    const self = this;
    this._wrappedLog = function (...args) {
      if (self.active && process.stdout.isTTY) self._clearLine();
      self._origLog.apply(console, args);
      if (self.active && process.stdout.isTTY) self.render();
    };
    this._wrappedWarn = function (...args) {
      if (self.active && process.stdout.isTTY) self._clearLine();
      self._origWarn.apply(console, args);
      if (self.active && process.stdout.isTTY) self.render();
    };
    this._wrappedError = function (...args) {
      if (self.active && process.stdout.isTTY) self._clearLine();
      self._origError.apply(console, args);
      if (self.active && process.stdout.isTTY) self.render();
    };
    console.log = this._wrappedLog;
    console.warn = this._wrappedWarn;
    console.error = this._wrappedError;
  },
  _unhookConsole () {
    console.log = this._origLog;
    console.warn = this._origWarn;
    console.error = this._origError;
  },
  stop () {
    this._completeLine();
    this._unhookConsole();
    this.text = ''; this.baseText = ''; this.active = false;
  }
};

export async function install(baseDir, dependenciesDir, verbose) {
  ({ join, getPackageSpec, readPackageSpec } = await import("./helpers.cjs"));
  var packageSpecFile = getPackageSpec(),
    timestamp = new Date().toJSON().replace(/[\.\:]/g, "_");
  var installLog = [],
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
      step8_runPackageBuildScripts = false,
      step9_createImportMap = true;

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
      if (baseDir.startsWith("/")) baseDir = "file://" + baseDir;
      if (dependenciesDir.startsWith("/")) dependenciesDir = "file://" + dependenciesDir;
      await resource(baseDir).asDirectory().ensureExistance();
      await resource(dependenciesDir).asDirectory().ensureExistance();
      await resource(baseDir).join("custom-npm-modules/").ensureExistance();
    }

    var knownProjects = await readPackageSpec(packageSpecFile),
        packages = await Promise.all(knownProjects.map(spec =>
          new Package(join(baseDir, spec.name), spec, installLog).readConfig()));


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // creating packages
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var pBar = false && hasUI && $world.addProgressBar(), i;

    if (step2_cloneLivelyPackages) {
      i = 0; for (let p of packages) {
        if (pBar) pBar.setLabel(`updating ${p.name}`);
        await p.installOrUpdate();
        pBar && pBar.setValue(++i / packages.length);
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // flatn setup
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var packageMap = await buildPackageMap([dependenciesDir], [], packages.map(ea => ea.directory));
    var flatnBinDir = join(packageMap.lookup("flatn").location, "bin");
    if (step3_setupFlatn) {
      let env = process.env;
      if (!env.PATH.includes(flatnBinDir)) {
        env.PATH = flatnBinDir + ":" + env.PATH;
      }
      if (env.FLATN_DEV_PACKAGE_DIRS !== packageMap.devPackageDirs.join(":")) {
        env.FLATN_DEV_PACKAGE_DIRS = packageMap.devPackageDirs.join(":");
      }
      if (env.FLATN_PACKAGE_COLLECTION_DIRS !== packageMap.packageCollectionDirs.join(":")) {
        env.FLATN_PACKAGE_COLLECTION_DIRS = packageMap.packageCollectionDirs.join(":");
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // installing dependencies
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step4_installPackageDeps) {
      // Hook flatn progress into our spinner — shows download/build sub-steps
      globalThis.__flatnProgress = (msg) => {
        if (spinner.active) spinner.update(`${spinner.baseText} › ${msg}`);
      };

      let usedBun = false;
      try {
        const { detectBun, bunInstall } = await import("../flatn/bun-install.js");
        const bunPath = detectBun();
        if (bunPath) {
          log.step(`Downloading packages via bun...`);
          const livelyDirs = packages.map(p => p.directory);
          const depsDirPath = dependenciesDir.replace(/^file:\/\//, "");
          const baseDirPath = baseDir.replace(/^file:\/\//, "");
          const tBun = Date.now();
          const { newPackages: bunPkgs } = await bunInstall(bunPath, livelyDirs, depsDirPath, baseDirPath, verbose);
          packageMap = buildPackageMap([dependenciesDir], [], packages.map(ea => ea.directory));
          log.step(`${bunPkgs.length} packages installed via bun (${elapsed(tBun)})`);
          spinner.start(`Resolving version gaps...`);
          const tGap = Date.now();
          for (let p of packages) {
            await installDependenciesOfPackage(
              p.directory, dependenciesDir, packageMap, ["dependencies"], verbose);
          }
          spinner.stop();
          const gapCount = packageMap.allPackages().length - bunPkgs.length;
          if (gapCount > 0) log.step(`${gapCount} additional packages via flatn (${elapsed(tGap)})`);
          else log.step(`No version gaps (${elapsed(tGap)})`);
          usedBun = true;
        } else {
          log.step(`bun not available, using flatn sequential install`);
        }
      } catch (err) {
        log.warn(`bun install failed: ${err.message}`);
        log.step(`Falling back to flatn sequential install...`);
      }

      if (!usedBun) {
        for (let p of packages) {
          spinner.start(`Installing deps: ${p.name}`);
          await installDependenciesOfPackage(
            p.directory, dependenciesDir, packageMap, ["dependencies"], verbose);
        }
        spinner.stop();
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // build scripts
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step5_runPackageInstallScripts) {
      const tBuild = Date.now();
      // upon first install this is not yet inside the lookup
      const nodeGyp = packageMap.lookup('node-gyp');
      const tmpGyp = join(flatnBinDir, 'node-gyp');
      const tmpGypBuild = join(flatnBinDir, 'node-gyp-build');
      await exec('ln -s ' + string.joinPath(nodeGyp.location, nodeGyp.bin['node-gyp']) + ` ${tmpGyp}`)
      const nodeGypBuild = packageMap.lookup('node-gyp-build');
      await exec('ln -s ' + string.joinPath(nodeGypBuild.location, nodeGypBuild.bin['node-gyp-build']) + ` ${tmpGypBuild}`);
      pBar && pBar.setValue(0)
      i = 0; for (let p of packages) {
        pBar && pBar.setLabel(`npm setup ${p.name}`);
        spinner.start(`Building ${p.name}...`);
        await buildPackage(p.directory, packageMap, ["dependencies"]);
        pBar && pBar.setValue(++i / packages.length)
      }
      spinner.stop();
      log.step(`${packages.length} packages built (${elapsed(tBuild)})`);
      await exec(`rm ${tmpGyp}`);
      await exec(`rm ${tmpGypBuild}`);
    }

    if (step8_runPackageBuildScripts) {
      let env = process.env, status;
      pBar && pBar.setValue(0)
      const nodeGyp = packageMap.lookup('node-gyp');
      await exec('ln -s ' + string.joinPath(nodeGyp.location, nodeGyp.bin['node-gyp']) + ' node-gyp')
      const nodeGypBuild = packageMap.lookup('node-gyp-build');
      await exec('ln -s ' + string.joinPath(nodeGypBuild.location, nodeGypBuild.bin['node-gyp-build']) + ' node-gyp-build')
      i = 0; for (let p of packages) {
        if (p.config.scripts && p.config.scripts.build) {
          pBar && pBar.setLabel(`npm build ${p.name}`);
          await installDependenciesOfPackage(
            p.directory, dependenciesDir, packageMap, ["devDependencies"], verbose);
          log.step(`Compiling ${p.name}...`);
          status = await exec('npm run build', {cwd: p.directory});
          if (status.code) console.log(status.output);
        }
        pBar && pBar.setValue(++i / packages.length)
      }
      await exec('rm node-gyp');
      await exec('rm node-gyp-build');
    }

    // by this time, all of the dependencies have been installed, and we can import them now
    const tInit = Date.now();
    spinner.start('Initializing module system...');
    ({ default: global.System } = await import('systemjs'));

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // System + ObjectDB init
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    spinner.start('Building package registry...');
    const System = await setupSystem(baseDir);

    if (step6_setupObjectDB) {
      spinner.start('Setting up ObjectDB...');
      await setupObjectDB(baseDir, packageMap);
    }
    spinner.stop();
    log.step(`System initialized (${elapsed(tInit)})`);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // ObjectDB sync
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step6_syncWithObjectDB) {
      await replicateObjectDB(baseDir);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // initial world files
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step7_setupAssets) {
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
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // import maps
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (step9_createImportMap) {
      const tMaps = Date.now();
      const { Generator } = await import('@jspm/generator');
      System.set('@jspm_generator', System.newModule({ default: Generator }));
      const { generateImportMap } = await System.import('lively.server/plugins/lib-lookup.js');
      for (let p of packages) {
        spinner.start(`Import map: ${p.name}`);
        await generateImportMap(p.name);
      }
      spinner.stop();
      log.step(`${packages.length} import maps generated (${elapsed(tMaps)})`);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    pBar && pBar.remove();
    indicator && indicator.remove();

    var livelyServerDir = baseDir
    if (hasUI) {
      $world.inform("Packages successfully updated!\n" + packages.map(ea => ea.name).join("\n"));
    }

  } catch (e) {
    errored = true;
    console.error("\n   [ERROR] Installation failed: " + e.stack);
    installLog.push(e.stack || e);
    throw e;

  } finally {
    resource(join(baseDir, "lively.installer.log")).write(installLog.join(""));
    pBar && pBar.remove();
    indicator && indicator.remove();

    process.exit(errored ? 1 : 0);
  }
}


async function safelyRemove(baseDir, file) {
  if (!await file.exists()) return;

  let backupDir = baseDir.join(`${timestamp}_install-backup/`);
  await backupDir.ensureExistance();

  let backupFile = backupDir.join(file.relativePathFrom(baseDir));
  await backupFile.parent().ensureExistance();
  await file.rename(backupFile);
}

export async function setupSystem(baseURL) {
  ({ default: global.babel } = await import("@babel/core"));
  modules = await import("lively.modules");
  let livelySystem = modules.getSystem("lively", {baseURL, _nodeRequire: System._nodeRequire });
  modules.changeSystem(livelySystem, true);
  var registry = livelySystem["__lively.modules__packageRegistry"] = new modules.PackageRegistry(livelySystem);
  registry.packageBaseDirs = process.env.FLATN_PACKAGE_COLLECTION_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.devPackageDirs = process.env.FLATN_DEV_PACKAGE_DIRS.split(":").map(ea => resource(`file://${ea}`));
  registry.individualPackageDirs = process.env.FLATN_PACKAGE_DIRS.split(":").map(ea => ea.length > 0 ? resource(`file://${ea}`) : false).filter(Boolean);
  await registry.update();
  resetPackageMap();

  const { setupBabelTranspiler } = await import('lively.source-transform/babel/plugin.js');
  await setupBabelTranspiler(livelySystem);

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
  log.step(`Syncing ObjectDB from ${resource(config.remoteCommitDB).host()}...`);

  console.time("   replication");

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
    console.timeEnd("   replication");
  }
}
