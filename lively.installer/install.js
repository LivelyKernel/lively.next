/*global process,System,global*/
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exec } from "./shell-exec.js";
import { Package } from "./package.js";
import { resource } from 'lively.resources';
import { promise } from 'lively.lang';

const require = createRequire(import.meta.url);
const { discoverPackageRootPaths } = require('./helpers.cjs');
export { discoverPackageRootPaths };
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

export async function install(baseDir) {
  ({ join, getPackageSpec, readPackageSpec } = await import("./helpers.cjs"));
  var packageSpecFile = getPackageSpec(),
    timestamp = new Date().toJSON().replace(/[\.\:]/g, "_");
  var installLog = [],
      hasUI = typeof $world !== "undefined",
      errored = false;

  let step1_ensureDirectories = true,
      step6_setupObjectDB = true,
      step6_syncWithObjectDB = false,
      step7_setupAssets = true,
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
      await resource(baseDir).asDirectory().ensureExistance();
    }

    var knownProjects = await readPackageSpec(packageSpecFile),
        packages = await Promise.all(knownProjects.map(spec =>
          new Package(join(baseDir, spec.name), spec, installLog).readConfig()));


    var pBar = false && hasUI && $world.addProgressBar();

    // Bun has installed the workspace before this module is imported.
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
      await setupObjectDB(baseDir);
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
      const { generateImportMap } = await System.import('lively.server/plugins/lib-lookup.js');
      for (let p of packages) {
        spinner.start(`Import map: ${p.name}`);
        await generateImportMap(p.name);
      }
      spinner.stop();
      log.step(`${packages.length} import maps generated (${elapsed(tMaps)})`);
      const cache = await exec('node scripts/cache-browser-dependencies.mjs', { cwd: resource(baseDir).path() });
      if (cache.code) throw new Error(cache.output);
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

function serverStartupLog (msg) {
  if (process.env.LIVELY_DESKTOP_APP) console.log(`[lively.server startup] ${msg}`);
}

function readRegistryPayload (file) {
  try {
    const cached = JSON.parse(require('fs').readFileSync(file, 'utf8'));
    return cached.registry || cached;
  } catch (_) {}
  return null;
}

export function hasMutableRuntimePackages (registeredRoots = []) {
  return registeredRoots.some(dir => dir.replace(/\\/g, '/').includes('/local_projects/'));
}

function isCurrentRegistry (registry) { return registry?.schema === 2; }

function readPackageRegistrySeed (registeredRoots) {
  const seedFile = process.env.LIVELY_PACKAGE_REGISTRY_SEED_FILE;
  if (!seedFile) return null;
  if (hasMutableRuntimePackages(registeredRoots)) {
    serverStartupLog('skipped package registry seed because mutable package dirs exist');
    return null;
  }
  const registry = readRegistryPayload(seedFile);
  if (isCurrentRegistry(registry)) return { registry, source: 'seed' };
  return null;
}

function readPackageRegistryCache (registeredRoots) {
  if (process.env.LIVELY_DISABLE_PACKAGE_REGISTRY_CACHE === '1') return null;
  const cacheFile = process.env.LIVELY_PACKAGE_REGISTRY_CACHE_FILE;
  const cacheKey = process.env.LIVELY_PACKAGE_REGISTRY_CACHE_KEY;
  if (cacheFile && cacheKey) {
    try {
      const cached = JSON.parse(require('fs').readFileSync(cacheFile, 'utf8'));
      if (cached.key === cacheKey && isCurrentRegistry(cached.registry)) {
        return { registry: cached.registry, source: 'runtime cache' };
      }
    } catch (_) {}
  }
  return readPackageRegistrySeed(registeredRoots);
}

function writePackageRegistryCache (registry) {
  if (process.env.LIVELY_DISABLE_PACKAGE_REGISTRY_CACHE === '1') return;
  const cacheFile = process.env.LIVELY_PACKAGE_REGISTRY_CACHE_FILE;
  const cacheKey = process.env.LIVELY_PACKAGE_REGISTRY_CACHE_KEY;
  if (!cacheFile || !cacheKey) return;
  try {
    const fs = require('fs');
    fs.mkdirSync(dirname(cacheFile), { recursive: true });
    const tmpFile = `${cacheFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify({
      key: cacheKey,
      writtenAt: new Date().toISOString(),
      registry: registry.toJSON()
    }));
    fs.renameSync(tmpFile, cacheFile);
    serverStartupLog('wrote package registry cache');
  } catch (err) {
    serverStartupLog(`failed writing package registry cache: ${err.message || err}`);
  }
}

export async function setupSystem(baseURL) {
  if (!/^[a-z][a-z0-9+.-]*:/i.test(baseURL)) baseURL = pathToFileURL(baseURL).href;
  if (!baseURL.endsWith('/')) baseURL += '/';
  ({ default: global.babel } = await import("@babel/core"));
  modules = await import("lively.modules");
  let livelySystem = modules.getSystem("lively", {baseURL, _nodeRequire: System._nodeRequire || require });
  Object.assign(livelySystem, await import("lively.modules/src/node-resolver.js"));
  modules.changeSystem(livelySystem, true);
  var registry = livelySystem["__lively.modules__packageRegistry"] = new modules.PackageRegistry(livelySystem);
  const registeredRootPaths = discoverPackageRootPaths(baseURL);
  const registeredRoots = registeredRootPaths.map(dir => resource(pathToFileURL(dir).href));
  const nodeModules = resource(baseURL).join("node_modules").asDirectory();
  registry.packageBaseDirs = [nodeModules];
  registry.nodeModulesDirs = [nodeModules, ...registeredRoots.map(dir => dir.join("node_modules").asDirectory())];
  registry.devPackageDirs = registeredRoots;
  registry.individualPackageDirs = [];
  const registryCache = readPackageRegistryCache(registeredRootPaths);
  if (registryCache) {
    registry.fromJSON(registryCache.registry);
    serverStartupLog(`loaded package registry ${registryCache.source}`);
    if (registryCache.source === 'seed') writePackageRegistryCache(registry);
  } else {
    const t0 = Date.now();
    await registry.update();
    serverStartupLog(`package registry scan: ${elapsed(t0)}`);
    writePackageRegistryCache(registry);
  }

  const { setupBabelTranspiler } = await import('lively.source-transform/babel/plugin.js');
  setupBabelTranspiler(livelySystem);

  return livelySystem;
}

async function setupObjectDB(baseDir) {
  let { ensureFetch, resource } = await modules.importPackage(join(baseDir, "/lively.resources"));
  await ensureFetch();
  if (!global.navigator) global.navigator = {};

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
