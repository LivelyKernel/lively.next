#!/usr/bin/env node
// Package an already-built lively.app desktop bundle with Velopack.
//
// This is intentionally a thin wrapper around `vpk pack`: build.mjs owns the
// NW.js/Node/Lively bundle layout, while this script owns version/channel/main
// executable selection for Velopack.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(APP_DIR, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const PLATFORM_KV = { linux: 'linux', darwin: 'osx', win32: 'win' };
const ARCH_KV = { x64: 'x64', arm64: 'arm64', ia32: 'ia32' };

function parseArgs () {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const args = parseArgs();
const targetPlatform = args.platform || PLATFORM_KV[process.platform];
const targetArch = args.arch || ARCH_KV[process.arch];
const bundleName = args.bundle || `lively.next-${targetPlatform}-${targetArch}`;
const bundleDir = path.resolve(args.bundleDir || path.join(DIST_DIR, bundleName));
const outputDir = path.resolve(args.outputDir || path.join(DIST_DIR, 'velopack', bundleName));
const version = args.version || process.env.LIVELY_APP_VERSION || process.env.VPK_PACK_VERSION;
const channel = args.channel || process.env.LIVELY_APP_UPDATE_CHANNEL || process.env.VPK_CHANNEL || `nightly-${targetPlatform}-${targetArch}`;
const runtime = args.runtime || `${targetPlatform}-${targetArch}`;
const packId = args.packId || process.env.VPK_PACK_ID || 'next.lively.app';
const packTitle = args.packTitle || process.env.VPK_PACK_TITLE || 'lively.next';
const packAuthors = args.packAuthors || process.env.VPK_PACK_AUTHORS || 'Lively Kernel';
const delta = args.delta || process.env.VPK_DELTA || 'BestSpeed';
const vpk = process.env.VPK || 'vpk';

function die (msg) {
  console.error('ERROR: ' + msg);
  process.exit(1);
}

function semverish (v) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(v);
}

function hostCanPackTarget () {
  return PLATFORM_KV[process.platform] === targetPlatform;
}

function mainExeFor () {
  if (targetPlatform === 'linux') return 'nw';
  if (targetPlatform === 'win') return 'lively.next.exe';
  if (targetPlatform === 'osx') return 'nwjs';
  die(`Unsupported target platform: ${targetPlatform}`);
}

function packDirFor () {
  if (targetPlatform !== 'osx') return bundleDir;
  const appBundle = path.join(bundleDir, 'lively.next.app');
  return fs.existsSync(appBundle) ? appBundle : bundleDir;
}

function realpath (p) {
  return (fs.realpathSync.native || fs.realpathSync)(p);
}

function pathIsInside (candidate, parent) {
  const rel = path.relative(parent, candidate);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function materializeExternalSymlink (linkPath, packRoot) {
  const linkTarget = fs.readlinkSync(linkPath);
  const absoluteTarget = path.resolve(path.dirname(linkPath), linkTarget);
  let resolvedTarget;

  try {
    resolvedTarget = realpath(absoluteTarget);
  } catch (_) {
    return 'dangling';
  }

  if (pathIsInside(resolvedTarget, packRoot)) return false;

  const targetStat = fs.statSync(resolvedTarget);
  const tmpPath = `${linkPath}.velopack-tmp-${process.pid}`;
  fs.rmSync(tmpPath, { recursive: true, force: true });

  if (targetStat.isDirectory()) {
    fs.cpSync(resolvedTarget, tmpPath, { recursive: true, dereference: true });
    fs.chmodSync(tmpPath, targetStat.mode);
  } else if (targetStat.isFile()) {
    fs.copyFileSync(resolvedTarget, tmpPath);
    fs.chmodSync(tmpPath, targetStat.mode);
  } else {
    die(`Velopack cannot package external symlink ${linkPath} -> ${linkTarget}: target is neither a file nor a directory.`);
  }

  fs.rmSync(linkPath, { recursive: true, force: true });
  fs.renameSync(tmpPath, linkPath);
  console.log(`  materialized external symlink: ${path.relative(packRoot, linkPath)} -> ${resolvedTarget}`);
  return 'materialized';
}

function sanitizeSymlinksForVelopack (packDir) {
  const packRoot = realpath(packDir);
  let materialized = 0;
  let dangling = 0;

  function walk (dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const entry = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) {
        const result = materializeExternalSymlink(entry, packRoot);
        if (result === 'materialized') materialized++;
        else if (result === 'dangling') dangling++;
      } else if (ent.isDirectory()) {
        walk(entry);
      }
    }
  }

  walk(packDir);
  if (materialized) {
    console.log(`Materialized ${materialized} external symlink${materialized === 1 ? '' : 's'} before Velopack packaging.`);
  }
  if (dangling) {
    console.log(`Left ${dangling} dangling symlink${dangling === 1 ? '' : 's'} unchanged before Velopack packaging.`);
  }
}

function iconFor () {
  const candidates = targetPlatform === 'win'
    ? [path.join(APP_DIR, 'assets', 'icon.ico')]
    : targetPlatform === 'osx'
      ? [path.join(APP_DIR, 'assets', 'icon.icns')]
      : [path.join(APP_DIR, 'assets', 'icon.png')];
  return candidates.find(p => fs.existsSync(p));
}

function listZipEntries (zipFile) {
  return execFileSync('unzip', ['-Z1', zipFile], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  }).split(/\r?\n/).filter(Boolean);
}

function listPkgPayloadEntries (pkgFile) {
  return execFileSync('pkgutil', ['--payload-files', pkgFile], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  }).split(/\r?\n/).filter(Boolean);
}

function assertEntriesContain (label, entries, required) {
  const missing = required.filter(({ name, test }) => !entries.some(test));
  if (!missing.length) return;

  die(`${label} is missing Velopack runtime file${missing.length === 1 ? '' : 's'}: ${missing.map(ea => ea.name).join(', ')}`);
}

function escapeRegExp (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateMacVelopackOutput () {
  const outputs = fs.readdirSync(outputDir).map(name => path.join(outputDir, name));
  const portableZip = outputs.find(file => /-Portable\.zip$/.test(path.basename(file)));
  const setupPkg = outputs.find(file => /-Setup\.pkg$/.test(path.basename(file)));
  const rootAppEntry = escapeRegExp(`${packTitle}.app`);
  const required = [
    {
      name: 'Contents/MacOS/UpdateMac',
      test: entry => new RegExp(`(^|/)${rootAppEntry}/Contents/MacOS/UpdateMac$`).test(entry)
    },
    {
      name: 'Contents/MacOS/sq.version',
      test: entry => new RegExp(`(^|/)${rootAppEntry}/Contents/MacOS/sq\\.version$`).test(entry)
    },
    {
      name: 'Contents/Resources/sq.version',
      test: entry => new RegExp(`(^|/)${rootAppEntry}/Contents/Resources/sq\\.version$`).test(entry)
    }
  ];

  if (!portableZip) die(`Velopack did not produce a macOS portable zip in ${outputDir}`);
  if (!setupPkg) die(`Velopack did not produce a macOS setup pkg in ${outputDir}`);

  assertEntriesContain(path.basename(portableZip), listZipEntries(portableZip), required);
  assertEntriesContain(path.basename(setupPkg), listPkgPayloadEntries(setupPkg), required);
  console.log('Validated macOS Velopack updater files in portable zip and setup pkg.');
}

function validateVelopackOutput () {
  if (targetPlatform === 'osx') validateMacVelopackOutput();
}

if (!targetPlatform || !targetArch) die(`Unsupported platform/arch: ${process.platform}/${process.arch}`);
if (!version) die('No version specified. Pass --version or set LIVELY_APP_VERSION.');
if (!semverish(version)) die(`Velopack requires a semver2 version, got: ${version}`);

if (!hostCanPackTarget()) {
  console.log(`Skipping Velopack package for ${targetPlatform}-${targetArch}; vpk pack is platform-native and this runner is ${process.platform}.`);
  process.exit(0);
}

if (!fs.existsSync(bundleDir)) die(`Bundle does not exist: ${bundleDir}`);

fs.mkdirSync(outputDir, { recursive: true });

const packDir = packDirFor();
const icon = iconFor();
sanitizeSymlinksForVelopack(packDir);
const cmd = [
  '--yes',
  '--skip-updates',
  'pack',
  '--packId', packId,
  '--packVersion', version,
  '--packDir', packDir,
  '--mainExe', mainExeFor(),
  '--packTitle', packTitle,
  '--packAuthors', packAuthors,
  '--channel', channel,
  '--runtime', runtime,
  '--delta', delta,
  '--outputDir', outputDir
];

if (icon) cmd.push('--icon', icon);
if (targetPlatform === 'osx') cmd.push('--bundleId', packId);

console.log(`Packing ${bundleName} with Velopack`);
console.log(`  version: ${version}`);
console.log(`  channel: ${channel}`);
console.log(`  runtime: ${runtime}`);
console.log(`  packDir: ${packDir}`);
console.log(`  output:  ${outputDir}`);

execFileSync(vpk, cmd, { cwd: ROOT_DIR, stdio: 'inherit' });
validateVelopackOutput();
