/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text, HTMLMorph } from '../index.js';
import { pt, Color } from 'lively.graphics';
import { promise } from 'lively.lang';

describe('minimal inline morph CSS', () => {
  it('keeps fixed HTML content relative to its morph at the default transform', async () => {
    const morph = new HTMLMorph({ html: '<div style="position:fixed;left:10px;top:20px;width:30px;height:40px"></div>' }).openInWorld();
    try {
      await morph.whenRendered();
      const node = morph.env.renderer.getNodeForMorph(morph);
      const child = morph.domNode.firstChild;
      const check = () => {
        morph.env.forceUpdate();
        const ownerBounds = node.getBoundingClientRect();
        const bounds = child.getBoundingClientRect();
        expect(bounds.left).closeTo(ownerBounds.left + 10 * morph.scale, 0.2);
        expect(bounds.top).closeTo(ownerBounds.top + 20 * morph.scale, 0.2);
      };
      check();
      morph.moveBy(pt(50, 30));
      check();
      morph.scale = 1.01;
      check();
      morph.scale = 1;
      check();
      expect(node.style.transform).equals('');
    } finally { morph.remove(); }
  });

  it('uses CSS defaults and removes declarations when values return to defaults', async () => {
    const parent = new Morph({ nativeCursor: 'pointer', reactsToPointer: false }).openInWorld();
    const morph = parent.addMorph(new Morph());
    try {
      await morph.whenRendered();
      const node = morph.env.renderer.getNodeForMorph(morph);
      const style = getComputedStyle(node);
      expect(node.style.borderLeftWidth).equals('');
      expect(node.style.borderRadius).equals('');
      expect(node.style.opacity).equals('');
      expect(node.style.transform).equals('');
      expect(style.position).equals('absolute');
      expect(style.borderLeftWidth).equals('0px');
      expect(style.pointerEvents).equals('auto');
      expect(style.cursor).equals('auto');
      morph.borderWidth = 7;
      morph.borderRadius = 12;
      morph.opacity = 0.4;
      morph.scale = 1.2;
      morph.env.forceUpdate();
      expect(node.style.borderLeftWidth).equals('7px');
      morph.borderWidth = 0;
      morph.borderRadius = 0;
      morph.opacity = 1;
      morph.scale = 1;
      morph.env.forceUpdate();
      expect(node.style.borderLeftWidth).equals('');
      expect(node.style.borderRadius).equals('');
      expect(node.style.opacity).equals('');
      expect(node.style.transform).equals('');
      expect(getComputedStyle(node).borderTopLeftRadius).equals('0px');
    } finally { parent.remove(); }
  });

  it('animates borders and radius through zero without snapping back', async () => {
    const morph = new Morph({ extent: pt(100, 80), borderWidth: 8, borderRadius: 20, borderColor: Color.red }).openInWorld();
    try {
      await morph.whenRendered();
      const node = morph.env.renderer.getNodeForMorph(morph);
      const animation = morph.animate({ borderWidth: 0, borderRadius: 0, duration: 300 });
      morph.env.forceUpdate();
      await promise.delay(100);
      const width = parseFloat(getComputedStyle(node).borderLeftWidth);
      const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius);
      expect(width).greaterThan(0);
      expect(width).lessThan(8);
      expect(radius).greaterThan(0);
      expect(radius).lessThan(20);
      await animation;
      morph.env.forceUpdate();
      await promise.delay(40);
      expect(getComputedStyle(node).borderLeftWidth).equals('0px');
      expect(getComputedStyle(node).borderTopLeftRadius).equals('0px');
      expect(node.style.borderLeftWidth).equals('');
      expect(node.style.borderRadius).equals('');
      await morph.animate({ borderWidth: 5, borderRadius: 10, duration: 100 });
      morph.env.forceUpdate();
      expect(getComputedStyle(node).borderLeftWidth).equals('5px');
      expect(getComputedStyle(node).borderTopLeftRadius).equals('10px');
    } finally { morph.remove(); }
  });

  it('preserves text and non-default per-side borders', async () => {
    const text = new Text({ readOnly: true, textString: 'text', fill: Color.transparent, borderWidthLeft: 3, borderColorLeft: Color.blue }).openInWorld();
    try {
      await text.whenRendered();
      const node = text.env.renderer.getNodeForMorph(text);
      expect(getComputedStyle(node).borderLeftWidth).equals('3px');
      expect(getComputedStyle(node).borderRightWidth).equals('0px');
      expect(node.querySelector('.line').textContent).equals('text');
      expect(node.style.background).not.equals('');
    } finally { text.remove(); }
  });
});
