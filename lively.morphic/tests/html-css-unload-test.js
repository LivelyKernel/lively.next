/* global describe, it, getComputedStyle */
import { expect } from 'mocha-es6';
import { HTMLMorph } from '../html-morph.js';
import { Morph, MorphicEnv, morph } from '../index.js';
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { loadWorld } from '../world-loading.js';
import { pt } from 'lively.graphics';

describe('HTML CSS world lifetime', () => {
  for (const shareCss of [false, true]) {
    it(`keeps CSS installed after a cancelled beforeunload (shareCss=${shareCss})`, async () => {
      const html = new HTMLMorph({
        shareCss,
        html: '<span class="unload-content">content</span>',
        cssDeclaration: '.unload-content { color:rgb(255,0,0); }'
      }).openInWorld();
      try {
        await html.whenRendered();
        const world = html.world();
        expect(getComputedStyle(html.domNode.firstChild).color).equals('rgb(255, 0, 0)', 'CSS must be installed before beforeunload');
        html.env.eventDispatcher.dispatchDOMEvent(new Event('beforeunload'), world, 'onBeforeUnload');
        await html.whenRendered();
        expect(html.env.world).equals(world, 'a cancelled beforeunload keeps the active world');
        expect(getComputedStyle(html.domNode.firstChild).color).equals('rgb(255, 0, 0)', 'CSS must survive a cancelled beforeunload');
        expect((world.attributeConnections || []).some(c => c.targetObj === html)).equals(true, 'the active world must retain the CSS cleanup connection');
      } finally { html.remove(); }
    });
  }

  it('releases private and shared CSS from a nested old world on in-page loadWorld', async () => {
    const env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
    const members = [false, true].map(shareCss => new HTMLMorph({ env, shareCss, cssDeclaration: '.content { color:red; }' }));
    const oldWorld = morph({ type: 'world', env, extent: pt(300, 300), submorphs: [new Morph({ env, submorphs: members })] });
    try {
      await env.setWorld(oldWorld);
      env.forceUpdate();
      const doc = env.domEnv.document;
      const newWorld = morph({ type: 'world', env, extent: pt(300, 300) });
      await loadWorld(newWorld, oldWorld, { env, l2l: false, shell: false, localconfig: false, verbose: false });
      const fresh = newWorld.addMorph(new HTMLMorph({ env, shareCss: true, cssDeclaration: '.content { color:blue; }' }));
      env.forceUpdate();
      const sheets = [...doc.head.querySelectorAll('style')].map(node => node.textContent).join('\n');
      for (const member of members) {
        expect(sheets.includes(member.id)).equals(false, 'unloaded world must not remain in the document CSS registry');
        expect([...doc.head.childNodes].some(n => n.nodeType === 8 && n.data === 'css-for-' + member.id)).equals(false, 'unloaded world must release its CSS markers');
        expect((oldWorld.attributeConnections || []).some(c => c.targetObj === member)).equals(false, 'unloaded world must release its unload connection');
      }
      expect(sheets.includes(fresh.id)).equals(true, 'new world CSS must stay installed');
    } finally { await MorphicEnv.popDefault().uninstall(); }
  });
});
