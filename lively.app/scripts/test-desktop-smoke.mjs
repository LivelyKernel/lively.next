import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const smoke = await readFile(new URL('./smoke-desktop-bundle.mjs', import.meta.url), 'utf8');
const waitFor = smoke.slice(smoke.indexOf('async function waitFor ('), smoke.indexOf('\nfunction tailFile ('));
const reopen = smoke.slice(smoke.indexOf('async function reopenSmokeWorld ('), smoke.indexOf('\nasync function assertNativeAssets ('));

await test('saved world verification waits for its current studio controls', { timeout: 2000 }, async () => {
  // Snapshots can restore the old flag before the ephemeral studio UI is recreated.
  const world = { name: 'desktop-storage-smoke', _uiInitialized: true, get: () => ({}) };
  const sleeps = [];
  let imagesChecked = false;
  const context = { $world: world, SAVED_WORLD: world.name, appExitStatus: null,
    sleep: () => new Promise(resolve => sleeps.push(resolve)), console: { log () {} } };
  const client = { async send (method, params) {
    if (method === 'Page.navigate') return {};
    if (params.awaitPromise) {
      imagesChecked = true;
      return { result: { value: true } };
    }
    return { result: { value: runInNewContext(params.expression, context) } };
  } };
  const open = runInNewContext(`${waitFor}\n${reopen}\nreopenSmokeWorld`, context)(client, '/worlds/load', 1000);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const advance = async () => { sleeps.shift()(); await tick(); };

  await tick();
  assert.equal(imagesChecked, false, 'World contents were treated as studio readiness');
  world.sceneGraphFlap = { owner: world };
  await advance();
  assert.equal(imagesChecked, false, 'Only one sidebar control was ready');
  world.propertiesPanelFlap = { owner: {} };
  await advance();
  assert.equal(imagesChecked, false, 'A detached control was treated as ready');
  world.propertiesPanelFlap.owner = world;
  world._uiInitialized = false;
  await advance();
  assert.equal(imagesChecked, false, 'Studio initialization had not finished');
  world._uiInitialized = true;
  await advance();
  await open;
  assert.equal(imagesChecked, true);
});
