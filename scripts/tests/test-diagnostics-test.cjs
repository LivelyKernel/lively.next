const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '../..');

function runCLI (data, ci = true) {
  const output = []; const written = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/test.js'), 'utf8'), {
    URL,
    process: { argv: ['node', 'test.js', 'pkg'], env: ci ? { CI: 'true' } : {} },
    console: { log: (...parts) => output.push(parts.join(' ')) },
    require (name) {
      if (name === 'fs') return { appendFileSync: (file, text) => written.push({ file, text }) };
      assert.equal(name, 'http');
      return { request (_, onResponse) {
        const request = new EventEmitter();
        request.end = () => {
          const response = new EventEmitter();
          onResponse(response);
          response.emit('data', data);
          response.emit('end');
        };
        return request;
      } };
    }
  });
  return { output, written };
}

function checkAssertionBounds () {
  const data = JSON.stringify([{ file: '/pkg/tests/large-assertion-test.js', tests: [{
    type: 'test', state: 'failed', fullTitle: 'large assertion values',
    error: { message: 'values differ', stack: 'LARGE_STACK_SENTINEL',
      expected: 'EXPECTED_HEAD|' + 'e'.repeat(5000) + '|EXPECTED_TAIL',
      actual: 'ACTUAL_HEAD|' + 'a'.repeat(5000) + '|ACTUAL_TAIL' }
  }] }]);
  const text = runCLI(data, false).output.join('\n');
  for (const label of ['EXPECTED', 'ACTUAL']) {
    const values = text.split('\n').filter(line => line.startsWith(label + ': ')).map(line => line.slice(label.length + 2));
    assert.ok(values.length, `CLI retains ${label} values`);
    for (const value of values) {
      assert.ok(value.startsWith('"' + label + '_HEAD|'), `${label} retains its useful prefix`);
      assert.ok(value.length <= 1000, `CLI ${label} must be bounded to 1000 characters, got ${value.length}`);
    }
    assert.ok(!text.includes(label + '_TAIL'), `${label} omits the oversized tail`);
  }
  console.log('Assertion bounds: CLI output retains useful prefixes within 1000 characters');
}

function checkFailureListBounds () {
  // One package with hundreds of failed tests, the first with a stack far longer than any bound.
  const frame = '    at eval (https://ga.jspm.io/npm:mocha@10.0.0/lib/runner.js!transpiled:496:31)';
  const stack = 'AssertionError: expected 1 to equal 2\n' + Array(12).fill(frame).join('\n');
  const tests = Array.from({ length: 700 }, (_, i) => ({ type: 'test', state: 'failed', fullTitle: `behaviour ${i} works`,
    error: { message: 'expected 1 to equal 2', stack: i === 0 ? `${stack}\n${'x'.repeat(20000)}STACK_TAIL` : stack, expected: 2, actual: 1 } }));
  const { output, written } = runCLI(JSON.stringify({ files: [{ file: '/pkg/tests/many-test.js', tests }], browserErrors: null }));
  const summary = written.filter(entry => entry.file === 'failing.txt').map(entry => entry.text).join('');
  assert.ok(summary.length < 11000, `the CI summary of a package is bounded, got ${summary.length} characters`);
  assert.match(summary, /the following 700 test\(s\) failed/);
  assert.equal(summary.split('❌').length - 1, 30, 'the CI summary lists 30 failed tests');
  assert.equal(summary.split('```text').length - 1, 5, 'the CI summary details the first five failures');
  assert.match(summary, /behaviour 0 works failed ❌\n\n```text\nAssertionError/);
  assert.ok(!summary.includes('STACK_TAIL'), 'the CI summary shortens stacks');
  assert.match(summary, /- 670 more failed test\(s\) are listed in the job log\n/);
  const log = output.join('\n');
  assert.equal(log.split(' failed ❌').length - 1, 700, 'the job log lists every failed test');
  assert.match(log, /STACK_TAIL/, 'the job log keeps full stacks');
  assert.match(log, /SUMMARY-failed:700/);
  console.log('Failure list: the CI summary of a package is bounded while the job log keeps every failure');
}

function loadRunner (Session) {
  const source = fs.readFileSync(path.join(root, 'lively.server/plugins/test-runner.js'), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export default class TestRunner', 'class TestRunner');
  return vm.runInNewContext(`${source}\nTestRunner`, { HeadlessSession: Session, console, promise: {}, process: { env: {} } });
}

async function checkBrowserErrorsOncePerPackage () {
  // Five failing files in one package and a full buffer of long session-wide browser errors.
  const records = Array.from({ length: 5 }, (_, i) => ({ file: `/pkg/tests/failing-${i}-test.js`, tests: [{
    type: 'test', state: 'failed', fullTitle: `failing ${i}`, error: { message: 'failure', stack: 'Error: failure' }
  }] }));
  const entries = Array.from({ length: 200 }, (_, i) =>
    `[2026-01-01T00:00:00.${String(i).padStart(3, '0')}Z] console.error http://localhost/x.js:1:1 BROWSER_ERROR_${i}| ` +
    'x'.repeat(i === 199 ? 5000 : 500) + (i === 198 ? '\n    at multi-line entry' : ''));
  class Session {
    async open () {}
    async runEval () { return JSON.stringify(records); }
    summarizeRecentConsoleErrors () { return entries.join('\n'); }
    async dispose () {}
  }
  const { output, written } = runCLI(await new (loadRunner(Session))().run('pkg'));
  const stdout = output.join('\n');
  const summary = written.map(entry => entry.text).join('');
  for (const [label, text] of [['CLI output', stdout], ['CI summary', summary]]) {
    assert.equal(text.split('BROWSER_ERROR_199|').length - 1, 1, `${label} prints the browser errors once per package`);
    assert.equal(text.split('Recent browser console errors').length - 1, 1, `${label} has one browser error block`);
    assert.ok(text.includes('at multi-line entry'), `${label} keeps multi-line entries`);
    assert.ok(!text.includes('BROWSER_ERROR_0|'), `${label} omits the oldest entries beyond the total bound`);
    assert.match(text, /\(\d+ earlier entries omitted\)/, `${label} reports omitted entries`);
    const block = text.slice(text.indexOf('Recent browser console errors'));
    for (const line of block.split('\n')) assert.ok(line.length <= 1000, `${label} bounds each entry to 1000 characters, got ${line.length}`);
  }
  assert.ok(summary.length < 20000, `CI summary stays bounded, got ${summary.length} characters`);
  console.log('Browser errors: reported once per package within per-entry and total bounds');
}

function checkRunnerFailureReport (data) {
  // The runner error is a stack trace that spans several lines.
  const local = runCLI(data, false).output.join('\n');
  assert.match(local, /^Error: RUNNER_SENTINEL 100%\n\s+at /m, 'CLI prints the stack on separate lines');
  assert.ok(!local.includes('\\n'), 'CLI prints no escaped line breaks');
  assert.match(local, /BROWSER_SENTINEL/);
  const { output, written } = runCLI(data);
  const annotation = output.filter(line => line.startsWith('::error::'));
  assert.equal(annotation.length, 1, 'CI reports one error annotation');
  assert.ok(!annotation[0].includes('\n'), 'the annotation is a single workflow command line');
  assert.match(annotation[0], /Error: RUNNER_SENTINEL 100%25%0A\s+at /, 'the annotation encodes line breaks and percent signs');
  assert.match(output.join('\n'), /BROWSER_SENTINEL/, 'CI log shows the browser errors');
  // scripts/test.sh builds the CI step summary from test_output.md and failing.txt.
  const summary = written.filter(entry => ['test_output.md', 'failing.txt'].includes(entry.file)).map(entry => entry.text).join('');
  assert.match(summary, /Running the tests for \*\*pkg\*\* produced the following error/, 'the CI summary names the package');
  assert.match(summary, /^Error: RUNNER_SENTINEL 100%\n\s+at /m, 'the CI summary prints the stack on separate lines');
  assert.ok(!summary.includes('\\n'), 'the CI summary contains no escaped line breaks');
  assert.match(summary, /BROWSER_SENTINEL/);
  const long = JSON.parse(data);
  long.error = `Error: page failed to load\n${'x'.repeat(50000)}ERROR_TAIL`;
  const bounded = runCLI(JSON.stringify(long)).written.map(entry => entry.text).join('');
  assert.ok(bounded.length < 11000 && !bounded.includes('ERROR_TAIL'), `the CI summary bounds the error, got ${bounded.length} characters`);
  console.log('Runner failures: stack traces stay multi-line in CLI and CI summary and are encoded for annotations');
}

async function check () {
  checkAssertionBounds();
  checkFailureListBounds();
  await checkBrowserErrorsOncePerPackage();
  let disposed = 0;
  const records = [{ file: '/pkg/tests/failing-test.js', tests: [{
    type: 'test', state: 'failed', fullTitle: 'ordinary assertion',
    error: { message: 'failure message', stack: 'STACK_SENTINEL\nat failing-test.js:1:1', actual: 1, expected: 2 }
  }] }];
  class Session {
    async open () {}
    async runEval () { return JSON.stringify(records); }
    summarizeRecentConsoleErrors () { return 'BROWSER_SENTINEL'; }
    async dispose () { disposed++; }
  }
  const Runner = loadRunner(Session);
  const data = await new Runner().run('pkg');
  assert.equal(disposed, 1, 'dispose the browser on ordinary assertion failures');
  assert.equal(JSON.parse(data).browserErrors, 'BROWSER_SENTINEL');
  const { output, written } = runCLI(data);
  assert.equal(output.join('\n').split('STACK_SENTINEL').length - 1, 1, 'CI prints each assertion stack once');
  assert.match(output.join('\n'), /STACK_SENTINEL/);
  assert.match(output.join('\n'), /BROWSER_SENTINEL/);
  assert.match(output.join('\n'), /SUMMARY-failed:1/);
  assert.match(output.join('\n'), /EXPECTED: 2/);
  assert.match(output.join('\n'), /ACTUAL: 1/);
  assert.match(written.map(entry => entry.text).join('\n'), /STACK_SENTINEL/);
  assert.match(written.map(entry => entry.text).join('\n'), /BROWSER_SENTINEL/);
  records[0].tests[0].state = 'succeeded';
  const successful = JSON.parse(await new Runner().run('pkg'));
  assert.equal(successful.browserErrors, null, 'do not attach errors to successful packages');
  assert.match(runCLI(JSON.stringify(successful)).output.join('\n'), /SUMMARY-passed:1/);
  Session.prototype.runEval = async () => { throw new Error('RUNNER_SENTINEL 100%'); };
  const runnerFailureData = await new Runner().run('pkg');
  const runnerFailure = JSON.parse(runnerFailureData);
  assert.match(runnerFailure.error, /Error: RUNNER_SENTINEL 100%\n\s+at/);
  assert.equal(runnerFailure.browserErrors, 'BROWSER_SENTINEL');
  assert.equal(disposed, 3, 'dispose the browser on success and runner failure too');
  checkRunnerFailureReport(runnerFailureData);
  console.log('Failure diagnostics: assertion stack, expected/actual and browser errors reach CLI and CI summary');
}
check().catch(err => { console.error(err); process.exitCode = 1; });
