/* global describe, it, beforeEach, afterEach, System */
import { expect } from 'mocha-es6';
import { setupLively2Lively } from '../world-loading.js';
import { promise } from 'lively.lang';

describe('world service startup', () => {
  let originalImport, registered, client, registrationCalls;

  beforeEach(() => {
    registered = promise.deferred();
    registrationCalls = 0;
    client = {
      once () {},
      whenRegistered () { registrationCalls++; return registered.promise; }
    };
    const modules = {
      'lively.modules': { importPackage: async () => {} },
      'lively.user': { currentUser: () => ({ login: 'offline user' }) },
      'lively.2lively/client.js': { default: { forLivelyInBrowser: () => client } }
    };
    originalImport = System.import;
    System.import = function (id, ...args) {
      return id in modules ? Promise.resolve(modules[id]) : originalImport.call(this, id, ...args);
    };
  });

  afterEach(() => {
    registered.resolve(client);
    System.import = originalImport;
  });

  it('returns the ordinary-world client while registration stays offline', async () => {
    const startup = setupLively2Lively({ name: 'offline world' });
    try {
      expect(await promise.timeout(200, startup)).equals(client);
      expect(registrationCalls).equals(0);
    } finally {
      registered.resolve(client);
      await startup;
    }
  });

  it('leaves registration failure handling to connection-dependent callers', async () => {
    client.whenRegistered = () => { throw new Error('offline registration'); };
    expect(await setupLively2Lively({ name: 'offline world' })).equals(client);
  });
});
