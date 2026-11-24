/* global describe, it */
import { expect } from 'mocha-es6';
import { part } from 'lively.morphic';
import { WorldBrowser } from '../studio/world-browser.cp.js';

describe('world browser faders', () => {
  it('pass pointer events at the bottom of the list to the tiles below them', () => {
    const browser = part(WorldBrowser).openInWorld();
    try {
      browser.env.forceUpdate();
      const fader = browser.env.renderer.getNodeForMorph(browser.get('fader bottom'));
      const { left, top, width, height } = fader.getBoundingClientRect();
      const target = document.elementFromPoint(left + width / 2, top + height / 2);
      expect(fader.contains(target), 'the fader is not the pointer target').equals(false);
      expect(browser.env.renderer.getNodeForMorph(browser).contains(target), 'the browser below is').equals(true);
    } finally {
      browser.remove();
    }
  });
});
