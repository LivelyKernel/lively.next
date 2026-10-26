import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { rollup } from '@rollup/wasm-node';
import { lively } from '../src/plugins/rollup.js';
import resolver from '../src/resolvers/node.cjs';
import { runtimeDefinition } from '../src/util/runtime.js';
import { initializeClass } from 'lively.classes/runtime.js';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-commonjs-polyfills-'));
const modulesRequire = createRequire(resolver.normalizeFileName('lively.modules/package.json'));
const semver = modulesRequire.resolve('semver');
let build;
try {
  const dependency = path.join(directory, 'node_modules', 'process-user');
  await fs.mkdir(dependency, { recursive: true });
  await fs.writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: 'process-user', version: '1.0.0' }));
  await fs.writeFile(path.join(dependency, 'index.js'), `
    module.exports = { browser: process.browser, nextTick: typeof process.nextTick };
  `);
  const entry = path.join(directory, 'entry.js');
  await fs.writeFile(entry, `
    import semver, { satisfies } from ${JSON.stringify(semver)};
    import processUser from './node_modules/process-user/index.js';
    export const callable = semver;
    export const result = [semver('1.2.3').version, satisfies('1.2.3', '^1.0.0'), processUser.browser, processUser.nextTick];
  `);
  build = await rollup({
    input: entry,
    shimMissingExports: true,
    plugins: [lively({
      resolver, asBrowserModule: true, useSwc: true, isResurrectionBuild: true,
      minify: false, compress: false, includeLivelyAssets: false, includePolyfills: false
    })]
  });
  const { output } = await build.generate({ format: 'system' });
  for (const exposeNodeModule of [true, false]) {
    const context = createContext({ console, setTimeout, clearTimeout });
    const nativeExports = {};
    if (exposeNodeModule) context.module = { id: 'renderer', exports: nativeExports };
    context.window = context;
    runInContext(`(${runtimeDefinition.toString()})()`, context);
    let exports;
    context.System = {
      get () { return { evaluationStart () {}, evaluationEnd () {} }; },
      register (dependencies, define) {
        assert.ok(dependencies.every(id => /(^|\/)livelyClassesRuntime\.js$/.test(id)), JSON.stringify(dependencies));
        exports = {};
        const module = define((name, value) => {
          if (typeof name === 'object') Object.assign(exports, name);
          else exports[name] = value;
          return value;
        }, { id: 'commonjs-polyfills.js' });
        module.setters.forEach(setter => setter?.({ initializeClass }));
        module.execute();
      }
    };
    context.BootstrapSystem = context.System;
    runInContext(output.find(chunk => chunk.type === 'chunk').code, context);
    assert.equal(typeof exports.callable, 'function', 'module.exports must retain its callable default export');
    assert.equal(exports.callable('2.3.4').version, '2.3.4');
    assert.deepEqual(Array.from(exports.result), ['1.2.3', true, true, 'function']);
    assert.equal(context.process, undefined, 'Node globals must be imported from the browser shim');
    if (exposeNodeModule) assert.equal(context.module.exports, nativeExports, 'Dependency exports must not escape into the renderer module');
  }
  console.log('Resurrection System.register bundles preserve CommonJS exports and imported Node global shims.');
} finally {
  await build?.close();
  resolver.finish();
  await fs.rm(directory, { recursive: true, force: true });
}
