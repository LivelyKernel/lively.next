/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text, HTMLMorph, Path, Polygon } from '../index.js';
import { pt, Color } from 'lively.graphics';
import { promise } from 'lively.lang';
import { addOrChangeCSSDeclaration } from '../rendering/dom-helper.js';

describe('minimal inline morph CSS', () => {
  for (const type of [Path, Polygon]) {
    it(`keeps ${type.name} backgrounds transparent`, async () => {
      const morph = new type({ vertices: [pt(0, 0), pt(30, 0), pt(30, 30)], fill: Color.red }).openInWorld();
      try {
        await morph.whenRendered();
        expect(getComputedStyle(morph.env.renderer.getNodeForMorph(morph)).backgroundColor).equals('rgba(0, 0, 0, 0)');
      } finally { morph.remove(); }
    });
  }

  it('preserves defaults in previews without marking them as live morphs', async () => {
    const morph = new Morph({ extent: pt(200, 200), submorphs: [new Morph({
      position: pt(10, 10), extent: pt(50, 50), borderWidth: 3
    })] }).openInWorld();
    let preview;
    try {
      await morph.whenRendered();
      preview = morph.env.renderer.renderPreview(morph, { asNode: true, width: 200, height: 200, center: false });
      document.body.appendChild(preview);
      const child = preview.querySelector('.morph-preview');
      const style = getComputedStyle(child);
      expect(preview.querySelector('.Morph')).equals(null);
      expect(style.position).equals('absolute');
      expect(style.left).equals('10px');
      expect(style.top).equals('10px');
      expect(style.backgroundColor).equals('rgb(255, 255, 255)');
      expect(style.borderLeftStyle).equals('solid');
      expect(style.borderLeftWidth).equals('3px');
      expect(style.transformOrigin).equals('0px 0px');
    } finally { preview?.remove(); morph.remove(); }
  });

  it('keeps morph positioning when scoped HTML CSS uses relative divs', async () => {
    const child = new Morph({ position: pt(10, 20) });
    const morph = new HTMLMorph({ cssDeclaration: 'div { position: relative; }', submorphs: [child] }).openInWorld();
    try {
      await morph.whenRendered();
      expect(getComputedStyle(morph.env.renderer.getNodeForMorph(child)).position).equals('absolute');
    } finally { morph.remove(); }
  });

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
      expect(getComputedStyle(node).transform).not.equals('none', 'default transform must remain a containing block for fixed HTML');
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
      const restored = getComputedStyle(node);
      expect(restored.borderLeftWidth).equals('0px', 'returning to defaults must remove the visible border');
      expect(restored.opacity).equals('1', 'returning to defaults must restore full opacity');
      expect(restored.transform).equals('matrix(1, 0, 0, 1, 0, 0)', 'returning to defaults must restore the default transform');
      expect(restored.borderTopLeftRadius).equals('0px');
    } finally { parent.remove(); }
  });

  it('animates borders and radius through zero without snapping back', async () => {
    const morph = new Morph({ extent: pt(100, 80), borderWidth: 8, borderRadius: 20, borderColor: Color.red }).openInWorld();
    try {
      await morph.whenRendered();
      const node = morph.env.renderer.getNodeForMorph(morph);
      const animation = morph.animate({ borderWidth: 0, borderRadius: 0, duration: 300 });
      morph.env.forceUpdate();
      const [nativeAnimation] = node.getAnimations();
      expect(nativeAnimation).to.be.ok;
      nativeAnimation.pause();
      await nativeAnimation.ready;
      nativeAnimation.currentTime = 100;
      const width = parseFloat(getComputedStyle(node).borderLeftWidth);
      const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius);
      expect(width).greaterThan(0);
      expect(width).lessThan(8);
      expect(radius).greaterThan(0);
      expect(radius).lessThan(20);
      nativeAnimation.finish();
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
  it('allows project style classes to override default-valued fill and cursor', async () => {
    const style = addOrChangeCSSDeclaration('minimal-default-override', '.minimal-default-override { background:rgb(0,0,255); cursor:wait; }');
    const morph = new Morph({ fill: Color.white, nativeCursor: 'auto', styleClasses: ['minimal-default-override'] }).openInWorld();
    try {
      await morph.whenRendered();
      const computed = getComputedStyle(morph.env.renderer.getNodeForMorph(morph));
      expect(computed.backgroundColor).equals('rgb(0, 0, 255)', 'project classes may override omitted default fill');
      expect(computed.cursor).equals('wait', 'project classes may override omitted default cursor');
    } finally { morph.remove(); style.remove(); }
  });

  it('inlines preview defaults for HTML copied outside Lively', async () => {
    const morph = new Morph({ extent: pt(100, 100), submorphs: [new Morph({ borderWidth: 3, extent: pt(40, 40), position: pt(10, 20) })] }).openInWorld();
    let frame;
    try {
      await morph.whenRendered();
      const preview = morph.renderPreview({ inlineDefaults: true });
      frame = document.createElement('iframe');
      frame.srcdoc = '<!doctype html><html><body>' + preview + '</body></html>';
      const loaded = new Promise(resolve => { frame.onload = resolve; });
      document.body.appendChild(frame);
      await loaded;
      const child = frame.contentDocument.querySelector('.morph-preview .morph-preview');
      const style = frame.contentWindow.getComputedStyle(child);
      expect(style.borderLeftStyle).equals('solid', 'copied borders must survive without the Lively stylesheet');
      expect(style.borderLeftWidth).equals('3px', 'copied border widths must survive without the Lively stylesheet');
      expect(style.backgroundColor).to.be.oneOf(['rgb(255, 255, 255)', 'color(display-p3 1 1 1)'], 'copied default white fill must survive without the Lively stylesheet');
      expect(style.transformOrigin).equals('0px 0px', 'copied transform origin must survive without the Lively stylesheet');
    } finally { frame?.remove(); morph.remove(); }
  });

});
