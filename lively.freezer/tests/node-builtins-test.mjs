import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { rollup } from '@rollup/wasm-node';
import { lively } from '../src/plugins/rollup.js';
import resolver from '../src/resolvers/node.cjs';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-builtin-bundle-'));
try {
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'builtin-fixture', version: '1.0.0' }));
  const nodeResolver = lively({ resolver, asBrowserModule: false });
  for (const prefix of ['', 'node:']) {
    assert.deepEqual(await nodeResolver.resolveId(`${prefix}path`), { id: `${prefix}path`, external: true });
    const entry = path.join(directory, 'entry.js');
    await fs.writeFile(entry, `
      import path from '${prefix}path';
      import fs from '${prefix}fs';
      import cjs from './require.cjs';
      globalThis.builtinResult = [path.join('a', 'b'), typeof fs.readFile, cjs];
      globalThis.builtinPromise = import('${prefix}path').then(module => module.basename('/a/b'));
    `);
    await fs.writeFile(path.join(directory, 'require.cjs'), `module.exports = require('${prefix}path').basename('/a/b');`);
    const build = await rollup({
      input: entry,
      plugins: [lively({
        // This regression exercises resolution without scope instrumentation.
        resolver: { ...resolver, detectFormatFromSource: () => 'global' },
        asBrowserModule: true, minify: false, compress: false, includeLivelyAssets: false
      })]
    });
    try {
      const { output } = await build.generate({ format: 'iife', inlineDynamicImports: true });
      const sandbox = {};
      runInNewContext(output.find(chunk => chunk.type === 'chunk').code, sandbox);
      assert.deepEqual(Array.from(sandbox.builtinResult), ['a/b', 'undefined', 'b']);
      assert.equal(await sandbox.builtinPromise, 'b');
    } finally {
      await build.close();
    }
  }
  const mapped = lively({ resolver, map: { fs: '@empty', 'node:fs': '@empty' } });
  assert.equal(await mapped.resolveId('fs'), '@empty');
  assert.equal(await mapped.resolveId('node:fs'), '@empty');
  console.log('Browser bundles polyfill static, dynamic, and CommonJS builtins; Node bundles keep them external.');
} finally {
  resolver.finish();
  await fs.rm(directory, { recursive: true, force: true });
}
