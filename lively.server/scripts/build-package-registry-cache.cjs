#!/usr/bin/env node
// Pre-builds the package registry that lively.installer.setupSystem normally
// discovers by scanning every package directory on server startup.

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const rootDir = path.resolve(__dirname, '..', '..');
const outFile = path.join(__dirname, '..', '.package-registry-cache.json');
async function buildCache () {
  process.env.LIVELY_DISABLE_PACKAGE_REGISTRY_CACHE = "1";

  const System = require('systemjs');
  global.System = System;

  const { setupSystem } = await import('lively.installer');
  const livelySystem = await setupSystem(pathToFileURL(`${rootDir}${path.sep}`).href);
  const registry = livelySystem.get('@lively-env').packageRegistry;
  const registryJSON = registry.toJSON();
  const packageCount = Object.keys(registryJSON.packageMap || {}).length;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({
    format: 'lively-package-registry-cache-v2',
    createdAt: new Date().toISOString(),
    registry: registryJSON
  }, null, 2));

  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`[build-package-registry-cache] wrote ${outFile} (${packageCount} packages, ${sizeKb} KB)`);
}

buildCache().catch(err => {
  console.error('[build-package-registry-cache] failed:', err && err.stack || err);
  process.exit(1);
});
