/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { Text } from '../../text/morph.js';
import { Color, pt, Rectangle } from 'lively.graphics';

describe('text line numbers', () => {
  let text, copy;
  const node = () => text.env.renderer.getNodeForMorph(text);
  const numbers = () => Array.from(node().querySelectorAll('.line-number'));
  const update = () => text.env.forceUpdate();

  beforeEach(async () => {
    text = new Text({
      textString: 'first\nsecond\nthird',
      fontFamily: 'IBM Plex Mono',
      fontSize: 12,
      fill: Color.white,
      readOnly: false,
      fixedWidth: true,
      fixedHeight: true,
      extent: pt(220, 100),
      clipMode: 'auto',
      lineWrapping: 'by-chars',
      padding: Rectangle.inset(4),
      showLineNumbers: true
    }).openInWorld();
    await text.whenFontLoaded();
    update();
  });

  afterEach(() => {
    text.remove();
    copy?.remove();
    copy = null;
  });

  it('numbers logical lines from one without changing text or selection content', () => {
    expect(numbers().map(n => n.textContent)).deep.equals(['1', '2', '3']);
    for (const number of numbers()) {
      const line = node().querySelector('.newtext-text-layer.actual .line[data-row="' + number.dataset.row + '"]');
      expect(number.getBoundingClientRect().top).closeTo(line.getBoundingClientRect().top, 0.5);
    }
    text.selectAll();
    expect(text.selection.text).equals('first\nsecond\nthird');
    expect(node().querySelector('.newtext-line-number-layer').getAttribute('aria-hidden')).equals('true');
    expect(text.padding).equals(Rectangle.inset(4));
  });

  it('keeps wrapped rows aligned with one number per document line', () => {
    text.width = 140;
    text.textString = 'a long line that wraps across several screen lines\nnext line';
    update();
    expect(text.document.getLine(0).height).greaterThan(text.document.getLine(1).height);
    expect(numbers().map(n => n.textContent)).deep.equals(['1', '2']);
    for (const number of numbers()) {
      const line = node().querySelector('.newtext-text-layer.actual .line[data-row="' + number.dataset.row + '"]');
      expect(number.getBoundingClientRect().top).closeTo(line.getBoundingClientRect().top, 0.5);
    }
  });

  it('renders only visible numbers and follows partial vertical scrolling', () => {
    text.textString = Array.from({ length: 1000 }, (_, row) => 'row ' + row).join('\n');
    update();
    text.scroll = pt(0, 237.5);
    update();
    expect(numbers().length).lessThan(100);
    expect(Number(numbers()[0].textContent)).equals(text.renderingState.firstVisibleRow + 1);
    for (const number of numbers()) {
      const line = node().querySelector('.newtext-text-layer.actual .line[data-row="' + number.dataset.row + '"]');
      expect(number.getBoundingClientRect().top).closeTo(line.getBoundingClientRect().top, 0.5);
    }
  });

  it('keeps the gutter fixed while the source scrolls horizontally', () => {
    text.fill = Color.transparent;
    text.lineWrapping = 'no-wrap';
    update();
    text.textString = 'a very long line '.repeat(30);
    update();
    const numberLeft = numbers()[0].getBoundingClientRect().left;
    const line = node().querySelector('.newtext-text-layer.actual .line');
    const sourceLeft = line.getBoundingClientRect().left;
    text.scroll = pt(70, 0);
    update();
    expect(numbers()[0].getBoundingClientRect().left).equals(numberLeft);
    const scrolledLine = node().querySelector('.newtext-text-layer.actual .line');
    expect(scrolledLine.getBoundingClientRect().left).closeTo(sourceLeft - 70, 0.5);
  });

  it('updates numbering after newline insertion, deletion and undo', () => {
    text.insertText('\ninserted', { row: 0, column: 5 });
    update();
    expect(numbers().map(n => n.textContent)).deep.equals(['1', '2', '3', '4']);
    text.undoManager.undo();
    update();
    expect(numbers().map(n => n.textContent)).deep.equals(['1', '2', '3']);
    text.deleteText({ start: { row: 0, column: 5 }, end: { row: 1, column: 0 } });
    update();
    expect(numbers().map(n => n.textContent)).deep.equals(['1', '2']);
  });

  it('adapts to digit count and font size without changing the requested padding', () => {
    text.padding = Rectangle.inset(0);
    text.textString = Array(99).fill('line').join('\n');
    update();
    const initial = text.lineNumberGutterWidth;
    text.insertText('\nline', text.document.endPosition);
    update();
    expect(text.lineNumberGutterWidth).greaterThan(initial);
    const threeDigits = text.lineNumberGutterWidth;
    text.fontSize = 20;
    update();
    expect(text.lineNumberGutterWidth).greaterThan(threeDigits);
    expect(text.padding).equals(Rectangle.inset(0));
    text.execCommand('toggle line numbers');
    update();
    expect(numbers()).to.have.length(0);
    const layer = node().querySelector('.newtext-text-layer.actual');
    expect(text.env.domEnv.window.getComputedStyle(layer).paddingLeft).equals('0px');
  });

  it('uses the reserved gutter in cursor geometry and hit testing', () => {
    const bounds = text.charBoundsFromTextPosition({ row: 1, column: 2 });
    expect(bounds.left()).greaterThan(text.lineNumberGutterWidth);
    expect(text.textPositionFromPoint(bounds.leftCenter())).deep.equals({ row: 1, column: 2 });
    text.cursorPosition = { row: 0, column: 2 };
    text.execCommand('go down');
    expect(text.cursorPosition).deep.equals({ row: 1, column: 2 });
    text.addMarker({ id: 'line-number-test-marker', range: {
      start: { row: 1, column: 0 }, end: { row: 1, column: 2 }
    }, style: { backgroundColor: 'red' } });
    update();
    const marker = node().querySelector('.newtext-marker-layer');
    expect(parseFloat(marker.style.left)).closeTo(text.textPadding.left(), 0.5);
  });

  it('preserves padding and the gutter when a text is copied', () => {
    copy = text.copy().openInWorld();
    update();
    expect(copy.showLineNumbers).equals(true);
    expect(copy.padding).equals(text.padding);
    expect(copy.textPadding).equals(text.textPadding);
    expect(copy.env.renderer.getNodeForMorph(copy).querySelectorAll('.line-number')).to.have.length(3);
  });

  it('supports read-only texts and releases the document when the gutter is disabled', () => {
    text.readOnly = true;
    update();
    expect(!!text.document).equals(true);
    expect(numbers().map(n => n.textContent)).deep.equals(['1', '2', '3']);
    text.showLineNumbers = false;
    update();
    expect(!!text.document).equals(false);
    expect(text.selectionMode).equals('none');
    expect(numbers()).to.have.length(0);
    text.showLineNumbers = true;
    update();
    expect(numbers().map(n => n.textContent)).deep.equals(['1', '2', '3']);
  });

  it('leaves ordinary text unnumbered by default', () => {
    copy = new Text({ textString: 'ordinary label' }).openInWorld();
    update();
    expect(copy.showLineNumbers).equals(false);
    expect(!!copy.document).equals(false);
    expect(copy.textPadding).equals(copy.padding);
    expect(copy.env.renderer.getNodeForMorph(copy).querySelector('.newtext-line-number-layer')).equals(null);
    copy.selectionMode = 'native';
    copy.showLineNumbers = false;
    expect(copy.selectionMode).equals('native');
  });

  it('restores native selection after numbered read-only text returns to label mode', () => {
    copy = new Text({ textString: 'read-only\ntext', showLineNumbers: true, selectionMode: 'native' }).openInWorld();
    update();
    expect(copy.selectionMode).equals('lively');
    expect(!!copy.document).equals(true);
    copy.readOnly = false;
    copy.readOnly = true;
    copy.showLineNumbers = false;
    update();
    expect(!!copy.document).equals(false);
    expect(copy.selectionMode).equals('native');
    copy.showLineNumbers = true;
    update();
    expect(copy.selectionMode).equals('lively');
  });
});
