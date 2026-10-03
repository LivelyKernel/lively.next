import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nativeResolve } from '../src/node-resolver.js';
import { resolveViaImportMap } from '../src/import-map.js';

const root = await mkdtemp(join(tmpdir(), 'lively-native-resolver-'));
try {
const write = async (path, content) => { await mkdir(join(path, '..'), { recursive: true }); await writeFile(path, content); };
const pkg = async (path, json, files = {}) => {
  await write(join(path, 'package.json'), JSON.stringify(json));
  await Promise.all(Object.entries(files).map(([name, content]) => write(join(path, name), content)));
};
const parent = path => pathToFileURL(path).href;

await pkg(join(root, 'a', 'node_modules', 'dep'), { name: 'dep', version: '1.0.0', exports: './one.mjs' }, { 'one.mjs': 'export default 1;' });
await pkg(join(root, 'b', 'node_modules', 'dep'), { name: 'dep', version: '2.0.0', exports: './two.mjs' }, { 'two.mjs': 'export default 2;' });
await write(join(root, 'a', 'index.mjs'), '');
await write(join(root, 'b', 'index.mjs'), '');
assert.match(nativeResolve('dep', parent(join(root, 'a', 'index.mjs'))), /one\.mjs$/);
assert.match(nativeResolve('dep', parent(join(root, 'b', 'index.mjs'))), /two\.mjs$/);

await pkg(join(root, 'node_modules', 'conditional'), {
  name: 'conditional', version: '1.0.0', type: 'module',
  exports: { import: './esm.mjs', require: './cjs.cjs' }, imports: { '#private': './private.mjs' }
}, { 'esm.mjs': 'export default "esm";', 'cjs.cjs': 'module.exports = "cjs";', 'private.mjs': 'export default "private";' });
await write(join(root, 'source.mjs'), '');
const source = parent(join(root, 'source.mjs'));
assert.match(nativeResolve('conditional', source), /esm\.mjs$/);
assert.match(nativeResolve('conditional', source, 'require'), /cjs\.cjs$/);
assert.match(nativeResolve('#private', nativeResolve('conditional', source)), /private\.mjs$/);

await pkg(join(root, 'node_modules', 'alias'), { name: 'target', version: '1.0.0', exports: './index.mjs', type: 'module' }, { 'index.mjs': 'export const linked = true;' });
assert.match(nativeResolve('alias', source), /alias\/index\.mjs$/);
const linkedDir = join(root, 'node_modules', 'linked');
await symlink(join(root, 'node_modules', 'alias'), join(root, 'node_modules', 'linked'), 'dir');
const linked = await import(nativeResolve('linked', source));
const direct = await import(pathToFileURL(join(realpathSync(linkedDir), 'index.mjs')).href);
assert.equal(linked, direct);

await pkg(join(root, 'peer-a', 'node_modules', 'shared'), { name: 'shared', version: '1.0.0', exports: './index.mjs' }, { 'index.mjs': 'export default "a";' });
await pkg(join(root, 'peer-b', 'node_modules', 'shared'), { name: 'shared', version: '1.0.0', exports: './index.mjs' }, { 'index.mjs': 'export default "b";' });
await write(join(root, 'peer-a', 'index.mjs'), '');
await write(join(root, 'peer-b', 'index.mjs'), '');
assert.notEqual(nativeResolve('shared', parent(join(root, 'peer-a', 'index.mjs'))), nativeResolve('shared', parent(join(root, 'peer-b', 'index.mjs'))));

const map = { imports: { 'dep/': 'https://cdn.example/dep/' }, scopes: { 'https://app.example/a/': { dep: 'https://cdn.example/a.js' } } };
assert.equal(resolveViaImportMap('dep', map, 'https://app.example/a/source.js'), 'https://cdn.example/a.js');
assert.equal(resolveViaImportMap('dep/sub.js', map, 'https://app.example/b/source.js'), 'https://cdn.example/dep/sub.js');
assert.equal(resolveViaImportMap('missing', map, 'https://app.example/b/source.js'), undefined);
assert.equal(resolveViaImportMap('./unmapped.js', map, 'https://app.example/b/source.js'), undefined);
assert.throws(() => resolveViaImportMap('blocked', { imports: { blocked: null } }, 'https://app.example/b/source.js'), /blocks blocked/);
assert.equal(resolveViaImportMap('blocked', {
  imports: { blocked: null },
  scopes: { 'https://app.example/allowed/': { blocked: 'https://cdn.example/allowed.js' } }
}, 'https://app.example/allowed/source.js'), 'https://cdn.example/allowed.js');
assert.equal(resolveViaImportMap('dep', { scopes: { 'https://app.example/a/': { dep: 'https://cdn.example/a.js' } } }, 'esm://app.example/a/source.js'), 'https://cdn.example/a.js');
// Cached normalization must preserve relative bases and observe live map edits.
const relativeMap = { imports: { dep: './one.js' } };
assert.equal(resolveViaImportMap('dep', relativeMap, 'https://app.example/a/source.js'), 'https://app.example/a/one.js');
assert.equal(resolveViaImportMap('dep', relativeMap, 'https://app.example/b/source.js'), 'https://app.example/b/one.js');
relativeMap._mapUrl = 'https://app.example/maps/map.json';
assert.equal(resolveViaImportMap('dep', relativeMap, 'https://app.example/a/source.js'), 'https://app.example/maps/one.js');
relativeMap.imports.dep = './two.js';
assert.equal(resolveViaImportMap('dep', relativeMap, 'https://app.example/a/source.js'), 'https://app.example/maps/two.js');
relativeMap.scopes = { 'https://app.example/a/': { dep: './scoped.js' } };
assert.equal(resolveViaImportMap('dep', relativeMap, 'https://app.example/a/source.js'), 'https://app.example/maps/scoped.js');
relativeMap.scopes['https://app.example/a/'].dep = null;
assert.throws(() => resolveViaImportMap('dep', relativeMap, 'https://app.example/a/source.js'), /blocks dep/);
assert.equal(resolveViaImportMap('dep', JSON.parse(JSON.stringify(relativeMap)), 'https://app.example/b/source.js'), 'https://app.example/maps/two.js');
console.log('native resolver fixture passed');
} finally {
  await rm(root, { recursive: true, force: true });
}
