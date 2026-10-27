/* global describe, it, document */
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';
import { createDOMEnvironment } from '../rendering/dom-helper.js';

describe('iframe CSS failure recovery', () => {
  it('keeps the DOM environment usable when its stylesheet wait rejects', async () => {
    const original = promise.waitFor;
    const frames = new Set(document.querySelectorAll('iframe'));
    let env, error;
    promise.waitFor = (ms, ...args) => ms === 30000 ? Promise.reject(new Error('injected CSS timeout')) : original(ms, ...args);
    try {
      try { env = await createDOMEnvironment(); } catch (err) { error = err; }
      expect(error).equals(undefined, 'stylesheet timeout must not reject DOM environment creation');
      expect(env.document.body).to.be.ok;
      expect(env.document.getElementById('lively-morphic-css')).to.be.ok;
    } finally {
      promise.waitFor = original;
      env?.destroy();
      for (const frame of document.querySelectorAll('iframe')) if (!frames.has(frame)) frame.remove();
    }
  });
});
