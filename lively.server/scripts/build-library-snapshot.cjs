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
const { pipeline } = require('node:stream/promises');

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

async function buildLibrarySnapshot (rootDir = path.resolve(__dirname, '..', '..'),
  outFile = path.join(rootDir, 'lively.server', '.library-snapshot.tar.gz')) {
  // esm_cache is created lazily, so include only directories already present.
  const presentDirs = cachedDirs.filter(d => fs.existsSync(path.join(rootDir, d)));
  console.log(`[build-library-snapshot] packing ${presentDirs.length}/${cachedDirs.length} dirs from ${rootDir}`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await pipeline(tar.pack(rootDir, {
    ignore: name => excludedDirs.some(p => name.includes(p)),
    entries: presentDirs
  }), zlib.createGzip(), fs.createWriteStream(outFile));
  const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
  console.log(`[build-library-snapshot] wrote ${outFile} (${mb} MB)`);
  return outFile;
}

module.exports = { buildLibrarySnapshot };
if (require.main === module) buildLibrarySnapshot().catch(err => {
  console.error('[build-library-snapshot] failed:', err);
  process.exitCode = 1;
});
