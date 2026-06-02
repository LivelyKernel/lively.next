#!/usr/bin/env node
// Non-interactive Velopack update smoke test for the macOS NW.js bundle.
//
// This extracts the portable Velopack artifact when needed, loads the same
// desktop update service used by the native menu, and exercises status() plus
// checkForUpdates() against a local or remote feed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

function parseArgs () {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--keep') args.keep = true;
    else {
      const eq = arg.match(/^--([^=]+)=(.*)$/);
      if (eq) args[eq[1]] = eq[2];
      else if (arg.startsWith('--')) args[arg.slice(2)] = raw[++i];
    }
  }
  return args;
}

function usage () {
  console.log(`Usage:
  node lively.app/scripts/smoke-velopack-updates.mjs --artifactDir=dist/velopack/lively.next-osx-arm64
  node lively.app/scripts/smoke-velopack-updates.mjs --app=/Applications/lively.next.app --updateUrl=/path/to/velopack/feed

Options:
  --artifactDir  Directory containing the Velopack Portable.zip and feed files.
  --portableZip  Portable.zip to extract instead of discovering it in artifactDir.
  --app          Installed or extracted lively.next.app to test directly.
  --updateUrl    Velopack update feed URL/path. Defaults to artifactDir.
  --channel      Override LIVELY_APP_UPDATE_CHANNEL for the smoke run.
  --packagesDir  Temporary Velopack packages directory for this smoke run.
  --json         Print machine-readable JSON.
  --keep         Keep the temporary extracted portable app.`);
}

function die (msg, details = null) {
  console.error('ERROR: ' + msg);
  if (details) console.error(details);
  process.exit(1);
}

function requiredArg (args) {
  if (args.app || args.artifactDir || args.portableZip) return;
  die('Pass --artifactDir, --portableZip, or --app. Use --help for examples.');
}

function firstExistingFile (files) {
  return files.find(file => file && fs.existsSync(file) && fs.statSync(file).isFile());
}

function portableZipFor (artifactDir) {
  if (!artifactDir) return null;
  const entries = fs.readdirSync(artifactDir).map(name => path.join(artifactDir, name));
  return firstExistingFile(entries.filter(file => /-Portable\.zip$/.test(path.basename(file))));
}

function extractPortableZip (zipFile, keep) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-velopack-smoke-'));
  execFileSync('unzip', ['-q', zipFile, '-d', tmpDir], { stdio: 'inherit' });

  return {
    tmpDir,
    cleanup () {
      if (!keep) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };
}

function findAppBundle (dir) {
  const queue = [dir];
  while (queue.length) {
    const current = queue.shift();
    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, ent.name);
      if (ent.isDirectory() && ent.name.endsWith('.app')) {
        const appNw = path.join(file, 'Contents', 'Resources', 'app.nw');
        if (fs.existsSync(appNw)) return file;
      }
      if (ent.isDirectory() && !ent.name.endsWith('.app')) queue.push(file);
    }
  }

  return null;
}

function appLayout (appBundle) {
  const appNwDir = path.join(appBundle, 'Contents', 'Resources', 'app.nw');
  return {
    appBundle,
    appNwDir,
    rootDir: path.join(appNwDir, 'app'),
    desktopDir: path.join(appNwDir, 'desktop'),
    updatesPath: path.join(appNwDir, 'desktop', 'updates.cjs')
  };
}

function assertPath (label, file) {
  if (!fs.existsSync(file)) die(`${label} does not exist: ${file}`);
}

function assertCodeSignature (label, file) {
  try {
    execFileSync('codesign', ['--verify', '--deep', file], {
      stdio: ['ignore', 'ignore', 'pipe']
    });
  } catch (err) {
    die(`${label} does not have a valid code signature: ${file}`, err.stderr && err.stderr.toString());
  }
}

function configureEnvironment (args, artifactDir) {
  const updateUrl = args.updateUrl || artifactDir;
  if (!updateUrl) die('No update feed configured. Pass --updateUrl or --artifactDir.');

  process.env.LIVELY_APP_UPDATE_URL = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(updateUrl)
    ? updateUrl
    : path.resolve(updateUrl);
  if (args.channel) process.env.LIVELY_APP_UPDATE_CHANNEL = args.channel;
  if (!process.env.LIVELY_APP_UPDATE_CHECK_TIMEOUT_MS) {
    process.env.LIVELY_APP_UPDATE_CHECK_TIMEOUT_MS = '30000';
  }
}

function loadUpdatesModule (updatesPath) {
  const require = createRequire(import.meta.url);
  return require(updatesPath);
}

async function main () {
  const args = parseArgs();
  if (args.help) {
    usage();
    return;
  }
  if (process.platform !== 'darwin') {
    die('The Velopack update smoke test must run on macOS because the SDK loads the macOS native binding.');
  }

  requiredArg(args);

  let extracted = null;
  let appBundle = args.app && path.resolve(args.app);
  const artifactDir = args.artifactDir && path.resolve(args.artifactDir);

  if (!appBundle) {
    const portableZip = args.portableZip || portableZipFor(artifactDir);
    if (!portableZip) die(`No Velopack Portable.zip found in ${artifactDir || '(no artifactDir)'}`);
    const zipFile = path.resolve(portableZip);
    assertPath('Portable zip', zipFile);
    extracted = extractPortableZip(zipFile, args.keep);
    appBundle = findAppBundle(extracted.tmpDir);
    if (!appBundle) die(`No .app bundle with Contents/Resources/app.nw found in ${zipFile}`);
  }

  const layout = appLayout(appBundle);
  assertPath('App bundle', layout.appBundle);
  assertPath('Desktop update service', layout.updatesPath);
  configureEnvironment(args, artifactDir);

  const updates = loadUpdatesModule(layout.updatesPath);
  const packagesDir = args.packagesDir && path.resolve(args.packagesDir);
  const locator = updates.createVelopackLocator(layout.rootDir, { packagesDir });
  if (!locator) die(`Could not construct Velopack locator for ${layout.rootDir}`);

  assertPath('Velopack UpdateMac helper', locator.UpdateExePath);
  assertPath('Velopack manifest', locator.ManifestPath);
  assertCodeSignature('App bundle', appBundle);
  fs.mkdirSync(locator.PackagesDir, { recursive: true });

  const log = [];
  const service = updates.createUpdateService({
    rootDir: layout.rootDir,
    desktopDir: layout.desktopDir,
    locator,
    log: msg => log.push(msg)
  });

  const status = service.status();
  if (!status.ok) {
    die(status.message || 'Velopack status failed.', status.error || JSON.stringify(status, null, 2));
  }

  const checked = await service.checkForUpdates();
  if (!checked.ok) {
    die(checked.message || 'Velopack update check failed.', checked.error || JSON.stringify(checked, null, 2));
  }

  const summary = {
    ok: true,
    appBundle: layout.appBundle,
    source: checked.source,
    channel: checked.channel,
    appId: status.appId,
    version: status.version,
    state: checked.state,
    targetVersion: checked.targetVersion || null,
    locator,
    log
  };

  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log('Velopack update smoke passed');
    console.log('  app:     ' + summary.appBundle);
    console.log('  appId:   ' + summary.appId);
    console.log('  version: ' + summary.version);
    console.log('  source:  ' + summary.source);
    console.log('  channel: ' + (summary.channel || '(default)'));
    console.log('  state:   ' + summary.state + (summary.targetVersion ? ` (${summary.targetVersion})` : ''));
  }

  if (extracted) extracted.cleanup();
}

main().catch(err => {
  die(err && (err.stack || err.message) || String(err));
});
