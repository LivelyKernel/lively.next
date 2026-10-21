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
  for (const [limit, content] of Object.entries(largeContents)) {
    it(`does not retain an oversized document (${limit})`, async () => {
      const text = new Text({ readOnly: false, fixedWidth: true, fixedHeight: true, textAndAttributes: content() }).openInWorld();
      try {
        await text.whenRendered();
        const original = text.document;
        const anchor = text.addAnchor({ id: 'large-text-anchor', row: 0, column: 1 });
        text.readOnly = true;
        expect(text._documentBackup).equals(undefined, `${limit}: oversized documents must not be retained in static mode`);
        expect(anchor.position).deep.equals({ row: 0, column: 1 }, `${limit}: dropping the cache must preserve anchors`);
        text.readOnly = false;
        text.env.forceUpdate();
        expect(text.document).not.equals(original, `${limit}: oversized documents must be reconstructed`);
        expect(text.textString).equals(original.textString, `${limit}: reconstruction must preserve contents`);
        text.document.consistencyCheck();
        text.readOnly = true;
        text.textString = 'replacement';
        expect(anchor.position).deep.equals({ row: 0, column: 0 }, `${limit}: static replacement must retain anchor invalidation semantics`);
      } finally { text.remove(); }
    });

    it(`does not retain oversized static line DOM (${limit})`, async () => {
      const text = new Text({ readOnly: true, fixedWidth: true, fixedHeight: true, textAndAttributes: content() }).openInWorld();
      try {
        await text.whenFontLoaded();
        text.env.forceUpdate();
        expect(text.renderingState.cachedStaticLines).equals(undefined, `${limit}: oversized static line sets must not be cached`);
        const before = text.textString;
        text.readOnly = false;
        text.readOnly = true;
        text.env.forceUpdate();
        expect(text.textString).equals(before, `${limit}: mode switches must preserve uncached text`);
      } finally { text.remove(); }
    });
  }
});
