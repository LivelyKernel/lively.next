import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateImportMapForPackage, installDeps } from '../plugins/lib-lookup.js';
import { setFetch } from '@jspm/generator';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-browser-cache-'));
try {
  const manifest = path.join(root, 'package.json');
  const cacheFile = path.join(root, '.cachedImportMap.json');
  await fs.writeFile(manifest, JSON.stringify({ name: 'fixture', dependencies: {} }));
  const generated = await generateImportMapForPackage(root);
  assert.deepEqual(JSON.parse(await fs.readFile(cacheFile, 'utf8')), generated);
  assert.deepEqual(generated._dependencies, {});
  await assert.rejects(fs.access(path.join(root, 'browser-import-map.json')), { code: 'ENOENT' });
  const before = await fs.stat(cacheFile);
  const fetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('A valid cached map must not access the network'); };
  try { assert.deepEqual(await generateImportMapForPackage(root), generated); } finally { globalThis.fetch = fetch; }
  assert.equal((await fs.stat(cacheFile)).mtimeMs, before.mtimeMs);

  const dependencies = { 'lively.lang': 'workspace:*' };
  await fs.writeFile(manifest, JSON.stringify({ name: 'fixture', dependencies }));
  const refreshed = await generateImportMapForPackage(root);
  assert.deepEqual(refreshed._dependencies, dependencies);
  assert.deepEqual(JSON.parse(await fs.readFile(cacheFile, 'utf8')), refreshed);
  await fs.unlink(cacheFile);
  assert.deepEqual(await generateImportMapForPackage(root), refreshed);
  // Legacy hidden maps have no manifest or module-closure metadata.
  await fs.writeFile(cacheFile, JSON.stringify({ imports: {} }));
  assert.deepEqual(await generateImportMapForPackage(root), refreshed);
  const mappedUrl = 'https://ga.jspm.io/npm:map-fixture@1.0.0/load.js';
  const dependencyUrl = new URL('./dependency.js', mappedUrl).href;
  setFetch(async url => {
    if (String(url) === mappedUrl) return new Response('export { value } from "./dependency.js";');
    if (String(url) === dependencyUrl) return new Response('export const value = 42;');
    throw new Error('Unexpected generator request: ' + url);
  });
  try {
    await fs.writeFile(manifest, JSON.stringify({ name: 'fixture', dependencies,
      systemjs: { map: { loader: { node: 'map-fixture/load', '~node': mappedUrl.replace(/^https:/, 'esm:') } } } }));
    const mapped = await generateImportMapForPackage(root);
    assert(mapped._modules.includes(mappedUrl));
    assert(mapped._modules.includes(dependencyUrl));
    assert(mapped.integrity[mappedUrl.replace(/^https:/, 'esm:')]);
    setFetch(() => { throw new Error('A mapped module cache must not access the network'); });
    assert.deepEqual(await generateImportMapForPackage(root), mapped);
  } finally { setFetch(globalThis.fetch); }
  console.log('Hidden browser map generation, cache reuse, manifest refresh, and mapped module closure passed.');
} finally { await fs.rm(root, { recursive: true, force: true }); }

const installs = [];
const generator = {
  map: { imports: { eslint: 'implicit-peer-version' } },
  async install(specifier) { installs.push(specifier); },
  getMap() { return this.map; },
  async uninstall() {}
};
await installDeps(generator, [['eslint', '7.32.0'], ['@buxlabs/amd-to-es6', '0.16.3']], {}, {}, undefined, async () => []);
assert.deepEqual(installs, ['eslint@7.32.0']);
console.log('Explicit browser dependency pins override existing peer mappings.');
