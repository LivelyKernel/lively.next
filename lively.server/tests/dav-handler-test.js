/* global before, after, describe, it, Buffer, process */

import { expect } from 'mocha-es6';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, symlink, chmod, readlink, readdir } from 'node:fs/promises';
import fs, { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { string } from 'lively.lang';
import LivelyDAVPlugin from '../plugins/dav.js';

describe('DAV handler', function () {
  // Real sockets and file I/O share the lively server process that hosts the
  // tests, which can be busy with other work; mocha's 2s default is too tight.
  this.timeout(30 * 1000);

  let base, root, server, plugin;

  before(async () => {
    base = await mkdtemp(join(tmpdir(), 'lively-dav-handler-'));
    root = join(base, 'root');
    await mkdir(join(root, 'sub dir/nested'), { recursive: true });
    await writeFile(join(root, 'a.js'), 'export const a = 1;\n');
    await writeFile(join(root, 'sub dir/ü #?&.txt'), 'unicode');
    await writeFile(join(base, 'secret.txt'), 'outside of the root');
    await writeFile(join(base, 'secret.js'), 'export const secret = 1;');
    plugin = new LivelyDAVPlugin();
    plugin.setOptions({ rootDirectory: root });
    server = http.createServer((req, res) => {
      plugin.handleRequest(req, res).catch(error => {
        res.writeHead(500);
        res.end(error.stack);
      });
    });
    plugin.server = server;
    plugin.fileHashes = {};
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    // Don't wait for keep-alive sockets to time out.
    server?.closeAllConnections();
    if (server) await new Promise(resolve => server.close(resolve));
    plugin?.close();
    if (base) await rm(base, { recursive: true, force: true });
  });

  /** Sends `path` unchanged, so that it can contain `..` segments. */
  function send (method, path, { headers = {}, body } = {}) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: server.address().port, path, method,
        headers: { 'accept-encoding': 'gzip', ...headers }
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({
          status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks)
        }));
      });
      req.on('error', reject);
      req.setTimeout(10 * 1000, () =>
        req.destroy(new Error(`${method} ${path} stalled after ${Date.now() - started}ms`)));
      req.end(body);
    });
  }

  /** Resolves once `condition()` holds; the hash map is updated after the response. */
  async function eventually (condition, timeout = 10 * 1000) {
    for (const started = Date.now(); !await condition(); await new Promise(resolve => setTimeout(resolve, 25))) {
      if (Date.now() - started > timeout) throw new Error(`condition not met after ${timeout}ms: ${condition}`);
    }
  }

  /** Names of leftover temporary files of PUTs below `dir`. */
  async function temporaryFiles (dir = '') {
    return (await readdir(join(root, dir))).filter(name => name.startsWith('.lively-put-'));
  }

  /** The ETag the handler is expected to send for `file`. */
  async function etagOf (file) {
    const { ino, size, mtimeNs } = await stat(join(root, file), { bigint: true });
    return `"${ino}-${size}-${mtimeNs}"`;
  }

  describe('PROPFIND', () => {
    it('answers with the multistatus XML that lively.resources parses', async () => {
      const response = await send('PROPFIND', '/sub%20dir/', { headers: { 'content-type': 'text/xml' } });
      const dirTime = (await stat(join(root, 'sub dir'))).mtime.toUTCString();
      const nestedTime = (await stat(join(root, 'sub dir/nested'))).mtime.toUTCString();
      const fileTime = (await stat(join(root, 'sub dir/ü #?&.txt'))).mtime.toUTCString();
      const etag = (await etagOf('sub dir/ü #?&.txt')).replace(/"/g, '&#34;');
      const modified = '<d:getlastmodified xmlns:b="urn:uuid:c2f41010-65b3-11d1-a29f-00aa00c14882/" b:dt="dateTime.rfc1123">';
      const ok = '</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>';
      expect(response.status).equals(207);
      expect(response.headers['content-type']).equals('application/xml; charset=utf-8');
      expect(response.body.toString()).equals(
        '<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:">' +
        `<d:response><d:href>/sub%20dir/</d:href><d:propstat><d:prop>${modified}${dirTime}</d:getlastmodified>` +
        `<d:resourcetype><d:collection/></d:resourcetype>${ok}` +
        `<d:response><d:href>/sub%20dir/nested/</d:href><d:propstat><d:prop>${modified}${nestedTime}</d:getlastmodified>` +
        `<d:resourcetype><d:collection/></d:resourcetype>${ok}` +
        `<d:response><d:href>/sub%20dir/%C3%BC%20%23%3F&#38;.txt</d:href><d:propstat><d:prop>${modified}${fileTime}</d:getlastmodified>` +
        `<d:getcontentlength>7</d:getcontentlength><d:resourcetype></d:resourcetype><d:getetag>${etag}</d:getetag>` +
        `<d:getcontenttype>text/plain; charset=utf-8</d:getcontenttype>${ok}` +
        '</d:multistatus>');
    });

    it('lists only the resource itself for Depth: 0 and for files', async () => {
      const directory = await send('PROPFIND', '/sub%20dir', { headers: { depth: '0' } });
      const file = await send('PROPFIND', '/a.js');
      expect(directory.body.toString().match(/<d:href>[^<]*<\/d:href>/g)).deep.equals(['<d:href>/sub%20dir/</d:href>']);
      expect(file.body.toString().match(/<d:href>[^<]*<\/d:href>/g)).deep.equals(['<d:href>/a.js</d:href>']);
      expect(file.body.toString()).includes('<d:getcontenttype>application/javascript; charset=utf-8</d:getcontenttype>');
    });

    it('prefixes hrefs with x-lively-proxy-path', async () => {
      const response = await send('PROPFIND', '/sub%20dir/', { headers: { 'x-lively-proxy-path': '/lively/' } });
      expect(response.body.toString().match(/<d:href>[^<]*<\/d:href>/g)).deep.equals([
        '<d:href>/lively/sub%20dir/</d:href>',
        '<d:href>/lively/sub%20dir/nested/</d:href>',
        '<d:href>/lively/sub%20dir/%C3%BC%20%23%3F&#38;.txt</d:href>'
      ]);
    });

    it('lists the entries behind a broken symbolic link', async () => {
      await mkdir(join(root, 'links'));
      await symlink('missing', join(root, 'links/broken'));
      await writeFile(join(root, 'links/z.txt'), 'z');
      const response = await send('PROPFIND', '/links/');
      expect(response.body.toString().match(/<d:href>[^<]*<\/d:href>/g)).deep.equals([
        '<d:href>/links/</d:href>', '<d:href>/links/z.txt</d:href>'
      ]);
    });

    it('answers 404 for missing resources', async () => {
      expect((await send('PROPFIND', '/missing/')).status).equals(404);
    });

    it('ignores the query, also if it contains a URL', async () => {
      const response = await send('PROPFIND', '/sub%20dir/?from=http://example.com/x');
      expect(response.status).equals(207);
      expect(response.body.toString()).includes('<d:href>/sub%20dir/</d:href>');
    });

    it('hides the temporary files of PUTs in progress', async () => {
      await mkdir(join(root, 'uploading'));
      await writeFile(join(root, 'uploading/.lively-put-0123456789ab'), 'partial');
      await writeFile(join(root, 'uploading/.hidden'), 'listed');
      await writeFile(join(root, 'uploading/.lively-put-notes'), 'listed');
      const response = await send('PROPFIND', '/uploading/');
      expect(response.body.toString().match(/<d:href>[^<]*<\/d:href>/g).sort()).deep.equals([
        '<d:href>/uploading/.hidden</d:href>', '<d:href>/uploading/.lively-put-notes</d:href>', '<d:href>/uploading/</d:href>'
      ]);
      expect((await send('GET', '/uploading/')).body.toString()).not.includes('0123456789ab');
    });

    it('skips symbolic link loops', async () => {
      await mkdir(join(root, 'loop'));
      await symlink('b', join(root, 'loop/a'));
      await symlink('a', join(root, 'loop/b'));
      await writeFile(join(root, 'loop/c.txt'), 'c');
      const response = await send('PROPFIND', '/loop/');
      expect(response.status).equals(207);
      expect(response.body.toString().match(/<d:href>[^<]*<\/d:href>/g)).deep.equals([
        '<d:href>/loop/</d:href>', '<d:href>/loop/c.txt</d:href>'
      ]);
      expect((await send('GET', '/loop/a')).status).equals(404);
    });
  });

  describe('GET and HEAD', () => {
    it('streams files with validators', async () => {
      const response = await send('GET', '/a.js');
      expect(response.status).equals(200);
      expect(response.body.toString()).equals('export const a = 1;\n');
      expect(response.headers).to.containSubset({
        'content-type': 'application/javascript; charset=utf-8',
        'content-length': '20',
        etag: await etagOf('a.js'),
        'last-modified': (await stat(join(root, 'a.js'))).mtime.toUTCString(),
        'cache-control': 'no-cache, no-transform'
      });
    });

    it('answers HEAD with the headers of GET', async () => {
      const get = await send('GET', '/a.js');
      const head = await send('HEAD', '/a.js');
      expect(head.status).equals(200);
      expect(head.body.length).equals(0);
      for (const name of ['content-type', 'content-length', 'etag', 'last-modified']) {
        expect(head.headers[name]).equals(get.headers[name]);
      }
    });

    it('answers HEAD from the file status, so that unreadable files exist()', async function () {
      if (process.platform === 'win32' || process.getuid?.() === 0) return this.skip();
      await writeFile(join(root, 'locked.txt'), 'locked');
      await chmod(join(root, 'locked.txt'), 0);
      try {
        const head = await send('HEAD', '/locked.txt');
        expect(head.status).equals(200);
        expect(head.headers['content-length']).equals('6');
        expect(head.headers.etag).equals(await etagOf('locked.txt'));
        expect((await send('GET', '/locked.txt')).status).equals(403);
      } finally {
        await chmod(join(root, 'locked.txt'), 0o600);
      }
    });

    it('does not open FIFOs, which would block a file system thread', async function () {
      if (process.platform === 'win32') return this.skip();
      const fifo = join(root, 'pipe');
      execFileSync('mkfifo', [fifo]);
      try {
        for (const method of ['GET', 'HEAD']) {
          const response = await send(method, '/pipe');
          expect(response.status, method).equals(403);
          expect(response.body.toString(), method).equals(method === 'GET' ? 'Not a regular file' : '');
        }
        expect((await send('GET', '/a.js')).status).equals(200);
      } finally {
        // Releases a thread waiting in open() if the handler opened the FIFO.
        try { fs.closeSync(fs.openSync(fifo, fs.constants.O_WRONLY | fs.constants.O_NONBLOCK)); } catch (err) { /* no reader */ }
        await rm(fifo);
      }
    });

    it('answers HEAD on directories with 200, which exists() relies on', async () => {
      expect((await send('HEAD', '/sub%20dir/')).status).equals(200);
      expect((await send('HEAD', '/sub%20dir')).status).equals(200);
    });

    it('lists directories as HTML', async () => {
      const response = await send('GET', '/sub%20dir/');
      expect(response.status).equals(200);
      expect(response.headers['content-type']).equals('text/html; charset=utf-8');
      expect(response.body.toString()).includes('<a href="/sub%20dir/nested/">nested</a>');
    });

    it('answers 404 for missing files, with a message', async () => {
      const missing = await send('GET', '/missing.js');
      expect(missing.status).equals(404);
      expect(missing.headers['content-type']).equals('text/plain; charset=utf-8');
      expect(missing.body.toString()).equals('Not Found');
      expect((await send('HEAD', '/missing.js')).status).equals(404);
      expect((await send('GET', '/' + 'x'.repeat(300) + '.js')).status).equals(404);
    });

    it('ignores the query, also if it contains a URL', async () => {
      const response = await send('GET', '/a.js?u=http://x/y.js');
      expect(response.status).equals(200);
      expect(response.body.toString()).equals('export const a = 1;\n');
      expect((await send('GET', '//a.js')).status).equals(200);
    });

    it('serves the content types that browsers check', async () => {
      await writeFile(join(root, 'm.mjs'), 'export {};');
      await writeFile(join(root, 'c.cjs'), 'module.exports = 1;');
      await writeFile(join(root, 'w.wasm'), Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
      await writeFile(join(root, 'd.json'), '{}');
      const types = {};
      for (const name of ['m.mjs', 'c.cjs', 'w.wasm', 'd.json']) types[name] = (await send('HEAD', '/' + name)).headers['content-type'];
      expect(types).deep.equals({
        'm.mjs': 'application/javascript; charset=utf-8',
        'c.cjs': 'application/javascript; charset=utf-8',
        'w.wasm': 'application/wasm',
        'd.json': 'application/json'
      });
    });

    it('does not send a substituted content encoding with errors', async () => {
      await mkdir(join(root, 'components_cache'), { recursive: true });
      const response = await send('GET', '/components_cache/missing.json', { headers: { 'accept-encoding': 'gzip, br' } });
      expect(response.status).equals(404);
      expect(response.headers['content-encoding']).equals(undefined);
      expect(response.body.toString()).equals('Not Found');
    });

    it('serves headers and bytes of the same version while a PUT replaces the file', async () => {
      // Deterministic version of the race: the file is replaced right before the handler opens it.
      const oldText = 'old version';
      const newText = 'the new, longer version';
      await writeFile(join(root, 'raced.txt'), oldText);
      await writeFile(join(base, 'replacement.txt'), newText);
      const open = fs.open;
      fs.open = function (file, ...args) {
        if (String(file).endsWith('raced.txt')) fs.renameSync(join(base, 'replacement.txt'), join(root, 'raced.txt'));
        return open.call(this, file, ...args);
      };
      let response;
      try { response = await send('GET', '/raced.txt'); } finally { fs.open = open; }
      expect(response.body.toString()).equals(newText);
      expect(response.headers['content-length']).equals(String(newText.length));
      expect(response.headers.etag).equals(await etagOf('raced.txt'));
    });

    it('answers 304 with the validators, also for If-None-Match lists and *', async () => {
      const etag = await etagOf('a.js');
      for (const ifNoneMatch of [`"other", W/${etag}`, '*']) {
        const response = await send('GET', '/a.js', { headers: { 'if-none-match': ifNoneMatch } });
        expect(response.status, ifNoneMatch).equals(304);
        expect(response.headers, ifNoneMatch).to.containSubset({ etag, 'cache-control': 'no-cache, no-transform' });
        expect(response.headers['last-modified'], ifNoneMatch).equals((await stat(join(root, 'a.js'))).mtime.toUTCString());
      }
      expect((await send('GET', '/a.js', { headers: { 'if-none-match': '"other", "another"' } })).status).equals(200);
    });

    it('closes the file after every kind of answer', async () => {
      await writeFile(join(root, 'empty.txt'), '');
      const etag = await etagOf('a.js');
      const open = fs.open;
      const close = fs.close;
      const openFiles = new Set();
      fs.open = function (file, ...args) {
        const callback = args.pop();
        return open.call(this, file, ...args, (err, fd) => {
          if (!err && String(file).startsWith(root)) openFiles.add(fd);
          callback(err, fd);
        });
      };
      fs.close = function (fd, ...args) {
        openFiles.delete(fd);
        return close.call(this, fd, ...args);
      };
      try {
        const statuses = [];
        for (const [path, headers] of [['/a.js', {}], ['/a.js', { range: 'bytes=0-5' }], ['/empty.txt', {}],
          ['/a.js', { 'if-none-match': etag }], ['/a.js', { range: 'bytes=100-' }], ['/a.js', { 'if-match': '"other"' }]]) {
          statuses.push((await send('GET', path, { headers })).status);
        }
        expect(statuses).deep.equals([200, 206, 200, 304, 416, 412]);
        await eventually(() => openFiles.size === 0, 2000);
      } finally {
        fs.open = open;
        fs.close = close;
      }
    });

    it('serves byte ranges', async () => {
      const response = await send('GET', '/a.js', { headers: { range: 'bytes=7-11' } });
      expect(response.status).equals(206);
      expect(response.headers['content-range']).equals('bytes 7-11/20');
      expect(response.body.toString()).equals('const');
      const clamped = await send('GET', '/a.js', { headers: { range: 'bytes=13-100' } });
      expect(clamped.status).equals(206);
      expect(clamped.headers['content-range']).equals('bytes 13-19/20');
      expect(clamped.body.toString()).equals('a = 1;\n');
      const unsatisfiable = await send('GET', '/a.js', { headers: { range: 'bytes=20-' } });
      expect(unsatisfiable.status).equals(416);
      expect(unsatisfiable.headers['content-range']).equals('bytes */20');
    });

    it('ignores invalid ranges and ranges of a changed file', async () => {
      const invalid = await send('GET', '/a.js', { headers: { range: 'bytes=5-2' } });
      expect(invalid.status).equals(200);
      expect(invalid.body.toString()).equals('export const a = 1;\n');
      const current = await send('GET', '/a.js', { headers: { range: 'bytes=0-5', 'if-range': await etagOf('a.js') } });
      expect(current.status).equals(206);
      expect(current.body.toString()).equals('export');
      const stale = await send('GET', '/a.js', { headers: { range: 'bytes=0-5', 'if-range': '"stale"' } });
      expect(stale.status).equals(200);
      expect(stale.body.toString()).equals('export const a = 1;\n');
    });

    it('does not serve or hash files outside of the root', async () => {
      for (const path of ['/../secret.txt', '/sub%20dir/../../secret.txt', '/..%2fsecret.txt', '/%2e%2e%2fsecret.txt',
        '/../secret.js', '/%2e%2e/secret.js', '/..%2fsecret.js']) {
        const response = await send('GET', path);
        expect(response.status, path).equals(403);
        expect(response.body.toString(), path).equals('Path is outside of the root directory');
      }
      await send('GET', '/a.js'); // hashed after the response, like the requests above would be
      await eventually(() => plugin.fileHashes['/a.js'] !== undefined);
      expect(Object.keys(plugin.fileHashes).filter(key => key.includes('secret'))).deep.equals([]);
    });

    it('rejects malformed URLs', async () => {
      expect((await send('GET', '/%E0%A4%A.js')).status).equals(400);
      expect((await send('GET', '/a.js%00')).status).equals(400);
      const unparsable = await send('GET', '*');
      expect(unparsable.status).equals(400);
      expect(unparsable.body.toString()).equals('Malformed URL');
    });
  });

  describe('PUT', () => {
    it('creates (201) and replaces (200) files', async () => {
      const created = await send('PUT', '/sub%20dir/new%20%C3%A4.txt', { body: 'first' });
      const replaced = await send('PUT', '/sub%20dir/new%20%C3%A4.txt', { body: 'second' });
      expect(created.status).equals(201);
      expect(replaced.status).equals(200);
      expect(await readFile(join(root, 'sub dir/new ä.txt'), 'utf8')).equals('second');
      expect(await temporaryFiles('sub dir')).deep.equals([]);
    });

    it('answers 404 if the parent directory is missing, as lively.git expects', async () => {
      expect((await send('PUT', '/missing/new.txt', { body: 'x' })).status).equals(404);
      expect(existsSync(join(root, 'missing'))).equals(false);
    });

    it('does not replace directories', async () => {
      expect((await send('PUT', '/sub%20dir', { body: 'x' })).status).equals(409);
    });

    it('checks If-Match and If-None-Match', async () => {
      await writeFile(join(root, 'guarded.txt'), 'v1');
      const current = await etagOf('guarded.txt');
      expect((await send('PUT', '/guarded.txt', { headers: { 'if-match': '"other"' }, body: 'x' })).status).equals(412);
      expect((await send('PUT', '/guarded.txt', { headers: { 'if-none-match': '*' }, body: 'x' })).status).equals(412);
      expect((await send('PUT', '/guarded.txt', { headers: { 'if-none-match': current }, body: 'x' })).status).equals(412);
      expect(await readFile(join(root, 'guarded.txt'), 'utf8')).equals('v1');
      expect((await send('PUT', '/guarded.txt', { headers: { 'if-match': current }, body: 'v2' })).status).equals(200);
      expect(await readFile(join(root, 'guarded.txt'), 'utf8')).equals('v2');
      expect((await send('PUT', '/unguarded.txt', { headers: { 'if-match': '*' }, body: 'x' })).status).equals(412);
      expect(existsSync(join(root, 'unguarded.txt'))).equals(false);
      expect((await send('PUT', '/unguarded.txt', { headers: { 'if-none-match': '*' }, body: 'new' })).status).equals(201);
    });

    it('keeps the old content if an upload is aborted', async () => {
      await writeFile(join(root, 'keep.txt'), 'old content');
      await new Promise(resolve => {
        const req = http.request({
          hostname: '127.0.0.1', port: server.address().port, path: '/keep.txt', method: 'PUT',
          headers: { 'content-length': 1000 }
        });
        req.on('error', () => resolve());
        req.write('partial');
        setTimeout(() => { req.destroy(); resolve(); }, 100);
      });
      // The server removes the temporary file once it notices the abort.
      await eventually(async () => (await temporaryFiles()).length === 0);
      expect(await readFile(join(root, 'keep.txt'), 'utf8')).equals('old content');
    });

    it('writes through symbolic links and keeps file permissions', async () => {
      await writeFile(join(root, 'script.sh'), 'echo 1');
      await chmod(join(root, 'script.sh'), 0o750);
      await symlink('script.sh', join(root, 'link.sh'));
      expect((await send('PUT', '/link.sh', { body: 'echo 2' })).status).equals(200);
      expect(await readlink(join(root, 'link.sh'))).equals('script.sh');
      expect(await readFile(join(root, 'script.sh'), 'utf8')).equals('echo 2');
      expect((await stat(join(root, 'script.sh'))).mode & 0o777).equals(0o750);
    });

    it('streams large bodies', async () => {
      const body = Buffer.alloc(8 * 1024 * 1024, 'lively');
      expect((await send('PUT', '/large.bin', { body })).status).equals(201);
      const response = await send('GET', '/large.bin');
      expect(response.headers['content-length']).equals(String(body.length));
      expect(response.body.equals(body)).equals(true);
    });

    it('writes in place where a rename cannot replace the file', async () => {
      await mkdir(join(root, 'mounted'));
      await writeFile(join(root, 'mounted/file.txt'), 'old');
      const { ino } = await stat(join(root, 'mounted/file.txt'));
      const rename = fs.promises.rename;
      let code;
      fs.promises.rename = async function (from, to) {
        if (String(to).endsWith('file.txt')) throw Object.assign(new Error(code), { code });
        return rename.call(this, from, to);
      };
      try {
        code = 'ENOENT'; // other errors are answered, and the upload is removed
        expect((await send('PUT', '/mounted/file.txt', { body: 'new' })).status).equals(404);
        expect(await temporaryFiles('mounted')).deep.equals([]);
        code = 'EBUSY';
        expect((await send('PUT', '/mounted/file.txt', { body: 'new' })).status).equals(200);
      } finally {
        fs.promises.rename = rename;
      }
      expect(await readFile(join(root, 'mounted/file.txt'), 'utf8')).equals('new');
      expect((await stat(join(root, 'mounted/file.txt'))).ino).equals(ino);
      expect(await temporaryFiles('mounted')).deep.equals([]);
    });

    it('keeps the upload if writing in place fails', async () => {
      await mkdir(join(root, 'full'));
      await writeFile(join(root, 'full/file.txt'), 'old content');
      const { rename, copyFile } = fs.promises;
      const error = console.error;
      const logged = [];
      fs.promises.rename = async () => { throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' }); };
      fs.promises.copyFile = async (from, to) => {
        await writeFile(to, 'new');
        throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      };
      console.error = (...args) => logged.push(args.map(String).join(' '));
      let response;
      try {
        response = await send('PUT', '/full/file.txt', { body: 'new content' });
      } finally {
        Object.assign(fs.promises, { rename, copyFile });
        console.error = error;
      }
      expect(response.status).equals(500);
      expect(response.body.toString()).equals('Internal Server Error');
      const kept = await temporaryFiles('full');
      expect(kept.length).equals(1);
      expect(await readFile(join(root, 'full', kept[0]), 'utf8')).equals('new content');
      expect(logged.some(line => line.includes(join(root, 'full', kept[0])))).equals(true, logged.join('\n'));
    });

    it('updates the source hash with the written content', async () => {
      await send('PUT', '/hashed.js', { body: 'export const version = 1;' });
      await send('PUT', '/hashed.js', { body: 'export const version = 2;' });
      const expected = string.hashCode('export const version = 2;');
      await eventually(() => plugin.fileHashes['/hashed.js'] === expected);
    });
  });

  describe('MKCOL and DELETE', () => {
    it('creates directories', async () => {
      expect((await send('MKCOL', '/made/')).status).equals(201);
      expect((await stat(join(root, 'made'))).isDirectory()).equals(true);
      expect((await send('MKCOL', '/made/')).status).equals(405);
      expect((await send('MKCOL', '/missing/made/')).status).equals(409);
    });

    it('deletes files and non-empty directories', async () => {
      await mkdir(join(root, 'doomed/inner'), { recursive: true });
      await writeFile(join(root, 'doomed/inner/file.txt'), 'x');
      await writeFile(join(root, 'doomed.txt'), 'x');
      expect((await send('DELETE', '/doomed.txt')).status).equals(204);
      expect((await send('DELETE', '/doomed/')).status).equals(204);
      expect(existsSync(join(root, 'doomed.txt'))).equals(false);
      expect(existsSync(join(root, 'doomed'))).equals(false);
      expect((await send('DELETE', '/doomed/')).status).equals(404);
    });

    it('deletes a symbolic link to a directory, not the directory', async () => {
      await symlink('sub dir', join(root, 'dir-link'));
      expect((await send('DELETE', '/dir-link')).status).equals(204);
      expect(existsSync(join(root, 'dir-link'))).equals(false);
      expect(existsSync(join(root, 'sub dir/ü #?&.txt'))).equals(true);
    });

    it('deletes broken symbolic links', async () => {
      await symlink('missing-target', join(root, 'broken-link'));
      expect((await send('DELETE', '/broken-link')).status).equals(204);
      expect(await readdir(root)).not.includes('broken-link');
    });

    it('refuses to delete the root directory', async () => {
      expect((await send('DELETE', '/')).status).equals(403);
      expect(existsSync(root)).equals(true);
    });
  });
});
