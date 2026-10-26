import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { rollup } from '@rollup/wasm-node';
import { lively } from '../src/plugins/rollup.js';
import LivelyRollup from '../src/bundler.js';
import resolver from '../src/resolvers/node.cjs';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-browser-relative-'));
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
  assert.ok(!build.cache.modules.some(module => module.id.endsWith('/internal/node.js') || module.id.endsWith('/ignored.js')));
  console.log('Browser bundles honor package browser aliases and disabled relative imports.');
} finally {
  await build?.close();
  resolver.finish();
  await fs.rm(directory, { recursive: true, force: true });
}
