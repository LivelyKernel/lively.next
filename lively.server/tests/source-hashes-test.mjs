import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { string } from 'lively.lang';
import { resource } from 'lively.resources';
import { NodeJSFileResource } from 'lively.resources/src/fs-resource.js';
import { computeSourceHashes } from '../source-hashes.js';

const directory = await mkdtemp(join(tmpdir(), 'lively source hashes '));
const baseURL = pathToFileURL(directory + '/').href;
const packageDir = join(directory, 'lively.fixture');
await mkdir(packageDir);
for (let i = 0; i < 40; i++) await writeFile(join(packageDir, `${i}.js`), `export const value = ${i}; // λ\n`);

async function checkParallel (method, operation) {
  const original = NodeJSFileResource.prototype[method];
  let release, started, count = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const first = new Promise(resolve => { started = resolve; });
  NodeJSFileResource.prototype[method] = async function (...args) {
    count++;
    started();
    await gate;
    return original.apply(this, args);
  };
  const running = operation();
  try {
    await Promise.race([first, running]);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(count > 1 && count <= 16, `${method} serialized file I/O or exceeded the limit: ${count}`);
  } finally {
    release();
    await running.finally(() => { NodeJSFileResource.prototype[method] = original; });
  }
  return running;
}

try {
  await test('directory metadata loads concurrently and retains order and properties', async () => {
    const files = await checkParallel('stat', () => resource(pathToFileURL(packageDir + '/').href).dirList());
    assert.deepEqual(files.map(file => file.name()), await readdir(packageDir));
    assert.ok(files.every(file => file.isFile() && file.size > 0 && file.lastModified instanceof Date));
  });
  await test('source hashing reads concurrently and keeps fresh hashes and exclusions', async () => {
    const hashes = await checkParallel('read', () => computeSourceHashes(baseURL));
    assert.equal(Object.keys(hashes).length, 40);
    assert.equal(hashes['/lively.fixture/0.js'], string.hashCode('export const value = 0; // λ\n'));
    await mkdir(join(packageDir, 'node_modules'));
    await writeFile(join(packageDir, 'node_modules', 'ignored.js'), 'ignored');
    await writeFile(join(packageDir, 'ignored.txt'), 'ignored');
    await writeFile(join(packageDir, '0.js'), 'changed source');
    for (const output of ['landing-page', 'loading-screen']) {
      await mkdir(join(directory, 'lively.freezer', output), { recursive: true });
      await writeFile(join(directory, 'lively.freezer', output, 'bundle.js'), 'generated output');
    }
    await writeFile(join(directory, 'lively.freezer', 'source.js'), 'original source');
    const updated = await computeSourceHashes(baseURL);
    assert.equal(Object.keys(updated).length, 41);
    assert.equal(updated['/lively.fixture/0.js'], string.hashCode('changed source'));
    assert.equal(updated['/lively.freezer/source.js'], string.hashCode('original source'));
  });
  await test('parallel directory and source reads propagate filesystem failures', async () => {
    for (const [method, operation] of [
      ['stat', () => resource(pathToFileURL(packageDir + '/').href).dirList()],
      ['read', () => computeSourceHashes(baseURL)]
    ]) {
      const original = NodeJSFileResource.prototype[method];
      const error = Object.assign(new Error('filesystem probe failure'), { code: 'EACCES' });
      NodeJSFileResource.prototype[method] = function () { return Promise.reject(error); };
      try { await assert.rejects(operation(), err => err === error); }
      finally { NodeJSFileResource.prototype[method] = original; }
    }
  });
} finally { await rm(directory, { recursive: true, force: true }); }
