/* global describe, it, System */
import { expect } from 'mocha-es6';
import { parse } from 'lively.ast';
import BrowserResolver from '../src/resolvers/browser.js';

describe('freezer browser resolver', () => {
  it('returns a usable file URL synchronously for generated runtime assets', () => {
    const file = 'lively.freezer/src/util/system.0.21.js';
    const url = BrowserResolver.normalizeFileName(file);
    expect(url).equals(System.decanonicalize(file));
    expect(new URL(url).pathname).includes('/src/util/system.0.21.js');
  });

  it('preserves the freezer plugin when Rollup supplies the resolution context', () => {
    const freezerPlugin = { name: 'freezer fixture' };
    const plugins = BrowserResolver.supportingPlugins('browser', freezerPlugin);
    expect(plugins[0]).equals(freezerPlugin);
    expect(plugins.every(plugin => typeof plugin === 'object')).equals(true);
  });

  it('injects Node globals in dependency URLs and nested install paths', async () => {
    const plugin = BrowserResolver.supportingPlugins('browser', {}).find(plugin => plugin.name === 'polyfill-node');
    for (const id of [
      System.baseURL + 'node_modules/.bun/example/node_modules/example/index.js',
      System.baseURL + 'node_modules/example/index.mjs',
      'C:\\runtime\\node_modules\\example\\index.cjs'
    ]) {
      const result = await plugin.transform.call({ parse }, 'export const answer = process.browser;', id);
      expect(result && result.code, id).includes('polyfill-node.process');
    }
  });
});
