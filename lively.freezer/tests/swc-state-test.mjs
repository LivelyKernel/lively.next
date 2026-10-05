import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { transformSync } from '@swc/core';
import { LivelySwcTransform } from '../src/bundler-swc.js';
import { runtimeDefinition } from '../src/util/runtime.js';

const source = await readFile(new URL('../../lively.source-transform/swc/browser-transform.js', import.meta.url), 'utf8');
const bytes = await readFile(new URL('../swc-browser-wasm/lively_swc_browser_bg.wasm', import.meta.url));
const bundled = new LivelySwcTransform().transform(source, {
  filename: 'browser-transform.js', moduleId: 'lively.source-transform/swc/browser-transform.js', resurrection: true,
  exclude: ['WebAssembly', 'TextDecoder', 'TextEncoder', 'Uint8Array', 'fetch', 'document']
});
const code = transformSync(bundled.code, { module: { type: 'systemjs' }, jsc: { target: 'es2022' } }).code;

function fixture (fetch) {
  const context = createContext({ console, WebAssembly, TextDecoder, TextEncoder, Uint8Array, fetch,
    document: { location: { href: 'http://fixture.test/' }, querySelector () { return null; } }, __contextModule__: { id: 'bootstrap.js' } });
  context.window = context;
  runInContext(`(${runtimeDefinition.toString()})()`, context);
  let exports;
  context.System = { register (deps, factory) {
    exports = {};
    const module = factory((name, value) => {
      if (typeof name === 'object') Object.assign(exports, name);
      else exports[name] = value;
      return value;
    }, context.__contextModule__);
    module.execute();
  } };
  return () => { runInContext(code, context); return exports; };
}
function checkTransform (module) {
  assert.equal(module.isAvailable(), true, 'Bundle re-execution cleared initialized SWC');
  const result = module.swcTransform('export const answer = 42;', { moduleId: 'fixture.js', captureObj: '_rec' });
  assert.ok(result?.code.includes('System.register'), 'Re-executed SWC must still transform real source');
}
const response = () => new Response(bytes, { headers: { 'content-type': 'application/wasm' } });

let fetches = 0;
const execute = fixture(async () => { fetches++; return response(); });
let module = execute();
await module.initWasm('http://fixture.test');
checkTransform(module);
module = execute();
checkTransform(module);
await module.initWasm('http://fixture.test');
assert.equal(fetches, 1, 'An initialized instance must survive bundle reload without another fetch');

let release;
fetches = 0;
const pending = fixture(() => { fetches++; return new Promise(resolve => { release = resolve; }); });
const first = pending().initWasm('http://fixture.test');
module = pending();
const second = module.initWasm('http://fixture.test');
assert.equal(fetches, 1, 'Bundle reload must retain the pending initialization');
release(response());
await Promise.all([first, second]);
checkTransform(module);

let failed = true;
const retry = fixture(async () => {
  if (failed) throw new Error('fixture WASM request failed');
  return response();
});
module = retry();
await assert.rejects(module.initWasm('http://fixture.test'), /fixture WASM request failed/);
assert.equal(module.isAvailable(), false);
assert.equal(module.swcTransform('export const answer = 42;', {}), null);
failed = false;
await module.initWasm('http://fixture.test');
checkTransform(module);
console.log('SWC survives bundle re-execution and pending initialization; real load failures remain recoverable.');
