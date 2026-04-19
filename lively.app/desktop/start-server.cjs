// NW.js node-main script
// Runs in Node context BEFORE any window opens.
// Boots lively.server, then navigates the window to it.
//
// Works in two modes:
//   - Dev mode: lively.app/ inside the monorepo at <root>/lively.app/
//   - Bundled mode: standalone distribution where lively source lives at
//     <bundle>/app/ next to the NW.js binary
//
// ESM resolver hooks (module.register, registerHooks, NODE_OPTIONS) all crash
// NW.js's Blink renderer. So the server runs in a managed child process where
// --experimental-loader works normally. From the user's perspective it's
// invisible — launch the app, lively starts, close the window, everything stops.

const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { spawn, execSync } = require('child_process');

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

const rootDir = findRootDir();
// In dev mode this script lives inside the monorepo, so __dirname is under rootDir.
// In bundled mode this script lives next to the NW.js binary (at <bundle>/desktop/)
// and rootDir is at <bundle>/app/ — __dirname is NOT under rootDir.
const bundled = !__dirname.startsWith(rootDir + path.sep);

// ---------------------------------------------------------------------------
// 1. Logging
// ---------------------------------------------------------------------------
// Dev mode: log to lively.app/boot.log (alongside source).
// Bundled mode: log to ~/.local/share/lively.next/boot.log (user-writable).

const logFile = bundled
  ? path.join(os.homedir(), '.local', 'share', 'lively.next', 'boot.log')
  : path.join(rootDir, 'lively.app', 'boot.log');
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
log('node-main starting, mode=' + (bundled ? 'bundled' : 'dev') + ', rootDir=' + rootDir);
log('build: ' + buildInfo);

// ---------------------------------------------------------------------------
// 2. Locate the desktop/ directory (always next to this script)
// ---------------------------------------------------------------------------

const desktopDir = __dirname;

// ---------------------------------------------------------------------------
// 3. Locate a node binary
// ---------------------------------------------------------------------------
// Bundled mode: look in <bundle>/node/bin/node.
// Dev mode: first PATH entry that isn't flatn/bin/node.

function findNodeBinary () {
  const bundleNode = path.resolve(__dirname, '..', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
  if (fs.existsSync(bundleNode)) return bundleNode;

  try {
    const found = execSync('which -a node', { encoding: 'utf8' })
      .split('\n').map(p => p.trim())
      .find(p => p && !p.includes('/flatn/'));
    if (found) return found;
  } catch (_) {}
  throw new Error('No node binary found (checked bundle and PATH)');
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

function waitForServer (port, timeout = 120000) {
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

function livelyBoot () {
  try {
    const w = nw.Window.get().window;
    return w && w.livelyBoot;   // undefined until boot.html's script runs
  } catch (_) { return null; }
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
  const pkgs = JSON.parse(fs.readFileSync(
    path.join(rootDir, 'lively.installer/packages-config.json'), 'utf8'));
  const devDirs = pkgs
    .map(p => path.join(rootDir, p.name))
    .filter(d => fs.existsSync(d));
  const localProjects = path.join(rootDir, 'local_projects');
  if (fs.existsSync(localProjects)) {
    for (const d of fs.readdirSync(localProjects, { withFileTypes: true })) {
      if (d.isDirectory()) devDirs.push(path.join(localProjects, d.name));
    }
  }
  process.env.FLATN_PACKAGE_COLLECTION_DIRS = [
    path.join(rootDir, 'lively.next-node_modules'),
    path.join(rootDir, 'custom-npm-modules')
  ].join(':');
  process.env.FLATN_DEV_PACKAGE_DIRS = devDirs.join(':');
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
  log('Using node: ' + nodeBin);

  // Per-user cache directory for V8 bytecode + (pre-built) snapshot mtime stamp
  const userCacheDir = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Caches', 'lively.next')
    : path.join(os.homedir(), '.cache', 'lively.next');
  const v8CacheDir = path.join(userCacheDir, 'v8');
  fs.mkdirSync(v8CacheDir, { recursive: true });

  // If the bundle ships a pre-built library snapshot, point dav.js at it so
  // the server skips the tar+gzip step on every startup.
  const prebuiltSnapshot = bundled
    ? path.join(rootDir, 'lively.server', '.library-snapshot.tar.gz')
    : '';

  emitStatus('Starting lively.server on 127.0.0.1:' + port + '...');

  const child = spawn(nodeBin, [
    '--no-warnings',
    '--dns-result-order', 'ipv4first',
    // Parent-death watchdog (first so other preloads failing can't orphan us)
    '-r', path.join(desktopDir, 'watchdog.cjs'),
    // Flatn CJS resolver hook
    '-r', path.join(rootDir, 'flatn/resolver.cjs'),
    // Flatn ESM resolver hook
    '--experimental-loader', path.join(rootDir, 'flatn/resolver.mjs'),
    path.join(rootDir, 'lively.server/bin/start-server.js'),
    '--root-directory', rootDir,
    '--config', configFile,
    '--port', String(port),
    '--hostname', '127.0.0.1'
  ], {
    cwd: path.join(rootDir, 'lively.server'),
    env: {
      ...process.env,
      ENTR_SUPPORT: '0',
      NODE_OPTIONS: '',
      LIVELY_APP_PARENT_PID: String(process.pid),
      // Node 22+ caches V8 bytecode to this dir — makes launches after
      // the first much faster (20-40% typically).
      NODE_COMPILE_CACHE: v8CacheDir,
      // Use the pre-built library snapshot if the bundle shipped one.
      ...(prebuiltSnapshot && fs.existsSync(prebuiltSnapshot)
        ? { LIVELY_PREBUILT_LIBRARY_SNAPSHOT: prebuiltSnapshot }
        : {})
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', d => log('server: ' + d.toString().trimEnd()));
  child.stderr.on('data', d => log('server err: ' + d.toString().trimEnd()));
  child.on('exit', (code) => {
    if (code !== 0) emitError('Server crashed (exit code ' + code + ')');
  });

  emitStatus('Waiting for server...');
  await waitForServer(port);

  emitStatus('Server ready, loading lively...');

  const dashboardUrl = 'http://127.0.0.1:' + port + '/dashboard/';
  const win = nw.Window.get();

  // Menu construction needs to happen AFTER the window is loaded —
  // wiring it up in node-main before the window fires 'loaded' is
  // flaky in NW.js on macOS (known issue where click callbacks silently
  // never fire). Once loaded, the menu behaves as documented.
  //
  // Navigation: click handler posts a 'lively-nav' message to the page.
  // desktop/inject.js listens and does the location.href assignment
  // from DOM context. (Assigning location.href FROM node context has
  // been broken since NW.js 0.12.x — see nwjs/nw.js#4313.)
  function installAppMenu () {
    try {
      const menu = new nw.Menu({ type: 'menubar' });
      if (process.platform === 'darwin') {
        // Standard Quit / Hide / Minimize / Window etc. — these are
        // OS-dispatched so they work regardless of click-callback quirks.
        menu.createMacBuiltin('lively.next', { hideEdit: false });
      }
      const goMenu = new nw.Menu();
      const mod = process.platform === 'darwin' ? 'cmd' : 'ctrl';
      goMenu.append(new nw.MenuItem({
        label: 'Dashboard',
        key: 'd',
        modifiers: mod + '+shift',
        click: function () {
          try {
            nw.Window.get().window.postMessage({ type: 'lively-nav', url: dashboardUrl }, '*');
          } catch (err) { log('dashboard menu click: ' + err.message); }
        }
      }));
      goMenu.append(new nw.MenuItem({ type: 'separator' }));
      goMenu.append(new nw.MenuItem({
        label: 'Toggle DevTools',
        key: 'i',
        modifiers: mod + '+alt',
        click: function () {
          try { nw.Window.get().showDevTools(); }
          catch (err) { log('devtools menu click: ' + err.message); }
        }
      }));
      menu.append(new nw.MenuItem({ label: 'Go', submenu: goMenu }));
      win.menu = menu;
    } catch (err) {
      log('menu setup failed (non-fatal): ' + err.message);
    }
  }
  win.on('loaded', installAppMenu);
  // Also run it once synchronously in case 'loaded' already fired by now
  installAppMenu();

  const b = livelyBoot();
  if (b && b.navigate) b.navigate(dashboardUrl);
  else {
    // boot.html's script hasn't run yet — fall back and hope the direct
    // assignment works on this platform. Shouldn't happen in practice
    // since server boot takes many seconds by which point boot.html is
    // long loaded, but be defensive.
    log('livelyBoot helper missing, using direct location.href assignment');
    win.window.location.href = dashboardUrl;
  }

  win.on('close', function () {
    log('Window closing, killing server...');
    child.kill('SIGTERM');
    setTimeout(() => this.close(true), 2000);
  });
})().catch(err => {
  emitError('Boot failed: ' + (err.stack || err));
});
