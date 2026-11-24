/* global System, describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { runInNewContext } from 'vm';
import { HeadlessSession } from 'lively.headless';
import { resource } from 'lively.resources';
import TestRunner from '../plugins/test-runner.js';

describe('test runner server URLs', () => {
  let originalMethods; let calls; let runner;

  beforeEach(async () => {
    calls = [];
    originalMethods = {};
    for (const name of ['open', 'runEval', 'dispose']) {
      originalMethods[name] = HeadlessSession.prototype[name];
      HeadlessSession.prototype[name] = async function (argument) {
        calls.push({ name, argument });
        return name === 'runEval' ? '[]' : this;
      };
    }
    runner = new TestRunner();
    await runner.setup({ port: 19050 });
    await runner.run('pkg');
  });

  afterEach(() => Object.assign(HeadlessSession.prototype, originalMethods));

  it('opens the world at the configured server port', () => {
    expect(calls.find(({ name }) => name === 'open').argument,
      'headless world URL must use the port supplied to setup').equals(
      'http://localhost:19050/worlds/load?name=__newWorld__&askForWorldName=false&fastLoad=false');
    expect(calls.filter(({ name }) => name === 'dispose').length,
      'the headless session must be disposed').equals(1);
  });

  it('derives the fallback package URL from the configured server port', () => {
    const code = calls.find(({ name }) => name === 'runEval').argument;
    expect(code, 'fallback package URL must use the setup port').includes(
      "'http://localhost:19050/local_projects/pkg'");
    expect(code, 'browser evaluation must not refer to the default port').not.includes(':9011');
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    expect(() => new AsyncFunction(code), 'generated browser code must parse').not.throw();
  });
});

describe('test script server URL', () => {
  // Runs scripts/test.js against a stubbed HTTP request that answers with `responseBody`.
  const runTestScript = async (env, responseBody) => {
    const source = await resource(System.decanonicalize('lively.server/'))
      .join('../scripts/test.js').withRelativePartsResolved().read();
    let options; const lines = [];
    runInNewContext(source, {
      URL,
      console: { log (line) { lines.push(String(line)); } },
      process: { argv: ['node', 'scripts/test.js', 'pkg'], env },
      require (name) {
        if (name === 'fs') return { appendFileSync () {} };
        if (name !== 'http') throw new Error('Unexpected dependency: ' + name);
        return {
          request (requestOptions, onResponse) {
            options = requestOptions;
            if (responseBody !== undefined) {
              const handlers = {};
              onResponse({ on (event, handler) { handlers[event] = handler; } });
              handlers.data(responseBody);
              handlers.end();
            }
            return { on () {}, end () {} };
          }
        };
      }
    });
    return { options, lines };
  };
  const requestOptions = async (env) => (await runTestScript(env)).options;

  it('uses the readiness URL port for the test result request', async () => {
    const options = await requestOptions({ LIVELY_TEST_SERVER_READY_URL: 'http://127.0.0.1:19050/' });
    expect(Number(options.port), 'test result request must use the readiness URL port').equals(19050);
    expect(options.hostname, 'test result request must use the readiness URL host').equals('127.0.0.1');
    expect(options.path, 'the requested package must be preserved').equals('/subserver/TestRunner/pkg');
  });

  it('keeps port 9011 as the default', async () => {
    const options = await requestOptions({});
    expect(Number(options.port), 'the default test server port must remain 9011').equals(9011);
    expect(options.hostname, 'the default test server must remain local').equals('localhost');
  });

  it('annotates a failed test in CI with its message, expected and actual values', async () => {
    const error = { message: 'expected 1 to equal 2\nsecond line', expected: 2, actual: 1, stack: 'Error: at fixture' };
    const { lines } = await runTestScript({ CI: 'true' }, JSON.stringify([{
      file: 'http://localhost:9011/pkg/tests/fixture-test.js',
      tests: [{ type: 'test', fullTitle: 'fixture fails', state: 'failed', error }]
    }]));
    const annotation = lines.find(line => line.startsWith('::error '));
    expect(annotation).equals('::error title=Test failed in pkg::fixture fails' +
      '%0AERROR: expected 1 to equal 2%0Asecond line%0AEXPECTED: 2%0AACTUAL:   1%0AError: at fixture');
    expect(lines).to.include('SUMMARY-failed:1');
  });

  it('annotates a test run error in CI as a single workflow command', async () => {
    const { lines } = await runTestScript({ CI: 'true' }, JSON.stringify({ error: 'open failed', browserErrors: 'boom' }));
    expect(lines.filter(line => line.startsWith('::error')), 'every line of the error belongs to one annotation').deep.equals([
      '::error title=Tests failed for pkg::Running the tests produced the following error:%0A"open failed"%0ARecent browser console errors:%0Aboom'
    ]);
  });
});
