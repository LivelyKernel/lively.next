/* global describe, it, System */
import { expect } from 'mocha-es6';
import L2LClient from '../client.js';

/**
 * Looks up the socket URL of a page. The page globals are stubbed only during the
 * synchronous lookup, since the server runs this suite next to its own requests.
 * @param {string} pageBaseURL - System.baseURL of the page.
 * @param {string} [runtimeRoot] - The page's SYSTEM_BASE_URL.
 * @returns {string} The URL that the page connects its socket to.
 */
function socketURL (pageBaseURL, runtimeRoot) {
  const { baseURL } = System;
  const { default: defaultClient, ensure } = L2LClient;
  const hadRuntimeRoot = 'SYSTEM_BASE_URL' in globalThis;
  const previousRuntimeRoot = globalThis.SYSTEM_BASE_URL;
  const addedDocument = typeof document === 'undefined';
  try {
    if (addedDocument) globalThis.document = { location: { origin: 'http://example.test' } };
    if (runtimeRoot) globalThis.SYSTEM_BASE_URL = runtimeRoot;
    else delete globalThis.SYSTEM_BASE_URL;
    System.config({ baseURL: pageBaseURL });
    L2LClient.default = () => null;
    L2LClient.ensure = options => options;
    return L2LClient.forLivelyInBrowser().url;
  } finally {
    System.config({ baseURL });
    L2LClient.default = defaultClient;
    L2LClient.ensure = ensure;
    if (hadRuntimeRoot) globalThis.SYSTEM_BASE_URL = previousRuntimeRoot;
    else delete globalThis.SYSTEM_BASE_URL;
    if (addedDocument) delete globalThis.document;
  }
}

describe('browser connection location', () => {
  it('connects to the server root from a frozen page with a nested base URL', () => {
    expect(socketURL('http://example.test/dashboard/')).equals('http://example.test/lively-socket.io');
  });

  it('connects below SYSTEM_BASE_URL in a sub-path deployment', () => {
    expect(socketURL('http://example.test/deployments/lively/lively.freezer/landing-page/', 'http://example.test/deployments/lively/'))
      .equals('http://example.test/deployments/lively/lively-socket.io');
  });

  it('connects at the native runtime root that the desktop app routes in-process', () => {
    expect(socketURL('file:///C:/Users/RUNNER~1/runtime-root/lively.freezer/landing-page/', 'file:///C:/Users/RUNNER~1/runtime-root/'))
      .equals('file:///C:/Users/RUNNER~1/runtime-root/lively-socket.io');
  });
});
