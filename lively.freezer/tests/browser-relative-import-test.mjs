import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { rollup } from '@rollup/wasm-node';
import { lively } from '../src/plugins/rollup.js';
import LivelyRollup from '../src/bundler.js';
import resolver from '../src/resolvers/node.cjs';

const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'lively-browser-relative-')));
const pkg = path.join(directory, 'node_modules', 'browser-relative');
let build;
try {
  await fs.mkdir(path.join(pkg, 'internal'), { recursive: true });
  await fs.writeFile(path.join(pkg, 'package.json'), JSON.stringify({
    name: 'browser-relative', version: '1.0.0', main: './index.js',
    browser: { './internal/node.js': './internal/browser.js', './ignored.js': false }
  }));
  await fs.writeFile(path.join(pkg, 'internal/node.js'), "export const environment = 'node';");
  await fs.writeFile(path.join(pkg, 'internal/browser.js'), "export const environment = 'browser';");
  await fs.writeFile(path.join(pkg, 'ignored.js'), 'export const nodeOnly = true;');
  await fs.writeFile(path.join(pkg, 'index.js'), `
    import { environment } from './internal/node.js';
    import * as ignored from './ignored.js';
    export const result = [environment, Object.keys(ignored).length];
  `);
  const entry = path.join(directory, 'entry.js');
  await fs.writeFile(entry, "import { result } from 'browser-relative'; globalThis.browserResult = result;");
  assert.equal(resolver.resolveModuleId('./entry.js'), null);
  const bundler = new LivelyRollup({ resolver, asBrowserModule: false });
  assert.equal(bundler.resolveRelativeImport(path.join(pkg, 'index.js'), './internal/node.js'), path.join(pkg, 'internal/node.js'));
  // Modules fetched from a CDN import their relative dependencies from the same host.
  const browserBundler = new LivelyRollup({ resolver, asBrowserModule: true });
  for (const [importer, id, expected] of [
    ['https://unpkg.com/lodash-es@4.17.21/add.js', './_createMathOperation.js', 'https://unpkg.com/lodash-es@4.17.21/_createMathOperation.js'],
    ['https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/add.js', './_createMathOperation.js', 'https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/_createMathOperation.js'],
    ['https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/fp/add.js', '../add.js', 'https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/add.js']
  ]) assert.equal(browserBundler.resolveId(id, importer), expected, `${id} from ${importer}`);
  build = await rollup({
    input: entry,
    plugins: [lively({
      resolver: { ...resolver, detectFormatFromSource: () => 'global' },
      asBrowserModule: true, minify: false, compress: false, includeLivelyAssets: false
    })]
  });
  const { output } = await build.generate({ format: 'iife' });
  const sandbox = {};
  runInNewContext(output.find(chunk => chunk.type === 'chunk').code, sandbox);
  assert.deepEqual(Array.from(sandbox.browserResult), ['browser', 0]);
  // Module ids use the platform's path separator.
  const bundledIds = build.cache.modules.map(module => module.id.replace(/\\/g, '/'));
  assert.ok(bundledIds.some(id => id.endsWith('/browser-relative/internal/browser.js')), JSON.stringify(bundledIds));
  assert.ok(!bundledIds.some(id => id.endsWith('/browser-relative/internal/node.js') || id.endsWith('/browser-relative/ignored.js')), JSON.stringify(bundledIds));
  console.log('Browser bundles honor package browser aliases and disabled relative imports.');
} finally {
  await build?.close();
  resolver.finish();
  await fs.rm(directory, { recursive: true, force: true });
}
