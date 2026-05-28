// Windows Velopack helper for the NW.js desktop app.
//
// Velopack's native Node module can hang inside NW.js on Windows. This helper
// is launched with the bundled plain Node.js binary and performs update
// operations on behalf of the NW background menu.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createUpdateService } = require('./updates.cjs');

function desktopDataDir () {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'lively.next');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'lively.next');
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'lively.next');
}

const logFile = path.join(desktopDataDir(), 'boot.log');

function emit (event) {
  try {
    process.stdout.write(JSON.stringify(event) + '\n');
  } catch (_) {}
}

function log (msg) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, '[' + new Date().toISOString() + '] velopack-helper: ' + msg + '\n');
  } catch (_) {}
  emit({ type: 'log', message: msg });
}

function serializableError (err) {
  const msg = err && (err.stack || err.message || String(err));
  return msg || 'Unknown Velopack helper error';
}

function readStdin () {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { input += chunk; });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

function payloadFileFromArgs () {
  const idx = process.argv.indexOf('--payload');
  return idx >= 0 ? process.argv[idx + 1] : null;
}

async function readPayload () {
  const payloadFile = payloadFileFromArgs();
  if (payloadFile) {
    try {
      return JSON.parse(fs.readFileSync(payloadFile, 'utf8'));
    } finally {
      try { fs.rmSync(payloadFile, { force: true }); } catch (_) {}
    }
  }
  const input = await readStdin();
  return JSON.parse(input || '{}');
}

function processIsAlive (pid) {
  if (!pid || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === 'EPERM';
  }
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForParentExit (parentPid, timeoutMs = 120000) {
  if (!parentPid) return;
  const deadline = Date.now() + timeoutMs;
  log('waiting for parent process to exit: pid=' + parentPid);
  while (processIsAlive(parentPid) && Date.now() < deadline) {
    await delay(500);
  }
  if (processIsAlive(parentPid)) {
    log('parent process still alive after ' + timeoutMs + 'ms; launching updater anyway');
  } else {
    log('parent process exited; launching updater');
  }
}

async function run () {
  const payload = await readPayload();
  const command = payload.command;
  const rootDir = payload.rootDir;
  const desktopDir = payload.desktopDir || __dirname;
  const service = createUpdateService({ rootDir, desktopDir, log });
  let result;

  if (command === 'status') {
    result = service.status();
  } else if (command === 'check') {
    result = await service.checkForUpdates();
  } else if (command === 'download') {
    result = await service.downloadUpdate(payload.updateInfo, percent => {
      emit({ type: 'progress', percent });
    });
  } else if (command === 'apply') {
    await waitForParentExit(payload.parentPid, payload.parentExitTimeoutMs || 120000);
    result = service.applyUpdate(payload.updateInfo, payload.options || {});
  } else {
    result = {
      ok: false,
      state: 'bad-command',
      message: 'Unknown Velopack helper command: ' + command
    };
  }

  emit({ type: 'result', result });
  process.exit(result && result.ok ? 0 : 1);
}

run().catch(err => {
  const error = serializableError(err);
  log('failed: ' + error);
  emit({ type: 'error', error });
  process.exit(1);
});
