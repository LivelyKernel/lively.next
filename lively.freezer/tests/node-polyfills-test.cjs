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

    // A project build runs Lively's legacy (non-SWC) transform after the polyfill plugin.
    // These dependencies mention `process` but declare it themselves, so the plugin adds no import.
    const { lively } = await import('../src/plugins/rollup.js');
    const { runtimeDefinition } = await import('../src/util/runtime.js');
    const writePackage = (name, source) => {
      const pkg = path.join(directory, 'node_modules', name);
      fs.mkdirSync(pkg, { recursive: true });
      fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: 'index.js' }));
      fs.writeFileSync(path.join(pkg, 'index.js'), source);
    };
    writePackage('local-process-esm', "const process = { env: { MODE: 'esm' } };\nexport function mode () { return process.env.MODE; }\n");
    writePackage('local-process-cjs', "const process = { env: { MODE: 'cjs' } };\nmodule.exports = { mode () { return process.env.MODE; } };\n");
    writePackage('global-process', 'export const browser = process.browser;\n');
    const projectEntry = path.join(directory, 'entry.js');
    fs.writeFileSync(projectEntry, `import { mode as esmMode } from 'local-process-esm';
      import { mode as cjsMode } from 'local-process-cjs';
      import { browser } from 'global-process';
      globalThis.result = [esmMode(), cjsMode(), browser];`);
    const projectBuild = await rollup({
      input: projectEntry,
      plugins: [lively({ resolver, asBrowserModule: true, minify: false, compress: false, includeLivelyAssets: false })]
    });
    try {
      const { output } = await projectBuild.generate({ format: 'iife' });
      const sandbox = { module: { id: 'project-bundle', exports: {} } };
      sandbox.window = sandbox;
      vm.runInNewContext(`(${runtimeDefinition})()`, sandbox);
      vm.runInNewContext(output.find(chunk => chunk.type === 'chunk').code, sandbox);
      assert.deepEqual(Array.from(sandbox.result), ['esm', 'cjs', true]);
    } finally {
      await projectBuild.close();
      resolver.finish();
    }
    console.log('Legacy Lively transforms bundle dependencies that declare their own Node globals.');
  } finally {
    process.chdir(previousDirectory);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
