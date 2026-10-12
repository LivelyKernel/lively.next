/* global describe, it, System */
import { expect } from 'mocha-es6';
import L2LClient from '../client.js';

describe('browser connection location', function () {
  it('connects to the server root when the frozen dashboard has a nested base URL', function () {
    const baseURL = System.baseURL, originalDefault = L2LClient.default, originalEnsure = L2LClient.ensure;
    const hadDocument = typeof document !== 'undefined';
    if (!hadDocument) globalThis.document = {location: {origin: 'http://example.test'}};
    try {
      System.config({baseURL: 'http://example.test/dashboard/'});
      L2LClient.default = () => null;
      L2LClient.ensure = options => options;
      expect(L2LClient.forLivelyInBrowser().url).equals('http://example.test/lively-socket.io');
    } finally {
      System.config({baseURL});
      L2LClient.default = originalDefault;
      L2LClient.ensure = originalEnsure;
      if (!hadDocument) delete globalThis.document;
    }
  });
});
