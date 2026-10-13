import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import babel from '@babel/core';
import LivelyRollup from '../src/bundler.js';

const sandbox = { module: { exports: {} }, location: { href: 'http://fixture.test/' }, console };
sandbox.global = sandbox;
runInNewContext(await readFile(new URL('../src/util/system.0.21.js', import.meta.url), 'utf8'), sandbox);
const system = sandbox.module.exports;
const parentURL = 'http://fixture.test/parent.js';
system.trace = true;
system.register(parentURL, [], (exports, context) => ({
  execute () {
    exports('load', () => context.import('./child.js'));
    exports('loadBroken', () => context.import('./broken.js'));
  }
}));
system.register('http://fixture.test/child.js', [], exports => ({
  execute () { exports('value', 42); }
}));
system.register('http://fixture.test/broken.js', [], () => ({
  execute () { throw new Error('fixture dependency failed'); }
}));
const parent = await system.import(parentURL);
assert.equal((await parent.load()).value, 42);
assert.deepEqual(Array.from(system.loads[parentURL].dynamicDeps), ['./child.js']);
delete system.loads[parentURL];
assert.equal((await parent.load()).value, 42);
system.loads = undefined;
assert.equal((await parent.load()).value, 42);
await assert.rejects(parent.loadBroken(), /fixture dependency failed/);
console.log('Contextual imports survive removed trace records and preserve dependency errors.');

const resolver = {
  setStatus () {},
  detectFormatFromSource () { return 'esm'; },
  dontTransform () { return []; },
  resolvePackage () { return { name: 'fixture', version: '1.0.0' }; },
  pathInPackageFor () { return ''; }
};
const mixed = `export async function load() {
  const mocha = await System.import('mocha-es6/index.js');
  return [mocha, await System.import('lively.lang')];
}`;

for (const [name, useSwc] of [['SWC', true], ['legacy', false]]) {
  const bundler = new LivelyRollup({
    excludedModules: ['mocha-es6'], resolver, useSwc
  });
  const transformed = await bundler.transform(mixed, `esm://fixture@1.0.0/${name}.js`);
  const code = typeof transformed === 'string' ? transformed : transformed.code;
  assert.match(code, /System\[['"]import['"]\]\(['"]mocha-es6\/index\.js['"]\)/);
  assert.match(code, /import\(['"]lively\.lang['"]\)/);
}

console.log('Excluded SystemJS imports remain runtime namespace lookups.');

for (const useSwc of [false, true]) {
  for (const sourceMap of [false, true]) {
    const bundler = new LivelyRollup({ resolver, useSwc, sourceMap });
    for (const specifier of [String.raw`D:\a\lively.next\lively.resources\index.js`, String.raw`D:\app spaces\quoted "name"\index.js`]) {
      const id = 'esm://fixture@1.0.0/escaped.js';
      const source = `export const load = () => System.import(${JSON.stringify(specifier)});`;
      bundler.moduleSources[id] = source;
      const transformed = await bundler.transform(source, id);
      const code = typeof transformed === 'string' ? transformed : transformed.code;
      const imports = [];
      babel.traverse(babel.parse(code), {
        CallExpression ({ node }) {
          if (node.callee.type === 'Import') imports.push(node.arguments[0].value);
        }
      });
      assert.deepEqual(imports, [specifier], `useSwc=${useSwc}, sourceMap=${sourceMap}`);
    }
  }
}
console.log('SWC and legacy dynamic imports preserve Windows paths and embedded quotes.');
