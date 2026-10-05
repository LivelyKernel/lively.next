#!/usr/bin/env node
// Usage: DISPLAY=:91 node lively.app/scripts/test-native-backend.mjs /path/to/nw
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const executable = process.argv[2];
if (!executable) throw new Error('Pass an NW.js executable with no adjacent app manifest');
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively native backend '));
const app = path.join(fixture, 'app with spaces');
const runtimeRoot = path.join(fixture, 'runtime with spaces');
fs.mkdirSync(app);
fs.mkdirSync(runtimeRoot);
// Check the page and endpoint boundary without giving remote pages Node APIs.
const trustedRoot = path.join(fixture, 'trusted pages');
for (const entry of ['landing-page', 'loading-screen']) {
  const directory = path.join(trustedRoot, 'lively.freezer', entry);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), '<!doctype html>');
}
const baseURL = pathToFileURL(trustedRoot + path.sep).href;
const bridge = { baseURL, legacyOrigin: 'http://127.0.0.1:9014', dashboardURL: baseURL + 'lively.freezer/landing-page/index.html' };
const inject = fs.readFileSync(path.join(root, 'lively.app/desktop/inject-start.js'), 'utf8');
const injectPage = (href, hasNode = true) => {
  const window = { location: new URL(href) };
  runInNewContext(inject, { window, URL, require: createRequire(import.meta.url),
    ...(hasNode ? { process: { mainModule: { exports: { livelyNative: bridge } } } } : {}) });
  return window.livelyNative;
};
const native = injectPage(bridge.dashboardURL);
assert.ok(Object.isFrozen(native));
assert.ok(native.isLocal(bridge.legacyOrigin + '/objectdb/', 'objectdb'));
assert.ok(native.isLocal(baseURL + 'eval', 'eval'));
for (const url of ['https://remote.test/objectdb', 'http://127.0.0.1:9015/objectdb', bridge.legacyOrigin + '/objectdb/extra', bridge.legacyOrigin + '/objectdb?remote=true']) {
  assert.equal(native.isLocal(url, 'objectdb'), false);
}
assert.equal(injectPage('https://remote.test/', false), undefined);
assert.equal(injectPage(pathToFileURL(path.join(root, 'lively.app/desktop/boot.html')).href), undefined);
assert.equal(injectPage(bridge.dashboardURL, false), undefined);
assert.ok(native.route('/worlds/load?name=test').endsWith('?name=test&route=worlds'));
console.log('Native bridge: trusted pages and exact local endpoints only');
fs.copyFileSync(path.join(root, 'package.json'), path.join(runtimeRoot, 'package.json'));
const { workspaces } = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
for (const directory of [...workspaces, 'node_modules']) {
  fs.symlinkSync(path.join(root, directory), path.join(runtimeRoot, directory), process.platform === 'win32' ? 'junction' : 'dir');
}
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({
  name: 'lively-native-backend-test', main: 'index.html',
  'node-main': '--experimental-import-meta-resolve probe.cjs',
  'chromium-args': '--enable-features=NWESM --disable-gpu --no-sandbox',
  window: { show: false }
}));
fs.writeFileSync(path.join(app, 'index.html'), '<!doctype html><title>Native backend test</title>');
fs.writeFileSync(path.join(app, 'probe.cjs'), `
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
// A backend that starts any TCP/HTTP server fails this test immediately.
const listen = require('node:net').Server.prototype.listen;
require('node:net').Server.prototype.listen = function (endpoint, ...args) {
  assert.equal(typeof endpoint, 'string', 'Native backend opened a TCP/HTTP listener');
  return listen.call(this, endpoint, ...args);
};
const createBackend = require(config.root + '/lively.app/desktop/native-backend.cjs');
const backend = createBackend(config.runtimeRoot);
(async () => {
  const { resourceClass: FileResource } = await backend.fileExtension();
  const source = new FileResource(pathToFileURL(config.fixture + '/file with spaces.txt').href);
  await source.write('native file');
  assert.equal(await source.read(), 'native file');
  assert.equal(String(await source.beBinary(true).read()), 'native file');
  assert.equal(backend.initialize(), backend.initialize());
  const { system } = await backend.initialize();
  assert.equal(system.has(system.normalizeSync('lively.storage')), false, 'Registry initialization eagerly loaded storage');
  if (config.mode === 'registry') {
    await backend.close();
    assert.equal(system.has(system.normalizeSync('lively.storage')), false, 'Shutdown eagerly loaded storage');
    fs.writeFileSync(config.result, JSON.stringify({ mode: config.mode, nw: process.versions.nw, node: process.versions.node, adapters: [] }));
    return;
  }
  const { Database } = await system.import('lively.storage');
  if (config.mode === 'eval-storage') {
    const database = Database.ensureDB(config.fixture + '/eval-only database');
    const pouch = database.pouchdb;
    assert.equal(pouch.adapter, 'leveldb');
    await backend.close();
    await assert.rejects(pouch.info(), /closed/);
    fs.writeFileSync(config.result, JSON.stringify({ mode: config.mode, nw: process.versions.nw, node: process.versions.node, adapters: ['leveldb'] }));
    return;
  }
  const { registerObjectDBResource, nativeObjectDBURL } = await system.import('lively.storage/objectdb-resource.js');
  registerObjectDBResource(backend.request);
  const { ObjectDBHTTPInterface } = await system.import('lively.storage');
  const client = new ObjectDBHTTPInterface(nativeObjectDBURL);
  const db = config.fixture + '/persistent database';
  if (config.mode === 'write') {
    await client.ensureDB({ db, snapshotLocation: pathToFileURL(config.fixture + '/snapshots/').href });
    const snapshot = { nested: { value: 42 } };
    await client.commit({ db, type: 'world', name: 'native probe', snapshot, commitSpec: { author: { name: 'native test' } } });
    snapshot.nested.value = 99;
  }
  assert.deepEqual(await client.fetchSnapshot({ db, type: 'world', name: 'native probe' }), { nested: { value: 42 } });
  assert.deepEqual(await client.exists({ db, type: 'world', name: 'missing' }), { exists: false });
  const adapters = [...Database.databases.values()].map(db => db.pouchdb.adapter);
  assert.ok(adapters.length && adapters.every(adapter => adapter === 'leveldb'));
  assert.equal(JSON.parse(await backend.evaluate('40 + 2')), 42);
  const nodeEnv = JSON.parse(await backend.evaluate('System.get("@system-env").node'));
  assert.equal(nodeEnv, true);
  if (config.mode === 'write') {
    const output = [], exits = new Map();
    const receive = (text, reply) => {
      const message = JSON.parse(text);
      if (message.action === 'ask for') { reply(JSON.stringify({ data: { answer: 'smoke-password' } })); return; }
      if (message.action === 'open editor') { reply(JSON.stringify({ data: { status: 'saved' } })); return; }
      if (message.action === 'lively.shell.onOutput') output.push(message.data);
      if (message.action === 'lively.shell.onExit') exits.set(message.data.pid, message.data);
    };
    const send = async (action, data) => JSON.parse(await backend.send(JSON.stringify({ sender: 'native-probe', action, data }), receive)).data;
    const waitExit = async pid => {
      for (let n = 0; n < 400 && !exits.has(pid); n++) await new Promise(resolve => setTimeout(resolve, 25));
      assert.ok(exits.has(pid), 'Native shell command did not exit');
      return exits.get(pid);
    };
    let result = await send('lively.shell.spawn', { command: 'printf native-stdout; printf native-stderr >&2', cwd: config.fixture, env: {} });
    assert.ok(result.pid, JSON.stringify(result));
    assert.equal((await waitExit(result.pid)).code, 0);
    assert.ok(output.some(event => event.stdout === 'native-stdout'));
    assert.ok(output.some(event => event.stderr === 'native-stderr'));
    result = await send('lively.shell.spawn', { command: 'sleep 30', cwd: config.fixture, env: {} });
    await send('lively.shell.kill', { pid: result.pid, signal: 'TERM' });
    await waitExit(result.pid);
    result = await send('lively.shell.spawn', { command: 'read line; printf "%s" "$line"', cwd: config.fixture, env: {} });
    await send('lively.shell.writeToStdin', { pid: result.pid, stdin: 'native-stdin\\n' });
    await waitExit(result.pid);
    assert.ok(output.some(event => event.stdout === 'native-stdin'));
    const quote = value => "'" + value.replace(/'/g, "'\\\\''") + "'";
    result = await send('lively.shell.spawn', {
      command: 'node ' + quote(config.root + '/lively.shell/bin/askpass.js') + ' ' + quote('Password for smoke?'),
      cwd: config.fixture, env: { ASKPASS_SESSIONID: 'native-probe' }
    });
    assert.equal((await waitExit(result.pid)).code, 0, JSON.stringify(output));
    assert.ok(output.some(event => event.stdout?.includes('smoke-password')));
  }
  await backend.close();
  await assert.rejects(backend.request('GET', nativeObjectDBURL + 'exists'), /closing/);
  fs.writeFileSync(config.result, JSON.stringify({ mode:config.mode, nw:process.versions.nw, node:process.versions.node, adapters }));
})().catch(err => fs.writeFileSync(config.result, JSON.stringify({ error:err.stack }))).finally(() => setTimeout(() => nw.App.quit(), 200));
`);

try {
  for (const mode of ['registry', 'eval-storage', 'write', 'read']) {
    const result = path.join(fixture, `${mode}.json`);
    fs.writeFileSync(path.join(app, 'config.json'), JSON.stringify({
      root, runtimeRoot, fixture, mode, result
    }));
    let output = '';
    const child = spawn(executable, [app, `--user-data-dir=${path.join(fixture, 'profile')}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const timeout = setTimeout(() => child.kill('SIGTERM'), 60000);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    clearTimeout(timeout);
    assert.equal(code, 0, output);
    assert.ok(fs.existsSync(result), `No probe result: ${output}`);
    const state = JSON.parse(fs.readFileSync(result));
    assert.equal(state.error, undefined, state.error);
    console.log(`Native backend ${mode}: NW.js ${state.nw}, Node ${state.node}, ${state.adapters.length} persistent databases; no TCP/HTTP listener`);
  }
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
