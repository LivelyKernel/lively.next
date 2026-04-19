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
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(APP_DIR, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const NW_VERSION = '0.110.1';
const NODE_VERSION = '25.6.1';

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
  return new Promise((resolve, reject) => {
    function attempt (u, redirects = 0) {
      if (redirects > 5) return reject(new Error('Too many redirects: ' + u));
      https.get(u, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          return attempt(new URL(res.headers.location, u).toString(), redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        const total = Number(res.headers['content-length']) || 0;
        let got = 0, lastPct = -1;
        const out = fs.createWriteStream(dest);
        res.on('data', chunk => {
          got += chunk.length;
          if (total) {
            const pct = Math.floor(got / total * 100);
            if (pct !== lastPct) {
              process.stdout.write(`\r   ${pct}%  `);
              lastPct = pct;
            }
          }
        });
        res.pipe(out);
        out.on('finish', () => { out.close(); process.stdout.write('\n'); resolve(); });
        out.on('error', reject);
      }).on('error', reject);
    }
    attempt(url);
  });
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

function copyMonorepo (src, dst, excludeFilter) {
  function walk (currentSrc, currentDst) {
    const ents = fs.readdirSync(currentSrc, { withFileTypes: true });
    for (const ent of ents) {
      const s = path.join(currentSrc, ent.name);
      const d = path.join(currentDst, ent.name);
      const rel = path.relative(src, s);
      if (!excludeFilter(rel)) continue;
      if (ent.isSymbolicLink()) {
        const link = fs.readlinkSync(s);
        try { fs.symlinkSync(link, d); } catch (_) {}
      } else if (ent.isDirectory()) {
        fs.mkdirSync(d, { recursive: true });
        walk(s, d);
      } else if (ent.isFile()) {
        fs.copyFileSync(s, d);
      }
    }
  }
  fs.mkdirSync(dst, { recursive: true });
  walk(src, dst);
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
  for (const f of ['package.json', 'boot.html', 'desktop', 'app', 'node']) {
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

// ---------------------------------------------------------------------------
// Build steps
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
  const nwCache = path.join(DIST_DIR, '.cache', 'nw', `${NW_VERSION}-${FLAVOR}-${TARGET_NW_PLATFORM}-${TARGET_ARCH}`);
  await fetchAndExtract(
    `https://dl.nwjs.io/v${NW_VERSION}/${NW_DIR_NAME}.${NW_EXT}`,
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

  // -----------------------------------------------------------------------
  // 3. App manifest + desktop/ scripts + boot.html
  // -----------------------------------------------------------------------
  section('Copying app manifest + node-main scripts');
  const manifest = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
  delete manifest.dependencies;
  delete manifest.exports;
  delete manifest.scripts;
  manifest.main = 'boot.html';
  manifest['node-main'] = 'desktop/start-server.cjs';
  fs.writeFileSync(path.join(BUNDLE, 'package.json'), JSON.stringify(manifest, null, 2));

  fs.copyFileSync(path.join(APP_DIR, 'desktop', 'boot.html'),        path.join(BUNDLE, 'boot.html'));
  fs.mkdirSync(path.join(BUNDLE, 'desktop'), { recursive: true });
  for (const f of ['start-server.cjs', 'watchdog.cjs', 'server-config.js', 'inject.js']) {
    fs.copyFileSync(path.join(APP_DIR, 'desktop', f), path.join(BUNDLE, 'desktop', f));
  }

  // -----------------------------------------------------------------------
  // 4. Monorepo content → bundle/app/
  // -----------------------------------------------------------------------
  section('Copying lively.next source + node_modules into bundle/app/');

  const crossPlatformNativeExcludes = (() => {
    // Strip native bindings from other platforms to save space.
    const patterns = [];
    const KEEP = {
      'linux-x64':    ['linux-x64'],
      'linux-arm64':  ['linux-arm64'],
      'osx-x64':      ['darwin-x64'],
      'osx-arm64':    ['darwin-arm64'],
      'win-x64':      ['win32-x64', 'win-x64'],
    };
    const keep = KEEP[`${TARGET_NW_PLATFORM}-${TARGET_ARCH}`] || [];
    const ALL = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'linux-x64-gnu', 'linux-x64-musl', 'linux-arm64-gnu', 'linux-arm64-musl', 'win32-x64', 'win32-x64-msvc'];
    for (const tag of ALL) {
      if (keep.some(k => tag.includes(k))) continue;
      patterns.push(`lively.next-node_modules/@swc__SLASH__core-${tag}/`);
      patterns.push(`lively.next-node_modules/@rollup__SLASH__rollup-${tag}/`);
    }
    return patterns;
  })();

  const excludes = [
    // Anchored (source-root-relative) — avoid stripping legit nested dirs
    // like systemjs/0.21.6/dist/ (that IS the package source).
    '/.git/',
    '/.claude/',
    '/.github/',
    '/dist/',
    '/esm_cache/',
    '/tmp/',
    '/.module_cache/',
    '/local_projects/',
    '/node_modules/',
    '/lively.freezer/swc-plugin/target/',
    '/lively.freezer/swc-plugin/src/',
    '/lively.freezer/swc-plugin/Cargo.toml',
    '/lively.freezer/swc-plugin/Cargo.lock',
    '/lively.next-node_modules/nw/',
    '/lively.next-node_modules/puppeteer/',
    '/lively.next-node_modules/puppeteer-core/',
    '/lively.next-node_modules/@puppeteer/',
    '/lively.headless/chrome-data-dir/',
    '/lively.app/dist/',
    '/lively.app/boot.log',
    // Anywhere
    '**/.cachedImportMap.json',
    // In-dep cruft
    'lively.next-node_modules/**/test/',
    'lively.next-node_modules/**/tests/',
    'lively.next-node_modules/**/__tests__/',
    'lively.next-node_modules/**/example/',
    'lively.next-node_modules/**/examples/',
    'lively.next-node_modules/**/docs/',
    'lively.next-node_modules/**/*.md',
    'lively.next-node_modules/**/*.markdown',
    'lively.next-node_modules/**/*.map',
    'lively.next-node_modules/**/.bin/',
    'lively.next-node_modules/**/CHANGELOG*',
    ...crossPlatformNativeExcludes,
  ];

  step('Copying monorepo (this may take a minute)...');
  copyMonorepo(ROOT_DIR, path.join(BUNDLE, 'app'), makeFilter(excludes));

  // -----------------------------------------------------------------------
  // 5. Platform-specific launchers / layout
  // -----------------------------------------------------------------------
  section('Creating launchers');
  if (TARGET_NW_PLATFORM === 'linux') finalizeLinux();
  else if (TARGET_NW_PLATFORM === 'osx') finalizeMacOS();
  else if (TARGET_NW_PLATFORM === 'win') finalizeWindows();

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

main().catch(err => { console.error(err); process.exit(1); });
