const assert = require('node:assert/strict');
const { expectedPrefix, validateSubject, validatePullRequest, checkPullRequest } = require('../check-pr-commit-message.cjs');

async function test () {
  assert.equal(expectedPrefix(['lively.source-transform/index.js', 'lively.freezer/index.js']), '❄️🔁');
  assert.equal(expectedPrefix(['lively.classes/runtime.js', 'scripts/test.js', 'lively.app/package.json']), '🛠️🧑‍🏫📦');
  assert.equal(expectedPrefix(['lively-system-interface/index.js', 'README.md']), '🗒️📠');
  assert.equal(expectedPrefix(['bun.lock', 'documents/guide.md']), '🛠️');
  assert.equal(expectedPrefix(['lively.morphic/a.js', 'lively.morphic/b.js']), '🎨');
  validateSubject('🧑‍🏫: fix class initialization', '🧑‍🏫', 'Test');
  for (const subject of ['❄️: fix exports', '🔁❄️: fix exports', '❄️🔁: Fix exports', '❄️🔁: cleanup', '❄️🔁: fix\nexports']) {
    assert.throws(() => validateSubject(subject, '❄️🔁', 'Test'));
  }
  validateSubject(`🧑‍🏫: ${'a'.repeat(70)}`, '🧑‍🏫', 'Test');
  assert.throws(() => validateSubject(`🧑‍🏫: ${'a'.repeat(71)}`, '🧑‍🏫', 'Test'));
  const pr = { title: '❄️🔁: fix exports', state: 'OPEN', headRefOid: 'head-sha', changedFiles: 2, autoMergeRequest: null };
  const files = [{ filename: 'lively.freezer/index.js' }, { filename: 'lively.source-transform/index.js' }];
  validatePullRequest(pr, files.map(f => f.filename), 1814);
  assert.throws(() => validatePullRequest({ ...pr, title: `❄️🔁: ${'a'.repeat(62)}` }, files.map(f => f.filename), 1814));
  for (const autoMergeRequest of [
    { mergeMethod: 'REBASE', commitHeadline: pr.title },
    { mergeMethod: 'SQUASH', commitHeadline: 'fix exports' },
    { mergeMethod: 'SQUASH', commitHeadline: '❄️: fix exports' }
  ]) assert.throws(() => validatePullRequest({ ...pr, autoMergeRequest }, files.map(f => f.filename), 1814));
  validatePullRequest({ ...pr, autoMergeRequest: { mergeMethod: 'SQUASH', commitHeadline: `${pr.title} (#1814)` } }, files.map(f => f.filename), 1814);

  const context = { repo: { owner: 'LivelyKernel', repo: 'lively.next' }, serverUrl: 'https://github.com', runId: 42 };
  async function run (first, { listed = files, last = first, apiError } = {}) {
    const created = [], updated = [];
    let reads = 0;
    const github = {
      graphql: async () => ({ repository: { pullRequest: reads++ ? last : first } }),
      paginate: async () => { if (apiError) throw apiError; return listed; },
      rest: {
        pulls: { listFiles () {} },
        checks: {
          create: async data => { created.push(data); return { data: { id: 7 } }; },
          update: async data => { updated.push(data); }
        }
      }
    };
    let error;
    try { await checkPullRequest(github, context, 1814); } catch (err) { error = err; }
    return { created, updated, error };
  }
  const success = await run(pr);
  assert.equal(success.error, undefined);
  assert.equal(success.created[0].head_sha, pr.headRefOid);
  assert.equal(success.updated[0].conclusion, 'success');
  const renamedFiles = [{ filename: 'lively.morphic/moved.js', previous_filename: 'lively.modules/moved.js' }, { filename: 'lively.morphic/index.js' }];
  assert.equal((await run({ ...pr, title: '🧩🎨: move module' }, { listed: renamedFiles })).updated[0].conclusion, 'success');
  for (const failure of [
    await run({ ...pr, title: 'Fix exports' }),
    await run(pr, { listed: files.slice(1) }),
    await run(pr, { last: { ...pr, headRefOid: 'new-head' } }),
    await run(pr, { last: { ...pr, title: 'changed title' } }),
    await run(pr, { last: { ...pr, autoMergeRequest: { mergeMethod: 'SQUASH', commitHeadline: 'bad message' } } }),
    await run(pr, { apiError: new Error('API unavailable') }),
    await run({ ...pr, autoMergeRequest: { mergeMethod: 'SQUASH', commitHeadline: 'bad message' } }),
    await run({ ...pr, title: '🎨: move module' }, { listed: renamedFiles })
  ]) {
    assert.ok(failure.error);
    assert.equal(failure.updated[0].conclusion, 'failure');
  }
  assert.equal((await run({ ...pr, state: 'CLOSED' })).created.length, 0);
  console.log('Lively merge-message convention and GitHub check regressions passed.');
}
test().catch(err => { console.error(err); process.exitCode = 1; });
