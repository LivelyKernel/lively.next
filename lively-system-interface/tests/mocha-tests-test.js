/* global describe, it */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { module } from 'lively.modules';
import { string } from 'lively.lang';
import { loadMochaTestFile, runMochaTests } from '../commands/mocha-tests.js';

/**
 * Runs `source` as a separate test module through runMochaTests.
 * @param {string} source - Test definitions; `expect` is imported.
 * @returns {Promise<object>} The recorded tests and change notifications.
 */
async function runFixture (source) {
  const file = resource(`local://mocha-tests-test-${string.newUUID()}/fixture-test.js`);
  await file.write("import { expect } from 'mocha-es6';\n" + source);
  try {
    const { testsByFile } = await loadMochaTestFile(file.url);
    const changes = []; const errors = [];
    await runMochaTests(null, testsByFile,
      (test, event) => changes.push(event),
      error => errors.push(error));
    expect(errors, 'every reporter event finds its test').length(0);
    return { tests: testsByFile[0].tests.filter(test => test.type === 'test'), changes };
  } finally {
    await module(file.url).unload();
    await file.parent().remove();
  }
}

describe('mocha test states', () => {
  it('leaves a test that calls this.skip() without state', async () => {
    const { tests, changes } = await runFixture("describe('fixture', () => { it('skips', function () { this.skip(); }); });");
    expect(tests[0].state).equals(undefined);
    expect(tests[0].error).equals(undefined);
    expect(changes).deep.equals(['test', 'pending']);
  });

  it('leaves tests skipped by hooks or it.skip without state', async () => {
    const { tests, changes } = await runFixture(`
      describe('each', () => { beforeEach(function () { this.skip(); }); it('each skip', () => { throw new Error('runs'); }); });
      describe('all', () => { before(function () { this.skip(); }); it('all skip', () => { throw new Error('runs'); }); });
      describe('static', () => { it.skip('static skip', () => {}); });`);
    expect(tests.map(test => test.state)).deep.equals([undefined, undefined, undefined]);
    expect(tests.map(test => test.error)).deep.equals([undefined, undefined, undefined]);
    expect(changes.filter(event => event === 'pending')).length(3);
  });

  it('records passing and failing tests with their assertion details', async () => {
    const { tests } = await runFixture("describe('fixture', () => { it('passes', () => {}); it('fails', () => { expect(1, 'detail').equals(2); }); });");
    expect(tests.map(test => test.state)).deep.equals(['succeeded', 'failed']);
    expect(tests[1].error.message).includes('detail');
    expect(tests[1].error.actual).equals(1);
    expect(tests[1].error.expected).equals(2);
  });
});
