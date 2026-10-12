#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import createClient from '../desktop/native-backend-client.cjs';
import createBackend from '../desktop/native-backend.cjs';
import { parseQuery } from '../../lively.resources/src/helpers.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively desktop resources '));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const method = (file, name, globals) => {
  const source = read(file).match(new RegExp(`  (?:static )?async ${name} \\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`));
  assert.ok(source, `Missing ${name}`);
  return runInNewContext('(' + source[0].trim().replace(/^static /, '').replace('async ' + name, 'async function') + ')', globals);
};
try {
  fs.symlinkSync(path.join(root, 'lively.resources'), path.join(fixture, 'lively.resources'),
    process.platform === 'win32' ? 'junction' : 'dir');
  const client = createClient(fixture, { createWorker: () => { throw new Error('Uploads must use native filesystem resources'); } });
  const { resourceClass: FileResource } = await client.fileExtension();
  const baseURL = pathToFileURL(fixture + path.sep).href;
  const resource = (url, options) => new FileResource(url, options);
  const project = {
    url: baseURL + 'local_projects/owner--project/',
    deleteCustomFont: async () => {}, addCustomFontFace: async () => {}
  };
  let status;
  const world = {
    openedProject: null,
    confirm: async text => text.startsWith('Upload '),
    setStatusMessage: message => { status = message; },
    showError: error => { throw new Error(String(error)); },
    get: () => null
  };
  let indicatorRemoved = false;
  const globals = {
    globalThis: { livelyNative: {} },
    System: { baseURL }, document: { location: { origin: 'null' } },
    resource, FormData, isUserLoggedIn: () => false,
    LoadingIndicator: { open: () => ({ remove: () => { indicatorRemoved = true; } }) }
  };
  const bytes = new Uint8Array([0, 13, 10, 255]);
  const dropped = new File([bytes], 'dropped.bin', { type: 'application/octet-stream' });
  await method('lively.ide/world.js', 'onNativeDrop', globals).call(world, {
    targetMorph: world, isAltDown: () => false, domEvt: { dataTransfer: { files: [dropped] } }
  });
  assert.equal(status, 'Uploaded 1 file');
  assert.equal(indicatorRemoved, true);
  assert.deepEqual(fs.readFileSync(path.join(fixture, 'uploads/dropped.bin')), Buffer.from(bytes));

  world.openedProject = project;
  const asset = new File([bytes], 'image.png', { type: 'image/png' });
  await method('lively.ide/studio/asset-browser.cp.js', 'uploadAsset', {
    ...globals, $world: world
  }).call({}, asset);
  assert.deepEqual(fs.readFileSync(path.join(fixture, 'local_projects/owner--project/assets/image.png')), Buffer.from(bytes));
  const font = new File([bytes], 'font.woff2', { type: 'font/woff2' });
  await method('lively.ide/studio/font-manager.cp.js', 'uploadFont', {
    ...globals, $world: world, isUserLoggedIn: () => true
  }).call({}, font);
  assert.deepEqual(fs.readFileSync(path.join(fixture, 'local_projects/owner--project/assets/font.woff2')), Buffer.from(bytes));

  const snapshot = new File(['{"value":42}'], 'snapshot.json', { type: 'application/json' });
  let bootstrapArgs;
  const pickSnapshot = method('lively.ide/studio/world-browser.cp.js', 'chooseAndOpenSnapshot', {
    ...globals, $world: world, lively: {},
    window: { SYSTEM_BASE_URL: baseURL, showOpenFilePicker: async () => [{ getFile: async () => snapshot }] },
    System: { baseURL: baseURL + 'lively.freezer/landing-page/', import: async () => ({ bootstrap: async args => { bootstrapArgs = args; } }) }
  });
  const browser = { fadeOut: async () => {}, progressIndicator: {} };
  await pickSnapshot.call(browser);
  await pickSnapshot.call(browser);
  assert.equal(fs.readFileSync(path.join(fixture, bootstrapArgs.filePath), 'utf8'), '{"value":42}');
  assert.equal(fs.existsSync(path.join(fixture, 'snapshots/snapshot-1.json')), false, 'Existing snapshots must be found under the native root');

  let httpUpload;
  await method('lively.ide/studio/world-browser.cp.js', 'chooseAndOpenSnapshot', {
    ...globals, $world: world, lively: {},
    window: { showOpenFilePicker: async () => [{ getFile: async () => snapshot }] },
    document: { location: { origin: 'http://h' } },
    System: { baseURL: 'http://h/dashboard/', import: async () => ({ bootstrap: async () => {} }) },
    resource: url => ({ join: name => {
      const target = new URL(name, url + '/').href;
      return { exists: async () => false, join: child => ({ exists: async () => false }),
        write: async () => { httpUpload = target; } };
    } })
  }).call(browser);
  assert.equal(httpUpload, 'http://h/upload?uploadPath=%2Fsnapshots%2F');

  let report;
  const progress = [];
  const upload = resource(baseURL, { onLoad: result => { report = result; }, onProgress: event => progress.push(event) })
    .join('upload?uploadPath=uploads%2F');
  const form = new FormData();
  form.append('file', dropped);
  form.append('file', new File([bytes], 'space # %.bin', { type: 'application/octet-stream' }));
  await upload.write(form);
  assert.equal(report.status, 'done');
  assert.deepEqual(progress.map(event => [event.loaded, event.total]), [[4, 8], [8, 8]]);
  assert.equal(report.uploadedFiles[0].path, 'uploads/dropped-1.bin');
  for (const file of report.uploadedFiles) {
    assert.deepEqual(await resource(baseURL).join(file.path).beBinary(true).read(), Buffer.from(bytes));
    assert.equal(file.hash, createHash('sha1').update(bytes).digest('hex'));
  }
  const invalid = new FormData();
  invalid.append('file', dropped, '../outside.bin');
  await assert.rejects(upload.write(invalid), /Invalid upload filename/);
  await resource(baseURL).join('blob.bin').write(new Blob([bytes]));
  assert.deepEqual(fs.readFileSync(path.join(fixture, 'blob.bin')), Buffer.from(bytes));
  await client.close();
  console.log('Native upload flows: world drop, assets, fonts, snapshots, collisions, binary data and callbacks passed');

  const screenSource = read('lively.freezer/src/loading-screen.cp.js').split('export class WorldLoadingScreen')[1].split('\nconst ErrorIndicator')[0];
  const document = { location: null };
  const Screen = runInNewContext('class WorldLoadingScreen' + screenSource + '\nWorldLoadingScreen', {
    Morph: class {}, document, window: {}, URLSearchParams,
    resource: url => ({ query: () => parseQuery(url) })
  });
  const screen = new Screen();
  for (const [href, expectedWorld, expectedProject] of [
    ['file:///home/user/projects/worlds/desktop/index.html?name=__newWorld__&route=worlds', '__newWorld__', false],
    ['file:///projects/desktop/index.html?name=worlds%2Fdemo&route=projects', false, 'worlds/demo'],
    ['file:///worlds/projects/desktop/index.html?name=demo', false, false],
    ['http://localhost:9011/worlds/load?name=projects', 'projects', false],
    ['http://localhost:9011/projects/load?name=worlds%2Fdemo', false, 'worlds/demo']
  ]) {
    document.location = new URL(href);
    assert.equal(screen.getWorldName(), expectedWorld);
    assert.equal(screen.getProjectName(), expectedProject);
  }
  console.log('Loading-screen routes: installation paths and names cannot change the route');

  for (const projectURL of [project.url, 'file:///C:/Users/RUNNER%7E1/lively%20desktop/local_projects/demo/', "file:///C:/Users/O'Brien/local_projects/demo/", 'http://localhost:9011/local_projects/demo/']) {
    const declarations = [];
    const installCSS = method('lively.project/project.js', 'installCSSForProject', {
      resource: url => ({ join: name => ({ url: new URL(name, url).href, read: async () => '.project { color: red; }' }) }),
      addOrChangeCSSDeclaration: (id, css) => declarations.push(css),
      $world: { fileWatcher: { registerFileAction () {} } }
    });
    for (const forProject of [true, false]) await installCSS(projectURL, forProject, 'demo', { retrieveProjectFontsFromCSS: async () => {} });
    assert.ok(declarations.length > 1);
    assert.ok(declarations.every(css => css.startsWith(`@import '${new URL('fonts.css', projectURL).href.replace(/'/g, '%27')}';\n`)));
  }
  console.log('Project font imports resolve from the project on native Unix/Windows and HTTP pages');

  const messages = [];
  let terminated = false;
  const worker = {
    postMessage ({ id, method }) {
      messages.push(method);
      queueMicrotask(() => worker.onmessage({ data: { id } }));
    },
    terminate: () => { terminated = true; }
  };
  const failed = createClient(fixture, { createWorker: async () => worker });
  await failed.initialize();
  worker.onerror({ preventDefault () {}, message: 'worker failed' });
  await failed.close();
  assert.equal(terminated, true);
  assert.equal(messages.includes('close'), false, 'A failed worker cannot acknowledge shutdown');
  const closeSource = read('lively.app/desktop/start-server.cjs').match(/win\.on\('close', (function \(\) \{[\s\S]*?\n    \})\);/)[1];
  for (const behavior of ['success', 'failure', 'hung']) {
    let timeout, cleared = false, closed = false;
    const close = runInNewContext('(' + closeSource + ')', {
      backend: { close: () => behavior === 'hung' ? new Promise(() => {})
        : behavior === 'failure' ? Promise.reject(new Error('shutdown failed')) : Promise.resolve() },
      emitError: () => {}, setTimeout: callback => { timeout = callback; }, clearTimeout: () => { cleared = true; }
    });
    close.call({ close: force => { closed = force; } });
    await new Promise(setImmediate);
    if (behavior === 'hung') timeout();
    else assert.equal(cleared, true);
    assert.equal(closed, true, `Window stayed open after ${behavior} shutdown`);
  }
  console.log('Native shutdown: failed workers terminate and rejected/hung shutdowns close the window');

  fs.mkdirSync(path.join(fixture, 'lively.server/scripts'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'lively.server/scripts/build-library-snapshot.cjs'),
    'module.exports = require(' + JSON.stringify(path.join(root, 'lively.server/scripts/build-library-snapshot.cjs')) + ');');
  fs.mkdirSync(path.join(fixture, 'lively.morphic'));
  fs.writeFileSync(path.join(fixture, 'lively.morphic/index.js'), 'export const value = 42;');
  const oldPrebuilt = process.env.LIVELY_PREBUILT_LIBRARY_SNAPSHOT;
  delete process.env.LIVELY_PREBUILT_LIBRARY_SNAPSHOT;
  try {
    const archiveSource = async buffer => {
      const require = createRequire(path.join(root, 'lively.server/package.json'));
      const extract = createRequire(require.resolve('tar-fs'))('tar-stream').extract();
      let source;
      extract.on('entry', (header, stream, next) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => { if (header.name === 'lively.morphic/index.js') source = Buffer.concat(chunks).toString(); next(); });
      });
      await pipeline(Readable.from([buffer]), createGunzip(), extract);
      return source;
    };
    const builder = createRequire(import.meta.url)(path.join(fixture, 'lively.server/scripts/build-library-snapshot.cjs'));
    const build = builder.buildLibrarySnapshot;
    let attempts = 0;
    builder.buildLibrarySnapshot = async (...args) => {
      if (!attempts++) throw new Error('transient source archive failure');
      return build(...args);
    };
    const backend = createBackend(fixture);
    await assert.rejects(backend.readFile(baseURL + 'compressed-sources'), /transient source archive failure/);
    let first;
    try { first = await backend.readFile(baseURL + 'compressed-sources'); }
    finally { builder.buildLibrarySnapshot = build; }
    assert.equal(await archiveSource(first), 'export const value = 42;');
    assert.equal(fs.existsSync(path.join(fixture, 'lively.server/.library-snapshot.tar.gz')), false, 'Development archives cannot be copied into a later package');
    fs.writeFileSync(path.join(fixture, 'lively.morphic/index.js'), 'export const value = 43;');
    assert.equal(await backend.readFile(baseURL + 'compressed-sources'), first, 'Reuse the snapshot during one backend lifetime');
    assert.equal(await archiveSource(await createBackend(fixture).readFile(baseURL + 'compressed-sources')), 'export const value = 43;');
    await backend.close();
  } finally {
    if (oldPrebuilt === undefined) delete process.env.LIVELY_PREBUILT_LIBRARY_SNAPSHOT;
    else process.env.LIVELY_PREBUILT_LIBRARY_SNAPSHOT = oldPrebuilt;
  }
  console.log('Native slow loading: builds a missing source archive and refreshes it on the next launch');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
