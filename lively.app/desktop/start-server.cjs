// NW.js node-main script
// Runs in Node context BEFORE any window opens.
// Boots lively.server, then navigates the window to it.
//
// Works in two modes:
//   - Dev mode: lively.app/ inside the monorepo at <root>/lively.app/
//   - Bundled mode: standalone distribution where lively source lives at
//     <bundle>/app/ next to the NW.js binary. The server runs from a
//     per-user runtime root so caches/projects/uploads stay outside the app.
//
// ESM resolver hooks (module.register, registerHooks, NODE_OPTIONS) all crash
// NW.js's Blink renderer. So the server runs in a managed child process where
// --experimental-loader works normally. From the user's perspective it's
// invisible — launch the app, lively starts, close the window, everything stops.

const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { createHash } = require('crypto');
const { spawn, execSync } = require('child_process');
const { pathToFileURL } = require('url');
const { runVelopackStartup } = require('./updates.cjs');
const { createInspectorService } = require('./inspector-service.cjs');

// ---------------------------------------------------------------------------
// 0. Detect mode: dev (monorepo) vs bundled (standalone distribution)
// ---------------------------------------------------------------------------
// Marker: lively.installer/packages-config.json always present at the repo
// (or bundled app) root.

function findRootDir () {
  const candidates = [
    path.resolve(__dirname, '..', '..'),       // dev: lively.app/desktop/ → monorepo
    path.resolve(__dirname, '..', 'app'),      // bundled: desktop/ → ../app/
    path.resolve(__dirname, '..')              // fallback: desktop/ → bundle root
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'lively.installer/packages-config.json'))) return c;
  }
  throw new Error('Could not locate lively.next root directory from ' + __dirname);
}

function desktopDataDir () {
  if (process.env.LIVELY_APP_DATA_DIR) return process.env.LIVELY_APP_DATA_DIR;
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'lively.next');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'lively.next');
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'lively.next');
}

function desktopCacheDir () {
  if (process.env.LIVELY_APP_CACHE_DIR) return process.env.LIVELY_APP_CACHE_DIR;
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'lively.next');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'lively.next', 'Cache');
  }
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'lively.next');
}

const sourceRootDir = findRootDir();
// In dev mode this script lives inside the monorepo, so __dirname is under rootDir.
// In bundled mode this script lives next to the NW.js binary (at <bundle>/desktop/)
// and rootDir is at <bundle>/app/ — __dirname is NOT under rootDir.
const bundled = !__dirname.startsWith(sourceRootDir + path.sep);
const appPayloadRoot = bundled ? path.resolve(sourceRootDir, '..') : sourceRootDir;

// ---------------------------------------------------------------------------
// 1. Logging
// ---------------------------------------------------------------------------
// Dev mode: log to lively.app/boot.log (alongside source).
// Bundled mode: log to ~/.local/share/lively.next/boot.log (user-writable).

const logFile = bundled
  ? path.join(desktopDataDir(), 'boot.log')
  : path.join(sourceRootDir, 'lively.app', 'boot.log');
fs.mkdirSync(path.dirname(logFile), { recursive: true });
fs.writeFileSync(logFile, '');
function log (msg) {
  fs.appendFileSync(logFile, '[' + new Date().toISOString() + '] ' + msg + '\n');
}
// Stamp bundle build info so the log identifies the exact commit
let buildInfo = '(no build-info.json)';
try {
  const p = path.join(__dirname, 'build-info.json');
  if (fs.existsSync(p)) buildInfo = fs.readFileSync(p, 'utf8').replace(/\s+/g, ' ').trim();
} catch (_) {}
log('node-main starting, mode=' + (bundled ? 'bundled' : 'dev') + ', sourceRootDir=' + sourceRootDir);
log('build: ' + buildInfo);

// Velopack must see its install/update hook arguments before the app starts
// expensive UI/server work. In raw/dev builds this simply reports unavailable.
runVelopackStartup({ rootDir: sourceRootDir, desktopDir: __dirname, log });

function ensureSymlink (target, link, type, logFn) {
  if (!fs.existsSync(target)) return;

  let shouldCreate = true;
  try {
    const stat = fs.lstatSync(link);
    if (stat.isSymbolicLink()) {
      let pointsToTarget = false;
      try {
        pointsToTarget = fs.realpathSync(link) === fs.realpathSync(target);
      } catch (_) {
        // AppImage mounts live below /tmp/.mount_*. Between launches those
        // mount points disappear, leaving stale runtime-root symlinks behind.
        // Broken symlinks must be removed before we can recreate them.
      }
      if (pointsToTarget) shouldCreate = false;
      else fs.rmSync(link, { recursive: true, force: true });
    } else {
      shouldCreate = false;
      logFn('runtime-root path exists and is not a symlink, keeping it: ' + link);
    }
  } catch (_) {}

  if (!shouldCreate) return;
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, process.platform === 'win32' && type === 'dir' ? 'junction' : type);
}

function ensureDirectoryOverlay (sourceDir, targetDir, mutableNames, logFn) {
  try {
    if (fs.lstatSync(targetDir).isSymbolicLink()) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch (_) {}
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (mutableNames.includes(entry.name)) continue;
    ensureSymlink(
      path.join(sourceDir, entry.name),
      path.join(targetDir, entry.name),
      entry.isDirectory() ? 'dir' : 'file',
      logFn);
  }
}

function copyFileWithMode (source, target) {
  const sourceStat = fs.statSync(source);
  try {
    if (fs.lstatSync(target).isDirectory()) fs.rmSync(target, { recursive: true, force: true });
  } catch (_) {}
  fs.copyFileSync(source, target);
  fs.chmodSync(target, sourceStat.mode & 0o777);
}

function ensureDirectoryCopy (sourceDir, targetDir, logFn) {
  try {
    if (fs.lstatSync(targetDir).isSymbolicLink()) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch (_) {}

  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);

    try {
      if (entry.isDirectory()) {
        ensureDirectoryCopy(source, target, logFn);
      } else if (entry.isSymbolicLink()) {
        let shouldCreate = true;
        try {
          if (fs.lstatSync(target).isSymbolicLink() && fs.readlinkSync(target) === fs.readlinkSync(source)) {
            shouldCreate = false;
          } else {
            fs.rmSync(target, { recursive: true, force: true });
          }
        } catch (_) {}
        if (shouldCreate) fs.symlinkSync(fs.readlinkSync(source), target);
      } else if (entry.isFile()) {
        try {
          if (fs.lstatSync(target).isSymbolicLink()) fs.rmSync(target, { force: true });
        } catch (_) {}
        copyFileWithMode(source, target);
      }
    } catch (err) {
      logFn('failed preparing runtime copy ' + target + ': ' + (err.stack || err));
    }
  }
}

function prepareDesktopRuntimeRoot (sourceRoot, dataDir, logFn) {
  const runtimeRoot = path.join(dataDir, 'runtime-root');
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(path.join(runtimeRoot, '.lively-desktop-runtime-root'),
    JSON.stringify({ sourceRoot, updatedAt: new Date().toISOString() }, null, 2));

  for (const d of ['esm_cache', 'snapshots', 'local_projects', 'custom-npm-modules', 'uploads', 'users']) {
    fs.mkdirSync(path.join(runtimeRoot, d), { recursive: true });
  }

  const topLevelDirs = fs.readdirSync(sourceRoot, { withFileTypes: true })
    .filter(ea =>
      ea.isDirectory() &&
      (ea.name.startsWith('lively.') ||
       ea.name === 'lively-system-interface' ||
       ea.name === 'flatn' ||
       ea.name === 'mocha-es6' ||
       ea.name === 'scripts' ||
       ea.name === 'assets' ||
       ea.name === 'documents' ||
       ea.name === 'doc-style' ||
       ea.name === 'lively.next-node_modules'))
    .map(ea => ea.name);

  for (const name of topLevelDirs) {
    if (['esm_cache', 'snapshots', 'local_projects', 'custom-npm-modules'].includes(name)) continue;
    if (name === 'lively.morphic') {
      ensureDirectoryOverlay(
        path.join(sourceRoot, name),
        path.join(runtimeRoot, name),
        ['objectdb'],
        logFn);
      for (const d of ['morphicdb', 'morphicdb/snapshots', 'morphicdb-commits', 'morphicdb-version-graph']) {
        fs.mkdirSync(path.join(runtimeRoot, name, 'objectdb', d), { recursive: true });
      }
      continue;
    }
    if (name === 'lively.server') {
      ensureDirectoryOverlay(
        path.join(sourceRoot, name),
        path.join(runtimeRoot, name),
        ['.module_cache'],
        logFn);
      fs.mkdirSync(path.join(runtimeRoot, name, '.module_cache'), { recursive: true });
      continue;
    }
    if (name === 'lively.shell') {
      ensureDirectoryOverlay(
        path.join(sourceRoot, name),
        path.join(runtimeRoot, name),
        ['bin'],
        logFn);
      ensureDirectoryCopy(
        path.join(sourceRoot, name, 'bin'),
        path.join(runtimeRoot, name, 'bin'),
        logFn);
      continue;
    }
    ensureSymlink(path.join(sourceRoot, name), path.join(runtimeRoot, name), 'dir', logFn);
  }

  for (const name of ['config.js', 'localconfig.js', 'conf.json', 'chrome.json', 'favicon.ico', 'README.md', 'LICENSE']) {
    ensureSymlink(path.join(sourceRoot, name), path.join(runtimeRoot, name), 'file', logFn);
  }

  logFn('desktop runtime root ready: ' + runtimeRoot);
  return runtimeRoot;
}

const preparedRootDir = bundled
  ? prepareDesktopRuntimeRoot(sourceRootDir, desktopDataDir(), log)
  : sourceRootDir;
const rootDir = bundled ? fs.realpathSync(preparedRootDir) : preparedRootDir;
if (rootDir !== preparedRootDir) log('desktop runtime root canonicalized: ' + preparedRootDir + ' -> ' + rootDir);
if (rootDir !== sourceRootDir) log('server rootDir=' + rootDir);

// ---------------------------------------------------------------------------
// 2. Locate the desktop/ directory (always next to this script)
// ---------------------------------------------------------------------------

const desktopDir = __dirname;

// ---------------------------------------------------------------------------
// 3. Locate a node binary
// ---------------------------------------------------------------------------
// Bundled mode: look in the packaged Node.js directory.
// Dev mode: first PATH entry that isn't flatn/bin/node.

function findNodeBinary () {
  const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const bundleCandidates = [
    path.resolve(__dirname, '..', 'node', 'bin', nodeName),
    path.resolve(__dirname, '..', 'node', nodeName)
  ];
  const bundleNode = bundleCandidates.find(candidate => fs.existsSync(candidate));
  if (bundleNode) return bundleNode;

  try {
    const lookup = process.platform === 'win32' ? 'where node' : 'which -a node';
    const found = execSync(lookup, { encoding: 'utf8' })
      .split('\n').map(p => p.trim())
      .find(p => p && !p.replace(/\\/g, '/').includes('/flatn/'));
    if (found) return found;
  } catch (_) {}
  throw new Error('No node binary found (checked bundle and PATH)');
}

function bundledGitPathEntries () {
  const gitRoot = path.join(appPayloadRoot, 'tools', 'git');
  if (process.platform !== 'win32' || !fs.existsSync(gitRoot)) return [];
  return [
    path.join(gitRoot, 'cmd'),
    path.join(gitRoot, 'bin'),
    path.join(gitRoot, 'usr', 'bin'),
    path.join(gitRoot, 'mingw64', 'bin')
  ].filter(d => fs.existsSync(d));
}

function findBundledWindowsBash () {
  if (process.platform !== 'win32') return null;
  const gitRoot = path.join(appPayloadRoot, 'tools', 'git');
  const candidates = [
    path.join(gitRoot, 'bin', 'bash.exe'),
    path.join(gitRoot, 'usr', 'bin', 'bash.exe'),
    path.join(gitRoot, 'usr', 'bin', 'sh.exe')
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

// ---------------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------------

function findFreePort (start) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(start, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => findFreePort(start + 1).then(resolve, reject));
  });
}

function serverStartTimeout () {
  const timeout = Number(process.env.LIVELY_APP_SERVER_START_TIMEOUT ||
    process.env.LIVELY_APP_SMOKE_TIMEOUT ||
    300000);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 300000;
}

function serverRestartWindow () {
  const timeout = Number(process.env.LIVELY_APP_SERVER_RESTART_WINDOW || 120000);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 120000;
}

function serverRestartLimit () {
  const limit = Number(process.env.LIVELY_APP_SERVER_RESTART_LIMIT || 5);
  return Number.isFinite(limit) && limit > 0 ? limit : 5;
}

function serverRestartDelay (attempt) {
  const delay = Math.min(30000, 1000 * Math.pow(2, Math.max(0, attempt - 1)));
  return Number.isFinite(delay) && delay > 0 ? delay : 1000;
}

function localProjectSignature (localProjectsDir) {
  if (!fs.existsSync(localProjectsDir)) return [];
  return fs.readdirSync(localProjectsDir, { withFileTypes: true })
    .filter(ea => ea.isDirectory())
    .map(ea => {
      const dir = path.join(localProjectsDir, ea.name);
      const files = ['package.json', '.livelyForkInformation']
        .map(file => {
          const full = path.join(dir, file);
          try {
            return [file, fs.statSync(full).mtimeMs];
          } catch (_) {
            return [file, 0];
          }
        });
      return [ea.name, files];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function packageCollectionSignature (collectionDir) {
  if (!fs.existsSync(collectionDir)) return [];
  return fs.readdirSync(collectionDir, { withFileTypes: true })
    .filter(ea => ea.isDirectory())
    .map(ea => {
      const dir = path.join(collectionDir, ea.name);
      try {
        return [ea.name, fs.statSync(dir).mtimeMs];
      } catch (_) {
        return [ea.name, 0];
      }
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
}

function packageRegistryCacheKey () {
  return JSON.stringify({
    buildInfo,
    rootDir,
    packageCollectionDirs: process.env.FLATN_PACKAGE_COLLECTION_DIRS || '',
    packageDirs: process.env.FLATN_PACKAGE_DIRS || '',
    devPackageDirs: process.env.FLATN_DEV_PACKAGE_DIRS || '',
    customNpmModules: packageCollectionSignature(path.join(rootDir, 'custom-npm-modules')),
    localProjects: localProjectSignature(path.join(rootDir, 'local_projects'))
  });
}

function packageRegistryCacheFile (cacheDir) {
  if (!bundled || process.env.LIVELY_DISABLE_PACKAGE_REGISTRY_CACHE === '1') return null;
  const key = packageRegistryCacheKey();
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 24);
  const dir = path.join(cacheDir, 'package-registry');
  fs.mkdirSync(dir, { recursive: true });
  return {
    file: path.join(dir, `${hash}.json`),
    key
  };
}

function waitForServer (port, timeout = serverStartTimeout()) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt () {
      if (Date.now() - start > timeout) return reject(new Error('Server start timed out'));
      const sock = net.connect(port, '127.0.0.1');
      sock.on('connect', () => { sock.destroy(); resolve(); });
      sock.on('error', () => setTimeout(attempt, 500));
    })();
  });
}

function waitForServerProcess (child, port, timeout = serverStartTimeout()) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = fn => value => {
      if (settled) return;
      settled = true;
      child.off('exit', onExit);
      child.off('error', onError);
      fn(value);
    };
    const onExit = (code, signal) => {
      settle(reject)(new Error(`Server exited before ready (code=${code}, signal=${signal})`));
    };
    const onError = err => {
      settle(reject)(err);
    };
    child.once('exit', onExit);
    child.once('error', onError);
    waitForServer(port, timeout).then(settle(resolve), settle(reject));
  });
}

function livelyBoot () {
  try {
    const w = nw.Window.get().window;
    return w && w.livelyBoot;   // undefined until boot.html's script runs
  } catch (_) { return null; }
}

function asImportSpecifier (filePath) {
  return process.platform === 'win32' ? pathToFileURL(filePath).href : filePath;
}

function pathEnvValue (env) {
  const key = Object.keys(env || {}).find(key =>
    process.platform === 'win32' ? key.toLowerCase() === 'path' : key === 'PATH');
  return key ? env[key] : '';
}

function withPathEnv (env, value) {
  const result = { ...env };
  if (process.platform === 'win32') {
    for (const key of Object.keys(result)) {
      if (key.toLowerCase() === 'path') delete result[key];
    }
    result.Path = value;
  } else {
    result.PATH = value;
  }
  return result;
}

function emitStatus (msg) {
  log(msg);
  const b = livelyBoot();
  if (b && b.status) b.status(msg);
}

function emitError (msg) {
  log('ERROR: ' + msg);
  const b = livelyBoot();
  if (b && b.error) b.error(msg);
}

// ---------------------------------------------------------------------------
// 5. Flatn env setup
// ---------------------------------------------------------------------------
// In dev mode start.sh sources scripts/lively-next-env.sh before launching.
// In bundled mode there's no launcher script — we set the env vars here.

function setupFlatnEnv () {
  if (process.env.FLATN_DEV_PACKAGE_DIRS) return;  // already set by launcher
  const collectionRoots = Array.from(new Set((bundled ? [rootDir] : [rootDir, sourceRootDir]).filter(Boolean)));
  const pkgs = JSON.parse(fs.readFileSync(
    path.join(sourceRootDir, 'lively.installer/packages-config.json'), 'utf8'));
  const devDirs = pkgs
    .map(p => path.join(rootDir, p.name))
    .filter(d => fs.existsSync(d));
  const localProjects = path.join(rootDir, 'local_projects');
  if (fs.existsSync(localProjects)) {
    for (const d of fs.readdirSync(localProjects, { withFileTypes: true })) {
      if (d.isDirectory()) devDirs.push(path.join(localProjects, d.name));
    }
  }
  const collectionDirs = collectionRoots.flatMap(root => [
    path.join(root, 'lively.next-node_modules'),
    path.join(root, 'custom-npm-modules')
  ]).filter(d => fs.existsSync(d));
  process.env.FLATN_PACKAGE_COLLECTION_DIRS = Array.from(new Set(collectionDirs)).join(path.delimiter);
  process.env.FLATN_DEV_PACKAGE_DIRS = Array.from(new Set(devDirs)).join(path.delimiter);
  process.env.FLATN_PACKAGE_DIRS = '';
  process.env.lv_next_dir = rootDir;
}

// ---------------------------------------------------------------------------
// 6. Boot
// ---------------------------------------------------------------------------

(async () => {
  setupFlatnEnv();

  // Runtime directories the server's library-snapshot step expects. Excluded
  // from the bundle since they're populated at runtime; create empty ones
  // on first launch.
  for (const d of ['esm_cache', 'snapshots', 'local_projects', 'custom-npm-modules']) {
    fs.mkdirSync(path.join(rootDir, d), { recursive: true });
  }

  emitStatus('Finding free port...');
  const port = await findFreePort(9011);

  let configFile = path.join(desktopDir, 'server-config.js');
  if (!fs.existsSync(configFile)) configFile = path.join(rootDir, 'config.js');
  if (!fs.existsSync(configFile)) configFile = path.join(rootDir, 'lively.installer/assets/config.js');

  const nodeBin = findNodeBinary();
  const bundledGitDirs = bundledGitPathEntries();
  const bundledWindowsBash = findBundledWindowsBash();
  const serverSourceRootDir = bundled ? rootDir : sourceRootDir;
  const commandPath = [
    path.join(serverSourceRootDir, 'flatn', 'bin'),
    ...bundledGitDirs,
    path.dirname(nodeBin),
    pathEnvValue(process.env)
  ].filter(Boolean).join(path.delimiter);
  log('Using node: ' + nodeBin);
  if (bundledGitDirs.length) log('Using bundled Git for Windows: ' + path.join(appPayloadRoot, 'tools', 'git'));
  else if (process.platform === 'win32') log('Bundled Git for Windows not found; falling back to PATH');
  if (bundledWindowsBash) log('Using Windows shell: ' + bundledWindowsBash);

  // Per-user cache directory for V8 bytecode + (pre-built) snapshot mtime stamp
  const userCacheDir = desktopCacheDir();
  const v8CacheDir = path.join(userCacheDir, 'v8');
  const moduleTranslationCacheDir = path.join(userCacheDir, 'module-translation-cache');
  const registryCache = packageRegistryCacheFile(userCacheDir);
  fs.mkdirSync(v8CacheDir, { recursive: true });
  fs.mkdirSync(moduleTranslationCacheDir, { recursive: true });

  // If the bundle ships a pre-built library snapshot, point dav.js at it so
  // the server skips the tar+gzip step on every startup.
  const prebuiltSnapshot = bundled
    ? path.join(sourceRootDir, 'lively.server', '.library-snapshot.tar.gz')
    : '';
  const prebuiltRegistryCache = bundled
    ? path.join(sourceRootDir, 'lively.server', '.package-registry-cache.json')
    : '';

  const childEnv = withPathEnv({
    ...process.env,
    ENTR_SUPPORT: '0',
    NODE_OPTIONS: '',
    LIVELY_DESKTOP_APP: '1',
    // The ws native addons are optional performance helpers. In the packaged
    // flatn/SystemJS runtime, especially on Windows, their dynamic require can
    // resolve to an incompatible module shape instead of throwing. Force ws to
    // use its built-in JavaScript fallback in the desktop server process.
    WS_NO_BUFFER_UTIL: '1',
    WS_NO_UTF_8_VALIDATE: '1',
    LIVELY_APP_PARENT_PID: String(process.pid),
    ...(process.platform === 'win32' ? {
      HOME: process.env.HOME || process.env.USERPROFILE || os.homedir(),
      LIVELY_WINDOWS_BASH: bundledWindowsBash || ''
    } : {}),
    LIVELY_MODULE_TRANSLATION_CACHE_DIR: moduleTranslationCacheDir,
    ...(registryCache
      ? {
          LIVELY_PACKAGE_REGISTRY_CACHE_FILE: registryCache.file,
          LIVELY_PACKAGE_REGISTRY_CACHE_KEY: registryCache.key
        }
      : {}),
    ...(prebuiltRegistryCache && fs.existsSync(prebuiltRegistryCache)
      ? { LIVELY_PACKAGE_REGISTRY_SEED_FILE: prebuiltRegistryCache }
      : {}),
    // Node 22+ caches V8 bytecode to this dir — makes launches after
    // the first much faster (20-40% typically).
    NODE_COMPILE_CACHE: v8CacheDir,
    // Use the pre-built library snapshot if the bundle shipped one.
    ...(prebuiltSnapshot && fs.existsSync(prebuiltSnapshot)
      ? { LIVELY_PREBUILT_LIBRARY_SNAPSHOT: prebuiltSnapshot }
      : {})
  }, commandPath);

  let currentChild = null;
  let closing = false;
  let restartTimer = null;
  let restartTimes = [];

  function startServerChild () {
    emitStatus('Starting lively.server on 127.0.0.1:' + port + '...');
    const child = spawn(nodeBin, [
      '--no-warnings',
      '--dns-result-order', 'ipv4first',
      ...(bundled ? ['--preserve-symlinks', '--preserve-symlinks-main'] : []),
      // Parent-death watchdog (first so other preloads failing can't orphan us)
      '-r', path.join(desktopDir, 'watchdog.cjs'),
      // Flatn CJS resolver hook
      '-r', path.join(serverSourceRootDir, 'flatn/resolver.cjs'),
      // Flatn ESM resolver hook
      '--experimental-loader', asImportSpecifier(path.join(serverSourceRootDir, 'flatn/resolver.mjs')),
      path.join(serverSourceRootDir, 'lively.server/bin/start-server.js'),
      '--root-directory', rootDir,
      '--config', configFile,
      '--port', String(port),
      '--hostname', '127.0.0.1'
    ], {
      cwd: path.join(rootDir, 'lively.server'),
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    child.__livelyReady = false;
    currentChild = child;
    child.stdout.on('data', d => log('server: ' + d.toString().trimEnd()));
    child.stderr.on('data', d => log('server err: ' + d.toString().trimEnd()));
    child.on('error', err => {
      log('Server process failed to start: ' + (err.stack || err));
    });
    child.on('exit', (code, signal) => {
      if (currentChild === child) currentChild = null;
      log('Server process exited (code=' + code + ', signal=' + signal + ')');
      if (!closing && child.__livelyReady) scheduleServerRestart(code, signal);
    });
    return child;
  }

  function scheduleServerRestart (code, signal) {
    const now = Date.now();
    const windowMs = serverRestartWindow();
    restartTimes = restartTimes.filter(time => now - time < windowMs);
    restartTimes.push(now);

    if (restartTimes.length > serverRestartLimit()) {
      emitError(`Server crashed too often; not restarting again (last exit code=${code}, signal=${signal})`);
      return;
    }

    const delay = serverRestartDelay(restartTimes.length);
    const seconds = Math.round(delay / 1000);
    emitStatus(`Server crashed; restarting in ${seconds}s...`);
    clearTimeout(restartTimer);
    restartTimer = setTimeout(restartServer, delay);
  }

  async function restartServer () {
    if (closing) return;
    const child = startServerChild();
    emitStatus('Waiting for server restart...');
    try {
      await waitForServerProcess(child, port);
      child.__livelyReady = true;
      emitStatus('Server restarted.');
    } catch (err) {
      log('Server restart failed: ' + (err.stack || err));
      if (currentChild === child) {
        currentChild = null;
        try { child.kill('SIGTERM'); } catch (_) {}
      }
      if (!closing) scheduleServerRestart('restart-failed', null);
    }
  }

  const child = startServerChild();

  emitStatus('Waiting for server...');
  await waitForServerProcess(child, port);
  child.__livelyReady = true;

  emitStatus('Server ready, loading lively...');

  const dashboardUrl = 'http://127.0.0.1:' + port + '/dashboard/';
  if (typeof nw === 'undefined') {
    log('NW.js global not available; server is ready for direct smoke mode.');
    return;
  }

  const win = nw.Window.get();
  let inspectorService = null;

  const b = livelyBoot();
  if (b && b.setDashboardUrl) b.setDashboardUrl(dashboardUrl);
  if (b && b.navigate) b.navigate(dashboardUrl);
  else {
    // boot.html's script hasn't run yet — fall back and hope the direct
    // assignment works on this platform. Shouldn't happen in practice
    // since server boot takes many seconds by which point boot.html is
    // long loaded, but be defensive.
    log('livelyBoot helper missing, using direct location.href assignment');
    win.window.location.href = dashboardUrl;
  }

  if (process.env.LIVELY_APP_INSPECTOR_SERVICE !== '0') {
    const cdpPort = Number(process.env.LIVELY_APP_CDP_PORT || 9222);
    inspectorService = createInspectorService({
      cdpPort: Number.isFinite(cdpPort) && cdpPort > 0 ? cdpPort : 9222,
      log: msg => log('inspector: ' + msg)
    });
    inspectorService.start().catch(err => {
      log('inspector: service unavailable: ' + (err.stack || err));
    });
  }

  win.on('close', function () {
    log('Window closing, killing server...');
    closing = true;
    clearTimeout(restartTimer);
    if (inspectorService) inspectorService.stop();
    if (currentChild) currentChild.kill('SIGTERM');
    setTimeout(() => this.close(true), 2000);
  });
})().catch(err => {
  emitError('Boot failed: ' + (err.stack || err));
});
