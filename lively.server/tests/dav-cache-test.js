/* global before, after, describe, it, Buffer */

import { expect } from 'mocha-es6';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import LivelyDAVPlugin from '../plugins/dav.js';

describe('DAV cache validators', () => {
  const oldBody = '{"value":"before"}';
  const newBody = '{"value":"after!"}';
  const second = Math.floor(Date.now() / 1000) * 1000 - 2000;
  let directory, server, plugin;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lively-dav-cache-'));
    await mkdir(join(directory, 'components_cache'));
    plugin = new LivelyDAVPlugin();
    plugin.setOptions({ rootDirectory: directory });
    server = http.createServer((req, res) => {
      plugin.handleRequest(req, res).catch(error => {
        res.writeHead(500);
        res.end(error.stack);
      });
    });
    plugin.server = server;
    plugin.fileHashes = {};
    plugin.patchServerForJsDAV(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    plugin?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  /** Pin distinct subsecond mtimes without sleeps or clock-boundary races. */
  async function write (file, body, offset) {
    const path = join(directory, file);
    await writeFile(path, body);
    await utimes(path, new Date(second + offset), new Date(second + offset));
  }

  /** Read through the real HTTP plugin and jsDAV handler. */
  function read (path, headers = {}, method = 'GET') {
    return new Promise((resolve, reject) => {
      http.request({ hostname: '127.0.0.1', port: server.address().port, path, method,
        headers: { 'accept-encoding': 'identity', ...headers } }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode,
          headers: response.headers, body: Buffer.concat(chunks) }));
      }).on('error', reject).end();
    });
  }

  /** Send the validators returned by the previous read, as browsers do. */
  function conditionalHeaders (response) {
    return {
      'if-modified-since': response.headers['last-modified'],
      ...(response.headers.etag ? { 'if-none-match': response.headers.etag } : {})
    };
  }

  it('returns new content after a same-second same-size rewrite', async () => {
    await write('fixture.json', oldBody, 100);
    const initial = await read('/fixture.json');
    await write('fixture.json', newBody, 800);
    const current = await read('/fixture.json');
    const conditional = await read('/fixture.json', conditionalHeaders(initial));
    expect(initial.body.toString()).equals(oldBody);
    expect(current.body.toString()).equals(newBody);
    expect(conditional.status).equals(200);
    expect(conditional.body.toString()).equals(newBody);
    expect(initial.headers.etag).matches(/^"[^"]+"$/);
    expect(current.headers.etag).not.equals(initial.headers.etag);
    expect(current.headers['last-modified']).equals(initial.headers['last-modified']);
  });

  it('returns 304 for unchanged content', async () => {
    await write('unchanged.json', oldBody, 100);
    const initial = await read('/unchanged.json');
    const unchanged = await read('/unchanged.json', conditionalHeaders(initial));
    expect(unchanged.status).equals(304);
    expect(unchanged.body.length).equals(0);
    expect(unchanged.headers.etag).equals(initial.headers.etag);
    expect(unchanged.headers['cache-control']).equals(initial.headers['cache-control']);
    expect(initial.headers['cache-control']).equals('no-cache, no-transform');
  });

  it('accepts a quoted If-None-Match without a date validator', async () => {
    await write('quoted.json', oldBody, 100);
    const initial = await read('/quoted.json');
    const unchanged = await read('/quoted.json', {
      'if-none-match': initial.headers.etag || '"missing-before-fix"'
    });
    expect(unchanged.status).equals(304);
    expect(unchanged.body.length).equals(0);
  });

  it('weakly compares If-None-Match on a GET', async () => {
    await write('weak.json', oldBody, 100);
    const initial = await read('/weak.json');
    const headers = {
      ...conditionalHeaders(initial),
      'if-none-match': 'W/' + (initial.headers.etag || '"missing-before-fix"')
    };
    const unchanged = await read('/weak.json', headers);
    expect(unchanged.status).equals(304);
    expect(unchanged.body.length).equals(0);
    await write('weak.json', newBody, 800);
    const current = await read('/weak.json', headers);
    expect(current.status).equals(200);
    expect(current.body.toString()).equals(newBody);
  });

  it('returns current validators on HEAD without changing its existing 200 behavior', async () => {
    await write('head.json', oldBody, 100);
    const initial = await read('/head.json', {}, 'HEAD');
    const unchanged = await read('/head.json', conditionalHeaders(initial), 'HEAD');
    expect(unchanged.status).equals(200);
    expect(unchanged.body.length).equals(0);
    expect(unchanged.headers.etag).equals(initial.headers.etag);
    await write('head.json', newBody, 800);
    const current = await read('/head.json', conditionalHeaders(initial), 'HEAD');
    expect(current.status).equals(200);
    expect(current.body.length).equals(0);
    expect(current.headers.etag).not.equals(initial.headers.etag);
    expect(current.headers.etag).matches(/^"[^"]+"$/);
  });

  it('returns 304 for unchanged Brotli component-cache content', async () => {
    await write('components_cache/fixture.json', oldBody, 100);
    await write('components_cache/fixture.br.json', brotliCompressSync(oldBody), 100);
    const initial = await read('/components_cache/fixture.json', { 'accept-encoding': 'br' });
    // Only the selected .br.json representation determines its validator.
    await write('components_cache/fixture.json', newBody, 800);
    const unchanged = await read('/components_cache/fixture.json', {
      ...conditionalHeaders(initial), 'accept-encoding': 'br'
    });
    expect(brotliDecompressSync(initial.body).toString()).equals(oldBody);
    expect(unchanged.status).equals(304);
    expect(unchanged.headers['content-encoding']).equals('br');
    expect(unchanged.headers.etag).equals(initial.headers.etag);
  });

  it('returns new Brotli content after a same-second rewrite', async () => {
    const url = '/components_cache/rewrite.json';
    await write('components_cache/rewrite.json', oldBody, 100);
    await write('components_cache/rewrite.br.json', brotliCompressSync(oldBody), 100);
    const initial = await read(url, { 'accept-encoding': 'br' });
    await write('components_cache/rewrite.json', newBody, 800);
    await write('components_cache/rewrite.br.json', brotliCompressSync(newBody), 800);
    const conditional = await read(url, { ...conditionalHeaders(initial), 'accept-encoding': 'br' });
    expect(conditional.status).equals(200);
    expect(brotliDecompressSync(conditional.body).toString()).equals(newBody);
  });

  it('returns 304 for an unchanged hidden import map', async () => {
    await write('.cachedImportMap.json', '{"imports":{}}', 100);
    const initial = await read('/.cachedImportMap.json');
    const unchanged = await read('/.cachedImportMap.json', conditionalHeaders(initial));
    expect(unchanged.status).equals(304);
    expect(unchanged.body.length).equals(0);
  });

  it('preserves date-only conditional requests', async () => {
    await write('date-only.json', oldBody, 100);
    const initial = await read('/date-only.json');
    const unchanged = await read('/date-only.json', {
      'if-modified-since': initial.headers['last-modified']
    });
    expect(unchanged.status).equals(304);
    expect(unchanged.body.length).equals(0);
  });
});
