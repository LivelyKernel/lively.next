/* global describe, it */
import { expect } from 'mocha-es6';
import { Text } from '../../index.js';
import Document from '../../text/document.js';

describe('text mode reuse regressions', () => {
  it('invalidates static lines when the editable document is replaced', async () => {
    const text = new Text({ readOnly: true, textString: 'old content' }).openInWorld();
    try {
      await text.whenRendered();
      const oldLine = text.renderingState.textLayer.querySelector('.line');
      text.readOnly = false;
      text.changeDocument(Document.fromString('new content'));
      text.env.forceUpdate();
      text.readOnly = true;
      text.env.forceUpdate();
      expect(text.textString).equals('new content', 'the model must contain the replacement document');
      expect(text.renderingState.textLayer.textContent).equals('new content', 'static mode must render the replacement document');
      expect(text.renderingState.textLayer.querySelector('.line')).not.equals(oldLine, 'replaced document must invalidate the old static line cache');
    } finally { text.remove(); }
  });

  it('keeps a middle quoted line through repeated multiline mode switches', async () => {
    const text = new Text({ readOnly: true,
      textAndAttributes: ['intro\n', null, 'quoted', { quote: 1 }, '\nafter', null] }).openInWorld();
    try {
      await text.whenFontLoaded();
      text.env.forceUpdate();
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const readOnly of [false, true]) {
          text.readOnly = readOnly;
          text.env.forceUpdate();
          const layer = text.renderingState.textLayer;
          const quotes = layer.querySelectorAll('blockquote');
          expect(quotes.length).equals(1, `cycle ${cycle}, readOnly ${readOnly}: exactly one quote wrapper`);
          expect(quotes[0].textContent).equals('quoted', `cycle ${cycle}, readOnly ${readOnly}: quoted contents must survive`);
          expect(Array.from(layer.querySelectorAll('.line'), node => node.textContent)).deep.equals(
            ['intro', 'quoted', 'after'], `cycle ${cycle}, readOnly ${readOnly}: all logical lines must survive`);
        }
      }
    } finally { text.remove(); }
  });

  const largeContents = {
    characters: () => ['x'.repeat(100001), null],
    lines: () => [Array(1001).fill('x').join('\n'), null],
    'attribute runs': () => Array.from({ length: 1001 }, (_, i) => ['x', { fontWeight: i % 2 ? 'bold' : 'normal' }]).flat()
  };
  for (const [size, content] of Object.entries(largeContents)) {
    it(`reuses a large document regardless of ${size}`, async () => {
      const text = new Text({ readOnly: false, fixedWidth: true, fixedHeight: true, textAndAttributes: content() }).openInWorld();
      try {
        await text.whenRendered();
        const original = text.document;
        const anchor = text.addAnchor({ id: 'large-text-anchor', row: 0, column: 1 });
        for (let cycle = 0; cycle < 3; cycle++) {
          text.readOnly = true;
          expect(text._documentBackup).equals(original, `${size}: retain the document in static mode`);
          expect(anchor.position).deep.equals({ row: 0, column: 1 }, `${size}: switching must preserve anchors`);
          text.readOnly = false;
          text.env.forceUpdate();
          expect(text.document).equals(original, `${size}: reuse the same document`);
          text.document.consistencyCheck();
        }
        text.readOnly = true;
        text.textString = 'replacement';
        expect(anchor.position).deep.equals({ row: 0, column: 0 }, `${size}: static replacement must retain anchor invalidation semantics`);
      } finally { text.remove(); }
    });

    it(`reuses large static line DOM regardless of ${size}`, async () => {
      const text = new Text({ readOnly: true, fixedWidth: true, fixedHeight: true, textAndAttributes: content() }).openInWorld();
      try {
        await text.whenFontLoaded();
        text.env.forceUpdate();
        const lines = text.renderingState.cachedStaticLines;
        expect(lines).to.be.ok;
        expect(lines[0]).equals(text.renderingState.textLayer.querySelector('.line'));
        const before = text.textString;
        text.readOnly = false;
        text.readOnly = true;
        text.env.forceUpdate();
        expect(text.renderingState.cachedStaticLines).equals(lines, `${size}: retain the whole line set`);
        expect(text.renderingState.textLayer.querySelector('.line')).equals(lines[0], `${size}: reuse the rendered line`);
        expect(text.textString).equals(before, `${size}: mode switches must preserve text`);
      } finally { text.remove(); }
    });
  }
});
