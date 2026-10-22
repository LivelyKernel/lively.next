/* global describe, it, System */
import { expect } from 'mocha-es6';
import L2LClient from '../client.js';

describe('browser connection location', function () {
  it('connects to the server root when the frozen dashboard has a nested base URL', function () {
    const baseURL = System.baseURL, originalDefault = L2LClient.default, originalEnsure = L2LClient.ensure;
    const originalRuntimeRoot = globalThis.SYSTEM_BASE_URL;
    const hadNative = 'livelyNative' in globalThis, originalNative = globalThis.livelyNative;
    const hadDocument = typeof document !== 'undefined';
    if (!hadDocument) globalThis.document = {location: {origin: 'http://example.test'}};
    try {
      delete globalThis.SYSTEM_BASE_URL;
      delete globalThis.livelyNative;
      System.config({baseURL: 'http://example.test/dashboard/'});
      L2LClient.default = () => null;
      L2LClient.ensure = options => options;
      expect(L2LClient.forLivelyInBrowser().url).equals('http://example.test/lively-socket.io');
      globalThis.SYSTEM_BASE_URL = 'http://example.test/deployments/lively/';
      expect(L2LClient.forLivelyInBrowser().url).equals('http://example.test/deployments/lively/lively-socket.io',
        'SYSTEM_BASE_URL keeps the socket below the deployed runtime root');
      System.config({baseURL: 'file:///C:/Users/RUNNER~1/runtime-root/lively.freezer/landing-page/'});
      globalThis.livelyNative = {baseURL: 'file:///C:/Users/RUNNER~1/runtime-root/'};
      expect(L2LClient.forLivelyInBrowser().url).equals('file:///C:/Users/RUNNER~1/runtime-root/lively-socket.io',
        'native desktop pages connect at the runtime root that livelyNative.isLocal routes in-process');
    } finally {
      if (originalRuntimeRoot === undefined) delete globalThis.SYSTEM_BASE_URL;
      else globalThis.SYSTEM_BASE_URL = originalRuntimeRoot;
      System.config({baseURL});
      L2LClient.default = originalDefault;
      L2LClient.ensure = originalEnsure;
      if (!hadDocument) delete globalThis.document;
      if (hadNative) globalThis.livelyNative = originalNative;
      else delete globalThis.livelyNative;
    }
  });
});
