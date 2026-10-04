#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { manifestName, preparePackagedSources, stagePackagedSources } from '../desktop/package-payload.cjs';

const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lively-payload-')));
const originalCache = process.env.LIVELY_APP_CACHE_DIR;
process.env.LIVELY_APP_CACHE_DIR = path.join(fixture, 'user cache');
const source = path.join(fixture, 'app');
try {
  for (const [owner, value] of [['lively.a', 'a'], ['lively.b', 'b']]) {
    const workspace = path.join(source, owner);
    const store = path.join(source, 'node_modules', '.bun', value, 'node_modules', 'dep');
    fs.mkdirSync(store, { recursive: true });
    fs.mkdirSync(path.join(workspace, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(store, 'package.json'), JSON.stringify({ name: 'dep', type: 'module', exports: './index.js' }));
    fs.writeFileSync(path.join(store, 'index.js'), `export default ${JSON.stringify(value)};`);
    fs.writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ name: owner }));
    fs.writeFileSync(path.join(workspace, '.cachedImportMap.json'), JSON.stringify({ imports: { dep: value } }));
    fs.symlinkSync(path.relative(path.join(workspace, 'node_modules'), store), path.join(workspace, 'node_modules', 'dep'), 'dir');
    for (const alias of ['cycle-a', 'cycle-b']) fs.symlinkSync('..', path.join(workspace, 'node_modules', alias), 'dir');
  }
  assert.equal(preparePackagedSources(source), source);
  const restore = await stagePackagedSources(source, fixture);
  try {
    assert.equal(fs.readdirSync(source).length, 2);
    fs.chmodSync(source, 0o555);
    for (const name of fs.readdirSync(source)) fs.chmodSync(path.join(source, name), 0o444);
    const before = fs.readdirSync(source);
    const prepared = preparePackagedSources(source);
    assert.deepEqual(fs.readdirSync(source), before);
    for (const [owner, value] of [['lively.a', 'a'], ['lively.b', 'b']]) {
      const workspace = path.join(prepared, owner);
      assert.equal(JSON.parse(fs.readFileSync(path.join(workspace, '.cachedImportMap.json'), 'utf8')).imports.dep, value);
      const require = createRequire(path.join(workspace, 'package.json'));
      const entry = require.resolve('dep');
      assert.equal((await import(pathToFileURL(entry).href)).default, value);
      const alias = path.join(workspace, 'node_modules', 'dep', 'index.js');
      assert.equal(await import(pathToFileURL(alias).href), await import(pathToFileURL(entry).href));
      assert.equal(fs.realpathSync(path.join(workspace, 'node_modules', 'cycle-a')), workspace);
    }
    fs.writeFileSync(path.join(prepared, 'retained-edit.txt'), 'live edit');
    assert.equal(preparePackagedSources(source), prepared);
    assert.equal(fs.readFileSync(path.join(prepared, 'retained-edit.txt'), 'utf8'), 'live edit');
  } finally {
    fs.chmodSync(source, 0o755);
    for (const name of fs.readdirSync(source)) fs.chmodSync(path.join(source, name), 0o644);
    restore();
  }
  assert.equal(fs.realpathSync(path.join(source, 'lively.a', 'node_modules', 'cycle-a')), path.join(source, 'lively.a'));
  const broken = path.join(fixture, 'broken payload');
  fs.mkdirSync(broken);
  fs.writeFileSync(path.join(broken, manifestName), JSON.stringify({ sha256: '../escape' }));
  assert.throws(() => preparePackagedSources(broken), /Invalid packaged source payload hash/);
  fs.writeFileSync(path.join(broken, manifestName), JSON.stringify({ sha256: 'f'.repeat(64) }));
  assert.throws(() => preparePackagedSources(broken));
  const payloadCache = path.join(process.env.LIVELY_APP_CACHE_DIR, 'package-payload');
  assert.equal(fs.readdirSync(payloadCache).some(name => name.startsWith('.extract-')), false);


  // The wrapper must restore raw sources even when the external packager fails.
  const platform = process.platform === 'darwin' ? 'osx' : 'linux';
  const bundle = path.join(fixture, 'bundle');
  const app = platform === 'osx' ? path.join(bundle, 'lively.next.app', 'Contents', 'Resources', 'app.nw', 'app') : path.join(bundle, 'app');
  fs.mkdirSync(path.dirname(app), { recursive: true });
  fs.cpSync(source, app, { recursive: true, verbatimSymlinks: true });
  const fake = path.join(fixture, 'fake-vpk');
  fs.writeFileSync(fake, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const pack = process.argv[process.argv.indexOf('--packDir') + 1];
const app = ${JSON.stringify(platform)} === 'osx' ? path.join(pack, 'Contents', 'Resources', 'app.nw', 'app') : path.join(pack, 'app');
if (!fs.existsSync(path.join(app, ${JSON.stringify(manifestName)}))) process.exit(99);
process.exit(23);
`);
  fs.chmodSync(fake, 0o755);
  const wrapper = fileURLToPath(new URL('./build-velopack.mjs', import.meta.url));
  const failed = spawnSync(process.execPath, [wrapper, `--platform=${platform}`, '--version=0.1.0', `--bundleDir=${bundle}`, `--outputDir=${fixture}/output`], { env: { ...process.env, VPK: fake }, encoding: 'utf8', timeout: 30000 });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /status: 23/);
  assert.equal(fs.existsSync(path.join(app, manifestName)), false);
  assert.equal(fs.realpathSync(path.join(app, 'lively.a', 'node_modules', 'cycle-a')), path.join(app, 'lively.a'));
  assert.equal(fs.readdirSync(fixture).some(name => name.startsWith('.velopack-source-')), false);
  console.log('Packaged payload preserves dependency identity, cyclic links, read-only sources, and failure cleanup.');
} finally {
  if (originalCache === undefined) delete process.env.LIVELY_APP_CACHE_DIR;
  else process.env.LIVELY_APP_CACHE_DIR = originalCache;
  fs.rmSync(fixture, { recursive: true, force: true });
}
