import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rollup } from '@rollup/wasm-node';
import { lively } from '../src/plugins/rollup.js';
import LivelyRollup from '../src/bundler.js';
import resolver from '../src/resolvers/node.cjs';
import { installProjectDependencies } from 'lively.project/package-install.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(root, 'local_projects', `bun-bundle-test-${process.pid}`);
const previousCwd = process.cwd();
let build;
try {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({
    name: `bun-bundle-test-${process.pid}`, version: '1.0.0', type: 'module', dependencies: { 'is-number': '6.0.0' }
  }));
  await fs.writeFile(path.join(directory, 'index.js'), "import isNumber from 'is-number'; export const answer = isNumber(42);\n");
  for (const name of ['index.css', 'fonts.css']) await fs.writeFile(path.join(directory, name), '');
  await fs.mkdir(path.join(directory, 'assets'), { recursive: true });
  await installProjectDependencies(directory, { update: true });
  const lock = await fs.readFile(path.join(directory, 'bun.lock'), 'utf8');
  await installProjectDependencies(directory);
  assert.equal(resolver.resolvePackage(path.join(directory, 'index.js')).systemjs.importMap._mapUrl,
    pathToFileURL(path.join(directory, '.cachedImportMap.json')).href);
  process.chdir(directory);
  const bundler = new LivelyRollup({ resolver });
  assert.equal(bundler.normalizedId(path.join(root, 'lively.morphic', 'lively-world.js').replace(/\\/g, '/')),
    'lively.morphic/lively-world.js');
  build = await rollup({ input: path.join(directory, 'index.js'), plugins: [lively({ resolver, minify: false, asBrowserModule: true })] });
  const { output } = await build.generate({ format: 'esm' });
  assert.ok(output.some(chunk => chunk.type === 'chunk' && Object.keys(chunk.modules).some(id => id.includes('is-number@6.0.0'))));
  assert.equal(await fs.readFile(path.join(directory, 'bun.lock'), 'utf8'), lock);
  console.log('Project bundle consumes its generated browser import map.');
} finally {
  process.chdir(previousCwd);
  await build?.close();
  resolver.finish();
  await fs.rm(directory, { recursive: true, force: true });
}
