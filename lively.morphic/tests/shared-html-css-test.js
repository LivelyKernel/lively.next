/* global describe, it */
import { expect } from 'mocha-es6';
import { HTMLMorph } from '../html-morph.js';
import { addOrChangeCSSDeclaration, addOrChangeLinkedCSS } from '../rendering/dom-helper.js';

describe('shared HTML morph CSS', () => {
  it('preserves external stylesheet ordering when sharing and toggling declarations', async () => {
    for (const linked of [false, true]) for (const shareCss of [false, true]) {
      const outer = new HTMLMorph({ shareCss, html: '<span class="content">outer</span>', cssDeclaration: '.content { color: red; }' });
      const source = `#${outer.id} .content { color: blue; }`;
      const external = linked
        ? await addOrChangeLinkedCSS('external-cascade-test', 'data:text/css,' + encodeURIComponent(source), outer.document)
        : addOrChangeCSSDeclaration('external-cascade-test', source, outer.document);
      if (linked) external.rel = 'StyleSheet';
      const inner = new HTMLMorph({ shareCss, html: '<span class="content">inner</span>', cssDeclaration: '.content { color: red; }' });
      outer.addMorph(inner);
      outer.openInWorld();
      try {
        await inner.whenRendered();
        const check = () => {
          expect(getComputedStyle(outer.domNode.firstChild).color).equals('rgb(0, 0, 255)');
          expect(getComputedStyle(inner.domNode.firstChild).color).equals('rgb(255, 0, 0)');
        };
        check();
        outer.shareCss = !outer.shareCss;
        check();
        inner.shareCss = !inner.shareCss;
        check();
        external.remove();
        inner.cssDeclaration = '.content { color: green; }';
        expect(getComputedStyle(outer.domNode.firstChild).color).equals('rgb(255, 0, 0)');
        expect(getComputedStyle(inner.domNode.firstChild).color).equals('rgb(0, 128, 0)');
      } finally { inner.remove(); outer.remove(); external.remove(); }
    }
  });

  it('preserves nested cascade order for every shared/private combination and toggles', async () => {
    for (let flags = 0; flags < 8; flags++) {
      const morphs = ['red', 'blue', 'red'].map((color, index) => new HTMLMorph({
        shareCss: !!(flags & (1 << index)), html: '<span class="content">text</span>', cssDeclaration: `.content { color: ${color}; }`
      }));
      const [outer, middle, inner] = morphs;
      outer.addMorph(middle);
      middle.addMorph(inner);
      outer.openInWorld();
      try {
        await inner.whenRendered();
        const check = () => expect(morphs.map(m => getComputedStyle(m.domNode.firstChild).color)).deep.equals(['rgb(255, 0, 0)', 'rgb(0, 0, 255)', 'rgb(255, 0, 0)']);
        check();
        for (const morph of morphs) { morph.shareCss = !morph.shareCss; check(); }
        middle.cssDeclaration = '';
        expect(getComputedStyle(inner.domNode.firstChild).color).equals('rgb(255, 0, 0)');
      } finally { outer.remove(); middle.remove(); inner.remove(); }
    }
  });

  it('preserves the private CSS cascade for nested red, blue, red declarations', async () => {
    for (const shareCss of [false, true]) {
      const makeMorph = color => new HTMLMorph({ shareCss, html: '<span class="content">text</span>', cssDeclaration: `.content { color: ${color}; }` });
      const outer = makeMorph('red');
      const middle = makeMorph('blue');
      const inner = makeMorph('red');
      outer.addMorph(middle);
      middle.addMorph(inner);
      outer.openInWorld();
      try {
        await inner.whenRendered();
        inner.env.forceUpdate();
        const colors = [outer, middle, inner].map(m => getComputedStyle(m.domNode.firstChild).color);
        expect(colors).deep.equals(['rgb(255, 0, 0)', 'rgb(0, 0, 255)', 'rgb(255, 0, 0)']);
      } finally { outer.remove(); middle.remove(); inner.remove(); }
    }
  });

  it('shares identical declarations, scopes changes and maintains one style node', async () => {
    const props = { html: '<span class="content">text</span>', cssDeclaration: '.content { color: rgb(255, 0, 0); }' };
    const first = new HTMLMorph({ ...props, shareCss: true }).openInWorld();
    const second = new HTMLMorph({ ...props, shareCss: true }).openInWorld();
    const privateMorph = new HTMLMorph(props).openInWorld();
    const doc = first.document;
    try {
      await first.whenRendered();
      first.env.forceUpdate();
      const style = doc.getElementById('css-for-shared-html-morphs');
      expect(style).to.be.ok;
      expect(style.textContent.match(/color:/g)).length(1);
      expect(doc.getElementById('css-for-' + first.id)).equals(null);
      expect(doc.getElementById('css-for-' + second.id)).equals(null);
      expect(doc.getElementById('css-for-' + privateMorph.id)).to.be.ok;
      const color = m => getComputedStyle(m.domNode.firstChild).color;
      expect(color(first)).equals('rgb(255, 0, 0)');
      second.cssDeclaration = '@media (min-width: 0px) { .content { color: rgb(0, 0, 255); } }';
      expect(doc.getElementById(style.id)).equals(style);
      expect(color(second)).equals('rgb(0, 0, 255)');
      expect(color(first)).equals('rgb(255, 0, 0)');
      expect(color(privateMorph)).equals('rgb(255, 0, 0)');
      second.shareCss = false;
      expect(doc.getElementById('css-for-' + second.id)).to.be.ok;
      expect(style.textContent.includes(second.id)).equals(false);
      first.cssDeclaration = '';
      expect(doc.getElementById(style.id)).equals(null);
      second.shareCss = true;
      const replacement = doc.getElementById(style.id);
      second.remove();
      expect(doc.getElementById(style.id)).equals(null);
      second.openInWorld();
      second.env.forceUpdate();
      expect(doc.getElementById(style.id)).to.be.ok;
      expect(doc.getElementById(style.id) === replacement).equals(false);
      expect(color(second)).equals('rgb(0, 0, 255)');
      const copy = second.copy();
      expect(copy.shareCss).equals(true);
      copy.remove();
    } finally { first.remove(); second.remove(); privateMorph.remove(); }
  });

  it('removes membership from the previous document when moving CSS', () => {
    const morph = new HTMLMorph({ shareCss: true, cssDeclaration: '.content { color: red; }' });
    const firstDoc = morph.document;
    const otherDoc = firstDoc.implementation.createHTMLDocument('other');
    try {
      morph.installCssDeclaration(otherDoc);
      expect(firstDoc.getElementById('css-for-shared-html-morphs')).equals(null);
      expect(otherDoc.getElementById('css-for-shared-html-morphs')).to.be.ok;
      morph.installCssDeclaration(firstDoc);
      expect(otherDoc.getElementById('css-for-shared-html-morphs')).equals(null);
      expect(firstDoc.getElementById('css-for-shared-html-morphs')).to.be.ok;
    } finally { morph.uninstallCssDeclaration?.(); morph.remove(); }
  });
});
