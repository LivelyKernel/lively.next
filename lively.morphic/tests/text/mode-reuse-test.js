/* global describe, it */
import { expect } from 'mocha-es6';
import { Text, Morph } from '../../index.js';
import { pt, Color } from 'lively.graphics';

describe('text mode reuse', () => {
  it('refreshes static lines when global formatting removes inline attributes', async () => {
    const text = new Text({
      readOnly: false, fixedWidth: true, fixedHeight: true,
      textAndAttributes: ['inline', { fontColor: Color.red, fontSize: 28 }, ' plain', null]
    }).openInWorld();
    try {
      await text.whenRendered();
      text.readOnly = true;
      text.env.forceUpdate();
      const originalLine = text.renderingState.textLayer.querySelector('.line');
      text.removePlainTextAttribute('fontSize', 40);
      text.env.forceUpdate();
      expect(text.renderingState.textLayer.querySelector('.line')).equals(originalLine);
      text.removePlainTextAttribute('fontColor');
      text.fontColor = Color.blue;
      text.removePlainTextAttribute('fontSize');
      text.fontSize = 30;
      text.env.forceUpdate();
      const span = text.renderingState.textLayer.querySelector('.line').firstChild;
      expect(getComputedStyle(span).color).equals(Color.blue.toP3ColorString().replace(' / 1', ''));
      expect(getComputedStyle(span).fontSize).equals('30px');
      text.readOnly = false;
      text.env.forceUpdate();
      expect(text.textAndAttributes[1]?.fontColor).equals(undefined);
      expect(text.textAndAttributes[1]?.fontSize).equals(undefined);
      text.document.consistencyCheck();
    } finally { text.remove(); }
  });

  it('restores marker and cursor nodes without accumulating selection anchors', async () => {
    const text = new Text({ readOnly: false, textString: 'first\nsecond' }).openInWorld();
    try {
      await text.whenRendered();
      text.addMarker({ id: 'retained', range: { start: { row: 0, column: 0 }, end: { row: 0, column: 3 } }, style: { 'background-color': 'red' } });
      text.env.forceUpdate();
      for (let i = 0; i < 4; i++) {
        text.readOnly = true;
        text.env.forceUpdate();
        text.readOnly = false;
        text.env.forceUpdate();
        const node = text.env.renderer.getNodeForMorph(text);
        expect(node.querySelectorAll('.newtext-marker-layer')).length(1);
        expect(text.renderingState.cursorNodes).length(1);
        expect(text.anchors.filter(anchor => anchor.id.startsWith('selection-'))).length(2);
      }
    } finally { text.remove(); }
  });

  it('retains document content and reuses unchanged static lines across mode switches', async () => {
    const text = new Text({ readOnly: false, textString: 'first\nsecond', fixedWidth: true, fixedHeight: true }).openInWorld();
    try {
      await text.whenRendered();
      const document = text.document;
      text.readOnly = true;
      text.env.forceUpdate();
      expect(document.textString).equals('first\nsecond');
      const staticLine = text.renderingState.textLayer.querySelector('.line');
      for (let i = 0; i < 4; i++) {
        text.readOnly = false;
        text.env.forceUpdate();
        expect(text.document === document).equals(true, 'document was replaced');
        document.consistencyCheck();
        text.readOnly = true;
        text.env.forceUpdate();
        expect(text.renderingState.textLayer.querySelector('.line')).equals(staticLine);
        expect(text.textString).equals('first\nsecond');
      }
      const copy = text.copy();
      expect(copy._documentBackup).equals(undefined);
      expect(copy.textString).equals(text.textString);
      copy.remove();
    } finally { text.remove(); }
  });

  it('regenerates the document after static content changes', async () => {
    const text = new Text({ readOnly: false, textString: 'before' }).openInWorld();
    try {
      await text.whenRendered();
      const document = text.document;
      text.readOnly = true;
      text.textAndAttributes = ['changed', { fontColor: Color.blue }];
      text.readOnly = false;
      text.env.forceUpdate();
      expect(text.document === document).equals(false, 'stale document was reused');
      expect(text.textString).equals('changed');
      expect(text.textAndAttributes[1].fontColor).equals(Color.blue);
      text.document.consistencyCheck();
    } finally { text.remove(); }
  });

  it('invalidates static lines after edits and attribute changes', async () => {
    const text = new Text({ readOnly: false, textString: 'before', fixedWidth: true, fixedHeight: true }).openInWorld();
    try {
      await text.whenRendered();
      text.readOnly = true;
      text.env.forceUpdate();
      const line = text.renderingState.textLayer.querySelector('.line');
      text.readOnly = false;
      text.insertText('new ', { row: 0, column: 0 });
      text.addTextAttribute({ fontColor: Color.blue }, { start: { row: 0, column: 0 }, end: { row: 0, column: 4 } });
      text.readOnly = true;
      text.env.forceUpdate();
      const updatedLine = text.renderingState.textLayer.querySelector('.line');
      expect(updatedLine).not.equals(line);
      expect(updatedLine.textContent).equals('new before');
      expect(getComputedStyle(updatedLine.firstChild).color).equals(Color.blue.toP3ColorString().replace(' / 1', ''));
    } finally { text.remove(); }
  });

  it('remeasures retained documents after font, wrapping and width changes', async () => {
    const text = new Text({
      readOnly: false, textString: Array(12).fill('words that wrap across a line').join('\n'),
      fixedWidth: true, fixedHeight: true, extent: pt(200, 150),
      fontSize: 13.75, lineHeight: 1.3, lineWrapping: 'by-words', clipMode: 'auto'
    }).openInWorld();
    try {
      await text.whenFontLoaded();
      text.env.forceUpdate();
      const document = text.document, originalHeight = document.height;
      text.readOnly = true;
      text.fontSize = 19.3;
      text.width = 100;
      text.readOnly = false;
      text.env.forceUpdate();
      expect(text.document === document).equals(true, 'document was replaced');
      expect(document.height).greaterThan(originalHeight);
      document.consistencyCheck();
      expect(text.brokenDocument).equals(undefined);
    } finally { text.remove(); }
  });

  it('retains document content and embedded ownership through repeated switches', async () => {
    const embedded = new Morph({ extent: pt(30, 20) });
    const text = new Text({ readOnly: false, textAndAttributes: ['before ', null, embedded, null, ' after', null] }).openInWorld();
    try {
      await text.whenRendered();
      const document = text.document;
      for (let i = 0; i < 4; i++) {
        text.readOnly = true;
        text.env.forceUpdate();
        expect(embedded.owner).equals(text);
        expect(text.embeddedMorphs).includes(embedded);
        text.readOnly = false;
        text.env.forceUpdate();
        expect(text.document === document).equals(true, 'document was replaced');
        expect(text.textString).equals('before \ufffd after');
        expect(text.embeddedMorphMap.get(embedded).anchor).to.be.ok;
        document.consistencyCheck();
      }
    } finally { text.remove(); }
  });
});
