/* global describe, it */
import { expect } from 'mocha-es6';
import { Text, Morph } from '../../index.js';
import { pt } from 'lively.graphics';

describe('embedded morphs in static text', () => {
  it('maintains ownership, text and removal without creating a document', async () => {
    const embedded = new Morph({ extent: pt(25, 15) });
    const text = new Text({ readOnly: true, textAndAttributes: ['before ', null, embedded, null, ' after', null] }).openInWorld();
    try {
      await text.whenRendered();
      expect(text.document).not.to.be.ok;
      expect(text.needsDocument).equals(false);
      expect(text.textString).equals('before \ufffd after');
      expect(embedded.owner).equals(text);
      expect(text.submorphs).deep.equals([embedded]);
      expect(text.embeddedMorphMap.has(embedded)).equals(true);
      const ordinary = Array.from({ length: 3 }, () => new Morph());
      ordinary.forEach(morph => text.addMorph(morph));
      expect(text.submorphs).deep.equals([embedded, ...ordinary]);
      expect(text.withAllSubmorphsSelect(morph => morph === embedded)).length(1);
      embedded.remove();
      text.env.forceUpdate();
      expect(text.textString).equals('before  after');
      expect(text.submorphs).deep.equals(ordinary);
      expect(text.embeddedMorphMap.has(embedded)).equals(false);
      expect(embedded.owner).equals(null);
    } finally { text.remove(); }
  });

  it('reconciles static embedded morphs when text is replaced or copied', async () => {
    const first = new Morph({ extent: pt(25, 15) });
    const second = new Morph({ extent: pt(30, 20) });
    const text = new Text({ readOnly: true, textAndAttributes: ['a', null, first, null] }).openInWorld();
    let copy;
    try {
      text.textAndAttributes = ['b\n', null, second, null];
      await text.whenRendered();
      expect(text.document).not.to.be.ok;
      expect(first.owner).equals(null);
      expect(text.embeddedMorphMap.has(first)).equals(false);
      expect(second.owner).equals(text);
      expect(text.embeddedMorphs).deep.equals([second]);
      copy = text.copy();
      expect(copy.document).not.to.be.ok;
      expect(copy.embeddedMorphs).length(1);
      expect(copy.embeddedMorphs[0]).not.equals(second);
      expect(copy.embeddedMorphs[0].owner).equals(copy);
      expect(copy.submorphs).deep.equals(copy.embeddedMorphs);
      expect(second.owner).equals(text);
    } finally { copy?.remove(); text.remove(); }
  });

  it('updates inline positions through wrapping, transforms and mode changes', async () => {
    const owner = new Morph({ position: pt(70, 50), extent: pt(400, 300), scale: 0.8, rotation: 0.15 }).openInWorld();
    const embedded = new Morph({ extent: pt(30, 20) });
    const text = owner.addMorph(new Text({
      readOnly: true, fixedWidth: true, fixedHeight: true, extent: pt(150, 100),
      scale: 1.3, fontSize: 13.75, borderWidth: 2,
      lineWrapping: 'by-words', textAndAttributes: ['prefix words ', null, embedded, null, ' after\nsecond line', null]
    }));
    try {
      await text.whenFontLoaded();
      const check = () => {
        text.env.forceUpdate();
        const actual = text.env.renderer.getNodeForMorph(embedded).getBoundingClientRect();
        const expected = embedded.globalBounds();
        for (const key of ['x', 'y', 'width', 'height']) expect(actual[key]).closeTo(expected[key], 0.2, key);
        expect(embedded.owner).equals(text);
        expect(text.embeddedMorphs).includes(embedded);
      };
      check();
      expect(text.document).not.to.be.ok;
      text.width = 90;
      text.fontSize = 19.3;
      check();
      text.readOnly = false;
      expect(text.document).to.be.ok;
      expect(text.embeddedMorphMap.get(embedded).anchor).to.be.ok;
      text.insertText('\n', { row: 0, column: 0 });
      check();
      text.readOnly = true;
      expect(text.document).not.to.be.ok;
      expect(text.embeddedMorphMap.get(embedded).anchor).not.to.be.ok;
      check();
      embedded.resizeBy(pt(10, 5));
      check();
    } finally { owner.remove(); }
  });
});
