/* global System, it, xit, describe, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { Text } from '../../text/morph.js';
import { Rectangle, Color, pt } from 'lively.graphics';
import { obj, promise } from 'lively.lang';
import { Range } from '../../text/range.js';

let inBrowser = System.get('@system-env').browser
  ? it
  : (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); };

const defaultStyle = {
  fontFamily: 'IBM Plex Mono',
  fontSize: 10,
  fontWeight: 'normal',
  fontColor: Color.black,
  fontStyle: 'normal',
  textDecoration: 'none solid rgb(0,0,0)'
};

let padding = Rectangle.inset(3);

function text (string, props) {
  return new Text({
    name: 'text',
    readOnly: false,
    textString: string,
    extent: pt(100, 100),
    padding,
    ...defaultStyle,
    ...props
  });
}

function printStyleNormalized (style) { return obj.inspect(style).replace(/ /g, ''); }

function getRenderedTextNodes (morph) {
  let root = morph.env.renderer.getNodeForMorph(morph);
  return Array.from(root.querySelectorAll('.newtext-text-layer .line'));
}

let sut;

describe('text rendering', () => {
  beforeEach(() => {
    sut = text('hello', { position: pt(10.10), fill: Color.gray.lighter(2) }).openInWorld();
    sut.env.forceUpdate();
  });

  afterEach(() => sut && sut.remove());

  it('only renders visible part of scrolled text', async () => {
    let lineHeight = sut.document.lines[0].height;
    let padTop = sut.padding.top();
    let padBot = sut.padding.bottom();
    Object.assign(sut, {
      clipMode: 'auto',
      extent: pt(100, 2 * lineHeight),
      position: pt(0, 0),
      textString: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].join('\n'),
      scroll: pt(0, lineHeight * 10 + (padTop - 1)),
      borderWidth: 0
    });

    sut.env.forceUpdate();

    let node = sut.env.renderer.getNodeForMorph(sut);
    let b = node.querySelector('.newtext-text-layer.actual').getBoundingClientRect();
    let textBounds = new Rectangle(b.left, b.top, b.width, b.height);

    expect(textBounds.top() - sut.top - sut.padding.top()).equals(-sut.scroll.y, 'text layer not scrolled correctly');
    const scrolledLines = 10;
    const visibleLines = 2;
    const paddingLines = 1;
    expect(textBounds.height).closeTo(lineHeight * (scrolledLines + visibleLines + paddingLines) + (padTop + padBot), 30, 'text layer does not have size of all lines');
    expect(node.querySelector('.newtext-text-layer.actual').textContent).lessThan(10111213, 'text  layer renders more than necessary');
  });

  it('can resize on content change', async () => {
    sut.clipMode = 'visible';
    sut.lineWrapping: 'no-wrap';
    sut.fixedWidth = false;
    let padLeft = sut.padding.left();
    let padRight = sut.padding.right();
    let { width: cWidth } = sut.textLayout.defaultCharExtent(sut);
    sut.textString = 'Hello hello';

    sut.env.forceUpdate();
    let expectedWidth = sut.textString.length * cWidth + padLeft + padRight;
    expect(sut.width).within(expectedWidth - 1, expectedWidth + 1);

    sut.textString = 'foo';
    sut.env.forceUpdate();
    expectedWidth = 3 * cWidth + padLeft + padRight;
    expect(sut.width).within(expectedWidth - 1, expectedWidth + 1);
  });

  describe('rich text', () => {
    let style_a = { fontSize: 12, fontStyle: 'italic' };
    let style_b = { fontSize: 14, fontWeight: 'bold' };

    inBrowser('renders styles', async () => {
      sut.addTextAttribute(style_a, Range.create(0, 1, 0, 3));
      sut.addTextAttribute(style_b, Range.create(0, 2, 0, 4));

      await promise.delay(20);

      let lines = getRenderedTextNodes(sut);
      let chunks = lines[0].childNodes;

      expect(chunks).property('length').equals(5);

      let styles = Array.from(chunks).map(ea => {
        let jsStyle = sut.env.domEnv.window.getComputedStyle(
          ea.nodeType === ea.TEXT_NODE ? ea.parentNode : ea);
        let fontFamily = jsStyle.getPropertyValue('font-family');
        let fontSize = parseInt(jsStyle.getPropertyValue('font-size').slice(0, -2));
        let fontWeight = jsStyle.getPropertyValue('font-weight');
        let fontStyle = jsStyle.getPropertyValue('font-style');
        let textDecoration = jsStyle.getPropertyValue('text-decoration');
        // note: when running the tests on Firefox "fontWeight" is differently
        // reported than on Chrome
        if (fontWeight === '400') fontWeight = 'normal';
        if (fontWeight === '700') fontWeight = 'bold';
        if (textDecoration === '') textDecoration = 'none';
        return { fontFamily, fontSize, fontWeight, fontStyle, textDecoration };
      });

      let strings = Array.from(chunks).map(ea => ea.textContent);
      expect(strings).equals(['h', 'e', 'l', 'l', 'o']);

      expect(printStyleNormalized(styles[0])).equals(printStyleNormalized(obj.dissoc(defaultStyle, ['fontColor', 'fixedCharacterSpacing'])));
      expect(printStyleNormalized(styles[1])).equals(printStyleNormalized(obj.dissoc({ ...defaultStyle, ...style_a }, ['fontColor', 'fixedCharacterSpacing'])));
      expect(printStyleNormalized(styles[2])).equals(printStyleNormalized(obj.dissoc({ ...defaultStyle, ...style_a, ...style_b }, ['fontColor', 'fixedCharacterSpacing'])));
      expect(printStyleNormalized(styles[3])).equals(printStyleNormalized(obj.dissoc({ ...defaultStyle, ...style_b }, ['fontColor', 'fixedCharacterSpacing'])));
      expect(printStyleNormalized(styles[4])).equals(printStyleNormalized(obj.dissoc(defaultStyle, ['fontColor', 'fixedCharacterSpacing'])));
    });

    inBrowser('renders css classes', async () => {
      sut.addTextAttribute({ textStyleClasses: ['class1', 'class2'] }, Range.create(0, 1, 0, 2));
      await promise.delay(20);

      let chunks = getRenderedTextNodes(sut)[0].childNodes;
      expect(chunks[1].className).equals('class1 class2');
    });

    inBrowser('links', async () => {
      sut.addTextAttribute({ link: 'http://foo' }, Range.create(0, 0, 0, 5));
      await promise.delay(20);
      let chunks = getRenderedTextNodes(sut)[0].childNodes;
      expect(obj.select(chunks[0], ['tagName', 'href', 'target'])).deep.equals({ tagName: 'A', href: 'http://foo/', target: '_blank' });
    });
  });

  describe('visible line detection', () => {
    inBrowser('determines last and first full visible line based on padding and scroll', () => {
      let { width: w, height: h } = sut.textLayout.defaultCharExtent(sut);
      Object.assign(sut, {
        textString: '111111\n222222\n333333\n444444\n555555',
        padding,
        borderWidth: 0,
        fill: Color.lightGray,
        lineWrapping: 'no-wrap',
        clipMode: 'auto',
        extent: pt(4 * w + padding.left() + padding.right(), 3 * h + padding.top() + padding.bottom())
      });

      let l = sut.textLayout;
      sut.env.forceUpdate();
      expect(l.firstFullVisibleLine(sut)).equals(0);
      expect(l.lastFullVisibleLine(sut)).equals(2);

      sut.scroll = sut.scroll.addXY(0, padding.top() + h);

      sut.env.forceUpdate();

      expect(l.firstFullVisibleLine(sut)).equals(1);
      expect(l.lastFullVisibleLine(sut)).equals(3);
    });
  });
});
