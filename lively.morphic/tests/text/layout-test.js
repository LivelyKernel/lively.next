/* global it, describe, afterEach */
import { expect } from 'mocha-es6';
import { pt, rect, Color, Rectangle } from 'lively.graphics';
import { Text } from '../../text/morph.js';

const padding = Rectangle.inset(5);

let w, h, t, tl, padl, padr, padt, padb; // eslint-disable-line no-unused-vars

async function text (string, props) {
  t = new Text({
    name: 'text',
    readOnly: false,
    textString: string,
    fontSize: 10,
    fontFamily: 'IBM Plex Mono',
    extent: pt(100, 100),
    fixedWidth: true,
    fixedHeight: true,
    padding,
    borderWidth: 0,
    fill: Color.limeGreen,
    lineWrapping: 'no-wrap',
    lineHeight: 1.4,
    ...props
  }).openInWorld();

  await t.allFontsLoaded();

  t.env.forceUpdate();

  // this measures the bounds differently than the text layout, yielding a line height instead
  // of the actual character bounds
  // char height !== line height, since lineHeight is a custom variation

  [{ height: h, width: w }] = t.env.fontMetric.charBoundsFor(t.defaultTextStyle, 'w');

  tl = t.textLayout;

  padl = padding.left();
  padr = padding.right();
  padt = padding.top();
  padb = padding.bottom();

  return t;
}

describe('text layout', function () {
  afterEach(() => t.remove());

  describe('positions', () => {
    it('text pos -> pixel pos', async () => {
      await text('hello\nlively\nworld');
      let pos;

      pos = tl.pixelPositionFor(t, { row: 0, column: 0 });
      expect(pos.x).closeTo(padl + 0, 2);
      expect(pos.y).closeTo(padt + 0, 2);

      pos = tl.pixelPositionFor(t, { row: 0, column: 4 });
      expect(pos.x).closeTo(padl + 4 * w, 2);
      expect(pos.y).closeTo(padt + 0, 2);

      pos = tl.pixelPositionFor(t, { row: 0, column: 5 });
      expect(pos.x).closeTo(padl + 5 * w, 2);
      expect(pos.y).closeTo(padt + 0, 2);

      pos = tl.pixelPositionFor(t, { row: 1, column: 0 });
      expect(pos.x).closeTo(padl + 0, 2);
      expect(pos.y).closeTo(padt + h, 2);

      pos = tl.pixelPositionFor(t, { row: 1, column: 1 });
      expect(pos.x).closeTo(padl + 1 * w, 2);
      expect(pos.y).closeTo(padt + h, 2);

      pos = tl.pixelPositionFor(t, { row: 2, column: 2 });
      expect(pos.x).closeTo(padl + 2 * w, 2);
      expect(pos.y).closeTo(padt + 2 * h, 2);

      pos = tl.pixelPositionFor(t, { row: 1, column: 100 });
      expect(pos.x).closeTo(padl + 6 * w, 2);
      expect(pos.y).closeTo(padt + h, 2);

      pos = tl.pixelPositionFor(t, { row: 100, column: 100 });
      expect(pos.x).closeTo(padl + 5 * w, 2);
      expect(pos.y).closeTo(padt + 2 * h, 2);
    });

    it('pixel pos -> text pos', async () => {
      await text('hello\nlively\nworld');
      t.env.forceUpdate();
      expect(t.textPositionFromPoint(pt(padl + 0, padt + 0))).deep.equals({ row: 0, column: 0 }, '1');
      expect(t.textPositionFromPoint(pt(padl + w - 1, padt + h / 2))).deep.equals({ row: 0, column: 1 }, '2');
      expect(t.textPositionFromPoint(pt(padl + w + 1, padt + h + 1))).deep.equals({ row: 1, column: 1 }, '3');
      expect(t.textPositionFromPoint(pt(padl + w * 2 + 1, padt + h * 2 + 1))).deep.equals({ row: 2, column: 2 }, '4');
      expect(t.textPositionFromPoint(pt(padl + w * 2 + w / 2 + 1, padt + h * 2 + 1))).deep.equals({ row: 2, column: 3 }, 'right side of char -> next pos');
    });
  });

  describe('fit', () => {
    afterEach(() => t.remove());

    it('computes size on construction', async () => {
      const t = await text('hello', { clipMode: 'visible', fixedHeight: false, fixedWidth: false });
      const { width, height } = t;
      expect(height).closeTo(h + padding.top() + padding.bottom(), 2);
      expect(width).closeTo(5 * w + padding.left() + padding.right(), 2);
    });

    it('computes only width', async () => {
      const { extent: { x: width, y: height } } = await text('hello', { clipMode: 'visible', fixedWidth: false, fixedHeight: true });
      expect(height).closeTo(100, 2);
      expect(width).closeTo(5 * w + padding.top() + padding.bottom(), 2);
    });

    it('computes only height', async () => {
      const { extent: { x: width, y: height } } = await text('hello', { clipMode: 'visible', fixedWidth: true, fixedHeight: false });
      expect(height).closeTo(h + padding.top() + padding.bottom(), 2);
      expect(width).closeTo(100, 2);
    });

    it('leaves extent as is with fixed sizing', async () => {
      const { extent } = await text('hello', { clipMode: 'visible', fixedWidth: true, fixedHeight: true });
      expect(extent.x).closeTo(100, 2);
      expect(extent.y).closeTo(100, 2);
    });

    it("when clip it won't shrink", async () => {
      const { extent } = await text('hello', { clipMode: 'hidden' });
      expect(extent).equals(pt(100, 100));
    });

    it('fits bounds synchronously if text is inserted', async () => {
      const t = await text('hello world', {
        clipMode: 'visible',
        fixedWidth: false,
        fixedHeight: true,
        padding: rect(1, 1, 1, 1)
      });
      const widthBefore = t.width;
      t.insertText('h');
      t.env.forceUpdate();
      const widthAfter = t.width;
      expect(widthBefore).lessThan(widthAfter);
      expect(widthAfter).equals(t.width);
      expect(t.env.renderer.getNodeForMorph(t).offsetWidth).equals(t.width);
    });

    it('fits bounds synchronously if font size changed', async () => {
      const t = await text('hello world', {
        clipMode: 'visible',
        fixedWidth: false,
        fixedHeight: false
      });
      const rightBefore = t.right;
      t.fontSize = 50;
      t.env.forceUpdate();
      const rightAfter = t.right;
      expect(rightBefore).lessThan(rightAfter);
      expect(rightAfter).equals(t.right);
    });

    it('fits bounds synchronously if padding changed', async () => {
      const t = await text('hello world', { name: 'trollo', clipMode: 'visible', fixedWidth: false, fixedHeight: false });
      const rightBefore = t.right;
      t.padding = Rectangle.inset(50, 50, 0, 0);
      const rightAfter = t.right;
      expect(rightBefore).lessThan(rightAfter);
      expect(rightAfter).equals(t.right);
    });

    it('fits bounds synchronously if border width changed', async () => {
      const t = await text('hello world', { clipMode: 'visible', fixedWidth: false, fixedHeight: false });
      const rightBefore = t.right;
      t.borderWidth = 5;
      const rightAfter = t.right;
      expect(rightBefore).lessThan(rightAfter);
      expect(rightAfter).equals(t.right);
    });
  });

  describe('line wrapping', () => {
    it('wraps single line and computes positions back and forth', async () => {
      await text('abcdef\n1234567\n');
      t.extent = pt(4 * w, 100);
      expect(t.lineCount()).equals(3);
      expect(t.charBoundsFromTextPosition({ row: 0, column: 5 })).equals(rect(padl + w * 5, padt - .5, w, h), 'not wrapped: text pos => pixel pos');
      expect(t.textPositionFromPoint(pt(padl + 2 * w + 1, padt + h))).deep.equals({ column: 2, row: 1 }, 'not wrapped: pixel pos => text pos');

      t.lineWrapping = 'by-chars';
      t.env.forceUpdate();

      let height, width, x, y;

      ({ height, width, x, y } = tl.boundsFor(t, { row: 0, column: 3 }));
      expect(x).closeTo(padl + w, 2);
      expect(y).closeTo(padt + h * 1, 2); // wrapped once
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h, 2);

      ({ height, width, x, y } = tl.boundsFor(t, { row: 0, column: 4 }));
      expect(x).closeTo(padl + w * 0, 2);
      expect(y).closeTo(padt + h * 2, 2); // wrapped twice
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h, 2);

      ({ height, width, x, y } = tl.boundsFor(t, { row: 0, column: 5 }));
      expect(x).closeTo(padl + w * 1, 2);
      expect(y).closeTo(padt + h * 2, 2); // wrapped twice
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h, 2);

      ({ height, width, x, y } = tl.boundsFor(t, { row: 0, column: 6 }));
      expect(x).closeTo(padl + w * 2, 2);
      expect(y).closeTo(padt + h * 2, 2); // wrapped twice
      expect(width).closeTo(0, 2);
      expect(height).closeTo(h, 2);

      // now we change the width to fit more chars in one row:
      t.width += w;
      t.env.forceUpdate();

      // and the text layout should take note:
      ({ height, width, x, y } = tl.boundsFor(t, { row: 0, column: 3 }));
      expect(x).closeTo(padl + w * 0, 2);
      expect(y).closeTo(padt + h * 1, 2); // wrapped once
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h, 2);

      ({ height, width, x, y } = tl.boundsFor(t, { row: 0, column: 4 }));
      expect(x).closeTo(padl + w * 1, 2);
      expect(y).closeTo(padt + h * 1, 2); // wrapped once
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h, 2);

      ({ height, width, x, y } = tl.boundsFor(t, { row: 0, column: 5 }));
      expect(x).closeTo(padl + w * 2, 2);
      expect(y).closeTo(padt + h * 1, 2); // wrapped once
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h, 2);

      ({ height, width, x, y } = tl.boundsFor(t, { row: 0, column: 6 }));
      expect(x).closeTo(padl + w * 3, 2);
      expect(y).closeTo(padt + h * 1, 2); // wrapped twice
      expect(width).closeTo(0, 2);
      expect(height).closeTo(h, 2);
    });

    it('screenLineRange', () => {
      text('abcdef\n1234567', { width: 4 * w + padl + padr });
      // t.fit()
      t.lineWrapping = 'by-chars';
      const range = t.screenLineRange({ row: 0, column: 5 });
      expect(range).deep.equals({ start: { row: 0, column: 4 }, end: { row: 0, column: 6 } });
    });
  });
});
