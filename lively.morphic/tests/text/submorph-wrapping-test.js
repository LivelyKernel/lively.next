/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text } from '../../index.js';
import { pt } from 'lively.graphics';

describe('scrolling ordinary text submorphs', () => {
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
