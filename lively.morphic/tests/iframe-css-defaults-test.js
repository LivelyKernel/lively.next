/* global describe, it */
import { expect } from 'mocha-es6';
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { morph, MorphicEnv } from '../index.js';
import { pt } from 'lively.graphics';

describe('iframe morphic CSS defaults', () => {
  it('iframe dom environments resolve stylesheet defaults for omitted declarations', async () => {
    const env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
    try {
      const world = morph({ type: 'world', name: 'world', extent: pt(300, 300), submorphs: [{ name: 'm', extent: pt(50, 50), position: pt(10, 10), borderWidth: 2 }] });
      await env.setWorld(world);
      env.forceUpdate();
      const node = env.renderer.getNodeForMorph(world.get('m'));
      const cs = env.domEnv.window.getComputedStyle(node);
      expect(node.style.borderLeftStyle).equals('', 'default border style must stay omitted inline');
      expect(cs.borderLeftStyle).equals('solid', 'iframe stylesheet must supply solid borders');
      expect(cs.backgroundColor).equals('rgb(255, 255, 255)', 'iframe stylesheet must supply the omitted white fill');
    } finally { MorphicEnv.popDefault().uninstall(); }
  });
});
