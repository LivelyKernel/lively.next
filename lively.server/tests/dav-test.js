/* global before, after, describe, it, Buffer */

import { expect } from 'mocha-es6';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import LivelyDAVPlugin from '../plugins/dav.js';

describe('DAV content encoding', () => {
  const body = '{"value":42}';
  let directory, server, plugin;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'lively-dav-'));
    await mkdir(join(directory, 'components_cache'));
    await writeFile(join(directory, 'plain.json'), body);
    await writeFile(join(directory, 'components_cache', 'fixture.json'), body);
    await writeFile(join(directory, 'components_cache', 'fixture.br.json'), brotliCompressSync(body));
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

  /** Make a real request without an implicit Accept-Encoding header. */
  function read (path, headers = {}) {
    return new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: server.address().port, path, headers }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks)
        }));
      }).on('error', reject);
    });
  }

  for (const path of ['/plain.json', '/components_cache/fixture.json']) {
    it(`serves ${path} without Accept-Encoding`, async () => {
      const response = await read(path);
      expect(response.status, response.body.toString()).equals(200);
      expect(response.headers['content-encoding']).equals(undefined);
      expect(response.body.toString()).equals(body);
    });
  }

  it('serves uncompressed JSON when Brotli is not accepted', async () => {
    const response = await read('/components_cache/fixture.json', { 'accept-encoding': 'gzip' });
    expect(response.status).equals(200);
    expect(response.headers['content-encoding']).equals(undefined);
    expect(response.body.toString()).equals(body);
  });

  it('still serves the Brotli version when accepted', async () => {
    const response = await read('/components_cache/fixture.json', { 'accept-encoding': 'gzip, br' });
    expect(response.status).equals(200);
    expect(response.headers['content-encoding']).equals('br');
    expect(brotliDecompressSync(response.body).toString()).equals(body);
  });
});
