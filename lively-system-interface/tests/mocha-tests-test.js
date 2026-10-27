/* global describe, it, System */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { module } from 'lively.modules';
import { string } from 'lively.lang';
import { loadMochaTestFile, runMochaTests } from '../commands/mocha-tests.js';

/**
 * Run a separate suite through the real Mocha reporter.
 * @param {string} source Test module source.
 * @returns {Promise<object>} Test states and notifications.
 */
async function runFixture (source) {
  const directory = resource(System.baseURL).join('local_projects/mocha-pending-' + string.newUUID() + '/');
  const file = directory.join('fixture-test.js');
  await directory.ensureExistance();
  await file.write(`import { expect } from ${JSON.stringify(System.decanonicalize('mocha-es6/index.js'))};\n` + source);
  try {
    const { testsByFile } = await loadMochaTestFile(file.url);
    const changes = [], errors = [];
    await runMochaTests(null, testsByFile,
      (test, event) => changes.push({ title: test.title, state: test.state, event }),
      error => errors.push(error));
    expect(errors, 'reporter must handle every real Mocha event').length(0);
    return { tests: testsByFile[0].tests.filter(test => test.type === 'test'), changes };
  } finally {
    await module(file.url).unload();
    await directory.remove();
  }
}

describe('Mocha test result states', () => {
  it('reports a runtime this.skip as skipped instead of leaving it running', async () => {
    const { tests, changes } = await runFixture("describe('fixture', () => { it('runtime skip', function () { this.skip(); }); });");
    expect(tests[0].state, 'runtime skip must use the existing unset skipped state').equals(undefined);
    expect(tests[0].error, 'a pending test must not have an assertion error').equals(undefined);
    expect(changes.map(change => change.event), 'pending must finalize the running notification').deep.equals(['test', 'pending']);
  });

  it('reports a beforeEach skip as skipped', async () => {
    const { tests } = await runFixture("describe('fixture', () => { beforeEach(function () { this.skip(); }); it('hook skip', () => { throw new Error('pending body must not run'); }); });");
    expect(tests[0].state, 'beforeEach skip must not leave a test running').equals(undefined);
    expect(tests[0].error, 'beforeEach skip must not be a failure').equals(undefined);
  });

  it('notifies pending tests from a suite hook and a static skip', async () => {
    const { tests, changes } = await runFixture("describe('static', () => { it.skip('static skip', () => {}); }); describe('hook', () => { before(function () { this.skip(); }); it('suite skip', () => { throw new Error('pending suite must not run'); }); });");
    expect(tests.every(test => test.state === undefined), 'all pending forms must remain skipped').equals(true);
    expect(changes.map(change => change.event), 'static and suite skips must notify their final state').deep.equals(['pending', 'pending']);
  });

  it('preserves succeeded and failed states and assertion details', async () => {
    const { tests } = await runFixture("describe('fixture', () => { it('pass', () => {}); it('fail', () => { expect(1, 'fixture assertion detail').equals(2); }); });");
    expect(tests[0].state, 'ordinary passing tests must stay succeeded').equals('succeeded');
    expect(tests[1].state, 'ordinary assertion failures must stay failed').equals('failed');
    expect(tests[1].error.message, 'failure messages must reach result consumers').includes('fixture assertion detail');
    expect(tests[1].error.actual).equals(1);
    expect(tests[1].error.expected).equals(2);
  });
});
