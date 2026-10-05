/* global describe, it, afterEach, DOMMatrix */
import { expect } from 'mocha-es6';
import { Text, Morph } from '../../index.js';
import { pt, Color } from 'lively.graphics';

describe('embedded morph transforms', () => {
  let text;
  afterEach(() => text && text.remove());

  for (const readOnly of [true, false]) {
    for (const renderOnGPU of [true, false]) {
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
