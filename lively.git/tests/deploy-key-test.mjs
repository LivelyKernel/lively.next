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
  ['different key title', [{ title: 'other project', id: 1 }]],
  ['error response', { message: 'Not Found' }],
  ['null response', null]
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
