/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text, HTMLMorph, TilingLayout } from '../../index.js';
import { pt, Color } from 'lively.graphics';
import { promise } from 'lively.lang';

describe('text shrink width', () => {
  it('measures inline boxes without moving or loading embedded iframe contents', async () => {
    const embedded = new HTMLMorph({ extent: pt(160, 80), html: '<iframe srcdoc="<input value=initial>"></iframe>' });
    const text = new Text({ name: 'label', readOnly: true, fixedHeight: false, fontSize: 20,
      textAndAttributes: ['before ', null, embedded, null, ' after', null] });
    const container = new Morph({ extent: pt(1000, 400), submorphs: [text], layout: new TilingLayout({
      resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
    }) }).openInWorld();
    try {
      await text.whenFontLoaded();
      container.env.forceUpdate();
      const iframe = embedded.domNode.querySelector('iframe');
      await promise.waitFor(3000, () => iframe.contentDocument?.querySelector('input'));
      const originalDocument = iframe.contentDocument;
      originalDocument.querySelector('input').value = 'retained';
      let loads = 0;
      iframe.addEventListener('load', () => loads++);
      for (let i = 0; i < 3; i++) {
        const range = document.createRange();
        range.selectNodeContents(text.renderingState.textLayer.querySelector('.line'));
        expect(text.intrinsicWidth()).closeTo(range.getBoundingClientRect().width, 1);
      }
      await promise.delay(50);
      expect(iframe.contentDocument).equals(originalDocument);
      expect(originalDocument.querySelector('input').value).equals('retained');
      expect(loads).equals(0);
    } finally { container.remove(); }
  });

  for (const axis of ['row', 'column']) {
    for (const renderViaCSS of [false, true]) {
      it(`refits static text when switching ${axis} fill and shrink at the same width (CSS: ${renderViaCSS})`, async () => {
        const text = new Text({ name: 'label', readOnly: true, textString: 'words that wrap across lines', fontSize: 15, fixedHeight: false, lineWrapping: 'no-wrap' });
        const container = new Morph({ extent: pt(100, 300), submorphs: [text], layout: new TilingLayout({
          axis, renderViaCSS, padding: 10,
          resizePolicies: [['label', { width: 'fill', height: 'fixed' }]]
        }) }).openInWorld();
        try {
          await text.whenFontLoaded();
          container.env.forceUpdate();
          const unwrappedHeight = text.height;
          expect(text.width).closeTo(80, 1);
          for (let cycle = 0; cycle < 2; cycle++) {
            container.layout.setResizePolicyFor(text, { width: 'shrink', height: 'fixed' });
            container.env.forceUpdate();
            expect(text.width).closeTo(80, 1);
            expect(text.height).greaterThan(unwrappedHeight);
            expect(text.height).closeTo(text.renderingState.textLayer.getBoundingClientRect().height, 1);
            container.layout.setResizePolicyFor(text, { width: 'fill', height: 'fixed' });
            container.env.forceUpdate();
            expect(text.height).closeTo(unwrappedHeight, 1);
          }
        } finally { container.remove(); }
      });

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
          // Yoga rounds text edges outwards at fractional positions.
          expect(text.width).closeTo(naturalWidth, 2, 'initial width');
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

      it(`measures relative padding and CSS font classes in ${axis} shrink width (CSS: ${renderViaCSS})`, async () => {
        const style = document.createElement('style');
        style.textContent = '.newtext-text-layer .shrink-large-font { font-size: 40px; }';
        document.head.appendChild(style);
        try {
          for (const textAndAttributes of [
            ['a', { paddingRight: '2em' }, 'b', null],
            ['one two three', { textStyleClasses: ['shrink-large-font'] }]
          ]) {
            const text = new Text({ name: 'label', readOnly: true, textAndAttributes, fontSize: 20, fixedHeight: false });
            const container = new Morph({ extent: pt(1000, 400), submorphs: [text], layout: new TilingLayout({
              axis, renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
            }) }).openInWorld();
            try {
              await text.whenFontLoaded();
              container.env.forceUpdate();
              const line = text.renderingState.textLayer.querySelector('.line');
              const range = document.createRange();
              range.selectNodeContents(line);
              expect(text.width).closeTo(range.getBoundingClientRect().width, 2);
              expect(text.height).closeTo(line.getBoundingClientRect().height, 1);
            } finally { container.remove(); }
          }
        } finally { style.remove(); }
      });

      it(`measures spacing and tabs in ${axis} shrink width (CSS: ${renderViaCSS})`, async () => {
        let lineHeight;
        for (const props of [
          {}, { letterSpacing: 6 }, { wordSpacing: 15 },
          { textAndAttributes: ['a\tb', null], tabWidth: 2 },
          { textAndAttributes: ['a\tb', null], tabWidth: 8 },
          { textAndAttributes: ['one two ', { letterSpacing: 6 }, 'three', null] },
          { textAndAttributes: ['a', { fontColor: Color.red }, '\tb', null], tabWidth: 8 },
          { textAndAttributes: ['abcd', { fontColor: Color.red }, '\tb', null], tabWidth: 8 },
          { textAndAttributes: ['a', { fontColor: Color.red }, '\tb', { paddingLeft: '20px' }], tabWidth: 8 },
          ...['constructor', '__proto__', 'toString', 'hasOwnProperty'].map(text => ({ textAndAttributes: [text, null] }))
        ]) {
          const text = new Text({ name: 'label', readOnly: true, textAndAttributes: ['one two three', null], fontSize: 20, fixedHeight: false, ...props });
          const container = new Morph({ extent: pt(1000, 400), submorphs: [text], layout: new TilingLayout({
            axis, renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
          }) }).openInWorld();
          try {
            await text.whenFontLoaded();
            container.env.forceUpdate();
            if (lineHeight === undefined) lineHeight = text.height;
            const range = text.env.domEnv.document.createRange();
            range.selectNodeContents(text.renderingState.textLayer.querySelector('.line'));
            const actualWidth = range.getBoundingClientRect().width;
            // DOM ranges and rounded layout edges can differ by less than a pixel.
            expect(text.intrinsicWidth()).closeTo(actualWidth, 1);
            expect(Number.isFinite(text.fontMetric.sizeFor(text.defaultTextStyle, text.textString, true).width)).equals(true);
            expect(text.width).closeTo(actualWidth, 2);
            expect(text.height).closeTo(lineHeight, 1);
          } finally { container.remove(); }
        }
      });
    }
  }
});
