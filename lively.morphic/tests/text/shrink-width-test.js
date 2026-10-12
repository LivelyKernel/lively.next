/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text, HTMLMorph, TilingLayout } from '../../index.js';
import { pt, Color } from 'lively.graphics';
import { promise } from 'lively.lang';

describe('text shrink width', () => {
  for (const renderViaCSS of [false, true]) {
    it(`measures horizontally hugging inline containers at their rendered extent (CSS: ${renderViaCSS})`, async () => {
      const embedded = new Morph({ layout: new TilingLayout({ hugContentsHorizontally: true, hugContentsVertically: true }),
        submorphs: [new Morph({ extent: pt(100, 20) })] });
      const text = new Text({ name: 'label', readOnly: true, textAndAttributes: ['before ', null, embedded, null, ' after', null], fontSize: 20, fixedHeight: false });
      const container = new Morph({ extent: pt(1000, 100), submorphs: [text], layout: new TilingLayout({
        renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) }).openInWorld();
      try {
        await text.whenFontLoaded();
        container.env.forceUpdate();
        const line = text.renderingState.textLayer.querySelector('.line');
        const range = document.createRange();
        range.selectNodeContents(line);
        expect(embedded.width).closeTo(100, 1);
        expect(text.intrinsicWidth()).closeTo(range.getBoundingClientRect().width, 1);
        expect(text.height).closeTo(parseFloat(getComputedStyle(line).lineHeight), 1, 'one unwrapped line');
      } finally { container.remove(); }
    });

    it(`remeasures inline box size and visibility changes within a render pass (CSS: ${renderViaCSS})`, async () => {
      const embedded = new Morph({ extent: pt(100, 20) });
      const text = new Text({ name: 'label', readOnly: true, textAndAttributes: ['before ', null, embedded, null, ' after', null], fontSize: 20, fixedHeight: true });
      const container = new Morph({ extent: pt(1000, 100), submorphs: [text], layout: new TilingLayout({
        renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) }).openInWorld();
      let checked = false;
      try {
        await text.whenFontLoaded();
        container.env.forceUpdate();
        text.renderStyles = style => {
          if (checked) return style;
          checked = true;
          const initialWidth = text.intrinsicWidth();
          embedded.width = 160;
          const resizedWidth = text.intrinsicWidth();
          expect(resizedWidth).closeTo(initialWidth + 60, 1, 'embedded extent invalidates the measurement');
          embedded.visible = false;
          text.env.renderer.renderStylingChanges(embedded);
          expect(getComputedStyle(text.env.renderer.getNodeForMorph(embedded)).display).equals('inline-block');
          expect(text.intrinsicWidth()).closeTo(resizedWidth, 1, 'hidden inline boxes retain their canvas layout width');
          embedded.visible = true;
          text.env.renderer.renderStylingChanges(embedded);
          expect(text.intrinsicWidth()).closeTo(resizedWidth, 1, 'shown inline boxes retain their width');
          return style;
        };
        text.makeDirty();
        container.env.forceUpdate();
        expect(checked).equals(true);
      } finally {
        delete text.renderStyles;
        container.remove();
      }
    });

    it(`measures visible labels without a preflight geometry read (CSS: ${renderViaCSS})`, async () => {
      const text = new Text({ name: 'label', readOnly: true, textString: 'visible label', fontSize: 20, fixedHeight: true });
      const container = new Morph({ extent: pt(500, 100), submorphs: [text], layout: new TilingLayout({
        renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) }).openInWorld();
      let node, getClientRects;
      try {
        await text.whenFontLoaded();
        container.env.forceUpdate();
        node = container.env.renderer.getNodeForMorph(text);
        getClientRects = node.getClientRects;
        let reads = 0;
        node.getClientRects = function () { reads++; return getClientRects.call(this); };
        expect(text.intrinsicWidth()).closeTo(text.width, 2);
        expect(reads).equals(0, 'the intrinsic measurement only reads geometry after appending');
      } finally {
        if (node) node.getClientRects = getClientRects;
        container.remove();
      }
    });

    it(`restores shrink width when a hidden ancestor becomes visible (CSS: ${renderViaCSS})`, async () => {
      const text = new Text({ name: 'label', readOnly: true, textString: 'short label', fontSize: 20 });
      const container = new Morph({ extent: pt(500, 100), submorphs: [text], layout: new TilingLayout({
        renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) });
      const ancestor = new Morph({ submorphs: [container] }).openInWorld();
      try {
        await text.whenFontLoaded();
        ancestor.env.forceUpdate();
        ancestor.visible = false;
        ancestor.env.forceUpdate();
        expect(Number.isFinite(text.intrinsicWidth())).equals(true);
        ancestor.visible = true;
        ancestor.env.forceUpdate();
        expect(text.width).closeTo(text.intrinsicWidth(), 2);
        expect(text.width).below(200);
      } finally { ancestor.remove(); }
    });

    it(`shares an intrinsic measurement between Yoga and CSS within a render pass (CSS: ${renderViaCSS})`, async () => {
      const text = new Text({ name: 'label', readOnly: true, textString: 'measure once', fontSize: 20, fixedHeight: true });
      const container = new Morph({ extent: pt(500, 100), submorphs: [text], layout: new TilingLayout({
        renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) }).openInWorld();
      const renderer = container.env.renderer;
      const nodeForLine = renderer.nodeForLine;
      let measurements = 0;
      let checked = 0;
      try {
        await text.whenFontLoaded();
        container.env.forceUpdate();
        renderer.nodeForLine = function (line, morph, real, inert) {
          if (morph === text && inert) measurements++;
          return nodeForLine.call(this, line, morph, real, inert);
        };
        text.renderStyles = style => {
          container.layout.updateSubmorphNode(text);
          const afterYoga = measurements;
          const css = {};
          container.layout.addSubmorphCSS(text, css);
          expect(measurements).equals(afterYoga, 'CSS reuses the Yoga measurement');
          expect(css.width).equals(`${text.intrinsicWidth()}px`);
          expect(measurements).equals(afterYoga, 'further reads reuse the measurement');
          checked++;
          return style;
        };
        text.makeDirty();
        container.env.forceUpdate();
        expect(checked).greaterThan(0);
        const afterRender = measurements;
        text.intrinsicWidth();
        expect(measurements).equals(afterRender + 1, 'measurements expire after rendering');
      } finally {
        delete text.renderStyles;
        renderer.nodeForLine = nodeForLine;
        container.remove();
      }
    });

    it(`remeasures content and font changes within a render pass (CSS: ${renderViaCSS})`, async () => {
      const text = new Text({ name: 'label', readOnly: true, textString: 'W', fontSize: 20, fixedHeight: true });
      const container = new Morph({ extent: pt(500, 100), submorphs: [text], layout: new TilingLayout({
        renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) }).openInWorld();
      let checked = false;
      try {
        await text.whenFontLoaded();
        container.env.forceUpdate();
        text.renderStyles = style => {
          if (checked) return style;
          checked = true;
          const initialWidth = text.intrinsicWidth();
          text.textString = 'WWWW';
          const contentWidth = text.intrinsicWidth();
          expect(contentWidth).greaterThan(initialWidth * 3);
          text.fontSize = 40;
          expect(text.intrinsicWidth()).greaterThan(contentWidth * 1.8);
          return style;
        };
        text.makeDirty();
        container.env.forceUpdate();
        expect(checked).equals(true);
        delete text.renderStyles;
        text.makeDirty();
        container.layout.scheduleApply();
        container.env.forceUpdate();
        expect(text.width).closeTo(text.intrinsicWidth(), 2);
      } finally {
        delete text.renderStyles;
        container.remove();
      }
    });

    it(`remeasures changed external CSS between render passes (CSS: ${renderViaCSS})`, async () => {
      const style = document.createElement('style');
      style.textContent = '.newtext-text-layer .shrink-changing-font { font-size: 20px; }';
      document.head.appendChild(style);
      const text = new Text({ name: 'label', readOnly: true, textAndAttributes: ['WWW', { textStyleClasses: ['shrink-changing-font'] }], fixedHeight: true });
      const container = new Morph({ extent: pt(500, 100), submorphs: [text], layout: new TilingLayout({
        renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) }).openInWorld();
      try {
        await text.whenFontLoaded();
        container.env.forceUpdate();
        const initialWidth = text.intrinsicWidth();
        style.textContent = '.newtext-text-layer .shrink-changing-font { font-size: 40px; }';
        text.makeDirty();
        container.layout.scheduleApply();
        container.env.forceUpdate();
        expect(text.intrinsicWidth()).greaterThan(initialWidth * 1.8);
        expect(text.width).closeTo(text.intrinsicWidth(), 2);
      } finally {
        style.remove();
        container.remove();
      }
    });

    it(`keeps fixed child heights in an overflowing column (CSS: ${renderViaCSS})`, async () => {
      const text = new Text({ name: 'label', readOnly: true, textString: 'short', extent: pt(80, 40), fixedHeight: true });
      const sibling = new Morph({ extent: pt(80, 80) });
      const container = new Morph({ extent: pt(100, 100), clipMode: 'auto', submorphs: [text, sibling], layout: new TilingLayout({
        axis: 'column', renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) }).openInWorld();
      try {
        await text.whenFontLoaded();
        container.env.forceUpdate();
        const textNode = container.env.renderer.getNodeForMorph(text);
        const siblingNode = container.env.renderer.getNodeForMorph(sibling);
        expect(text.height).equals(40);
        expect(textNode.getBoundingClientRect().height).closeTo(text.height, 0.1);
        expect(siblingNode.offsetTop).closeTo(sibling.top, 0.1);
      } finally { container.remove(); }
    });

    it(`restores the intrinsic width when a hidden label becomes visible (CSS: ${renderViaCSS})`, async () => {
      const text = new Text({ name: 'label', readOnly: true, visible: false, textString: 'short', fontSize: 20 });
      const container = new Morph({ extent: pt(500, 100), submorphs: [text], layout: new TilingLayout({
        renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]]
      }) }).openInWorld();
      try {
        await text.whenFontLoaded();
        container.env.forceUpdate();
        expect(Number.isFinite(text.intrinsicWidth())).equals(true);
        text.visible = true;
        container.env.forceUpdate();
        expect(text.width).closeTo(text.intrinsicWidth(), 2);
        expect(text.width).below(200);
      } finally { container.remove(); }
    });
  }

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
