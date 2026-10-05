import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { rollup } from '@rollup/wasm-node';
import { lively } from '../src/plugins/rollup.js';
import LivelyRollup from '../src/bundler.js';
import resolver from '../src/resolvers/node.cjs';
import { installProjectDependencies } from 'lively.project/package-install.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runtimeRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'project runtime with spaces-')));
const directory = path.join(runtimeRoot, 'local_projects', `bun-bundle-test-${process.pid}`);
const previousCwd = process.cwd();
const previousRuntimeRoot = process.env.lv_next_dir;
let build;
try {
  const config = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  await fs.writeFile(path.join(runtimeRoot, 'package.json'), JSON.stringify(config));
  for (const workspace of config.workspaces) await fs.symlink(path.join(root, workspace), path.join(runtimeRoot, workspace), process.platform === 'win32' ? 'junction' : 'dir');
  process.env.lv_next_dir = runtimeRoot;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({
    name: `bun-bundle-test-${process.pid}`, version: '1.0.0', type: 'module', dependencies: { 'is-number': '6.0.0' }
  }));
  await fs.writeFile(path.join(directory, 'index.js'), "import isNumber from 'is-number'; export const answer = isNumber(42); export class Fixture { value () { return answer; } }\n");
  await fs.writeFile(path.join(directory, 'index.css'), '.project-fixture { color: red; }');
  await fs.writeFile(path.join(directory, 'fonts.css'), '');
  await fs.mkdir(path.join(directory, 'assets'), { recursive: true });
  await installProjectDependencies(directory, { update: true });
  const lock = await fs.readFile(path.join(directory, 'bun.lock'), 'utf8');
  await installProjectDependencies(directory);
  assert.equal(resolver.resolvePackage(path.join(directory, 'index.js')).systemjs.importMap._mapUrl,
    pathToFileURL(path.join(directory, '.cachedImportMap.json')).href);
  process.chdir(directory);
  const bundler = new LivelyRollup({ resolver });
  assert.equal(bundler.resolveId('lively.classes/runtime.js', path.join(directory, 'index.js')),
    resolver.resolveModuleId('lively.classes/runtime.js'));
  assert.equal(bundler.normalizedId(path.join(root, 'lively.morphic', 'lively-world.js').replace(/\\/g, '/')),
    'lively.morphic/lively-world.js');
  const assetBundler = new LivelyRollup({ resolver: { ...resolver, detectFormatFromSource: () => 'global' }, minify: false });
  for (const separator of ['/', '\\']) {
    const id = ['C:', 'runtime', 'local_projects', 'fixture', 'index.js'].join(separator);
    const transformed = await assetBundler.transform("globalThis.asset = projectAsset('logo.svg');", id);
    const code = typeof transformed === 'string' ? transformed : transformed.code;
    assert.equal(runInNewContext(code, { projectAsset: name => name }), 'fixture__logo.svg');
  }
  build = await rollup({ input: path.join(directory, 'index.js'), plugins: [lively({ resolver, minify: false, asBrowserModule: true })] });
  const { output } = await build.generate({ format: 'esm' });
  assert.ok(output.some(chunk => chunk.type === 'chunk' && Object.keys(chunk.modules).some(id => id.includes('is-number@6.0.0'))));
  assert.ok(output.some(asset => asset.fileName === 'assets/bundle.css' && asset.source.includes('.project-fixture')));
  assert.equal(await fs.readFile(path.join(directory, 'bun.lock'), 'utf8'), lock);
  console.log('Project bundle consumes its generated browser import map.');
} finally {
  if (previousRuntimeRoot === undefined) delete process.env.lv_next_dir;
  else process.env.lv_next_dir = previousRuntimeRoot;
  process.chdir(previousCwd);
  await build?.close();
  resolver.finish();
  await fs.rm(runtimeRoot, { recursive: true, force: true });
}
