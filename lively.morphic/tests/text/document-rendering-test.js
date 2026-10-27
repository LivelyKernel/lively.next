/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text } from '../../index.js';
import { pt, Color } from 'lively.graphics';

describe('document consistency during rendering', () => {
  for (const measurement of ['canvas', 'DOM']) {
    it(`preserves a scaled, wrapped document during ${measurement} measuring and editing`, async function () {
      this.timeout(30000);
      const owner = new Morph({ extent: pt(600, 400), position: pt(30, 30) }).openInWorld();
      const content = Array.from({ length: 120 }, (_, row) => [
        `line ${row}: words that wrap at fractional widths `, null,
        'styled text', { fontSize: 17.25, fontColor: Color.blue },
        row === 119 ? '' : '\n', null
      ]).flat();
      const text = owner.addMorph(new Text({
        textAndAttributes: content, readOnly: false,
        fontFamily: 'IBM Plex Mono', fontSize: 14.1, lineHeight: 1.3,
        extent: pt(213.75, 160), fixedWidth: true, fixedHeight: true,
        lineWrapping: 'by-words', clipMode: 'auto'
      }));
      // Exercise both real measuring implementations, regardless of the font heuristic.
      Object.defineProperty(text, 'canBeMeasuredViaCanvas', { get: () => measurement === 'canvas' });
      try {
        await text.whenFontLoaded();
        const document = text.document;
        const originalText = text.textString;
        const originalAttributes = text.textAndAttributes;
        const anchor = text.addAnchor({ id: 'retained', row: 90, column: 2 });
        text.selection.range = { start: { row: 90, column: 2 }, end: { row: 90, column: 5 } };

        const check = () => {
          document.consistencyCheck();
          expect(text.document).equals(document, 'document was replaced');
          expect(text.brokenDocument).equals(undefined, 'consistency recovery ran');
          expect(text.textString).equals(originalText);
          expect(text.textAndAttributes).deep.equals(originalAttributes);
          expect(anchor.position).deep.equals({ row: 90, column: 2 });
          expect(text.selection.range).containSubset({
            start: { row: 90, column: 2 }, end: { row: 90, column: 5 }
          });
        };

        for (let i = 0; i < 24; i++) {
          text.scale = [0.7, 1.125, 1.3, 2, 0.333333, 1][i % 6];
          owner.scale = [1.25, 0.8, 1][i % 3];
          text.fontSize = [14.1, 13.75, 19.3, 11.125][i % 4];
          text.lineHeight = [1.3, 1.125, 1.7][i % 3];
          text.width = [213.75, 117.3, 302.125][i % 3];
          text.lineWrapping = ['by-words', 'by-chars', 'no-wrap'][i % 3];
          text.invalidateTextLayout(true, true);
          text.scroll = pt(0, 0);
          text.env.forceUpdate();
          check();

          const inserted = text.insertText('inserted\n', { row: 0, column: 0 }, false);
          expect(text.document).equals(document);
          expect(anchor.position).deep.equals({ row: 91, column: 2 });
          document.consistencyCheck();
          text.env.forceUpdate();
          document.consistencyCheck();
          text.deleteText(inserted);
          text.scroll = pt(0, document.height);
          text.env.forceUpdate();
          check();
        }
      } finally { owner.remove(); }
    });
  }
});
