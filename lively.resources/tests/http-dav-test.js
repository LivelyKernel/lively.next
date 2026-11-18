/* global System, before, after, describe, it */
import { expect } from 'mocha-es6';
import { resource } from '../index.js';

// Round trip through the http resource against the DAV handler of lively.server.
const describeInBrowser = System.get('@system-env').browser ? describe : describe.skip;

describeInBrowser('http resource against lively.server', function () {
  this.timeout(20000);

  let dir;

  before(async () => {
    dir = resource(System.baseURL).join(`lively.resources/tests/temp-dav-${Date.now()}/`);
    await dir.mkdir();
  });

  after(async () => { await dir?.remove(); });

  it('writes, reads and lists files with special names', async () => {
    const file = dir.join('sub dir/ü & 1.js');
    await file.parent().mkdir();
    await file.write('export const ü = 1;');
    expect(await file.exists()).equals(true);
    expect(await file.read()).equals('export const ü = 1;');
    // Listed URLs are percent-encoded, joined ones are not.
    const [listed] = await file.parent().dirList();
    expect(listed.name()).equals('ü & 1.js');
    expect(listed.isFile()).equals(true);
    expect(await listed.read()).equals('export const ü = 1;');
  });

  it('round trips binary content', async () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255]);
    const file = dir.join('bytes.png');
    await file.write(bytes);
    expect(Array.from(new Uint8Array(await file.read()))).deep.equals(Array.from(bytes));
  });

  it('reads the properties that dirList reports', async () => {
    await dir.join('props/').mkdir();
    await dir.join('props/a.js').write('1234567');
    await dir.join('props/inner/').mkdir();
    const [file, inner] = await dir.join('props/').dirList();
    expect(file.name()).equals('a.js');
    expect(file.size).equals(7);
    expect(file.etag).matches(/^"[^"]+"$/);
    expect(file.contentType).equals('application/javascript; charset=utf-8');
    expect(file.lastModified).instanceOf(Date);
    expect(Math.abs(file.lastModified - Date.now())).lessThan(60000);
    expect(inner.isDirectory()).equals(true);
    expect(inner.url).equals(dir.join('props/inner/').url);
    const props = await dir.join('props/a.js').readProperties();
    expect(props.etag).equals(file.etag);
  });

  it('cannot write into a missing directory or create an existing one', async () => {
    let writeError, mkdirError;
    try { await dir.join('missing/file.txt').write('x'); } catch (err) { writeError = err; }
    try { await dir.mkdir(); } catch (err) { mkdirError = err; }
    expect(String(writeError)).matches(/Cannot write .* 404/);
    expect(String(mkdirError)).matches(/Cannot create directory/);
  });

  it('creates missing parents with ensureExistance and removes directories', async () => {
    const file = dir.join('deep/er/file.txt');
    await file.ensureExistance('content');
    expect(await file.read()).equals('content');
    await dir.join('deep/').remove();
    expect(await dir.join('deep/').exists()).equals(false);
    expect(await dir.exists()).equals(true);
  });
});
