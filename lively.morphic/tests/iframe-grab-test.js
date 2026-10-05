/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, HTMLMorph, IFrameMorph, TilingLayout } from '../index.js';
import { insertNodeBefore } from '../rendering/keyed.js';
import { pt } from 'lively.graphics';
import { promise } from 'lively.lang';

describe('iframe state during morph moves', () => {
  for (const html of [false, true]) {
    it(`preserves iframe state through real hand grab and drop (HTMLMorph: ${html})`, async function () {
      if (!document.body.moveBefore) this.skip();
      const holder = html ? new HTMLMorph({ html: '<iframe srcdoc="<input value=initial>"></iframe>' }) : new IFrameMorph({ srcDoc: '<input value=initial>' });
      const container = new Morph({ extent: pt(600, 400), submorphs: [holder] }).openInWorld();
      const destination = new Morph({ extent: pt(600, 400), position: pt(650, 0), layout: new TilingLayout() }).openInWorld();
      try {
        await holder.whenRendered();
        const iframe = holder.domNode.querySelector('iframe');
        await promise.waitFor(3000, () => iframe.contentDocument?.querySelector('input'));
        let loads = 0;
        iframe.addEventListener('load', () => loads++);
        const originalDocument = iframe.contentDocument;
        originalDocument.querySelector('input').value = 'retained';
        iframe.contentWindow.retainedValue = 42;
        const hand = holder.world().firstHand;
        for (const target of [destination, container]) {
          hand.grab(holder);
          holder.env.forceUpdate();
          await promise.delay(50);
          expect(holder.owner).equals(hand);
          expect(iframe.contentDocument === originalDocument).equals(true, 'iframe document replaced during grab');
          hand.moveBy(pt(40, 30));
          holder.env.forceUpdate();
          hand.dropMorphsOn(target);
          holder.env.forceUpdate();
          await promise.delay(50);
          expect(holder.owner).equals(target);
          expect(iframe.contentDocument === originalDocument).equals(true, 'iframe document replaced during drop');
          expect(iframe.contentWindow.retainedValue).equals(42);
          expect(originalDocument.querySelector('input').value).equals('retained');
          expect(loads).equals(0);
        }
      } finally { holder.remove(); container.remove(); destination.remove(); }
    });
  }

  it('preserves iframe state when siblings are reordered', async function () {
    if (!document.body.moveBefore) this.skip();
    const holder = new HTMLMorph({ html: '<iframe srcdoc="<input>"></iframe>' });
    const container = new Morph({ submorphs: [holder, new Morph(), new Morph()] }).openInWorld();
    try {
      await holder.whenRendered();
      const iframe = holder.domNode.querySelector('iframe');
      await promise.waitFor(3000, () => iframe.contentDocument?.querySelector('input'));
      const originalDocument = iframe.contentDocument;
      originalDocument.querySelector('input').value = 'retained';
      holder.bringToFront();
      holder.env.forceUpdate();
      await promise.delay(50);
      expect(iframe.contentDocument === originalDocument).equals(true);
      container.addMorphBack(holder);
      holder.env.forceUpdate();
      await promise.delay(50);
      expect(iframe.contentDocument === originalDocument).equals(true);
      expect(originalDocument.querySelector('input').value).equals('retained');
    } finally { container.remove(); }
  });

  it('can insert new nodes and falls back when native connected moves are unavailable', () => {
    const parent = document.createElement('div');
    const first = document.createElement('div');
    const second = document.createElement('div');
    parent.moveBefore = undefined;
    insertNodeBefore(parent, first);
    insertNodeBefore(parent, second, first);
    expect(parent.firstChild).equals(second);
    insertNodeBefore(parent, first, second);
    expect(parent.firstChild).equals(first);
  });
});
