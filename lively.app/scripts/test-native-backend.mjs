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
import { createServer } from 'node:http';

const executable = process.argv[2];
if (!executable) throw new Error('Pass an NW.js executable with no adjacent app manifest');
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively native backend '));
const app = path.join(fixture, 'app with spaces');
const runtimeRoot = path.join(fixture, 'runtime with spaces');
fs.mkdirSync(app);
fs.mkdirSync(path.join(app, 'desktop'));
fs.mkdirSync(path.join(app, 'lively.installer'));
fs.writeFileSync(path.join(app, 'lively.installer/packages-config.json'), '{}');
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
  'node-main': '--experimental-import-meta-resolve',
  'bg-script': 'desktop/background-menu.js',
  'chromium-args': '--enable-features=NWESM --enable-node-worker --disable-raf-throttling --disable-gpu --no-sandbox',
  'node-remote': [],
  window: { show: false }
}));
fs.writeFileSync(path.join(app, 'index.html'), '<!doctype html><title>Native backend test</title>');
fs.writeFileSync(path.join(app, 'next.html'), '<!doctype html><title>Native backend after navigation</title>');
// Launch the production bootstrap from a different directory, as a relocated
// macOS package does. Keep its server entry limited to this backend probe.
fs.copyFileSync(path.join(root, 'lively.app/desktop/background-menu.js'), path.join(app, 'desktop/background-menu.js'));
fs.writeFileSync(path.join(app, 'desktop/start-server.cjs'), "module.exports = require('../probe.cjs');");
fs.writeFileSync(path.join(app, 'desktop/updates.cjs'), `exports.createUpdateService = ({ desktopDir }) => {
  require('node:assert/strict').equal(desktopDir, __dirname, 'Menu lost the updater directory');
  return {};
};`);
fs.copyFileSync(path.join(root, 'lively.app/desktop/native-backend-worker.js'), path.join(app, 'worker.js'));
fs.writeFileSync(path.join(app, 'failed-worker.js'), 'self.onmessage = () => { throw new Error("worker-probe-failure"); };');
fs.writeFileSync(path.join(app, 'probe.cjs'), `
const assert = require('node:assert/strict');
assert.notEqual(nw.App.startPath, __dirname, 'Probe must launch outside the app directory');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const config = JSON.parse(fs.readFileSync(__dirname + '/config.json'));
process.env.LIVELY_APP_SMOKE = '1';
process.env.LIVELY_PREBUILT_LIBRARY_SNAPSHOT = config.fixture + '/file with spaces.txt';
const backgroundWindow = new Promise(resolve => { module.exports.setBackgroundWindow = resolve; });
const createBackend = require(config.root + '/lively.app/desktop/native-backend-client.cjs');
const backend = createBackend(config.runtimeRoot, {
  createWorker: async () => new (await backgroundWindow).Worker('worker.js'),
  log: message => fs.appendFileSync(config.result + '.log', new Date().toISOString() + ' ' + message + '\\n')
});
const evaluate = async source => {
  const value = JSON.parse(await backend.evaluate(source));
  assert.ok(!value?.isError, value?.value);
  return value;
};
const nativeObjectDBURL = 'lively.objectdb://local/';
const request = async (method, action, args) => {
  fs.appendFileSync(config.result + '.log', new Date().toISOString() + ' Request ' + action + '\\n');
  const query = Object.entries(args).map(([key, value]) => encodeURIComponent(key) + '=' +
    encodeURIComponent(typeof value === 'object' ? JSON.stringify(value) : value)).join('&');
  const value = JSON.parse(await backend.request(method, nativeObjectDBURL + action + (method === 'GET' ? '?' + query : ''), JSON.stringify(args)));
  assert.equal(value.error, undefined, value.error);
  fs.appendFileSync(config.result + '.log', new Date().toISOString() + ' Completed ' + action + '\\n');
  return value;
};
(async () => {
  const { resourceClass: FileResource } = await backend.fileExtension();
  const source = new FileResource(pathToFileURL(config.fixture + '/file with spaces.txt').href);
  await source.write('native file');
  assert.equal(await source.read(), 'native file');
  assert.equal(String(await source.beBinary(true).read()), 'native file');
  await assert.rejects(new FileResource(pathToFileURL(config.fixture + '/missing.txt').href).read(), { code: 'ENOENT' });
  assert.equal(backend.initialize(), backend.initialize());
  await backend.initialize();
  assert.equal(global.System, undefined, 'Backend loader leaked onto the UI thread');
  assert.equal(await evaluate('process.pid'), process.pid, 'Backend spawned another process');
  const archive = new FileResource(pathToFileURL(config.runtimeRoot + '/compressed-sources').href).beBinary(true);
  assert.ok(await archive.exists());
  assert.equal(String(await archive.read()), 'native file', 'Worker binary resource was not preserved');
  assert.equal(await evaluate('System.has(System.normalizeSync("lively.storage"))'), false, 'Registry initialization eagerly loaded storage');
  const listener = JSON.parse(await backend.evaluate('require("node:net").createServer().listen(0)'));
  assert.ok(listener.isError && listener.value.includes('TCP/HTTP listener'), 'TCP guard did not run inside the worker');
  if (config.mode === 'registry') {
    nw.Window.open(config.remoteURL, { show: false });
    let ticks = 0, longest = 0, previous = Date.now();
    const timer = setInterval(() => { const now = Date.now(); longest = Math.max(longest, now - previous); previous = now; ticks++; }, 20);
    // A CPU-bound server operation must leave the UI event loop responsive.
    const busy = evaluate('(()=>{const end=Date.now()+1500;while(Date.now()<end){};return 42;})()');
    const win = await new Promise(resolve => nw.Window.getAll(windows => resolve(windows.find(win => win.window.location.href.endsWith('/index.html')))));
    win.window.location.href = 'next.html';
    assert.equal(await busy, 42, 'Navigation destroyed the backend worker');
    clearInterval(timer);
    assert.ok(ticks >= 10 && longest < 1000, 'Backend blocked UI timer: ' + JSON.stringify({ ticks, longest }));
    assert.equal(await evaluate('System.has(System.normalizeSync("lively.storage"))'), false);
    await backend.close();
    let error;
    const broken = createBackend(config.runtimeRoot, {
      createWorker: async () => new (await backgroundWindow).Worker('failed-worker.js'),
      onError: err => { error = err; }
    });
    await assert.rejects(Promise.all([broken.initialize(), broken.evaluate('42')]), /worker-probe-failure/);
    assert.match(error.message, /worker-probe-failure/);
    await assert.rejects(broken.evaluate('42'), /worker-probe-failure/);
    fs.writeFileSync(config.result, JSON.stringify({ mode: config.mode, nw: process.versions.nw, node: process.versions.node, adapters: [], ticks, longest }));
    return;
  }
  if (config.mode === 'eval-storage') {
    assert.equal(await evaluate('(async()=>{const {Database}=await System.import("lively.storage");return Database.ensureDB(' + JSON.stringify(config.fixture + '/eval-only database') + ').pouchdb.adapter;})()'), 'leveldb');
    // Closing drains work already in flight before releasing the database lock.
    const write = evaluate('(async()=>{await new Promise(r=>setTimeout(r,100));const {Database}=await System.import("lively.storage");await Database.ensureDB(' + JSON.stringify(config.fixture + '/eval-only database') + ').pouchdb.put({_id:"pending-write",value:42});return 42;})()');
    await backend.close();
    assert.equal(await write, 42);
    fs.writeFileSync(config.result, JSON.stringify({ mode: config.mode, nw: process.versions.nw, node: process.versions.node, adapters: ['leveldb'] }));
    return;
  }
  const db = config.fixture + '/persistent database';
  assert.equal(await evaluate('(async()=>{const {Database}=await System.import("lively.storage");return (await Database.ensureDB(' + JSON.stringify(config.fixture + '/eval-only database') + ').pouchdb.get("pending-write")).value;})()'), 42, 'Shutdown lost an in-flight write or did not release the database');
  if (config.mode === 'write') {
    await request('POST', 'ensureDB', { db, snapshotLocation: pathToFileURL(config.fixture + '/snapshots/').href });
    const snapshot = { nested: { value: 42 } };
    const commit = request('POST', 'commit', { db, type: 'world', name: 'native probe', snapshot, commitSpec: { author: { name: 'native test' } } });
    snapshot.nested.value = 99;
    await commit;
  }
  assert.deepEqual(await request('GET', 'fetchSnapshot', { db, type: 'world', name: 'native probe' }), { nested: { value: 42 } });
  assert.deepEqual(await request('GET', 'exists', { db, type: 'world', name: 'missing' }), { exists: false });
  const adapters = await evaluate('(async()=>{const {Database}=await System.import("lively.storage");return [...Database.databases.values()].map(db=>db.pouchdb.adapter);})()');
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

// This HTTP server is an untrusted-page fixture in the test runner, outside NW.js.
// Enabling Node in local workers must not grant Node to remote pages or workers.
let remoteState;
const remoteServer = createServer((req, res) => {
  if (req.url === '/result') {
    let text = '';
    req.on('data', data => { text += data; });
    req.on('end', () => { remoteState = JSON.parse(text); res.end('ok'); });
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end(`<script>
    const page = { require: typeof require, process: typeof process };
    const worker = new Worker(URL.createObjectURL(new Blob(['postMessage({require:typeof require,process:typeof process})'], {type:'text/javascript'})));
    worker.onmessage = ({data}) => fetch('/result', {method:'POST',body:JSON.stringify({page,worker:data})});
  </script>`);
});
await new Promise(resolve => remoteServer.listen(0, '127.0.0.1', resolve));
try {
  for (const mode of ['registry', 'eval-storage', 'write', 'read']) {
    const result = path.join(fixture, `${mode}.json`);
    fs.writeFileSync(path.join(app, 'config.json'), JSON.stringify({
      root, runtimeRoot, fixture, mode, result, remoteURL: 'http://127.0.0.1:' + remoteServer.address().port
    }));
    let output = '';
    const child = spawn(executable, [app, `--user-data-dir=${path.join(fixture, 'profile')}`], { cwd: fixture, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const timeout = setTimeout(() => child.kill('SIGTERM'), 60000);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    clearTimeout(timeout);
    if (fs.existsSync(result + '.log')) output = fs.readFileSync(result + '.log', 'utf8') + output;
    assert.equal(code, 0, output);
    assert.ok(fs.existsSync(result), `No probe result: ${output}`);
    const state = JSON.parse(fs.readFileSync(result));
    assert.equal(state.error, undefined, state.error);
    if (mode === 'registry') assert.deepEqual(remoteState, {
      page: { require: 'undefined', process: 'undefined' },
      worker: { require: 'undefined', process: 'undefined' }
    }, 'Remote page or worker gained Node access');
    console.log(`Native backend ${mode}: NW.js ${state.nw}, Node ${state.node}, ${state.adapters.length} persistent databases; no TCP/HTTP listener${state.ticks ? `; ${state.ticks} UI ticks during 1.5 s of worker CPU, longest ${state.longest} ms` : ''}`);
  }
} finally {
  await new Promise(resolve => remoteServer.close(resolve));
  fs.rmSync(fixture, { recursive: true, force: true });
}
