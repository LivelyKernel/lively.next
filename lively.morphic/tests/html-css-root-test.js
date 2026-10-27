/* global describe, it, getComputedStyle */
import { expect } from 'mocha-es6';
import { HTMLMorph } from '../html-morph.js';
import { Morph } from '../morph.js';
import { addOrChangeCSSDeclaration } from '../rendering/dom-helper.js';

describe('HTML content root CSS', () => {
  for (const shareCss of [false, true]) {
    it(`styles a custom domNode root (shareCss=${shareCss})`, async () => {
      const html = new HTMLMorph({ shareCss, cssDeclaration: '.custom-root { color:rgb(255,0,0); }' }).openInWorld();
      try {
        const root = html.document.createElement('div');
        root.className = 'custom-root';
        root.textContent = 'root';
        html.domNode = root;
        await html.whenRendered();
        expect(getComputedStyle(root).color).equals('rgb(255, 0, 0)', 'CSS must match the custom domNode itself');
      } finally { html.remove(); }
    });

    it(`styles the wrapper without styling a morphic child (shareCss=${shareCss})`, async () => {
      const child = new Morph();
      const html = new HTMLMorph({ shareCss, html: 'plain text', cssDeclaration: 'div { padding:7px; }', submorphs: [child] }).openInWorld();
      try {
        await html.whenRendered();
        expect(getComputedStyle(html.domNode).paddingLeft).equals('7px', 'div CSS must match the HTML wrapper');
        expect(getComputedStyle(html.env.renderer.getNodeForMorph(child)).paddingLeft).equals('0px', 'root matching must not reach a morphic child');
      } finally { html.remove(); }
    });

    it(`keeps root selector specificity (shareCss=${shareCss})`, async () => {
      const html = new HTMLMorph({ shareCss, cssDeclaration: '.custom-root { color:rgb(255,0,0); }' }).openInWorld();
      const external = addOrChangeCSSDeclaration('root-cascade-' + html.id, `#${html.id} .custom-root { color:rgb(0,0,255); }`, html.document);
      try {
        html.domNode.className = 'custom-root';
        html.domNode.textContent = 'root';
        await html.whenRendered();
        expect(getComputedStyle(html.domNode).color).equals('rgb(0, 0, 255)', 'the root boundary must not increase selector specificity');
      } finally { external.remove(); html.remove(); }
    });
  }
});
