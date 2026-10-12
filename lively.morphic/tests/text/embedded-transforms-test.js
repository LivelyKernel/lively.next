/* global describe, it, afterEach, DOMMatrix */
import { expect } from 'mocha-es6';
import { Text, Morph } from '../../index.js';
import { pt, rect, Color } from 'lively.graphics';

describe('embedded morph transforms', () => {
  let text;
  afterEach(() => text && text.remove());

  for (const readOnly of [true, false]) {
    for (const renderOnGPU of [true, false]) {
      for (const canvas of [true, false]) {
        it(`lays out text around transformed inline bounds (readOnly=${readOnly}, GPU=${renderOnGPU}, canvas=${canvas})`, async () => {
          const embedded = new Morph({ extent: pt(120, 30), fill: Color.red, renderOnGPU });
          text = new Text({
            readOnly, fixedWidth: true, fixedHeight: true, fontSize: 20,
            extent: pt(400, 350), position: pt(20, 30), lineWrapping: 'by-words',
            textAndAttributes: ['before ', null, embedded, null, 'after\nnext line', null]
          }).openInWorld();
          if (!canvas) Object.defineProperty(text, 'canBeMeasuredViaCanvas', { get: () => false });
          await text.whenFontLoaded();
          const check = async () => {
            text.env.forceUpdate();
            await text.whenRendered();
            const node = text.env.renderer.getNodeForMorph(embedded);
            const bounds = node.getBoundingClientRect();
            const line = node.closest('.line');
            const following = node.nextSibling.getBoundingClientRect();
            expect(following.left).closeTo(bounds.right, 0.2, 'following text reserves transformed width');
            expect(line.getBoundingClientRect().height).at.least(bounds.height - 0.2);
            expect(line.nextSibling.getBoundingClientRect().top).at.least(bounds.bottom - 0.2);
            const model = embedded.globalBounds();
            for (const key of ['x', 'y', 'width', 'height']) expect(bounds[key]).closeTo(model[key], 0.2, key);
            text.document?.consistencyCheck();
            return following.left;
          };
          const originalFollowing = await check();
          embedded.rotation = Math.PI / 2;
          const rotatedFollowing = await check();
          expect(originalFollowing - rotatedFollowing).closeTo(90, 0.2, 'following text moves with the new width');
          embedded.scale = 2;
          await check();
          embedded.origin = pt(7, 11);
          await check();
          embedded.rotation = -Math.PI / 4;
          await check();
          embedded.rotation = 0;
          embedded.scale = 1;
          embedded.origin = pt(0, 0);
          expect(await check()).closeTo(originalFollowing, 0.2, 'default layout is restored');

          embedded.rotation = 0.1234567;
          embedded.scale = 1.23456789;
          await check();
          const matrix = new DOMMatrix(getComputedStyle(text.env.renderer.getNodeForMorph(embedded)).transform);
          expect(matrix.a).closeTo(Math.cos(embedded.rotation) * embedded.scale, 0.000005);
          expect(matrix.b).closeTo(Math.sin(embedded.rotation) * embedded.scale, 0.000005);

          text.textAndAttributes = [embedded, null, 'after\nnext line', null];
          text.width = 170;
          embedded.rotation = 0;
          embedded.scale = 1.3;
          text.env.forceUpdate();
          await text.whenRendered();
          let node = text.env.renderer.getNodeForMorph(embedded);
          expect(node.nextSibling.getBoundingClientRect().top).at.least(node.getBoundingClientRect().bottom - 0.2, 'following word wraps');
          embedded.rotation = Math.PI / 2;
          text.env.forceUpdate();
          await text.whenRendered();
          node = text.env.renderer.getNodeForMorph(embedded);
          const bounds = node.getBoundingClientRect();
          const following = node.nextSibling.getBoundingClientRect();
          expect(following.left).closeTo(bounds.right, 0.2, 'narrower rotated bounds leave room for the word');
          expect(following.top).lessThan(bounds.bottom);
          expect(node.closest('.line').nextSibling.getBoundingClientRect().top).at.least(bounds.bottom - 0.2);

          // A transformed embed can exceed the viewport; the following word
          // must still wrap and both measurement paths must agree on its row.
          embedded.rotation = 0;
          embedded.scale = 2;
          text.env.forceUpdate();
          await text.whenRendered();
          node = text.env.renderer.getNodeForMorph(embedded);
          expect(node.nextSibling.getBoundingClientRect().top).at.least(node.getBoundingClientRect().bottom - 0.2);
          if (text.document) {
            const followingBounds = text.charBoundsFromTextPosition({ row: 0, column: 1 });
            expect(followingBounds.y).at.least(60);
          }

          text.width = 400;
          embedded.rotation = Math.PI / 2;
          embedded.scale = 1;
          text.textAndAttributes = ['before ', null, embedded, {
            paddingLeft: '9px', paddingRight: '11px', paddingTop: '7px', paddingBottom: '5px'
          }, 'after\nnext line', null];
          text.env.forceUpdate();
          await text.whenRendered();
          node = text.env.renderer.getNodeForMorph(embedded);
          const padded = node.getBoundingClientRect(), model = embedded.globalBounds();
          for (const key of ['x', 'y', 'width', 'height']) expect(padded[key]).closeTo(model[key], 0.2, key);
          expect(node.nextSibling.getBoundingClientRect().left - padded.right).closeTo(11, 0.2, 'run padding is retained');
        });
      }

      it(`preserves inline transforms and bounds (readOnly=${readOnly}, GPU=${renderOnGPU})`, async () => {
        const embedded = new Morph({ extent: pt(40, 20), fill: Color.red, rotation: Math.PI / 4, scale: 1.5, renderOnGPU });
        text = new Text({
          readOnly, fixedWidth: true, fixedHeight: true,
          extent: pt(300, 150), position: pt(20, 30),
          textAndAttributes: ['before ', null, embedded, null, ' after', null]
        }).openInWorld();
        await text.whenRendered();
        const node = () => text.env.renderer.getNodeForMorph(embedded);
        const matrix = () => new DOMMatrix(getComputedStyle(node()).transform);
        const assertBounds = () => {
          expect(node().closest('.newtext-text-layer.actual')).not.to.equal(null);
          const actual = node().getBoundingClientRect(), expected = embedded.globalBounds();
          for (const key of ['x', 'y', 'width', 'height']) expect(actual[key]).closeTo(expected[key], 0.2, key);
        };
        expect(matrix().a).closeTo(Math.SQRT1_2 * 1.5, 0.002);
        expect(matrix().b).closeTo(Math.SQRT1_2 * 1.5, 0.002);
        expect(matrix().e).equals(0);
        expect(matrix().f).equals(0);
        assertBounds();

        text.borderWidth = 2;
        text.padding = rect(10, 8, 10, 8);
        text.scale = 1.25;
        text.rotation = 0.1;
        await text.whenRendered();
        assertBounds();

        embedded.rotation = Math.PI / 2;
        embedded.scale = 2;
        embedded.origin = pt(5, 7);
        await embedded.whenRendered();
        await text.whenRendered();
        expect(matrix().b).closeTo(2, 0.002);
        expect(matrix().c).closeTo(-2, 0.002);
        assertBounds();

        const before = node().getBoundingClientRect();
        text.moveBy(pt(80, 50));
        await text.whenRendered();
        const after = node().getBoundingClientRect();
        expect(after.x - before.x).closeTo(80, 0.2);
        expect(after.y - before.y).closeTo(50, 0.2);
        assertBounds();
      });
    }
  }
});
