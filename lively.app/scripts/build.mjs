#!/usr/bin/env node
// Cross-platform bundle builder for lively.app.
// Runs on Linux, macOS, Windows — no bash / rsync dependency.
//
// Produces dist/lively.next-<platform>-<arch>/ — a self-contained
// distribution that launches by double-clicking its native entrypoint.
//
// Usage:
//   node lively.app/scripts/build.mjs                  # build for the current host
//   node lively.app/scripts/build.mjs --platform=osx --arch=arm64
//   PACK=1 node lively.app/scripts/build.mjs           # also produce tar.gz (linux/osx) or zip (win)
//   LOCALES="en-US fr de" node lively.app/scripts/build.mjs  # keep additional Chromium locales
//   FLAVOR=sdk node lively.app/scripts/build.mjs       # SDK build (has DevTools)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(APP_DIR, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const NW_VERSION = process.env.LIVELY_NW_VERSION || '0.111.1';
const NW_DOWNLOAD_BASE = process.env.LIVELY_NW_DOWNLOAD_BASE || 'https://dl.nwjs.io/live-build/v0.111.1-04292210-39517e80d';
const NW_DOWNLOAD_BASE_KEY = crypto.createHash('sha1').update(NW_DOWNLOAD_BASE).digest('hex').slice(0, 8);
const NODE_VERSION = (process.env.LIVELY_APP_NODE_VERSION || '24.20.0').replace(/^v/, '');
const GIT_FOR_WINDOWS_VERSION = process.env.LIVELY_GIT_FOR_WINDOWS_VERSION || '2.54.0';
const BUN_VERSION = '1.4.2';
const BUN_ASSETS = {
  'darwin-aarch64': '90987a3a16d7db556d886ac3d551e7b6d3edf0a1cf43acaed622e8676be1d12f',
  'darwin-x64': '80520d7e17526308c9185d261679ac6d27798d3803a0e9f7ff9121ab8affb012',
  'linux-aarch64': '54328bbc2d9c8e0c9f892c544d66c57a83b84139e34909e5ee81758f1ac8fda7',
  'linux-x64': '36368faef7527875d5ffa52e53cd48021741f2a83eb6208a8dd64068d422a913',
  'windows-aarch64': 'a7a16b876a305fd1029c66dbd27007b4f6112ae896532f675878731a21e50cfd',
  'windows-x64': 'ce4c17497b2f29712a99d3d53f028de28cd42e3bacb8589599e7f000e49b6405'
};
const BUN_PLATFORM_KV = { linux: 'linux', osx: 'darwin', win: 'windows' };
const BUN_ARCH_KV = { x64: 'x64', arm64: 'aarch64' };
const GIT_FOR_WINDOWS_RELEASE = process.env.LIVELY_GIT_FOR_WINDOWS_RELEASE || `v${GIT_FOR_WINDOWS_VERSION}.windows.1`;
const APP_VERSION = process.env.LIVELY_APP_VERSION || '0.1.0';
const APP_UPDATE_CHANNEL = process.env.LIVELY_APP_UPDATE_CHANNEL || '';
const APP_UPDATE_URL = process.env.LIVELY_APP_UPDATE_URL || '';

// ---------------------------------------------------------------------------
// Platform detection + overrides
// ---------------------------------------------------------------------------

function parseArgs () {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const args = parseArgs();

const NW_PLATFORM_KV = { linux: 'linux', darwin: 'osx', win32: 'win' };
const NODE_PLATFORM_KV = { linux: 'linux', darwin: 'darwin', win32: 'win' };
const ARCH_KV = { x64: 'x64', arm64: 'arm64', ia32: 'ia32' };

const HOST_NW_PLATFORM = NW_PLATFORM_KV[process.platform];
const HOST_NODE_PLATFORM = NODE_PLATFORM_KV[process.platform];
const HOST_ARCH = ARCH_KV[process.arch];

const TARGET_NW_PLATFORM = args.platform || HOST_NW_PLATFORM;
const TARGET_ARCH = args.arch || HOST_ARCH;
const TARGET_NODE_PLATFORM = TARGET_NW_PLATFORM === 'osx' ? 'darwin' : TARGET_NW_PLATFORM;

// Normal NW.js flavor for distribution; SDK when DevTools are needed
const FLAVOR = process.env.FLAVOR || 'normal';
const LOCALES = (process.env.LOCALES || 'en-US').split(/\s+/).filter(Boolean);
const PACK = process.env.PACK === '1';
// A cross-built Windows bundle gets its target-native isolated install and
// Puppeteer browser on windows-latest. Never stage the Linux install graph.
const DEFER_TARGET_INSTALL = process.env.DEFER_TARGET_INSTALL === '1';

if (!TARGET_NW_PLATFORM || !TARGET_ARCH) {
  die(`Unsupported host platform/arch: ${process.platform}/${process.arch}`);
}

const BUNDLE_NAME = `lively.next-${TARGET_NW_PLATFORM}-${TARGET_ARCH}`;
const BUNDLE = path.join(DIST_DIR, BUNDLE_NAME);

// NW.js tarball naming differs by flavor:
//   Normal flavor: nwjs-vX.Y.Z-<platform>-<arch>
//   SDK flavor:    nwjs-sdk-vX.Y.Z-<platform>-<arch>
const NW_DIR_NAME = FLAVOR === 'normal'
  ? `nwjs-v${NW_VERSION}-${TARGET_NW_PLATFORM}-${TARGET_ARCH}`
  : `nwjs-${FLAVOR}-v${NW_VERSION}-${TARGET_NW_PLATFORM}-${TARGET_ARCH}`;
const NW_EXT = TARGET_NW_PLATFORM === 'linux' ? 'tar.gz' : 'zip';

// Node.js tarball naming:
const NODE_DIR_NAME = `node-v${NODE_VERSION}-${TARGET_NODE_PLATFORM}-${TARGET_ARCH}`;
const NODE_EXT = TARGET_NODE_PLATFORM === 'win' ? 'zip' : 'tar.xz';

const GIT_FOR_WINDOWS = {
  x64: {
    name: `Git-${GIT_FOR_WINDOWS_VERSION}-64-bit.tar.bz2`,
    sha256: process.env.LIVELY_GIT_FOR_WINDOWS_SHA256 || 'e1819cee60d09793dde322cdb1170e03663c41cd9265cf45246219fc5e6aeecd'
  },
  arm64: {
    name: `Git-${GIT_FOR_WINDOWS_VERSION}-arm64.tar.bz2`,
    sha256: process.env.LIVELY_GIT_FOR_WINDOWS_SHA256 || 'ce10b24c74ac9c724ab81e2ee30d06e7ee693977a552b8da4e434e909a641847'
  }
};

// ---------------------------------------------------------------------------
// Pretty logging
// ---------------------------------------------------------------------------

const ORANGE = '\x1b[1;38;5;208m';
const NC = '\x1b[0m';
const section = msg => console.log(`\n${ORANGE}── ${msg} ──${NC}`);
const step = msg => console.log(`   ${msg}`);
const die = msg => { console.error(`ERROR: ${msg}`); process.exit(1); };

// ---------------------------------------------------------------------------
// Downloads (streamed, follow redirects)
// ---------------------------------------------------------------------------

function download (url, dest) {
  const temporary = `${dest}.download-${process.pid}`;
  try {
    execFileSync('curl', [
      '--fail', '--location', '--proto', '=http,https',
      '--proto-redir', `=${new URL(url).protocol.slice(0, -1)}`,
      '--retry', '3', '--retry-all-errors',
      '--connect-timeout', '30', '--max-time', '600',
      '--speed-limit', '1024', '--speed-time', '60',
      '--output', temporary, url
    ], { stdio: 'inherit' });
    fs.renameSync(temporary, dest);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

// ---------------------------------------------------------------------------
// Archive extraction
// ---------------------------------------------------------------------------
// `tar` ships with all modern Linux/macOS/Windows (Windows since 1803 has
// bsdtar which handles .zip, .tar.gz, .tar.xz). `unzip` is common on Unix.

function extract (archive, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (archive.endsWith('.tar.gz') || archive.endsWith('.tgz')) {
    execFileSync('tar', ['xzf', archive, '-C', destDir], { stdio: 'inherit' });
  } else if (archive.endsWith('.tar.bz2') || archive.endsWith('.tbz2')) {
    execFileSync('tar', ['xjf', archive, '-C', destDir], { stdio: 'inherit' });
  } else if (archive.endsWith('.tar.xz')) {
    execFileSync('tar', ['xJf', archive, '-C', destDir], { stdio: 'inherit' });
  } else if (archive.endsWith('.zip')) {
    // Windows + macOS ship bsdtar that reads .zip; on Linux we prefer unzip
    if (process.platform === 'linux') {
      execFileSync('unzip', ['-q', '-o', archive, '-d', destDir], { stdio: 'inherit' });
    } else {
      execFileSync('tar', ['-xf', archive, '-C', destDir], { stdio: 'inherit' });
    }
  } else {
    die('Unknown archive format: ' + archive);
  }
}

// ---------------------------------------------------------------------------
// Caching wrapper: download once per version into dist/.cache/
// ---------------------------------------------------------------------------

async function fetchAndExtract (url, extractTo, flagFile) {
  if (fs.existsSync(flagFile)) return;
  const cacheDir = path.join(DIST_DIR, '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const archivePath = path.join(cacheDir, path.basename(url));
  if (!fs.existsSync(archivePath)) {
    step(`Downloading ${path.basename(url)}...`);
    await download(url, archivePath);
  } else {
    step(`(cached) ${path.basename(url)}`);
  }
  step(`Extracting to ${path.relative(ROOT_DIR, extractTo)}...`);
  extract(archivePath, extractTo);
  fs.writeFileSync(flagFile, 'ok');
}

async function fetchAndExtractVerified (url, extractTo, flagFile, sha256, cacheName = path.basename(url)) {
  if (fs.existsSync(flagFile)) return;
  const cacheDir = path.join(DIST_DIR, '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const archivePath = path.join(cacheDir, cacheName);
  if (!fs.existsSync(archivePath)) {
    step(`Downloading ${path.basename(url)}...`);
    await download(url, archivePath);
  } else {
    step(`(cached) ${path.basename(url)}`);
  }
  if (sha256) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
    if (actual !== sha256) die(`Checksum mismatch for ${path.basename(url)}: expected ${sha256}, got ${actual}`);
  }
  step(`Extracting to ${path.relative(ROOT_DIR, extractTo)}...`);
  extract(archivePath, extractTo);
  fs.writeFileSync(flagFile, 'ok');
}

// ---------------------------------------------------------------------------
// Recursive copy with exclude patterns (rsync replacement, pure Node)
// ---------------------------------------------------------------------------

// Patterns follow a simple subset of rsync/gitignore syntax:
//   '/foo/'     — anchored: only matches at the source root
//   'foo/'      — anywhere: matches any dir called foo/ at any depth
//   '**/bar/'   — anywhere (explicit form)
//   'foo/*.md'  — anywhere: matches *.md inside any foo/
// Each pattern is compiled to a RegExp over the POSIX-slash path relative
// to the copy source root.

function compilePattern (pat) {
  // Detect if the pattern matches a directory
  const isDir = pat.endsWith('/');
  const body = isDir ? pat.slice(0, -1) : pat;
  const anchored = body.startsWith('/');
  const parts = (anchored ? body.slice(1) : body).split('/');

  // Build a regex piece for each segment
  const segs = parts.map(seg => {
    if (seg === '**') return '(?:.+/)?';
    // escape + translate glob wildcards
    return seg
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
  });

  let rx = anchored ? '^' : '(?:^|/)';
  rx += segs.join('/');
  rx += isDir ? '(?:/|$)' : '$';
  return new RegExp(rx);
}

function makeFilter (patterns) {
  const regexes = patterns.map(compilePattern);
  return (relPath) => {
    const posix = relPath.split(path.sep).join('/');
    for (const r of regexes) {
      if (r.test(posix)) return false;   // excluded
      // also test for trailing slash (directory semantics)
      if (r.test(posix + '/')) return false;
    }
    return true;
  };
}

function pathIsInside (root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function copyMonorepo (src, dst, excludeFilter) {
  function walk (currentSrc, currentDst) {
    const ents = fs.readdirSync(currentSrc, { withFileTypes: true });
    for (const ent of ents) {
      const s = path.join(currentSrc, ent.name);
      const d = path.join(currentDst, ent.name);
      const rel = path.relative(src, s);
      if (!excludeFilter(rel)) continue;
      if (ent.isSymbolicLink()) {
        const sourceTarget = path.resolve(path.dirname(s), fs.readlinkSync(s));
        if (!pathIsInside(src, sourceTarget)) {
          throw new Error(`Refusing to package external symlink: ${s} -> ${sourceTarget}`);
        }
        const bundledTarget = path.join(dst, path.relative(src, sourceTarget));
        const link = path.relative(path.dirname(d), bundledTarget) || '.';
        fs.symlinkSync(link, d, fs.statSync(s).isDirectory() ? 'dir' : 'file');
      } else if (ent.isDirectory()) {
        fs.mkdirSync(d, { recursive: true });
        walk(s, d);
      } else if (ent.isFile()) {
        fs.copyFileSync(s, d);
        fs.chmodSync(d, fs.statSync(s).mode & 0o777);
      }
    }
  }
  fs.mkdirSync(dst, { recursive: true });
  walk(src, dst);
}

function assertSelfContainedSymlinks (root) {
  function walk (dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const entry = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) {
        const target = path.resolve(path.dirname(entry), fs.readlinkSync(entry));
        if (!pathIsInside(root, target) || !fs.existsSync(entry)) {
          throw new Error(`Packaged symlink escapes or is broken: ${entry} -> ${target}`);
        }
        const realTarget = fs.realpathSync(entry);
        if (!pathIsInside(root, realTarget)) {
          throw new Error(`Packaged symlink resolves outside bundle: ${entry} -> ${realTarget}`);
        }
      } else if (ent.isDirectory()) {
        walk(entry);
      }
    }
  }
  walk(root);
}

function materializeFileSymlinksAndRejectDirectorySymlinks (root) {
  function walk (dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const entry = path.join(dir, ent.name);
      if (ent.isSymbolicLink()) {
        const target = fs.realpathSync(entry);
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
          throw new Error(`Deferred target staging contains a directory symlink: ${entry} -> ${target}`);
        }
        fs.rmSync(entry, { force: true });
        fs.copyFileSync(target, entry);
        fs.chmodSync(entry, stat.mode & 0o777);
      } else if (ent.isDirectory()) walk(entry);
    }
  }
  walk(root);
}

// ---------------------------------------------------------------------------
// rm -rf
// ---------------------------------------------------------------------------

function rmrf (p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function dirSize (dir) {
  let total = 0;
  function walk (d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile()) {
        try { total += fs.statSync(p).size; } catch (_) {}
      }
    }
  }
  walk(dir);
  return total;
}

function humanSize (bytes) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < u.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${u[i]}`;
}

// ---------------------------------------------------------------------------
// Platform-specific launcher/layout
// ---------------------------------------------------------------------------

function finalizeLinux () {
  // launch.sh — terminal-friendly entry point
  fs.writeFileSync(path.join(BUNDLE, 'launch.sh'),
`#!/bin/bash
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$BUNDLE_DIR/nw" "$BUNDLE_DIR"
`, { mode: 0o755 });

  // freedesktop .desktop entry — double-click target
  fs.writeFileSync(path.join(BUNDLE, 'lively-next.desktop'),
`[Desktop Entry]
Type=Application
Version=1.0
Name=lively.next
Comment=Live, interactive development environment
Exec=%k/../launch.sh
Icon=%k/../icon.png
Terminal=false
Categories=Development;IDE;
StartupWMClass=lively.next
`, { mode: 0o755 });

  // Bundle-root icon for the .desktop file's Icon= field
  const pngIcon = path.join(APP_DIR, 'assets', 'icon.png');
  if (fs.existsSync(pngIcon)) fs.copyFileSync(pngIcon, path.join(BUNDLE, 'icon.png'));
}

function finalizeMacOS () {
  // Turn the bundle into a single self-contained .app: all our files live
  // inside nwjs.app/Contents/Resources/app.nw/ (where NW.js expects the app
  // payload), then rename nwjs.app → lively.next.app so one .app is the
  // entire distribution.
  //
  // Before:
  //   <bundle>/
  //     nwjs.app/                    ← just the NW.js runtime
  //     credits.html, ...            ← junk from the tarball
  //     package.json                 ← our NW.js manifest (wrong place!)
  //     boot.html
  //     desktop/
  //     app/
  //     node/
  //
  // After:
  //   <bundle>/
  //     lively.next.app/
  //       Contents/
  //         MacOS/nwjs                        ← runtime
  //         Resources/
  //           app.nw/                         ← our app payload
  //             package.json
  //             boot.html
  //             desktop/
  //             app/
  //             node/
  //           ...
  //         Info.plist                        ← patched metadata

  const nwjsApp = path.join(BUNDLE, 'nwjs.app');
  const appNw = path.join(nwjsApp, 'Contents', 'Resources', 'app.nw');
  fs.mkdirSync(appNw, { recursive: true });

  // Move our payload into Contents/Resources/app.nw/
  for (const f of ['package.json', 'boot.html', 'desktop', 'app', 'node', 'tools']) {
    const src = path.join(BUNDLE, f);
    if (fs.existsSync(src)) fs.renameSync(src, path.join(appNw, f));
  }

  // Strip the loose NW.js tarball junk so the bundle root is just the .app
  for (const f of fs.readdirSync(BUNDLE)) {
    if (f === 'nwjs.app') continue;
    rmrf(path.join(BUNDLE, f));
  }

  // App icon: copy lively.app/assets/icon.icns → Contents/Resources/app.icns
  // (matches the CFBundleIconFile value "app" we set below).
  const icnsSrc = path.join(APP_DIR, 'assets', 'icon.icns');
  if (fs.existsSync(icnsSrc)) {
    fs.copyFileSync(icnsSrc, path.join(nwjsApp, 'Contents', 'Resources', 'app.icns'));
    // Strip the stock nwjs icon so macOS doesn't fall back to it if
    // Info.plist resolution hiccups.
    const stock = path.join(nwjsApp, 'Contents', 'Resources', 'nw.icns');
    if (fs.existsSync(stock)) rmrf(stock);
  }

  // Patch Info.plist so macOS treats this as our app (not a generic NW.js
  // instance that would share state / keychain / crash reports) and
  // picks up our icon.
  const plist = path.join(nwjsApp, 'Contents', 'Info.plist');
  if (fs.existsSync(plist)) {
    let xml = fs.readFileSync(plist, 'utf8');
    xml = xml.replace(
      /<key>CFBundleIdentifier<\/key>\s*<string>[^<]*<\/string>/,
      '<key>CFBundleIdentifier</key><string>next.lively.app</string>');
    xml = xml.replace(
      /<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
      '<key>CFBundleName</key><string>lively.next</string>');
    xml = xml.replace(
      /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
      '<key>CFBundleDisplayName</key><string>lively.next</string>');
    xml = xml.replace(
      /<key>CFBundleIconFile<\/key>\s*<string>[^<]*<\/string>/,
      '<key>CFBundleIconFile</key><string>app</string>');
    fs.writeFileSync(plist, xml);
  }

  // Final rename: nwjs.app → lively.next.app
  fs.renameSync(nwjsApp, path.join(BUNDLE, 'lively.next.app'));

  // First-run help: an unsigned .app downloaded from the internet is
  // quarantined by Gatekeeper ("is damaged and can't be opened"). Ship a
  // tiny README next to the .app explaining the workaround until we set
  // up code-signing + notarization. See the "macOS code-signing" tracking
  // issue in the repo.
  fs.writeFileSync(path.join(BUNDLE, 'README-macOS.txt'),
`lively.next for macOS — first-run notice
==========================================

On first launch macOS may complain that "lively.next is damaged and
can't be opened". This is standard macOS Gatekeeper behavior for
apps downloaded from the internet that aren't code-signed with an
Apple Developer ID. The app is fine — it just needs the quarantine
attribute stripped.

One-shot fix (Terminal, from this folder):

    xattr -cr lively.next.app
    open lively.next.app

Alternative — GUI:

    1. Double-click lively.next.app (fails with the "damaged" dialog).
    2. Open System Settings → Privacy & Security.
    3. Scroll to the Security section — an "Open anyway" button
       appears for lively.next. Click it.
    4. Confirm in the follow-up dialog.

Once launched successfully once, subsequent double-clicks work normally.

We intentionally do not ship an executable "fix" helper next to the app:
macOS applies the same downloaded-file trust checks to helper scripts/apps
inside the archive, so they get blocked for the same reason.

This will go away once the project sets up Apple Developer code-
signing + notarization for its CI builds.
`);
}

function finalizeWindows () {
  // Rename nw.exe -> lively.next.exe so Windows shell shows the right name.
  const fromExe = path.join(BUNDLE, 'nw.exe');
  const toExe = path.join(BUNDLE, 'lively.next.exe');
  if (fs.existsSync(fromExe)) fs.renameSync(fromExe, toExe);

  // launch.bat — optional double-click launcher (users can also just click
  // lively.next.exe directly).
  fs.writeFileSync(path.join(BUNDLE, 'launch.bat'),
`@echo off
"%~dp0lively.next.exe" "%~dp0."
`);
}

async function stageGitForWindows () {
  if (TARGET_NW_PLATFORM !== 'win') return;

  const spec = GIT_FOR_WINDOWS[TARGET_ARCH];
  if (!spec) die(`No Git for Windows bundle configured for ${TARGET_ARCH}`);

  section(`Fetching Git for Windows v${GIT_FOR_WINDOWS_VERSION} for ${TARGET_ARCH}`);
  const gitCache = path.join(DIST_DIR, '.cache', 'git-for-windows', `${GIT_FOR_WINDOWS_VERSION}-${TARGET_ARCH}`);
  await fetchAndExtractVerified(
    `https://github.com/git-for-windows/git/releases/download/${GIT_FOR_WINDOWS_RELEASE}/${spec.name}`,
    gitCache,
    path.join(gitCache, '.extracted'),
    spec.sha256);

  step('Copying Git for Windows into bundle/tools/git...');
  const gitDst = path.join(BUNDLE, 'tools', 'git');
  rmrf(gitDst);
  copyMonorepo(gitCache, gitDst, makeFilter([
    '/.extracted',
    '/dev/',
    '/etc/mtab',
    '/mingw64/share/doc/',
    '/mingw64/share/man/',
    '/usr/share/doc/',
    '/usr/share/man/',
    '/usr/share/info/',
    '/usr/share/vim/',
    '/usr/share/git-gui/',
    '/usr/share/gitk/',
    '/usr/share/gitweb/'
  ]));
}

// ---------------------------------------------------------------------------
// Build steps
async function stageBun () {
  const platform = BUN_PLATFORM_KV[TARGET_NW_PLATFORM];
  const arch = BUN_ARCH_KV[TARGET_ARCH];
  const key = `${platform}-${arch}`;
  const sha256 = BUN_ASSETS[key];
  if (!platform || !arch || !sha256) {
    die(`No Bun ${BUN_VERSION} desktop binary configured for ${TARGET_NW_PLATFORM}-${TARGET_ARCH}`);
  }

  section(`Fetching Bun v${BUN_VERSION} for ${platform}-${arch}`);
  const archive = `bun-${platform}-${arch}.zip`;
  const bunCache = path.join(DIST_DIR, '.cache', 'bun', `${BUN_VERSION}-${key}`);
  await fetchAndExtractVerified(
    `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${archive}`,
    bunCache,
    path.join(bunCache, '.extracted'),
    sha256,
    `bun-${BUN_VERSION}-${platform}-${arch}.zip`);

  const binaryName = platform === 'windows' ? 'bun.exe' : 'bun';
  const source = path.join(bunCache, path.basename(archive, '.zip'), binaryName);
  if (!fs.existsSync(source)) die(`Bun archive did not contain ${source}`);
  const target = path.join(BUNDLE, 'tools', 'bun', 'bin', binaryName);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  if (platform !== 'windows') fs.chmodSync(target, 0o755);
}

// ---------------------------------------------------------------------------

async function main () {
  section(`Target: ${TARGET_NW_PLATFORM}-${TARGET_ARCH} (flavor: ${FLAVOR})`);
  step(`Bundle: ${BUNDLE}`);

  // Fresh bundle
  rmrf(BUNDLE);
  fs.mkdirSync(BUNDLE, { recursive: true });

  // -----------------------------------------------------------------------
  // 1. NW.js runtime
  // -----------------------------------------------------------------------
  section(`Fetching NW.js ${FLAVOR} v${NW_VERSION} for ${TARGET_NW_PLATFORM}-${TARGET_ARCH}`);
  const nwCache = path.join(DIST_DIR, '.cache', 'nw', `${NW_VERSION}-${FLAVOR}-${TARGET_NW_PLATFORM}-${TARGET_ARCH}-${NW_DOWNLOAD_BASE_KEY}`);
  await fetchAndExtract(
    `${NW_DOWNLOAD_BASE}/${NW_DIR_NAME}.${NW_EXT}`,
    nwCache,
    path.join(nwCache, '.extracted'));

  // Copy NW.js runtime contents into the bundle root
  const nwExtractedRoot = path.join(nwCache, NW_DIR_NAME);
  step('Copying NW.js runtime into bundle...');
  copyMonorepo(nwExtractedRoot, BUNDLE, () => true);

  // Strip Chromium locales — keep only what we asked for
  const localesDir = path.join(BUNDLE, 'locales');
  if (fs.existsSync(localesDir)) {
    step(`Stripping locales (keeping: ${LOCALES.join(', ')})`);
    for (const f of fs.readdirSync(localesDir)) {
      const keep = LOCALES.some(l => f === `${l}.pak` || f === `${l}.pak.info`);
      if (!keep) rmrf(path.join(localesDir, f));
    }
  }

  // -----------------------------------------------------------------------
  // 2. Standalone Node.js (for the server subprocess)
  // -----------------------------------------------------------------------
  section(`Fetching Node.js v${NODE_VERSION} for ${TARGET_NODE_PLATFORM}-${TARGET_ARCH}`);
  const nodeCache = path.join(DIST_DIR, '.cache', 'node', `${NODE_VERSION}-${TARGET_NODE_PLATFORM}-${TARGET_ARCH}`);
  await fetchAndExtract(
    `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIR_NAME}.${NODE_EXT}`,
    nodeCache,
    path.join(nodeCache, '.extracted'));

  step('Copying Node.js binary into bundle...');
  const nodeBinSrc = TARGET_NODE_PLATFORM === 'win'
    ? path.join(nodeCache, NODE_DIR_NAME, 'node.exe')
    : path.join(nodeCache, NODE_DIR_NAME, 'bin', 'node');
  const nodeBinDst = TARGET_NODE_PLATFORM === 'win'
    ? path.join(BUNDLE, 'node', 'node.exe')
    : path.join(BUNDLE, 'node', 'bin', 'node');
  fs.mkdirSync(path.dirname(nodeBinDst), { recursive: true });
  fs.copyFileSync(nodeBinSrc, nodeBinDst);
  if (TARGET_NODE_PLATFORM !== 'win') fs.chmodSync(nodeBinDst, 0o755);

  await stageGitForWindows();
  await stageBun();

  // -----------------------------------------------------------------------
  // 3. App manifest + desktop/ scripts + boot.html
  // -----------------------------------------------------------------------
  section('Copying app manifest + node-main scripts');
  const manifest = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
  delete manifest.dependencies;
  delete manifest.exports;
  delete manifest.scripts;
  manifest.version = APP_VERSION;
  manifest.main = 'boot.html';
  manifest['bg-script'] = 'desktop/background-menu.js';
  manifest['node-main'] = (process.env.LIVELY_APP_FUNCTION_SCOPES === '1' ? '--nw-node-inspector ' : '') + 'desktop/start-server.cjs';
  fs.writeFileSync(path.join(BUNDLE, 'package.json'), JSON.stringify(manifest, null, 2));

  fs.copyFileSync(path.join(APP_DIR, 'desktop', 'boot.html'),        path.join(BUNDLE, 'boot.html'));
  fs.mkdirSync(path.join(BUNDLE, 'desktop'), { recursive: true });
  for (const f of ['background-menu.js', 'start-server.cjs', 'watchdog.cjs', 'server-config.js', 'inject.js', 'inspector-service.cjs', 'inspector-service-runner.cjs', 'function-scopes.cjs', 'updates.cjs', 'velopack-helper.cjs', 'package-payload.cjs']) {
    fs.copyFileSync(path.join(APP_DIR, 'desktop', f), path.join(BUNDLE, 'desktop', f));
  }
  // Stamp the build SHA so boot.log identifies the exact commit, no more
  // "which bundle am I running?" confusion across CI reruns.
  const buildSha = process.env.LIVELY_APP_BUILD_SHA || '(local)';
  fs.writeFileSync(path.join(BUNDLE, 'desktop', 'build-info.json'),
    JSON.stringify({
      sha: buildSha,
      builtAt: new Date().toISOString(),
      version: APP_VERSION,
      updateChannel: APP_UPDATE_CHANNEL,
      updateUrl: APP_UPDATE_URL,
      nwVersion: NW_VERSION,
      nwDownloadBase: NW_DOWNLOAD_BASE,
      nodeVersion: NODE_VERSION,
      bunVersion: BUN_VERSION,
      ...(TARGET_NW_PLATFORM === 'win' ? { gitForWindowsVersion: GIT_FOR_WINDOWS_VERSION } : {}),
      platform: TARGET_NW_PLATFORM,
      arch: TARGET_ARCH
    }, null, 2));

  // -----------------------------------------------------------------------
  // 4. Monorepo content → bundle/app/
  // -----------------------------------------------------------------------
  section('Copying lively.next source + node_modules into bundle/app/');

  const excludes = [
    '/.git/',
    '/.claude/',
    '/.github/',
    '/dist/',
    '/tmp/',
    '/.module_cache/',
    '/local_projects/',
    '/custom-npm-modules/',
    // Ignore a stale pre-migration flatn install if one is left in the checkout.
    '/lively.next-node_modules/',
    '/lively.freezer/swc-plugin/target/',
    '/lively.freezer/swc-plugin/src/',
    '/lively.freezer/swc-plugin/Cargo.toml',
    '/lively.freezer/swc-plugin/Cargo.lock',
    '/lively.headless/chrome-data-dir/',
    '/lively.app/dist/',
    '/lively.app/boot.log'
  ];

  const requiredInputs = ['package.json', 'bun.lock', 'bunfig.toml', 'esm_cache'];
  if (!DEFER_TARGET_INSTALL) requiredInputs.push('node_modules', '.puppeteer-browser-cache');
  for (const required of requiredInputs) {
    if (!fs.existsSync(path.join(ROOT_DIR, required))) {
      die(`Missing ${required}; run the frozen install and browser cache build before desktop packaging`);
    }
  }
  if (!DEFER_TARGET_INSTALL && fs.readdirSync(path.join(ROOT_DIR, '.puppeteer-browser-cache')).length === 0) {
    die('Puppeteer browser cache is empty; run the frozen install with PUPPETEER_CACHE_DIR set before desktop packaging');
  }

  step('Copying monorepo (this may take a minute)...');
  const includeFile = makeFilter(excludes);
  copyMonorepo(ROOT_DIR, path.join(BUNDLE, 'app'), relative => {
    // Ignore stale cache paths from before portable filename encoding.
    const posix = relative.split(path.sep).join('/');
    const parts = posix.split('/');
    if (DEFER_TARGET_INSTALL &&
        (parts.includes('node_modules') || parts[0] === '.puppeteer-browser-cache')) return false;
    return includeFile(relative) && !(posix.startsWith('esm_cache/') && /[<>:"\\|?*]/.test(posix));
  });
  assertSelfContainedSymlinks(path.join(BUNDLE, 'app'));

  if (DEFER_TARGET_INSTALL) {
    step('Deferring target dependency install and package registry cache to the native runner...');
  } else {
    step('Pre-building package registry cache...');
    execFileSync(process.execPath, [
      '--experimental-import-meta-resolve',
      path.join(BUNDLE, 'app', 'lively.server', 'scripts', 'build-package-registry-cache.cjs')
    ], {
      cwd: path.join(BUNDLE, 'app'),
      stdio: 'inherit'
    });
  }

  // -----------------------------------------------------------------------
  // 5. Platform-specific launchers / layout
  // -----------------------------------------------------------------------
  section('Creating launchers');
  if (TARGET_NW_PLATFORM === 'linux') finalizeLinux();
  else if (TARGET_NW_PLATFORM === 'osx') finalizeMacOS();
  else if (TARGET_NW_PLATFORM === 'win') finalizeWindows();
  if (DEFER_TARGET_INSTALL) materializeFileSymlinksAndRejectDirectorySymlinks(BUNDLE);

  // -----------------------------------------------------------------------
  // 6. Report + optional pack
  // -----------------------------------------------------------------------
  section('Bundle complete');
  step(`Location: ${BUNDLE}`);
  step(`Size:     ${humanSize(dirSize(BUNDLE))}`);
  step('');
  if (TARGET_NW_PLATFORM === 'win') {
    step(`Run: double-click ${BUNDLE_NAME}\\lively.next.exe`);
  } else if (TARGET_NW_PLATFORM === 'osx') {
    step(`Run: double-click ${BUNDLE_NAME}/lively.next.app`);
  } else {
    step(`Run: double-click ${BUNDLE_NAME}/lively-next.desktop (file manager)`);
    step(`  or ${BUNDLE}/launch.sh (terminal)`);
  }

  if (PACK) {
    step('');
    if (TARGET_NW_PLATFORM === 'win') {
      const zipPath = path.join(DIST_DIR, `${BUNDLE_NAME}.zip`);
      step(`Packing ${path.basename(zipPath)}...`);
      // Host-dependent: Windows bsdtar and macOS bsdtar both recognize
      // `-a` for format-from-extension; GNU tar (Linux) does not and
      // needs us to call `zip` directly instead.
      if (process.platform === 'linux') {
        // zip is preinstalled on ubuntu-latest runners.
        execFileSync('zip', ['-r', '-q', zipPath, BUNDLE_NAME], { cwd: DIST_DIR, stdio: 'inherit' });
      } else {
        execFileSync('tar', ['-a', '-c', '-f', zipPath, '-C', DIST_DIR, BUNDLE_NAME], { stdio: 'inherit' });
      }
      step(`Archive: ${zipPath}`);
    } else {
      const tgzPath = path.join(DIST_DIR, `${BUNDLE_NAME}.tar.gz`);
      step(`Packing ${path.basename(tgzPath)}...`);
      execFileSync('tar', ['czf', tgzPath, '-C', DIST_DIR, BUNDLE_NAME], { stdio: 'inherit' });
      step(`Archive: ${tgzPath}`);
    }
  }
}

export {
  download,
  assertSelfContainedSymlinks,
  copyMonorepo,
  makeFilter,
  materializeFileSymlinksAndRejectDirectorySymlinks
};

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err); process.exit(1); });
}
