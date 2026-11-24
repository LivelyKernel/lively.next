import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubAPIWrapper } from '../index.js';

const originalStorage = globalThis.localStorage;
before(() => { globalThis.localStorage = { getItem: () => null }; });
after(() => {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
});

for (const [name, body] of [
  ['empty list', []],
  ['different key title', [{ title: 'other project', id: 1 }]]
]) {
  test(`does not delete a key for ${name}`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () =>
      new Response(JSON.stringify(body)));
    await GitHubAPIWrapper.deleteDeployKey('owner', 'repo', 'project');
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(fetch.mock.calls[0].arguments[1].method, 'GET');
  });
}

test('deletes only the key with the matching title', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) =>
    options.method === 'GET'
      ? new Response(JSON.stringify([
        { title: 'other project', id: 1 },
        { title: 'project', id: 2 }
      ]))
      : new Response(null, { status: 204 }));
  await GitHubAPIWrapper.deleteDeployKey('owner', 'repo', 'project');
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(fetch.mock.calls[1].arguments[0], 'https://api.github.com/repos/owner/repo/keys/2');
  assert.equal(fetch.mock.calls[1].arguments[1].method, 'DELETE');
});

for (const method of ['GET', 'DELETE']) {
  for (const status of [401, 403, 404, 429, 500]) {
    test(`rejects ${method} HTTP ${status} instead of reporting successful cleanup`, async t => {
      const fetch = t.mock.method(globalThis, 'fetch', async (url, options) =>
        options.method === method
          ? new Response(JSON.stringify({ message: 'Request failed' }), { status })
          : new Response(JSON.stringify([{ title: 'project', id: 2 }])));
      await assert.rejects(
        GitHubAPIWrapper.deleteDeployKey('owner', 'repo', 'project'),
        new RegExp(`(?:list|delete).*deploy key.*owner/repo.*HTTP ${status}`));
      assert.equal(fetch.mock.callCount(), method === 'GET' ? 1 : 2);
    });
  }
}

for (const [name, body] of [
  ['error object', { message: 'Not Found' }],
  ['null', null],
  ['string', 'not a key list'],
  ['null key', [null]],
  ['missing key id', [{ title: 'project' }]],
  ['missing key title', [{ id: 2 }]],
  ['non-numeric key id', [{ title: 'project', id: '../other' }]],
  ['non-positive key id', [{ title: 'project', id: 0 }]],
  ['invalid unrelated key', [{ title: 'other project' }, { title: 'project', id: 2 }]]
]) {
  test(`rejects a malformed key list: ${name}`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () =>
      new Response(JSON.stringify(body)));
    await assert.rejects(
      GitHubAPIWrapper.deleteDeployKey('owner', 'repo', 'project'),
      /Invalid deploy key list.*owner\/repo/);
    assert.equal(fetch.mock.callCount(), 1, 'a malformed list must never initiate a deletion');
  });
}

test('rejects invalid JSON without initiating a deletion', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('{'));
  await assert.rejects(GitHubAPIWrapper.deleteDeployKey('owner', 'repo', 'project'), SyntaxError);
  assert.equal(fetch.mock.callCount(), 1);
});

for (const method of ['GET', 'DELETE']) {
  test(`preserves the ${method} transport failure`, async t => {
    const failure = new Error('Connection lost');
    const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (options.method === method) throw failure;
      return new Response(JSON.stringify([{ title: 'project', id: 2 }]));
    });
    await assert.rejects(GitHubAPIWrapper.deleteDeployKey('owner', 'repo', 'project'),
      error => error === failure);
    assert.equal(fetch.mock.callCount(), method === 'GET' ? 1 : 2);
  });
}
