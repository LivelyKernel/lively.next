/* global describe, it */
import { expect } from 'mocha-es6';
import { Text, Morph, HTMLMorph, TilingLayout } from '../../index.js';
import { pt, Color } from 'lively.graphics';
import { promise } from 'lively.lang';

describe('static embedding render regressions', () => {
  it('keeps inline positions while an owner is hidden and aligns again when shown', async () => {
    const embedded = new Morph({ extent: pt(40, 20) });
    const text = new Text({ readOnly: true, textAndAttributes: ['before ', null, embedded, null] });
    const owner = new Morph({ position: pt(100, 100), extent: pt(300, 100), submorphs: [text] }).openInWorld();
    try {
      await text.whenFontLoaded();
      text.env.forceUpdate();
      const before = embedded.position;
      owner.visible = false;
      text.fontSize += 1;
      text.env.forceUpdate();
      text.fontSize -= 1;
      text.env.forceUpdate();
      expect(embedded.position).equals(before, 'hidden DOM boxes must not overwrite inline coordinates');
      owner.visible = true;
      text.env.forceUpdate();
      expect(embedded.position.x).closeTo(before.x, 0.2, 'showing the owner must align the embed again');
      expect(embedded.position.y).closeTo(before.y, 0.2, 'showing the owner must restore the inline baseline');
    } finally { owner.remove(); }
  });

  it('does not measure clean inline boxes during idle or unrelated rendering', async () => {
    const embedded = new Morph({ extent: pt(40, 20) });
    const text = new Text({ readOnly: true, textAndAttributes: ['before ', null, embedded, null] }).openInWorld();
    const unrelated = new Morph({ extent: pt(20, 20) }).openInWorld();
    let node, original;
    try {
      await text.whenFontLoaded();
      text.env.forceUpdate();
      node = text.env.renderer.getNodeForMorph(embedded);
      original = node.getBoundingClientRect;
      let reads = 0;
      node.getBoundingClientRect = function () { reads++; return original.call(this); };
      text.env.renderer.renderStep();
      unrelated.fill = Color.red;
      text.env.renderer.renderStep();
      expect(reads).equals(0, 'clean static text must not force alignment layout reads');
      text.fontSize += 2;
      text.env.forceUpdate();
      expect(reads).above(0, 'dirty text must still measure and align its inline boxes');
    } finally {
      if (node) node.getBoundingClientRect = original;
      unrelated.remove(); text.remove();
    }
  });

  it('measures inert boxes without deep-cloning live inline contents', async () => {
    const embedded = new HTMLMorph({ extent: pt(50, 20), html: '<div><input value="retained"></div>' });
    const text = new Text({ readOnly: true, textAndAttributes: ['before ', { textStyleClasses: ['measurement-probe'] }, embedded, null] }).openInWorld();
    let layer, original;
    try {
      await text.whenFontLoaded();
      text.env.forceUpdate();
      layer = text.renderingState.textLayer;
      original = layer.cloneNode;
      let deepClones = 0;
      layer.cloneNode = function (deep) { if (deep) deepClones++; return original.call(this, deep); };
      text.renderingState.needsRemeasure = true;
      const bounds = text.measureStaticTextBounds();
      expect(bounds.width).above(embedded.width, 'inert measurement must include text and the inline box');
      expect(deepClones).equals(0, 'measurement must not clone the embedded live DOM subtree');
      expect(embedded.domNode.querySelector('input').value).equals('retained', 'measurement must preserve live contents');
    } finally {
      if (layer) layer.cloneNode = original;
      text.remove();
    }
  });

  it('switches to static mode without removing and re-adopting inline morphs', async () => {
    const embedded = new Morph({ extent: pt(40, 20) });
    const text = new Text({ readOnly: false, textAndAttributes: ['before ', null, embedded, null] }).openInWorld();
    const original = embedded.onOwnerChanged;
    const owners = [];
    try {
      await text.whenRendered();
      embedded.onOwnerChanged = function (owner) { owners.push(owner); return original.call(this, owner); };
      text.readOnly = true;
      text.env.forceUpdate();
      expect(owners).deep.equals([], 'a mode switch must not emit removal or adoption notifications');
      expect(embedded.owner).equals(text, 'the inline morph must keep its owner');
      expect(text.embeddedMorphMap.get(embedded).anchor).not.to.be.ok;
      text.readOnly = false;
      text.env.forceUpdate();
      expect(text.embeddedMorphMap.get(embedded).anchor).to.be.ok;
      expect(text.textString).equals('before \ufffd', 'both modes must retain the embedded character');
    } finally { embedded.onOwnerChanged = original; text.remove(); }
  });

  it('keeps a wrapped iframe document and state during static measurements', async () => {
    const embedded = new HTMLMorph({ extent: pt(160, 80), html: '<iframe srcdoc="<input value=initial>"></iframe>' });
    const text = new Text({ readOnly: true, fixedWidth: true, fixedHeight: true, extent: pt(500, 200),
      lineWrapping: 'by-words', textAndAttributes: ['before ', null, embedded, null, ' after', null] }).openInWorld();
    try {
      await text.whenFontLoaded();
      text.env.forceUpdate();
      const iframe = embedded.domNode.querySelector('iframe');
      await promise.waitFor(3000, () => iframe.contentDocument?.querySelector('input'));
      const doc = iframe.contentDocument;
      doc.querySelector('input').value = 'retained';
      iframe.contentWindow.retainedValue = 42;
      let loads = 0;
      iframe.addEventListener('load', () => loads++);
      text.width = 200;
      text.env.forceUpdate();
      text.measureStaticTextBounds();
      await promise.delay(50);
      expect(iframe.contentDocument).equals(doc, 'wrapping and measurement must preserve iframe document identity');
      expect(doc.querySelector('input').value).equals('retained', 'wrapping must preserve input state');
      expect(iframe.contentWindow.retainedValue).equals(42, 'wrapping must preserve iframe script state');
      expect(loads).equals(0, 'wrapping must not reload the iframe');
    } finally { text.remove(); }
  });

  for (const renderViaCSS of [false, true]) {
    it(`lays out a hugging embed before its Text is shrunk (CSS: ${renderViaCSS})`, async () => {
      const embedded = new Morph({
        layout: new TilingLayout({ hugContentsHorizontally: true, hugContentsVertically: true }),
        submorphs: [new Morph({ extent: pt(100, 20) })]
      });
      const text = new Text({ name: 'label', readOnly: true, fontSize: 20, fixedHeight: false,
        textAndAttributes: ['before ', null, embedded, null, ' after', null] });
      const owner = new Morph({ extent: pt(1000, 100), submorphs: [text],
        layout: new TilingLayout({ renderViaCSS, resizePolicies: [['label', { width: 'shrink', height: 'fixed' }]] })
      }).openInWorld();
      try {
        await text.whenFontLoaded();
        owner.env.forceUpdate();
        expect(embedded.width).closeTo(100, 1, 'shrinking Text must not clear the pending inline layout at its default 10px');
        const line = text.renderingState.textLayer.querySelector('.line');
        const range = document.createRange();
        range.selectNodeContents(line);
        expect(text.intrinsicWidth()).closeTo(range.getBoundingClientRect().width, 1, 'Text shrink width must include the laid-out inline box');
        expect(text.height).closeTo(parseFloat(getComputedStyle(line).lineHeight), 1, 'the inline layout must leave one unwrapped line');
      } finally { owner.remove(); }
    });
  }

  for (const variant of ['initial', 'set-then-fit', 'measure-before-render', 'label-like']) {
    it(`applies a hugging inline layout (${variant})`, async () => {
      const embedded = new Morph({
        layout: new TilingLayout({ hugContentsHorizontally: true, hugContentsVertically: true }),
        submorphs: [new Morph({ extent: pt(50, 30) })]
      });
      const text = new Text({ readOnly: true,
        ...(variant === 'label-like' ? { fixedWidth: false, fixedHeight: false } : {}),
        ...(variant === 'initial' || variant === 'label-like' ? { textAndAttributes: ['x ', null, embedded, null] } : {})
      }).openInWorld();
      try {
        if (variant === 'set-then-fit' || variant === 'measure-before-render') {
          await text.whenRendered();
          text.textAndAttributes = ['x ', null, embedded, null];
        }
        if (variant === 'measure-before-render') text.measureStaticTextBounds();
        if (variant !== 'initial') text.fit();
        await text.whenFontLoaded();
        text.env.forceUpdate();
        expect(embedded.extent).equals(pt(50, 30), 'hugging layout must compute the embedded model extent');
        const bounds = text.env.renderer.getNodeForMorph(embedded).getBoundingClientRect();
        expect(bounds.width).closeTo(50, 0.2, 'hugging layout must render its computed width');
        expect(bounds.height).closeTo(30, 0.2, 'hugging layout must render its computed height');
      } finally { text.remove(); }
    });
  }
});
