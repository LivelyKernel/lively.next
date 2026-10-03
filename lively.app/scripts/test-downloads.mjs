#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { download } from './build.mjs';

const payload = 'complete archive\n'.repeat(256);
if (process.argv[2] === '--server') {
  const requests = {};
  http.createServer((req, res) => {
    const attempt = requests[req.url] = (requests[req.url] || 0) + 1;
    if (req.url === '/redirect') {
      res.writeHead(302, { location: '/retry' });
      res.end();
    } else if (req.url === '/retry' && attempt === 1) {
      res.writeHead(503);
      res.end('try again');
    } else if (req.url === '/missing') {
      res.writeHead(404);
      res.end('missing');
    } else {
      res.writeHead(200, { 'content-length': Buffer.byteLength(payload) });
      res.end(req.url === '/truncated' && attempt === 1 ? 'partial' : payload);
    }
  }).listen(0, '127.0.0.1', function () { process.send(this.address().port); });
} else {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively downloads '));
  const server = fork(fileURLToPath(import.meta.url), ['--server'], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  try {
    const [port] = await once(server, 'message');
    const archive = path.join(fixture, 'archive with spaces.zip');
    for (const route of ['redirect', 'truncated']) {
      download(`http://127.0.0.1:${port}/${route}`, archive);
      assert.equal(fs.readFileSync(archive, 'utf8'), payload);
      assert.deepEqual(fs.readdirSync(fixture), [path.basename(archive)]);
    }
    assert.throws(() => download(`http://127.0.0.1:${port}/missing`, archive));
    assert.equal(fs.readFileSync(archive, 'utf8'), payload);
    assert.deepEqual(fs.readdirSync(fixture), [path.basename(archive)]);
    console.log('Desktop downloads follow redirects, retry HTTP/truncated transfers, and retain only complete archives.');
  } finally {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}
