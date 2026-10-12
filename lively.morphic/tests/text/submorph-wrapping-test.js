/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text } from '../../index.js';
import { pt, Rectangle } from 'lively.graphics';
import { promise } from 'lively.lang';

describe('scrolling ordinary text submorphs', () => {
  it('keeps static text measurements cached while scrolling', async () => {
    const text = new Text({
      readOnly: true, textString: Array(30).fill('scroll line').join('\n'),
      fixedWidth: true, fixedHeight: true, extent: pt(160, 100), clipMode: 'auto'
    }).openInWorld();
    try {
      await text.whenFontLoaded();
      await text.whenRendered();
      text.env.forceUpdate();
      const bounds = text.textBounds();
      for (const y of [20, 40, 60]) {
        text.scroll = pt(0, y);
        text.env.forceUpdate();
        expect(text.textBounds() === bounds).equals(true);
        expect(text.scroll.y).equals(y);
      }
    } finally { text.remove(); }
  });

  for (const clipMode of ['auto', 'scroll']) {
    it(`reaches the last wrapped line with a native scrollbar (${clipMode})`, async () => {
      const text = new Text({
        readOnly: true, fixedWidth: true, fixedHeight: true, extent: pt(160, 100),
        clipMode, hideScrollbars: false, lineWrapping: 'by-words',
        fontFamily: 'IBM Plex Mono', fontSize: 14, padding: Rectangle.inset(3), borderWidth: 0,
        textString: Array(35).fill('alpha beta gamma delta epsilon zeta').join(' ') + ' LAST LINE'
      }).openInWorld();
      const scrollbarStyle = document.createElement('style');
      scrollbarStyle.textContent = `#${text.id}::-webkit-scrollbar { width: 15px; height: 15px; }`;
      document.head.appendChild(scrollbarStyle);
      try {
        await text.whenFontLoaded();
        await document.fonts.ready;
        await text.whenRendered();
        text.env.forceUpdate();
        const node = text.env.renderer.getNodeForMorph(text);
        // Reserve the native scrollbar gutter even when headless Chrome hides its paint.
        node.style.scrollbarGutter = 'stable';
        expect(node.offsetWidth - node.clientWidth - text.borderWidthLeft - text.borderWidthRight).equals(15);
        const bounds = text.textBounds();
        const bottom = node.scrollHeight - node.clientHeight;
        node.scrollTop = bottom;
        await promise.delay(500);
        text.env.forceUpdate();
        expect(text.scroll.y).closeTo(bottom, 1);
        expect(node.scrollTop).equals(bottom);
        expect(text.textBounds() === bounds).equals(true);
        const lastSpan = text.renderingState.textLayer.querySelector('.line:last-child span:last-child');
        const range = document.createRange();
        range.setStart(lastSpan.firstChild, lastSpan.firstChild.length - 1);
        range.setEnd(lastSpan.firstChild, lastSpan.firstChild.length);
        const lastChar = range.getBoundingClientRect();
        const viewport = node.getBoundingClientRect();
        expect(lastChar.bottom).at.most(viewport.top + node.clientTop + node.clientHeight + 1);
        expect(lastChar.top).at.least(viewport.top + node.clientTop - 1);
        text.scroll = pt(0, 0);
        text.env.forceUpdate();
        text.scroll = pt(1e6, 1e6);
        text.env.forceUpdate();
        expect(text.scroll).equals(pt(node.scrollWidth - node.clientWidth, bottom));
        expect(node.scrollTop).equals(bottom);
        expect(node.scrollLeft).equals(text.scroll.x);
      } finally { scrollbarStyle.remove(); text.remove(); }
    });
  }

  it('uses the rendered scroll range on both axes for ordinary children', async () => {
    const text = new Text({
      readOnly: true, fixedWidth: true, fixedHeight: true, extent: pt(160, 100), clipMode: 'auto',
      padding: Rectangle.inset(5), borderWidth: 3,
      textString: 'short', submorphs: [new Morph({ position: pt(220, 160), extent: pt(25, 15) })]
    }).openInWorld();
    try {
      await text.whenRendered();
      const node = text.env.renderer.getNodeForMorph(text);
      const max = pt(node.scrollWidth - node.clientWidth, node.scrollHeight - node.clientHeight);
      expect(max.x).greaterThan(0);
      expect(max.y).greaterThan(0);
      expect(text.scrollExtent.subPt(text.extent)).equals(max);
      text.scroll = pt(1e6, 1e6);
      text.env.forceUpdate();
      expect(text.scroll).equals(max);
      expect(pt(node.scrollLeft, node.scrollTop)).equals(max);
    } finally { text.remove(); }
  });

  it('detects small static overflow from the rendered range', async () => {
    const text = new Text({
      readOnly: true, fixedWidth: true, fixedHeight: true, extent: pt(160, 100), clipMode: 'auto',
      hideScrollbars: false, textString: 'short',
      submorphs: [new Morph({ position: pt(10, 102), extent: pt(20, 2) })]
    }).openInWorld();
    try {
      await text.whenRendered();
      const node = text.env.renderer.getNodeForMorph(text);
      node.style.scrollbarGutter = 'stable';
      expect(node.scrollHeight - node.clientHeight).within(1, 14);
      expect(text.scrollbarVisible).deep.equals({ horizontal: false, vertical: true });
      text.hideScrollbars = true;
      expect(text.scrollbarVisible).deep.equals({ horizontal: false, vertical: false });
    } finally { text.remove(); }
  });

  it('preserves the model scroll extent for unrendered and document-backed text', async () => {
    const text = new Text({ readOnly: true, fixedWidth: true, fixedHeight: true, extent: pt(160, 100), clipMode: 'auto', textString: 'short' });
    try {
      expect(text.scrollExtent).equals(text.extent.addPt(text.scrollbarOffset));
    } finally { text.remove(); }
    const editable = new Text({ readOnly: false, fixedWidth: true, fixedHeight: true,
      extent: pt(160, 100), clipMode: 'auto', hideScrollbars: false, padding: Rectangle.inset(5), borderWidth: 3,
      textString: 'short', submorphs: [new Morph({ position: pt(220, 160), extent: pt(25, 15) })]
    }).openInWorld();
    try {
      await editable.whenRendered();
      expect(editable.document).not.equals(null);
      expect(editable.scrollExtent).equals(editable.textBounds().extent()
        .addPt(editable.padding.topLeft()).addPt(editable.padding.bottomRight())
        .addPt(editable.scrollbarOffset).maxPt(editable.innerBounds()
          .union(editable.submorphBounds()).extent().addPt(editable.scrollbarOffset)));
    } finally { editable.remove(); }
  });

  it('scrolls newly assigned static content before its next render', async () => {
    const text = new Text({ readOnly: true, fixedWidth: true, fixedHeight: true,
      extent: pt(160, 100), clipMode: 'auto', textString: 'a\nb'
    }).openInWorld();
    try {
      await text.whenFontLoaded();
      text.env.forceUpdate();
      text.textString = Array(50).fill('line').join('\n');
      text.scroll = pt(0, 1e6);
      text.env.forceUpdate();
      const node = text.env.renderer.getNodeForMorph(text);
      expect(node.scrollTop).equals(node.scrollHeight - node.clientHeight);
      await promise.delay(500);
      expect(text.scroll.y).equals(node.scrollTop);
    } finally { text.remove(); }
  });

  for (const mode of ['interactive', 'static-to-interactive', 'interactive-to-static', 'rapid-roundtrip']) {
    it(`keeps the child in the scrolling content after ${mode}`, async () => {
      const child = new Morph({ position: pt(5, 70), extent: pt(25, 15) });
      const text = new Text({
        readOnly: mode === 'static-to-interactive',
        textString: Array(30).fill('scroll line').join('\n'),
        fixedWidth: true, fixedHeight: true, extent: pt(160, 100),
        clipMode: 'auto', submorphs: [child]
      }).openInWorld();
      try {
        await text.whenRendered();
        if (mode === 'static-to-interactive') text.readOnly = false;
        if (mode === 'interactive-to-static') text.readOnly = true;
        if (mode === 'rapid-roundtrip') { text.readOnly = true; text.readOnly = false; }
        text.env.forceUpdate();
        const childNode = text.env.renderer.getNodeForMorph(child);
        expect(childNode.isConnected).equals(true);
        const before = childNode.getBoundingClientRect();
        text.scroll = pt(0, 40);
        text.env.forceUpdate();
        const after = childNode.getBoundingClientRect();
        const root = text.env.renderer.getNodeForMorph(text);
        expect(after.y - before.y).closeTo(-40, 0.2, JSON.stringify({
          overflow: getComputedStyle(root).overflowY, scrollTop: root.scrollTop,
          scrollHeight: root.scrollHeight, modelScroll: text.scroll.y,
          clientHeight: root.clientHeight, height: text.height, fixedHeight: text.fixedHeight,
          renderedScroll: text.renderingState.scroll?.y,
          wrapperParent: childNode.parentElement.parentElement.className
        }));
        expect(text.submorphs).includes(child);
        if (text.document) expect(text.renderingState.scrollWrapper.contains(childNode)).equals(true);
        else expect(getComputedStyle(text.env.renderer.getNodeForMorph(text)).overflowY).equals('auto');
      } finally { text.remove(); }
    });
  }
});
