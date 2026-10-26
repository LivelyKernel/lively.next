import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { rollup } from '@rollup/wasm-node';
import jsonPlugin from '@rollup/plugin-json';
import { lively } from '../src/plugins/rollup.js';
import resolver from '../src/resolvers/node.cjs';
import { runtimeDefinition } from '../src/util/runtime.js';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-browser-linter-'));
let build;
let runtimeBuild;
try {
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'browser-editor-fixture', version: '1.0.0' }));
  const entry = path.join(directory, 'entry.js');
  await fs.writeFile(entry, `
    export { default as lint } from ${JSON.stringify(resolver.normalizeFileName('lively.ide/js/linter.js'))};
    export { default as types } from ${JSON.stringify(resolver.normalizeFileName('@babel/types'))};
    export { default as babel } from ${JSON.stringify(resolver.normalizeFileName('@babel/core'))};
    export { default as commonjs } from ${JSON.stringify(resolver.normalizeFileName('@babel/plugin-transform-modules-commonjs'))};
    var hasRequiredState;
    export { hasRequiredState };
    export function saveState(value) { hasRequiredState = value; }
  `);
  const plugin = lively({
    resolver, asBrowserModule: true, useSwc: true, isResurrectionBuild: true,
    minify: false, compress: false, includeLivelyAssets: false, includePolyfills: false
  });
  // Build the classes runtime below so it shares the browser VM's native classes.
  delete plugin.generateBundle;
  build = await rollup({ input: entry, shimMissingExports: true, plugins: [plugin, jsonPlugin()] });
  const { output } = await build.generate({ format: 'system' });
  runtimeBuild = await rollup({
    input: resolver.normalizeFileName('lively.classes/runtime.js'),
    plugins: [{ name: 'runtime-resolver', resolveId: (id, importer) => resolver.resolveModuleId(id, importer) }]
  });
  const runtime = await runtimeBuild.generate({ format: 'iife', name: 'livelyClassesRuntime' });
  const context = createContext({ console, setTimeout, clearTimeout });
  context.window = context;
  runInContext(`(${runtimeDefinition.toString()})()`, context);
  runInContext(runtime.output[0].code, context);
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
      }, { id: 'browser-linter.js' });
      module.setters.forEach(setter => setter?.(context.livelyClassesRuntime));
      module.execute();
    }
  };
  context.BootstrapSystem = context.System;
  runInContext(output.find(chunk => chunk.type === 'chunk').code, context, { filename: 'browser-linter.js' });
  exports.saveState('preserved');
  runInContext(output.find(chunk => chunk.type === 'chunk').code, context, { filename: 'browser-linter-reloaded.js' });
  assert.equal(exports.hasRequiredState, 'preserved', 'Ordinary captured module state must survive re-evaluation');
  const [formatted, messages] = exports.lint('const unused={answer:42}\ndebugger');
  assert.equal(formatted, 'const unused = { answer: 42 };\ndebugger;\n');
  assert.deepEqual(Array.from(messages, message => message.ruleId).sort(), ['no-debugger', 'no-unused-vars']);
  assert.ok(messages.every(message => message.severity === 1));
  assert.equal(exports.lint('debugger', { 'no-debugger': 'off' })[1].length, 0);
  const identifier = exports.types.identifier('answer');
  assert.ok(exports.types.isIdentifier(identifier, { name: 'answer' }));
  assert.ok(exports.types.STANDARDIZED_TYPES.includes('Identifier'));
  assert.ok(exports.types.FLIPPED_ALIAS_KEYS.Standardized.includes('Identifier'));
  exports.types.assertIdentifier(identifier, { name: 'answer' });
  const transformed = exports.babel.transformSync('export const answer = 42;', {
    babelrc: false, configFile: false, plugins: [exports.commonjs]
  });
  const transformedContext = createContext({ exports: {} });
  runInContext(transformed.code, transformedContext);
  assert.equal(transformedContext.exports.answer, 42);
  for (const global of ['process', 'require', 'module']) assert.equal(context[global], undefined, `${global} must not be supplied by Node`);
  console.log('Reloaded browser editor dependencies preserve captured state, lint code, and run Babel types/plugins without Node globals.');
} finally {
  await build?.close();
  await runtimeBuild?.close();
  resolver.finish();
  await fs.rm(directory, { recursive: true, force: true });
}
