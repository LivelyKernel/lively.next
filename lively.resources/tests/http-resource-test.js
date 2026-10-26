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

describe('http request cancellation', () => {
  let originalFetch, originalXHR;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalXHR = globalThis.XMLHttpRequest;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.XMLHttpRequest = originalXHR;
  });

  function rejectWhenAborted (url, { signal }) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) reject(signal.reason);
      else signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  }

  it('passes the caller signal through derived and proxied resources', async () => {
    const controller = new AbortController();
    const base = resource('https://example.test/folder/', {
      signal: controller.signal, timeout: 5000,
      headers: { authorization: 'test' }, useCors: true
    });
    const derived = [base.join('file.txt'), base.parent(), base.root(), base.withQuery({ x: 1 }),
      base.asFile(), base.makeProxied('https://proxy.test/')];
    for (const res of derived) {
      expect(res.signal).equals(controller.signal);
      expect(res.timeout).equals(5000);
      expect(res.headers).equals(base.headers);
    }
    let options;
    globalThis.fetch = async (url, opts) => {
      options = opts;
      return { ok: true, text: async () => 'content' };
    };
    await resource('https://example.test/file.txt', { signal: controller.signal }).read();
    expect(options.signal).equals(controller.signal);
  });

  it('rejects with the caller cancellation reason', async () => {
    globalThis.fetch = rejectWhenAborted;
    const controller = new AbortController();
    const cause = new DOMException('Canceled by caller', 'AbortError');
    const pending = resource('https://example.test/file.txt', { signal: controller.signal }).read();
    controller.abort(cause);
    let error;
    try { await pending; } catch (err) { error = err; }
    expect(error.name).equals('AbortError');
    expect(error.cause).equals(cause);
  });

  it('times out requests without a caller signal', async () => {
    globalThis.fetch = rejectWhenAborted;
    let error;
    try { await resource('https://example.test/file.txt', { timeout: 1 }).read(); } catch (err) { error = err; }
    expect(error.name).equals('TimeoutError');
    expect(error.cause.name).equals('TimeoutError');
  });

  it('applies the timeout when a caller signal is also supplied', async () => {
    globalThis.fetch = rejectWhenAborted;
    const controller = new AbortController();
    let error;
    try {
      await resource('https://example.test/file.txt', { timeout: 1, signal: controller.signal }).read();
    } catch (err) { error = err; }
    expect(error.name).equals('TimeoutError');
    expect(controller.signal.aborted).equals(false);
  });

  it('cancels real fetch and XHR requests that are already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    for (const operation of ['read', 'write']) {
      const res = resource(System.baseURL + 'lively.resources/tests/canceled-upload.txt', { signal: controller.signal });
      let error;
      try { await res[operation]('content'); } catch (err) { error = err; }
      expect(error.name).equals('AbortError');
      expect(error.cause).equals(controller.signal.reason);
    }
  });

  it('aborts an active proxied upload and preserves its cancellation reason', async () => {
    let request;
    globalThis.XMLHttpRequest = class {
      constructor () { request = this; this.upload = { addEventListener () {} }; }
      open (method, url) { this.method = method; this.url = url; }
      setRequestHeader () {}
      send (body) { this.body = body; }
      abort () { this.aborted = true; this.onabort(); }
    };
    const controller = new AbortController();
    const res = resource('https://example.test/file.txt', {
      signal: controller.signal, useProxy: true, proxyDomain: 'https://proxy.test/'
    });
    const pending = res.write('content');
    const cause = new DOMException('Canceled upload', 'AbortError');
    controller.abort(cause);
    let error;
    try { await pending; } catch (err) { error = err; }
    expect(request.url).equals('https://proxy.test/');
    expect(request.aborted).equals(true);
    expect(error.name).equals('AbortError');
    expect(error.cause).equals(cause);
  });

  it('times out an active upload', async () => {
    let request;
    globalThis.XMLHttpRequest = class {
      constructor () { request = this; this.upload = { addEventListener () {} }; }
      open () {}
      setRequestHeader () {}
      send () {}
      abort () { this.aborted = true; this.onabort(); }
    };
    let error;
    try { await resource('https://example.test/file.txt', { timeout: 1 }).write('content'); } catch (err) { error = err; }
    expect(request.aborted).equals(true);
    expect(error.name).equals('TimeoutError');
  });
});
