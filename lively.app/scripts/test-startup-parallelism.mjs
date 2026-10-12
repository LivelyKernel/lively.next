import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const desktop = await readFile(new URL('lively.app/desktop/start-server.cjs', root), 'utf8');
const nativeBranch = desktop.slice(desktop.indexOf("  if (process.env.LIVELY_DESKTOP_MODE !== 'http') {"),
  desktop.indexOf("\n  emitStatus('Finding free port...')"));

function desktopFixture () {
  const ready = Promise.withResolvers();
  const events = [], errors = [];
  const backend = { initialize () { events.push('initialize'); return ready.promise; } };
  const window = { window: { livelyBoot: { navigate () { events.push('navigate'); } } }, on () {} };
  const context = { rootDir: '/runtime', childEnv: {}, path,
    process: { env: {}, chdir () {} }, fs: { existsSync: () => false },
    desktopDataDir: () => '/data', module: { exports: {} },
    require: id => id === 'node:url' ? { pathToFileURL } : () => backend,
    nw: { Window: { getAll: callback => callback([window]) } },
    emitStatus () {}, emitError: message => errors.push(message), log () {} };
  return { ready, events, errors, run: () => runInNewContext(`(async () => { ${nativeBranch} })()`, context) };
}

await test('native worker initialization overlaps dashboard navigation', { timeout: 2000 }, async () => {
  const f = desktopFixture();
  try {
    await f.run();
    assert.deepEqual(f.events, ['initialize', 'navigate'], 'Worker startup must begin before navigating, without waiting for readiness');
  } finally { f.ready.resolve(); }
});
await test('background worker initialization failures are handled', async () => {
  const f = desktopFixture();
  try {
    await f.run();
    assert.ok(f.events.includes('initialize'));
    f.ready.reject(new Error('worker initialization failed'));
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(f.errors.some(message => message.includes('worker initialization failed')));
  } finally { f.ready.resolve(); }
});

const bootstrap = await readFile(new URL('lively.freezer/src/util/bootstrap.js', root), 'utf8');
const setup = bootstrap.slice(bootstrap.indexOf('function bootstrapLivelySystem ('),
  bootstrap.indexOf('\nfunction fastPrepLivelySystem ('));
function frontendFixture () {
  const registry = Promise.withResolvers(), hashes = Promise.withResolvers(), wasm = Promise.withResolvers();
  const hashMap = { '/fixture.js': 42 }, packageMap = { packageMap: {} };
  const oldSystem = { baseURL: 'file:///runtime/', meta: {} }, newSystem = {};
  const stop = new Error('setup complete');
  let swcStarted = false, swaps = 0;
  const context = { window: { System: oldSystem }, baseURL: 'file:///runtime', Date,
    lively: { FreezerRuntime: {}, modules: {
      getSystem: () => newSystem,
      changeSystem: system => { swaps++; context.window.System = system; }
    } },
    $world: { env: { uninstallSystemChangeHandlers () {}, installSystemChangeHandlers () {} } },
    fastLoadPackages: async () => {}, promise: { timeToRun: async () => 0 },
    resource: () => ({ join: name => ({ readJson: () => name === 'package-registry.json' ? registry.promise : hashes.promise }) }),
    installLinter () {}, setupSwcTranspiler: async system => {
      assert.equal(system, newSystem);
      swcStarted = true;
      await wasm.promise;
    }, logInfo: label => { if (label === 'Setup SystemJS:') throw stop; } };
  const run = runInNewContext(`(${setup})`, context)(undefined, true);
  const result = run.catch(error => error);
  return { registry, hashes, wasm, oldSystem, newSystem, hashMap, stop, context, result,
    swcStarted: () => swcStarted, swaps: () => swaps,
    finish: async () => { registry.resolve(packageMap); hashes.resolve(hashMap); wasm.resolve(); return result; } };
}
await test('frontend compiler setup overlaps pending registry and hash reads', async () => {
  const f = frontendFixture();
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.swcStarted(), true, 'SWC setup waited for the backend inputs');
    assert.equal(f.swaps(), 0, 'The dashboard loader changed before setup completed');
    assert.equal(await f.finish(), f.stop);
    assert.equal(f.swaps(), 1);
    assert.equal(f.oldSystem._livelyModulesSourceHashes, f.hashMap);
    assert.equal(f.newSystem._livelyModulesSourceHashes, f.hashMap);
  } finally { await f.finish(); }
});
await test('the dashboard keeps its loader until compiler setup finishes', async () => {
  const f = frontendFixture();
  try {
    f.registry.resolve({ packageMap: {} });
    f.hashes.resolve(f.hashMap);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.swcStarted(), true);
    assert.equal(f.context.window.System, f.oldSystem);
    assert.equal(f.swaps(), 0);
    assert.equal(await f.finish(), f.stop);
  } finally { await f.finish(); }
});
await test('failed bootstrap input leaves the dashboard loader installed', async () => {
  const f = frontendFixture();
  try {
    const error = new Error('source hash read failed');
    f.hashes.reject(error);
    f.registry.resolve({ packageMap: {} });
    assert.equal(await f.result, error);
    assert.equal(f.context.window.System, f.oldSystem);
    assert.equal(f.swaps(), 0);
  } finally { await f.finish(); }
});
