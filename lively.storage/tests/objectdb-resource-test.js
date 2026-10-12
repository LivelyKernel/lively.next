/* global System, describe, it, before, after, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { ObjectDBHTTPInterface, ObjectDBInterface } from '../objectdb.js';
import { parseQuery, unregisterExtension } from 'lively.resources';
import { handleObjectDBRequest, registerObjectDBResource, nativeObjectDBURL } from '../objectdb-resource.js';
import { fillDB1 } from './test-helper.js';

describe('ObjectDB client resources', function () {
  this.timeout(30000);
  let fixture, originalFetch, request;
  const client = new ObjectDBHTTPInterface('http://objectdb.test/objectdb/');
  const response = (value, status = 200, contentType = 'application/json') => ({
    ok: status < 400,
    status,
    statusText: status === 200 ? 'OK' : 'Server Error',
    headers: { get: () => contentType },
    text: async () => contentType === 'application/json' ? JSON.stringify(value) : value
  });

  before(async () => { fixture = await fillDB1(); });
  after(async () => {
    await fixture.objectDB.destroy();
    await fixture.snapshotLocation.remove();
  });
  beforeEach(() => {
    originalFetch = System.global.fetch;
    System.global.fetch = async (url, options) => {
      request = { url, options };
      const action = url.split('/').pop().split('?')[0];
      const args = options.method === 'POST' ? JSON.parse(options.body) : parseQuery(url);
      try { return response(await ObjectDBInterface[action](args)); } catch (err) {
        return response({ error: String(err) }, 500);
      }
    };
  });
  afterEach(() => { System.global.fetch = originalFetch; });

  it('reads commits with nested query arguments', async () => {
    const typesAndNames = [{ type: 'world', name: fixture.world2.name }];
    const commits = await client.fetchCommits({ db: fixture.objectDB.name, typesAndNames });
    expect(commits.map(ea => ea._id)).deep.equals([fixture.commit4._id]);
    expect(parseQuery(request.url).typesAndNames).deep.equals(typesAndNames);
  });

  it('commits JSON snapshots with the expected request headers', async () => {
    const snapshot = { name: 'resource test', nested: { value: 42 } };
    const commit = await client.commit({
      db: fixture.objectDB.name, type: 'world', name: snapshot.name,
      snapshot, commitSpec: { author: fixture.author1 }
    });
    expect(commit._id).to.be.a('string');
    expect(request.options.headers['content-type']).equals('application/json');
    expect(JSON.parse(request.options.body).snapshot).deep.equals(snapshot);
    expect(await client.fetchSnapshot({ db: fixture.objectDB.name, commit: commit._id })).deep.equals(snapshot);
  });

  it('preserves missing objects and rejected commits', async () => {
    expect(await client.exists({ db: fixture.objectDB.name, type: 'world', name: 'missing' })).deep.equals({ exists: false });
    const error = await client.commit({
      db: fixture.objectDB.name, type: 'world', name: fixture.world2.name,
      expectedParentCommit: fixture.commit3._id,
      snapshot: fixture.world2, commitSpec: { author: fixture.author1 }
    }).catch(err => err);
    expect(error.message).matches(/version|mismatch/i);
  });

  it('preserves falsy and string JSON results on both paths', async () => {
    for (const value of [false, null, 0, '', 'false']) {
      System.global.fetch = async () => response(value);
      expect(await client._GET('test')).equals(value);
      expect(await client._POST('test')).equals(value);
    }
  });

  it('preserves HTTP payload errors, text failures and network rejection', async () => {
    System.global.fetch = async () => response({ error: 'rejected by backend' }, 500);
    expect((await client._GET('test').catch(err => err)).message).equals('rejected by backend');
    expect((await client._POST('test').catch(err => err)).message).equals('rejected by backend');
    System.global.fetch = async () => response('unavailable', 503, 'text/plain');
    expect((await client._GET('test').catch(err => err)).message).equals('unavailable');
    expect((await client._POST('test').catch(err => err)).message).equals('unavailable');
    System.global.fetch = async () => { throw new Error('network failure'); };
    expect((await client._GET('test').catch(err => err)).message).equals('network failure');
  });

  it('runs the same workflow through a JSON-isolated native resource', async () => {
    registerObjectDBResource(handleObjectDBRequest);
    const native = new ObjectDBHTTPInterface(nativeObjectDBURL);
    try {
      const db = fixture.objectDB.name;
      const snapshot = { name: 'native resource test', nested: { value: 42 } };
      const commit = await native.commit({ db, type: 'world', name: snapshot.name, snapshot, commitSpec: { author: fixture.author1 } });
      snapshot.nested.value = 99;
      expect(await native.fetchSnapshot({ db, commit: commit._id })).deep.equals({ name: snapshot.name, nested: { value: 42 } });
      expect(await native.exists({ db, type: 'world', name: 'missing' })).deep.equals({ exists: false });
      const commits = await native.fetchCommits({ db, typesAndNames: [{ type: 'world', name: snapshot.name }] });
      expect(commits.map(ea => ea._id)).deep.equals([commit._id]);
      expect((await native.commit({ db, type: 'world', name: snapshot.name, snapshot, commitSpec: { author: fixture.author1 }, expectedParentCommit: 'wrong' }).catch(err => err)).message).matches(/version|mismatch/i);
      expect((await native._POST('constructor').catch(err => err)).message).matches(/not supported/);
      expect((await handleObjectDBRequest('GET', 'lively.objectdb://remote/exists?db=test').catch(err => err)).message).matches(/not supported/);
      expect((await handleObjectDBRequest('constructor', nativeObjectDBURL + 'name', '{}').catch(err => err)).message).matches(/not supported/);
      expect((await handleObjectDBRequest('POST', nativeObjectDBURL + 'ensureDB', 'null').catch(err => err)).message).matches(/arguments must be an object/);
    } finally { unregisterExtension('lively.objectdb'); }
  });
});
