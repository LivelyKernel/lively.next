// NW.js node-main script
// Runs in Node context BEFORE any window opens.
// Boots lively.server, then navigates the window to it.
//
// ESM resolver hooks (module.register, registerHooks, NODE_OPTIONS) all crash
// NW.js's Blink renderer. So the server runs in a managed child process where
// --experimental-loader works normally. From the user's perspective it's
// invisible — launch the app, lively starts, close the window, everything stops.

const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn, execSync } = require('child_process');

// lively.app/ sits inside the monorepo root
const rootDir = path.resolve(__dirname, '..', '..');

// File-based logging — NW.js node-main console goes to internal devtools
const logFile = path.join(rootDir, 'lively.app', 'boot.log');
function log (msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
}
fs.writeFileSync(logFile, '');
log('node-main starting, rootDir=' + rootDir);

// ---------------------------------------------------------------------------
// 1. Find a free port
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

// ---------------------------------------------------------------------------
// 2. Wait for the server to accept connections
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 3. Status updates to boot.html
// ---------------------------------------------------------------------------

function emitStatus (msg) {
  log(msg);
  try { nw.Window.get().emit('lively-boot-status', msg); } catch (_) {}
}

function emitError (msg) {
  log('ERROR: ' + msg);
  try { nw.Window.get().emit('lively-boot-error', msg); } catch (_) {}
}

// ---------------------------------------------------------------------------
// 4. Boot
// ---------------------------------------------------------------------------

(async () => {
  emitStatus('Finding free port...');
  const port = await findFreePort(9011);

  let configFile = path.join(rootDir, 'lively.app/desktop/server-config.js');
  if (!fs.existsSync(configFile)) configFile = path.join(rootDir, 'config.js');
  if (!fs.existsSync(configFile)) configFile = path.join(rootDir, 'lively.installer/assets/config.js');

  // Find a real node binary on PATH (skip flatn/bin/node which is a wrapper script).
  const nodeBin = execSync('which -a node', { encoding: 'utf8' })
    .split('\n').map(p => p.trim())
    .find(p => p && !p.includes('/flatn/'));
  log('Using node: ' + nodeBin);

  emitStatus('Starting lively.server on 127.0.0.1:' + port + '...');

  const child = spawn(nodeBin, [
    '--no-warnings',
    '--dns-result-order', 'ipv4first',
    // Preload the parent-death watchdog FIRST (so even if later preloads fail,
    // the child still dies when NW.js does).
    '-r', path.join(rootDir, 'lively.app/desktop/watchdog.cjs'),
    // Flatn CJS resolver hook.
    '-r', path.join(rootDir, 'flatn/resolver.cjs'),
    // Flatn ESM resolver hook.
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
      LIVELY_APP_PARENT_PID: String(process.pid)
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
  const win = nw.Window.get();
  win.window.location.href = `http://127.0.0.1:${port}`;

  win.on('close', function () {
    log('Window closing, killing server...');
    child.kill('SIGTERM');
    setTimeout(() => this.close(true), 2000);
  });
})().catch(err => {
  emitError('Boot failed: ' + (err.stack || err));
});
