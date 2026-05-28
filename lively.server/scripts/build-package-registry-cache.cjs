#!/usr/bin/env node
// Pre-builds the package registry that lively.installer.setupSystem normally
// discovers by scanning every package directory on server startup.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const rootDir = path.resolve(__dirname, '..', '..');
const outFile = path.join(__dirname, '..', '.package-registry-cache.json');
const childEnvFlag = 'LIVELY_BUILD_PACKAGE_REGISTRY_CACHE_CHILD';

function setupFlatnEnv () {
  const pkgs = JSON.parse(fs.readFileSync(
    path.join(rootDir, 'lively.installer/packages-config.json'), 'utf8'));
  const devDirs = pkgs
    .map(p => path.join(rootDir, p.name))
    .filter(d => fs.existsSync(d));

  process.env.FLATN_PACKAGE_COLLECTION_DIRS = [
    path.join(rootDir, 'lively.next-node_modules'),
    path.join(rootDir, 'custom-npm-modules')
  ].filter(d => fs.existsSync(d)).join(path.delimiter);
  process.env.FLATN_DEV_PACKAGE_DIRS = devDirs.join(path.delimiter);
  process.env.FLATN_PACKAGE_DIRS = '';
  process.env.FLATN_DISABLE_WATCH = '1';
  process.env.LIVELY_DISABLE_PACKAGE_REGISTRY_CACHE = '1';
  delete process.env.LIVELY_PACKAGE_REGISTRY_CACHE_FILE;
  delete process.env.LIVELY_PACKAGE_REGISTRY_CACHE_KEY;
  delete process.env.LIVELY_PACKAGE_REGISTRY_SEED_FILE;
}

function runChildWithFlatnLoader () {
  setupFlatnEnv();
  const nodeBin = process.execPath;
  const result = spawnSync(nodeBin, [
    '-r', path.join(rootDir, 'flatn', 'resolver.cjs'),
    '--experimental-loader', pathToFileURL(path.join(rootDir, 'flatn', 'resolver.mjs')).href,
    __filename
  ], {
    cwd: rootDir,
    env: {
      ...process.env,
      [childEnvFlag]: '1',
      LIVELY_REAL_NODE_EXEC_PATH: nodeBin
    },
    stdio: 'inherit'
  });

  if (result.error) {
    console.error('[build-package-registry-cache] failed:', result.error);
    process.exit(1);
  }
  if (result.signal) {
    console.error(`[build-package-registry-cache] child exited with signal ${result.signal}`);
    process.exit(1);
  }
  process.exit(result.status || 0);
}

async function buildCache () {
  setupFlatnEnv();
  if (process.env.LIVELY_REAL_NODE_EXEC_PATH) {
    process.execPath = process.env.LIVELY_REAL_NODE_EXEC_PATH;
    process.argv[0] = process.env.LIVELY_REAL_NODE_EXEC_PATH;
  }

  const System = require('systemjs');
  global.System = System;

  const { setupSystem } = await import('lively.installer');
  const livelySystem = await setupSystem(rootDir);
  const registry = livelySystem.get('@lively-env').packageRegistry;
  const registryJSON = registry.toJSON();
  const packageCount = Object.keys(registryJSON.packageMap || {}).length;

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({
    format: 'lively-package-registry-cache-v1',
    createdAt: new Date().toISOString(),
    registry: registryJSON
  }, null, 2));

  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`[build-package-registry-cache] wrote ${outFile} (${packageCount} packages, ${sizeKb} KB)`);
}

if (process.env[childEnvFlag] !== '1') {
  runChildWithFlatnLoader();
} else {
  buildCache().catch(err => {
    console.error('[build-package-registry-cache] failed:', err && err.stack || err);
    process.exit(1);
  });
}
