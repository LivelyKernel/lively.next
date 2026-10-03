#!/usr/bin/env node
// Pre-builds the library snapshot that LivelyDAVPlugin.compressLibraryCode
// normally regenerates on every server startup (tar + gzip of ~28 lively
// package directories, several seconds of work). Running this once at
// build time and shipping the resulting .library-snapshot.tar.gz inside
// the bundle cuts server startup time significantly.
//
// Keep the cachedDirs / excludedDirs lists in sync with dav.js manually
// for now — extracting them into a shared module would require either
// inlining them via a build step

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const rootDir = path.resolve(__dirname, '..', '..');
const outFile = path.join(__dirname, '..', '.library-snapshot.tar.gz');

const tar = require('tar-fs');

// Must match LivelyDAVPlugin.compressLibraryCode in lively.server/plugins/dav.js
const cachedDirs = [
  'esm_cache',
  'lively.morphic', 'lively.lang', 'lively.bindings', 'lively.ast',
  'lively.source-transform', 'lively.classes', 'lively.vm', 'lively.resources',
  'lively.storage', 'lively.notifications', 'lively.modules',
  'lively-system-interface', 'lively.installer', 'lively.serializer2',
  'lively.graphics', 'lively.keyboard', 'lively.changesets', 'lively.2lively',
  'lively.git', 'lively.traits', 'lively.components', 'lively.ide',
  'lively.headless', 'lively.freezer', 'lively.collab', 'lively.project',
  'lively.user'
];

const excludedDirs = [
  'lively.morphic/objectdb',
  'lively.morphic/assets',
  'lively.morphic/web',
  'lively.ast/dist',
  'lively.classes/build',
  'lively.ide/jsdom.worker.js',
  'lively.headless/chrome-data-dir',
  'lively.freezer/landing-page',
  'lively.freezer/loading-screen',
  'lively.freezer/.swc',
  'lively.freezer/swc-plugin/target',
  'lively.modules/dist'
];

// Only include cachedDirs that actually exist on disk (esm_cache is created
// lazily by the server, so may be missing in CI).
const presentDirs = cachedDirs.filter(d => fs.existsSync(path.join(rootDir, d)));
console.log(`[build-library-snapshot] packing ${presentDirs.length}/${cachedDirs.length} dirs from ${rootDir}`);
if (presentDirs.length < cachedDirs.length) {
  const missing = cachedDirs.filter(d => !presentDirs.includes(d));
  console.log(`[build-library-snapshot]   missing (skipped): ${missing.join(', ')}`);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });

tar.pack(rootDir, {
  ignore (name) {
    return excludedDirs.some(p => name.includes(p));
  },
  entries: presentDirs
}).pipe(zlib.Gzip()).pipe(fs.createWriteStream(outFile))
  .on('finish', () => {
    const size = fs.statSync(outFile).size;
    const mb = (size / 1024 / 1024).toFixed(1);
    console.log(`[build-library-snapshot] wrote ${outFile} (${mb} MB)`);
  })
  .on('error', err => {
    console.error('[build-library-snapshot] failed:', err);
    process.exit(1);
  });
