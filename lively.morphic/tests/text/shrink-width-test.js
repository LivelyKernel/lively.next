/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text, TilingLayout } from '../../index.js';
import { pt } from 'lively.graphics';

describe('text shrink width', () => {
  for (const axis of ['row', 'column']) {
    for (const renderViaCSS of [false, true]) {
      it(`hugs short content and wraps within available ${axis} width (CSS: ${renderViaCSS})`, async () => {
        const text = new Text({ name: 'label', readOnly: axis === 'column', textString: 'Words that wrap when the container becomes small', fontSize: 13.75, fixedHeight: false });
        const sibling = new Morph({ name: 'sibling', extent: pt(35, 20) });
        const container = new Morph({ extent: pt(500, 300), submorphs: [text, sibling], layout: new TilingLayout({
          axis, renderViaCSS, align: 'center', axisAlign: 'center', padding: 10, spacing: 5,
          resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
        }) }).openInWorld();
        try {
          await text.whenFontLoaded();
          container.env.forceUpdate();
          expect(text.fixedWidth).equals(true);
          expect(text.lineWrapping).equals('by-words');
          const naturalWidth = text.intrinsicWidth();
          expect(text.width).closeTo(naturalWidth, 1, 'initial width');
          const initialHeight = text.height;
          container.width = 100;
          container.env.forceUpdate();
          const available = axis === 'row' ? 40 : 80;
          expect(text.width).closeTo(available, 1);
          expect(text.height).greaterThan(initialHeight);
          expect(text.textString).equals('Words that wrap when the container becomes small');
          if (text.document) text.document.consistencyCheck();
          text.textString = 'Hi';
          container.width = 500;
          container.env.forceUpdate();
          expect(text.width).closeTo(text.intrinsicWidth(), 1, 'width after content change');
          expect(text.width).lessThan(naturalWidth);
          if (axis === 'column') expect(text.center.x).closeTo(250, 1);
          text.fontSize = 21.3;
          container.env.forceUpdate();
          // Yoga rounds text edges outwards with the existing point scale factor.
          expect(text.width).closeTo(text.intrinsicWidth(), 2, 'width after font change');
          const copy = container.copy();
          expect(copy.layout.getResizeWidthPolicyFor(copy.get('label'))).equals('shrink');
          copy.remove();
          container.layout.setResizePolicyFor(text, { width: 'fixed', height: 'fixed' });
          text.fixedWidth = true;
          text.width = 160;
          container.env.forceUpdate();
          expect(text.width).equals(160);
          expect(container.env.renderer.getNodeForMorph(text).style.maxWidth).equals('');
          expect(text.brokenDocument).equals(undefined);
        } finally { container.remove(); }
      });
    }
  }
});
