/* global describe, it */
import { expect } from 'mocha-es6';
import { LivelyWorld } from '../world.js';

describe('studio initialization', () => {
  it('keeps the name of a world without metadata that opens no prompt', async () => {
    const world = new LivelyWorld({ name: 'world without metadata' });
    world.initializeTopBar = async () => {};
    world.initializeStudioUI = async () => {};
    const url = document.location.href;
    try {
      await world.initializeStudio();
      expect(world.name).equals('world without metadata');
      expect(new URLSearchParams(document.location.search).get('name'), 'the browser history shows the world')
        .equals('world without metadata');
    } finally {
      window.history.replaceState({}, '', url);
    }
  });
});
