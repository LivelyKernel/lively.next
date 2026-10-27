/* global describe, it */
import { expect } from 'mocha-es6';
import { HTMLMorph } from '../html-morph.js';
import { Morph } from '../index.js';
import { serialize, deserialize } from 'lively.serializer2';

const styleFor = (doc, id) => [...doc.head.querySelectorAll('style')].find(n => n.textContent.includes('#' + id + ' '));

describe('HTML CSS serialization lifecycle', () => {
  it('installs private CSS for an html morph restored by deserialization into a container', async () => {
    const container = new Morph({ submorphs: [new HTMLMorph({ html: '<span class="c">x</span>', cssDeclaration: '.c { color: rgb(0, 128, 0); }' })] });
    const copy = deserialize(serialize(container));
    const html = copy.submorphs[0];
    $world.addMorph(copy);
    try {
      await html.whenRendered();
      expect(!!styleFor(html.document, html.id)).equals(true);
      expect(getComputedStyle(html.domNode.firstChild).color).equals('rgb(0, 128, 0)');
    } finally { copy.remove(); }
  });

  it('installs shared CSS for an html morph restored by deserialization', async () => {
    const container = new Morph({ submorphs: [new HTMLMorph({ shareCss: true, html: '<span class="c">x</span>', cssDeclaration: '.c { color: rgb(0, 128, 0); }' })] });
    const copy = deserialize(serialize(container));
    const html = copy.submorphs[0];
    $world.addMorph(copy);
    try {
      await html.whenRendered();
      expect(html.shareCss).equals(true);
      expect(getComputedStyle(html.domNode.firstChild).color).equals('rgb(0, 128, 0)');
    } finally { copy.remove(); }
  });

  it('does not leave stale shared/private nodes after remove', async () => {
    const a = new HTMLMorph({ shareCss: true, cssDeclaration: '.c { color: red; }' }).openInWorld();
    const b = new HTMLMorph({ cssDeclaration: '.c { color: red; }' }).openInWorld();
    const doc = a.document;
    a.remove(); b.remove();
    expect(!!styleFor(doc, a.id)).equals(false);
    expect(!!styleFor(doc, b.id)).equals(false);
    expect([...doc.head.childNodes].some(n => n.nodeType === 8 && (n.data === 'css-for-' + a.id || n.data === 'css-for-' + b.id))).equals(false);
  });
});
