const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '../..');

async function check () {
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
  const source = fs.readFileSync(path.join(root, 'lively.server/plugins/test-runner.js'), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export default class TestRunner', 'class TestRunner');
  const Runner = vm.runInNewContext(`${source}\nTestRunner`, { HeadlessSession: Session, console, promise: {} });
  const data = await new Runner().run('pkg');
  assert.equal(disposed, 1, 'dispose the browser on ordinary assertion failures');
  assert.equal(JSON.parse(data)[0].browserErrors, 'BROWSER_SENTINEL');
  const output = []; const written = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/test.js'), 'utf8'), {
    URL,
    process: { argv: ['node', 'test.js', 'pkg'], env: { CI: 'true' } },
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
  assert.match(output.join('\n'), /STACK_SENTINEL/);
  assert.match(output.join('\n'), /BROWSER_SENTINEL/);
  assert.match(output.join('\n'), /SUMMARY-failed:1/);
  assert.match(written.map(entry => entry.text).join('\n'), /STACK_SENTINEL/);
  assert.match(written.map(entry => entry.text).join('\n'), /BROWSER_SENTINEL/);
  records[0].tests[0].state = 'succeeded';
  const successful = JSON.parse(await new Runner().run('pkg'));
  assert.equal(successful[0].browserErrors, undefined, 'do not attach errors to successful files');
  Session.prototype.runEval = async () => { throw new Error('RUNNER_SENTINEL'); };
  const runnerFailure = JSON.parse(await new Runner().run('pkg'));
  assert.match(runnerFailure.error, /Error: RUNNER_SENTINEL\n\s+at/);
  assert.equal(runnerFailure.browserErrors, 'BROWSER_SENTINEL');
  assert.equal(disposed, 3, 'dispose the browser on success and runner failure too');
  console.log('Failure diagnostics: assertion stack, expected/actual and browser errors reach CLI and CI summary');
}
check().catch(err => { console.error(err); process.exitCode = 1; });
