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

  for (const repositoryPackage of [true, false]) {
    it('loads an unregistered ' + (repositoryPackage ? 'workspace' : 'local project') + ' at the configured port', async () => {
      const code = calls.find(({ name }) => name === 'runEval').argument;
      const loaded = [];
      const localInterface = { coreInterface: { getPackages: () => [] } };
      class BrowserRunner {
        async runTestsInPackage () { return []; }
      }
      const imports = {
        'lively.resources': { resource: url => ({
          join: () => ({ exists: async () => repositoryPackage }),
          asFile: () => ({ url: url.replace(/\/$/, '') })
        }) },
        'lively.lang': { promise: { waitFor: async condition => expect(condition()).to.be.ok } },
        'lively-system-interface': { localInterface },
        'lively-system-interface/commands/packages.js': { loadPackage: async (_, spec) => loaded.push(spec) },
        'mocha-es6/index.js': {},
        'lively.ide/test-runner.js': { default: BrowserRunner }
      };
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      await new AsyncFunction('System', '$world', 'window', code)(
        { import: async name => imports[name] }, { handForPointerId () {} }, { chai: {}, Mocha: {} });
      expect(loaded).deep.equals([{ name: 'pkg', type: 'package', address:
        'http://localhost:19050/' + (repositoryPackage ? '' : 'local_projects/') + 'pkg' }]);
    });
  }
});

describe('test script server URL', () => {
  const requestOptions = async (env) => {
    const source = await resource(System.decanonicalize('lively.server/'))
      .join('../scripts/test.js').withRelativePartsResolved().read();
    let options;
    runInNewContext(source, {
      URL,
      console: { log () {} },
      process: { argv: ['node', 'scripts/test.js', 'pkg'], env },
      require (name) {
        if (name === 'fs') return {};
        if (name !== 'http') throw new Error('Unexpected dependency: ' + name);
        return {
          request (requestOptions) {
            options = requestOptions;
            return { on () {}, end () {} };
          }
        };
      }
    });
    return options;
  };

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
});
