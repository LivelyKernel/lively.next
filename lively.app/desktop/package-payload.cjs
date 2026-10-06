// Keep cyclic Bun links inside tar during Velopack packaging. Extract into a
// writable cache so signed apps and read-only AppImages remain unchanged.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const manifestName = '.lively-package-payload.json';
const archiveName = '.lively-package-payload.tar';

function desktopCacheDir () {
  if (process.env.LIVELY_APP_CACHE_DIR) return process.env.LIVELY_APP_CACHE_DIR;
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'lively.next');
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'lively.next', 'Cache');
  }
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'lively.next');
}

async function stagePackagedSources (sourceRoot, stagingParent) {
  const backup = fs.mkdtempSync(path.join(stagingParent, '.velopack-source-'));
  const original = path.join(backup, 'app');
  fs.renameSync(sourceRoot, original);
  const restore = () => {
    fs.rmSync(sourceRoot, { recursive: true, force: true });
    fs.renameSync(original, sourceRoot);
    fs.rmSync(backup, { recursive: true, force: true });
  };
  try {
    fs.mkdirSync(sourceRoot);
    const archive = path.join(sourceRoot, archiveName);
    execFileSync('tar', ['-cf', archive, '-C', original, '.'], { stdio: 'inherit' });
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(archive)) hash.update(chunk);
    fs.writeFileSync(path.join(sourceRoot, manifestName), JSON.stringify({ sha256: hash.digest('hex') }) + '\n');
    return restore;
  } catch (error) {
    restore();
    throw error;
  }
}

function preparePackagedSources (sourceRoot, log = () => {}) {
  const manifest = path.join(sourceRoot, manifestName);
  if (!fs.existsSync(manifest)) return sourceRoot;
  const { sha256 } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid packaged source payload hash');
  // ponytail: retain caches by payload hash; clear the app cache to remove old versions.
  const cache = path.join(desktopCacheDir(), 'package-payload');
  const root = path.join(cache, sha256);
  const ready = path.join(root, '.lively-payload-ready');
  if (fs.existsSync(ready)) return root;
  fs.mkdirSync(cache, { recursive: true });
  const staging = fs.mkdtempSync(path.join(cache, '.extract-'));
  try {
    log('extracting packaged sources into ' + root);
    execFileSync('tar', ['-xf', path.join(sourceRoot, archiveName), '-C', staging], { stdio: 'inherit' });
    fs.writeFileSync(path.join(staging, '.lively-payload-ready'), sha256);
    try {
      fs.renameSync(staging, root);
    } catch (error) {
      // Another desktop/updater process may have finished the same extraction.
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code) || !fs.existsSync(ready)) throw error;
    }
    return root;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function seedPackagedPartsbin (sourceRoot, runtimeRoot) {
  const projects = path.join(runtimeRoot, 'local_projects');
  const target = path.join(projects, 'LivelyKernel--partsbin');
  // Existing checkouts, including local edits, belong to the user.
  if (fs.existsSync(target)) return;
  fs.mkdirSync(projects, { recursive: true });
  const staging = fs.mkdtempSync(path.join(projects, '.partsbin-'));
  try {
    fs.cpSync(path.join(sourceRoot, 'local_projects', 'LivelyKernel--partsbin'), staging,
      { recursive: true, verbatimSymlinks: true });
    fs.renameSync(staging, target);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

module.exports = { desktopCacheDir, manifestName, preparePackagedSources, stagePackagedSources, seedPackagedPartsbin };
