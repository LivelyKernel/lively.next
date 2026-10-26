/* global beforeEach, afterEach, describe, it */
import { expect } from 'mocha-es6';
import { resource } from '../index.js';

describe('http request failures', () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('adds method and resource URL while preserving the network error', async () => {
    const cause = new TypeError('Failed to fetch');
    globalThis.fetch = async () => { throw cause; };
    let error;
    try { await resource('https://example.test/missing.txt').read(); } catch (err) { error = err; }
    expect(error).to.be.instanceOf(Error);
    expect(error.message).includes('GET https://example.test/missing.txt');
    expect(error.message).includes('Failed to fetch');
    expect(error.message).includes('CORS');
    expect(error.cause).equals(cause);
  });

  it('identifies the requested resource and the proxy that failed', async () => {
    globalThis.fetch = async () => { throw new TypeError('Network error'); };
    let error;
    const res = resource('https://example.test/data', {
      useProxy: true, proxyDomain: 'https://proxy.test/'
    });
    try { await res.post('payload'); } catch (err) { error = err; }
    expect(error.message).includes('POST https://example.test/data');
    expect(error.message).includes('https://proxy.test/');
  });

  it('keeps the cancellation error name and reason', async () => {
    const cause = new DOMException('Canceled by caller', 'AbortError');
    globalThis.fetch = async () => { throw cause; };
    let error;
    try { await resource('https://example.test/data').read(); } catch (err) { error = err; }
    expect(error.name).equals('AbortError');
    expect(error.cause).equals(cause);
    expect(error.message).includes('GET https://example.test/data');
    expect(error.message).not.includes('CORS');
  });
});
