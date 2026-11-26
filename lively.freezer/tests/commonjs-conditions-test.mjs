import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { rollup } from '@rollup/wasm-node';
import { lively } from '../src/plugins/rollup.js';
import resolver from '../src/resolvers/node.cjs';

const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'lively-require-conditions-')));
const pkg = path.join(directory, 'node_modules', 'conditional');
const dual = path.join(directory, 'node_modules', 'dual');
let build;
try {
  await fs.mkdir(pkg, { recursive: true });
  await fs.writeFile(path.join(pkg, 'package.json'), JSON.stringify({
    name: 'conditional', version: '1.0.0',
    exports: { '.': { import: './import.js', require: './require.cjs' } }
  }));
  await fs.writeFile(path.join(pkg, 'import.js'), "export default { mode: 'import' };");
  await fs.writeFile(path.join(pkg, 'require.cjs'), "module.exports = { mode: 'require' };");
  // Without `exports`, browser imports use the `module` field and `require()` uses `main`, the field Node's require reads.
  await fs.mkdir(dual, { recursive: true });
  await fs.writeFile(path.join(dual, 'package.json'), JSON.stringify({
    name: 'dual', version: '1.0.0', main: './index.cjs.js', module: './index.esm.js'
  }));
  await fs.writeFile(path.join(dual, 'index.esm.js'), "export default { mode: 'module' };");
  await fs.writeFile(path.join(dual, 'index.cjs.js'), "module.exports = { mode: 'main' };");
  const entry = path.join(directory, 'entry.js');
  await fs.writeFile(entry, `
    import imported from 'conditional';
    import importedDual from 'dual';
    const required = require('conditional');
    const requiredDual = require('dual');
    globalThis.conditionResult = [imported.mode, required.mode, importedDual.mode, requiredDual.mode];
  `);
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
  assert.deepEqual(Array.from(sandbox.conditionResult), ['import', 'require', 'module', 'main']);
  for (const context of ['systemjs-browser', 'systemjs-node']) {
    assert.equal(resolver.resolveModuleId('conditional', entry, context), path.join(pkg, 'import.js'));
    assert.equal(resolver.resolveModuleId('conditional', entry, context, true), path.join(pkg, 'require.cjs'));
  }
  assert.equal(resolver.resolveModuleId('dual', entry, 'systemjs-browser'), path.join(dual, 'index.esm.js'));
  assert.equal(resolver.resolveModuleId('dual', entry, 'systemjs-browser', true), path.join(dual, 'index.cjs.js'));
  console.log('Mixed ESM/CommonJS bundles preserve distinct import and require package conditions.');
} finally {
  await build?.close();
  resolver.finish();
  await fs.rm(directory, { recursive: true, force: true });
}
