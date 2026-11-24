/* global before, after, describe, it, Buffer */

import { expect } from 'mocha-es6';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import LivelyDAVPlugin from '../plugins/dav.js';

describe('code search', function () {
  // Real sockets and file I/O share the lively server process that hosts the
  // tests, which can be busy with other work; mocha's 2s default is too tight.
  this.timeout(30 * 1000);

  let base, root, server, plugin, origin;

  before(async () => {
    base = await mkdtemp(join(tmpdir(), 'lively-code-search-'));
    root = join(base, 'root');
    const files = {
      'pkg/a.js': 'export const needle = 1;\n// Needle again',
      'pkg/sub dir/b.js': 'needle()',
      'pkg/#/c.js': 'needle', // es5-ext has directories named like this
      'pkg/node_modules/dep/d.js': 'needle',
      'pkg/dist/e.js': 'needle',
      'pkg/lib/f.min.js': 'needle',
      'pkg/notes.txt': 'needle',
      'pkg/nested/g.js': 'needle',
      'other/h.js': 'needle'
    };
    for (const [file, content] of Object.entries(files)) {
      await mkdir(join(root, file, '..'), { recursive: true });
      await writeFile(join(root, file), content);
    }
    await symlink('..', join(root, 'pkg/lib/up')); // a link back to the package
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
    origin = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    // Don't wait for keep-alive sockets to time out.
    server?.closeAllConnections();
    if (server) await new Promise(resolve => server.close(resolve));
    plugin?.close();
    if (base) await rm(base, { recursive: true, force: true });
  });

  /** POSTs `query` to the code search route and resolves to the status and the parsed answer. */
  function search (query, { path = '/__CODE_SEARCH__', headers = {}, body = JSON.stringify(query) } = {}) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1', port: server.address().port, path, method: 'POST',
        headers: { 'content-type': 'application/json', ...headers }
      }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      });
      req.on('error', reject);
      req.setTimeout(10 * 1000, () =>
        req.destroy(new Error(`code search stalled after ${Date.now() - started}ms`)));
      req.end(body);
    });
  }

  const packages = base => [
    { url: `${base}/pkg`, name: 'pkg' },
    { url: `${base}/pkg/nested`, name: 'nested' }
  ];
  const query = (needle, options = {}) => ({
    packages: packages(origin),
    packageURLs: [`${origin}/pkg`, `${origin}/pkg/nested`, `${origin}/other`],
    needle,
    excludedModules: [{ source: '\\.min\\.js', flags: '' }],
    ...options
  });
  const located = results => results.map(({ moduleId, packageName, pathInPackage, line, column }) =>
    `${packageName} ${pathInPackage} ${moduleId.replace(origin, '')}:${line}:${column}`).sort();

  it('searches the .js files of packages as Package#search does', async () => {
    const { status, body } = await search(query('needle'));
    expect(status).equals(200);
    expect(located(body.results)).deep.equals([
      'nested g.js /pkg/nested/g.js:1:0',
      'pkg %23/c.js /pkg/%23/c.js:1:0',
      'pkg a.js /pkg/a.js:1:13',
      'pkg a.js /pkg/a.js:2:3',
      'pkg sub%20dir/b.js /pkg/sub%20dir/b.js:1:0'
    ]);
    expect(body.results.find(m => m.line === 2)).to.containSubset({ length: 6, lineString: '// Needle again' });
    expect(body.unsearched).deep.equals([]);
  });

  it('honours case sensitivity and regular expressions', async () => {
    expect(located((await search(query('Needle', { caseSensitive: true }))).body.results))
      .deep.equals(['pkg a.js /pkg/a.js:2:3']);
    expect(located((await search(query('needle\\(', { regexMode: true }))).body.results))
      .deep.equals(['pkg sub%20dir/b.js /pkg/sub%20dir/b.js:1:0']);
    expect((await search(query({ source: '^// N', flags: 'm' }))).body.results)
      .to.containSubset([{ moduleId: `${origin}/pkg/a.js`, line: 2, column: 0 }]);
  });

  it('leaves packages outside of the served root unsearched', async () => {
    const proxied = `${origin}/lively`;
    const { body } = await search({
      ...query('needle'),
      packages: [...packages(proxied), { url: `${origin}/elsewhere`, name: 'elsewhere' }],
      packageURLs: [`${proxied}/pkg`, `${proxied}/pkg/nested`]
    }, { headers: { 'x-lively-proxy-path': '/lively' } });
    expect(body.unsearched).deep.equals([`${origin}/elsewhere`]);
    expect(located(body.results)).to.include('pkg a.js /lively/pkg/a.js:1:13');
  });

  it('answers 400 for malformed requests and invalid regular expressions', async () => {
    expect((await search(null, { body: '{' })).status).equals(400);
    const invalid = await search(query('(', { regexMode: true }));
    expect(invalid.status).equals(400);
    expect(invalid.body.error).to.match(/Invalid regular expression/);
  });
});
