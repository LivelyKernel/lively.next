/* global describe, it */
import { expect } from 'mocha-es6';
import { Text, Morph, HTMLMorph } from '../../index.js';
import { pt } from 'lively.graphics';
import { promise } from 'lively.lang';

describe('embedded transform regressions', () => {
  for (const readOnly of [true, false]) {
    for (const action of ['rotation', 'extent']) {
      it(`preserves the iframe document after ${action} (readOnly=${readOnly})`, async () => {
        const embedded = new HTMLMorph({
          extent: pt(160, 80), html: '<iframe srcdoc="<input value=initial>"></iframe>'
        });
        const text = new Text({
          readOnly, fixedWidth: true, fixedHeight: true, extent: pt(500, 200), fontSize: 20,
          textAndAttributes: ['before ', null, embedded, null, ' after', null]
        }).openInWorld();
        try {
          await text.whenFontLoaded();
          text.env.forceUpdate();
          const iframe = embedded.domNode.querySelector('iframe');
          await promise.waitFor(3000, () => iframe.contentDocument?.querySelector('input'));
          const originalDocument = iframe.contentDocument;
          originalDocument.querySelector('input').value = 'retained';
          let loads = 0;
          iframe.addEventListener('load', () => loads++);
          if (action === 'rotation') embedded.rotation = 0.3;
          else embedded.resizeBy(pt(20, 10));
          text.env.forceUpdate();
          await promise.delay(50);
          expect(loads).equals(0, 'transform reflow must not reload the embedded iframe');
          expect(iframe.contentDocument).equals(originalDocument, 'the iframe document identity must survive');
          expect(originalDocument.querySelector('input').value).equals('retained', 'input state must survive reflow');
        } finally { text.remove(); }
      });
    }
  }

  it('aligns an outlying subtree by the embedded morph own box after rotate and resize', async () => {
    const embedded = new Morph({
      extent: pt(40, 20), submorphs: [new Morph({ position: pt(-10, -10), extent: pt(15, 15) })]
    });
    const text = new Text({
      readOnly: false, textAndAttributes: ['before ', null, embedded, null, ' after', null]
    }).openInWorld();
    try {
      await text.whenRendered();
      embedded.rotation = 0.2;
      text.env.forceUpdate();
      embedded.extent = pt(50, 25);
      text.env.forceUpdate();
      const world = text.world();
      const actual = text.env.renderer.getNodeForMorph(embedded).getBoundingClientRect();
      const root = text.env.renderer.getNodeForMorph(world).getBoundingClientRect();
      const own = embedded.getGlobalTransform().transformRectToRect(embedded.origin.negated().extent(embedded.extent));
      expect((actual.x - root.x) / world.scale).closeTo(own.x, 0.5, 'outlying children must not offset inline x');
      expect((actual.y - root.y) / world.scale).closeTo(own.y, 0.5, 'outlying children must not offset inline y');
    } finally { text.remove(); }
  });

  it('aligns rotate and resize reflow after the browser window scrolls', async () => {
    const embedded = new Morph({ extent: pt(40, 20) });
    const text = new Text({
      readOnly: false, textAndAttributes: ['before ', null, embedded, null, ' after', null]
    }).openInWorld();
    const world = text.world();
    const scroll = world.scroll;
    const windowScroll = pt(window.scrollX, window.scrollY);
    const overflow = document.documentElement.style.overflow;
    const minHeight = document.body.style.minHeight;
    try {
      await text.whenRendered();
      document.documentElement.style.overflow = 'auto';
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 80);
      await promise.delay(30);
      world.onWindowScroll();
      expect(world.scroll.y).equals(80, 'the regression requires an actual 80px window scroll');
      embedded.rotation = 0.2;
      text.env.forceUpdate();
      embedded.extent = pt(50, 25);
      text.env.forceUpdate();
      const actual = text.env.renderer.getNodeForMorph(embedded).getBoundingClientRect();
      const root = text.env.renderer.getNodeForMorph(world).getBoundingClientRect();
      const own = embedded.getGlobalTransform().transformRectToRect(embedded.origin.negated().extent(embedded.extent));
      expect((actual.y - root.y) / world.scale).closeTo(own.y, 0.5, 'window scroll must not be counted twice in inline y');
      expect((actual.x - root.x) / world.scale).closeTo(own.x, 0.5, 'inline x must remain aligned after scroll');
    } finally {
      text.remove();
      document.documentElement.style.overflow = overflow;
      document.body.style.minHeight = minHeight;
      window.scrollTo(windowScroll.x, windowScroll.y);
      await promise.delay(30);
      world.setProperty('scroll', scroll);
      world.env.forceUpdate();
    }
  });

  it('ignores an inline node missing from the render map during the anchor pass', async () => {
    const embedded = new Morph({ extent: pt(40, 20) });
    const text = new Text({ readOnly: false, textAndAttributes: ['before ', null, embedded, null] }).openInWorld();
    const renderer = text.env.renderer;
    let node;
    try {
      await text.whenRendered();
      text.env.forceUpdate();
      node = renderer.getNodeForMorph(embedded);
      expect(node?.isConnected).equals(true, 'the inline node must first be rendered');
      // Exercise a missing lookup without detaching the live line or rebuilding it.
      renderer.renderMap.delete(embedded);
      let error;
      try { renderer.renderTextAndAttributes(renderer.getNodeForMorph(text), text); } catch (err) { error = err; }
      expect(error).equals(undefined, 'a missing inline render-map entry must not abort the anchor pass');
    } finally {
      if (node) renderer.renderMap.set(embedded, node);
      text.remove();
    }
  });

  it('retains DOM character bounds for dirty lines without embedded morphs', async () => {
    const text = new Text({ readOnly: false, textString: 'ordinary text' }).openInWorld();
    try {
      Object.defineProperty(text, 'canBeMeasuredViaCanvas', { get: () => false });
      await text.whenRendered();
      text.env.forceUpdate();
      const line = text.document.getLine(0);
      const layout = text.textLayout;
      layout.resetLineCharBoundsCacheOfLine(line);
      line.lineNeedsRerender = true;
      const bounds = layout.charBoundsOfRow(text, 0);
      expect(layout.lineCharBoundsCache.get(line)).equals(bounds, 'dirty string-only lines must still retain measured bounds');
      expect(layout.charBoundsOfRow(text, 0)).equals(bounds, 'string-only lines must reuse their measured bounds');
    } finally { text.remove(); }
  });
});
