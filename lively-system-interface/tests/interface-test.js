/* global describe, it, System */
import { expect } from 'mocha-es6';
import { RemoteCoreInterface } from '../interfaces/interface.js';
import { LocalCoreInterface } from '../interfaces/local-system.js';

describe('package resource discovery', () => {
  it('excludes intentionally failing Mocha examples while retaining package source', async () => {
    const resources = await new LocalCoreInterface().resourcesOfPackage(System.baseURL + 'mocha-es6');
    expect(resources.some(({ nameInPackage }) => nameInPackage === 'index.js'), 'package source must remain discoverable').equals(true);
    expect(resources.some(({ nameInPackage }) => nameInPackage.startsWith('examples/')), 'examples must not enter package test discovery').equals(false);
  });
});

describe('remote module API', () => {
  const accessor = new RemoteCoreInterface().livelyModulesAccessor();
  const evaluate = new Function('System', `return (async () => { var modules; ${accessor}; return modules; })();`);

  it('imports the instrumented loader only when a remote request needs it', async () => {
    const api = { System: {} };
    let imports = 0;
    const system = { get: () => undefined, decanonicalize: name => name,
      import: async name => { expect(name).equals('lively.modules'); imports++; return api; } };
    expect(await evaluate(system)).equals(api);
    expect(imports).equals(1);
  });

  it('uses the cached module and propagates initialization failures', async () => {
    const instrumentedAPI = { System: {} };
    const error = new Error('loader initialization failed');
    const system = { get: () => instrumentedAPI, decanonicalize: name => name,
      import: async () => { throw error; } };
    expect(await evaluate(system)).equals(instrumentedAPI);
    system.get = () => undefined;
    let failure;
    try { await evaluate(system); } catch (err) { failure = err; }
    expect(failure).equals(error);
  });
});
