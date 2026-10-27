/* global describe, it, getComputedStyle */
import { expect } from 'mocha-es6';
import { HTMLMorph } from '../html-morph.js';
import { Morph } from '../index.js';
import { Color, pt } from 'lively.graphics';
import { addOrChangeCSSDeclaration } from '../rendering/dom-helper.js';

describe('HTML content CSS isolation', () => {
  it('keeps div declarations off a white child morph', async () => {
    const child = new Morph({ position: pt(10, 20), extent: pt(40, 40), fill: Color.white });
    const html = new HTMLMorph({ html: '<div class="content">content</div>', cssDeclaration: 'div { border:3px solid red; background:rgb(0,0,255); transform:rotate(45deg) }', submorphs: [child] }).openInWorld();
    try {
      await html.whenRendered();
      const style = getComputedStyle(html.env.renderer.getNodeForMorph(child));
      expect(style.borderLeftWidth).equals('0px', 'HTML div border must not reach a morphic child');
      expect(style.backgroundColor).to.be.oneOf(['rgb(255, 255, 255)', 'color(display-p3 1 1 1)'], 'HTML div background must not reach a white morphic child');
      expect(style.transform).equals('matrix(1, 0, 0, 1, 0, 0)', 'HTML div transform must not replace a morphic child transform');
      expect(getComputedStyle(html.domNode.firstChild).backgroundColor).equals('rgb(0, 0, 255)', 'content CSS must still style custom HTML');
    } finally { html.remove(); }
  });

  for (const shareCss of [false, true]) {
    it(`isolates nested media/supports rules from nested HTMLMorph content (shareCss=${shareCss})`, async () => {
      const child = new HTMLMorph({ html: '<span class="fx8-content">child</span>' });
      const outer = new HTMLMorph({ shareCss, html: '<span class="fx8-content">outer</span>', cssDeclaration: '@media (min-width:0px) { @supports (display:block) { .fx8-content { color:rgb(255,0,0); } } }', submorphs: [child] }).openInWorld();
      try {
        await outer.whenRendered();
        expect(getComputedStyle(outer.domNode.firstChild).color).equals('rgb(255, 0, 0)', 'nested rules must apply inside their own HTML');
        expect(getComputedStyle(child.domNode.firstChild).color).not.equals('rgb(255, 0, 0)', 'nested rules must not match another HTMLMorph content');
      } finally { outer.remove(); child.remove(); }
    });
  }

  it('keeps external stylesheet specificity and order', async () => {
    const html = new HTMLMorph({ html: '<span class="fx8-content">content</span>', cssDeclaration: '.fx8-content { color:rgb(255,0,0); }' }).openInWorld();
    const style = addOrChangeCSSDeclaration('fx8-external-style', `#${html.id} .fx8-content { color:rgb(0,0,255); }`, html.document);
    try {
      await html.whenRendered();
      expect(getComputedStyle(html.domNode.firstChild).color).equals('rgb(0, 0, 255)', 'content boundary must not increase selector specificity');
    } finally { style.remove(); html.remove(); }
  });
});
