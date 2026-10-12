import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setFetch } from '@jspm/generator';
import { generateImportMapForPackage, installDeps } from '../plugins/lib-lookup.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-browser-cache-'));
try {
  const manifest = path.join(root, 'package.json');
  const cacheFile = path.join(root, '.cachedImportMap.json');
  await fs.writeFile(manifest, JSON.stringify({ name: 'fixture', dependencies: {} }));
  const generated = await generateImportMapForPackage(root);
  assert.equal(generated._cacheVersion, 2);
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
  const oldCache = { ...refreshed, _modules: ['incomplete-old-graph'] };
  delete oldCache._cacheVersion;
  await fs.writeFile(cacheFile, JSON.stringify(oldCache));
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
  console.log('Hidden browser map generation, cache reuse, manifest refresh, cache removal, and mapped module closure passed.');
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

const templateRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-template-import-'));
const fixtureUrl = 'https://ga.jspm.io/npm:template-import-fixture@1.0.0/';
const katexUrl = 'https://ga.jspm.io/npm:katex@1.0.0/';
const source = [
  'export { value } from "./static.js";',
  'export * from "./assertions.js";',
  'export * from "./decorators.js";',
  'export * from "./source-phase.js";',
  'export * from "./unsupported-syntax.js";',
  'export const bare = () => import(`ka\\u0074ex`);',
  'export const duplicate = () => import(`katex`);',
  'export const relative = () => import(/* constant */ `./relative.js`);',
  'export const quoted = () => import("./quoted.js");',
  'export const computed = name => import(`./${name}.js`);',
  '// import(`comment-only`);',
  '/* import(`block-comment-only`); */',
  'export const text = "import(`string-only`)";',
  'export const template = `import(\\`template-only\\`)`;'
].join('\n');
const files = new Map([
  [fixtureUrl.slice(0, -1), '1.0.0'],
  [fixtureUrl + 'package.json', JSON.stringify({
    name: 'template-import-fixture', version: '1.0.0', type: 'module',
    exports: './index.js', dependencies: { katex: '1.0.0' }
  })],
  [fixtureUrl + 'index.js', source],
  [fixtureUrl + 'static.js', 'export const value = 1;'],
  [fixtureUrl + 'quoted.js', 'export default 2;'],
  [fixtureUrl + 'relative.js', 'export const nested = () => import(`./relative-leaf.js`);'],
  [fixtureUrl + 'relative-leaf.js', 'export default 3;'],
  [fixtureUrl + 'assertions.js', 'import data from "./asserted.json" assert { type: "json" }; export const assertionValue = data.value; export const assertionLoad = () => import(`./assertion-leaf.js`);'],
  [fixtureUrl + 'asserted.json', '{"value":5}'],
  [fixtureUrl + 'decorators.js', 'const sealed = value => value; @sealed export class Decorated {} export const decoratorLoad = () => import(`./decorator-leaf.js`);'],
  [fixtureUrl + 'source-phase.js', 'import source bytes from "./static.js"; export const sourceValue = bytes; export const sourceLoad = () => import(`./source-phase-leaf.js`);'],
  [fixtureUrl + 'unsupported-syntax.js', 'import "./static.js"; export const pipeline = 1 |> double; export const marker = `import`; export const quotedLoad = () => import("./unsupported-leaf.js");'],
  [fixtureUrl + 'assertion-leaf.js', 'export default 6;'],
  [fixtureUrl + 'decorator-leaf.js', 'export default 7;'],
  [fixtureUrl + 'source-phase-leaf.js', 'export default 8;'],
  [fixtureUrl + 'unsupported-leaf.js', 'export default 9;'],
  [katexUrl.slice(0, -1), '1.0.0'],
  ['https://ga.jspm.io/npm:katex', '1.0.0'],
  [katexUrl + 'package.json', JSON.stringify({ name: 'katex', version: '1.0.0', type: 'module', exports: './index.js' })],
  [katexUrl + 'index.js', 'export { default } from "./leaf.js";'],
  [katexUrl + 'leaf.js', 'export default 4;']
]);
const nativeFetch = globalThis.fetch;
const fixtureFetch = async (url) => {
  url = String(url);
  assert(files.has(url), `Unexpected network request: ${url}`);
  return new Response(files.get(url));
};
setFetch(fixtureFetch);
globalThis.fetch = fixtureFetch;
try {
  await fs.writeFile(path.join(templateRoot, 'package.json'), JSON.stringify({
    name: 'template-import-test', dependencies: { 'template-import-fixture': '1.0.0' }
  }));
  const map = await generateImportMapForPackage(templateRoot);
  const clientUrl = url => url.replace('https://', 'esm://');
  const scope = Object.entries(map.scopes || {}).find(([url, mappings]) =>
    clientUrl(fixtureUrl + 'index.js').startsWith(url) && mappings.katex);
  assert(scope, 'The constant bare import must have a mapping in its importer scope');
  assert.equal(scope[1].katex, clientUrl(katexUrl + 'index.js'));
  assert.deepEqual(Object.keys(map.imports), ['template-import-fixture']);
  assert.deepEqual(map._modules, [
    fixtureUrl + 'index.js', fixtureUrl + 'static.js', fixtureUrl + 'quoted.js',
    fixtureUrl + 'relative.js', fixtureUrl + 'relative-leaf.js',
    fixtureUrl + 'assertions.js', fixtureUrl + 'asserted.json', fixtureUrl + 'decorators.js',
    fixtureUrl + 'source-phase.js', fixtureUrl + 'assertion-leaf.js',
    fixtureUrl + 'decorator-leaf.js', fixtureUrl + 'source-phase-leaf.js',
    fixtureUrl + 'unsupported-syntax.js', fixtureUrl + 'unsupported-leaf.js',
    katexUrl + 'index.js', katexUrl + 'leaf.js'
  ].sort());
  assert.equal(map.integrity[clientUrl(fixtureUrl + 'index.js')],
    'sha384-' + createHash('sha384').update(source).digest('base64'));
  for (const name of ['assertions.js', 'decorators.js', 'source-phase.js', 'unsupported-syntax.js']) {
    assert.equal(map.integrity[clientUrl(fixtureUrl + name)],
      'sha384-' + createHash('sha384').update(files.get(fixtureUrl + name)).digest('base64'));
  }
  console.log('Constant template import scopes, recursive closure, cooked escapes, source integrity, and ignored expressions passed offline.');
  console.log('Import assertions, decorators, source-phase imports, and unrecognized Babel syntax preserve successful JSPM graphs.');
  // Installation generates maps through the live loader, whose CJS namespaces differ from native imports.
  const { default: nodeSystem } = await import('systemjs');
  const { setupSystem } = await import('lively.installer/install.js');
  globalThis.System = nodeSystem;
  const installerSystem = await setupSystem(new URL('../../', import.meta.url).href);
  const installerJspm = await installerSystem.import('@jspm/generator', new URL('../plugins/lib-lookup.js', import.meta.url).href);
  installerJspm.setFetch(fixtureFetch);
  const installerLookup = await installerSystem.import('lively.server/plugins/lib-lookup.js');
  await fs.writeFile(path.join(templateRoot, '.cachedImportMap.json'), JSON.stringify({
    imports: map.imports, _dependencies: map._dependencies,
    _modules: ['incomplete-installer-graph'], _cacheVersion: 1
  }));
  assert.deepEqual(await installerLookup.generateImportMapForPackage(templateRoot), map);
  console.log('Installer SystemJS and native generation discover the same constant-template dependency graph offline.');
  const cacheFile = path.join(templateRoot, '.cachedImportMap.json');
  const successfulCache = await fs.readFile(cacheFile, 'utf8');
  for (const [name, invalidSource] of [
    ['broken-analysis-fixture', 'export const broken = import('],
    ['broken-fetch-fixture', 'import "./missing.js"; export const marker = `import`;']
  ]) {
    const url = `https://ga.jspm.io/npm:${name}@1.0.0/`;
    files.set(url.slice(0, -1), '1.0.0');
    files.set(url + 'package.json', JSON.stringify({ name, version: '1.0.0', type: 'module', exports: './index.js' }));
    files.set(url + 'index.js', invalidSource);
    await fs.writeFile(path.join(templateRoot, 'package.json'), JSON.stringify({
      name: 'template-import-test', dependencies: { [name]: '1.0.0' }
    }));
    await assert.rejects(generateImportMapForPackage(templateRoot, { update: true }), {
      message: `Cannot generate browser import map for template-import-test: ${name}`
    });
    assert.equal(await fs.readFile(cacheFile, 'utf8'), successfulCache);
  }
  console.log('Original JSPM analysis and fetch failures still reject generation and preserve the previous cache.');
} finally {
  setFetch(nativeFetch);
  globalThis.fetch = nativeFetch;
  await fs.rm(templateRoot, { recursive: true, force: true });
}
