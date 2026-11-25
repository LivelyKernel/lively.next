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

const cdpClient = smoke.slice(smoke.indexOf('class CDPClient {'), smoke.indexOf('\nfunction summarizeCdpEvent ('));

/** A WebSocket whose events the test emits; sent payloads are recorded. */
class TestSocket {
  constructor () { this.listeners = {}; this.sent = []; }
  addEventListener (type, listener) { (this.listeners[type] ||= []).push(listener); }
  send (payload) { this.sent.push(JSON.parse(payload)); }
  close () {}
  emit (type, event = {}) { for (const listener of this.listeners[type] || []) listener(event); }
}

/** @returns {Promise<object>} A CDPClient of the smoke script, connected to a TestSocket. */
async function openCDPClient () {
  const CDPClient = runInNewContext(`${cdpClient}\nCDPClient`, { WebSocket: TestSocket, setTimeout, clearTimeout, Buffer, URL, JSON });
  const client = new CDPClient('ws://desktop.test/devtools');
  const opened = client.open();
  client.ws.emit('open');
  await opened;
  return client;
}

await test('CDP commands reject when the connection closes', { timeout: 2000 }, async () => {
  const client = await openCDPClient();
  const pending = client.send('Runtime.evaluate', { expression: '1' });
  client.ws.emit('close');
  await assert.rejects(pending, /connection closed/);
  assert.equal(client.pending.size, 0);
});

await test('CDP commands with a timeout reject when no response arrives', { timeout: 2000 }, async () => {
  const client = await openCDPClient();
  await assert.rejects(client.send('Runtime.evaluate', {}, { timeoutMs: 20 }), /Runtime.evaluate timed out after 20ms/);
  assert.equal(client.pending.size, 0, 'a late response finds no pending command');
  const answered = client.send('Runtime.evaluate', {}, { timeoutMs: 1000 });
  client.ws.emit('message', { data: JSON.stringify({ id: client.ws.sent.at(-1).id, result: { value: 42 } }) });
  assert.deepEqual({ ...await answered }, { value: 42 });
});

await test('headless smokes pass the Chromium headless flags to the app', () => {
  const launchers = smoke.slice(smoke.indexOf('// Chromium flags that render without a display.'), smoke.indexOf('\nfunction assertExecutableExists ('));
  const { appCommand, devAppCommand } = runInNewContext(`${launchers}\n({ appCommand, devAppCommand })`, { path: { join: (...parts) => parts.join('/') } });
  assert.deepEqual([...appCommand('/bundle', 'linux', true).args], ['--headless=new', '--disable-gpu', '--nwapp=/bundle']);
  assert.deepEqual([...appCommand('/bundle', 'osx', false).args], []);
  assert.deepEqual([...devAppCommand('/root', true).args], ['/root/lively.app/start.sh', '--headless=new', '--disable-gpu']);
  assert.deepEqual([...devAppCommand('/root').args], ['/root/lively.app/start.sh']);
});
