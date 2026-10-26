/* global describe, it */
import { expect } from 'mocha-es6';
import { Text } from '../../index.js';
import { pt } from 'lively.graphics';

describe('native text scroll metrics', () => {
  for (const property of ['scrollExtent', 'scrollbarVisible']) {
    it(`reads each client dimension once for ${property}`, async () => {
      const text = new Text({ readOnly: true, fixedWidth: true, fixedHeight: true,
        extent: pt(100, 40), clipMode: 'auto', textString: 'words '.repeat(100) }).openInWorld();
      const originals = new Map();
      try {
        await text.whenFontLoaded();
        text.env.forceUpdate();
        const node = text.env.renderer.getNodeForMorph(text);
        const reads = { clientWidth: 0, clientHeight: 0 };
        for (const key of Object.keys(reads)) {
          let prototype = node;
          while (!Object.getOwnPropertyDescriptor(prototype, key)) prototype = Object.getPrototypeOf(prototype);
          const getter = Object.getOwnPropertyDescriptor(prototype, key).get;
          originals.set(key, Object.getOwnPropertyDescriptor(node, key));
          Object.defineProperty(node, key, { configurable: true, get () { reads[key]++; return getter.call(this); } });
        }
        const result = text[property];
        expect(result).to.be.ok;
        expect(reads.clientWidth).equals(1, `${property} must read clientWidth only once`);
        expect(reads.clientHeight).equals(1, `${property} must read clientHeight only once`);
      } finally {
        const node = text.env.renderer.getNodeForMorph(text);
        for (const [key, descriptor] of originals) {
          if (descriptor) Object.defineProperty(node, key, descriptor);
          else delete node[key];
        }
        text.remove();
      }
    });
  }
});
