const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const resolver = require('../src/resolvers/node.cjs');

async function main () {
  const { rollup } = require('@rollup/wasm-node');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-polyfill-'));
  const previousDirectory = process.cwd();
  try {
    // The unified build runs in lively.freezer, outside the dependency directory.
    process.chdir(path.resolve(__dirname, '..'));
    const entry = path.join(directory, 'node_modules', '.bun', 'fixture', 'index.js');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, `export default {
      browser: process.browser, env: process.env.READABLE_STREAM,
      nextTick: typeof process.nextTick, buffer: Buffer.from('working').toString(),
      globalSelf: global === globalThis
    };`);
    const polyfills = resolver.supportingPlugins('browser', {}).find(plugin => plugin.name === 'polyfill-node');
    const build = await rollup({ input: entry, plugins: [polyfills] });
    try {
      const { output } = await build.generate({ format: 'iife', name: 'polyfillProbe', exports: 'default' });
      const context = { setTimeout, clearTimeout };
      context.self = context;
      vm.runInNewContext(output[0].code, context);
      assert.equal(context.polyfillProbe.browser, true);
      assert.equal(context.polyfillProbe.env, undefined);
      assert.equal(context.polyfillProbe.nextTick, 'function');
      assert.equal(context.polyfillProbe.buffer, 'working');
      assert.equal(context.polyfillProbe.globalSelf, true);
    } finally { await build.close(); }
    console.log('Browser dependencies outside the build cwd receive Node global polyfills.');
  } finally {
    process.chdir(previousDirectory);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
