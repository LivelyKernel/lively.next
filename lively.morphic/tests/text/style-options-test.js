/* global describe, it, afterEach */
import { expect } from 'mocha-es6';
import { Text } from '../../text/morph.js';
import { Color, Rectangle, pt } from 'lively.graphics';

describe('text styling and display options', () => {
  let text;
  afterEach(() => text && text.remove());

  for (const readOnly of [true, false]) {
    it(`renders whole-text and per-run decoration colors (${readOnly ? 'static' : 'editable'})`, async () => {
      text = new Text({
        readOnly, fixedWidth: true, extent: pt(250, 60),
        textDecoration: 'underline', textDecorationColor: Color.blue,
        fontColor: Color.green,
        textAndAttributes: ['whole ', null, 'run', { textDecorationColor: Color.red }]
      }).openInWorld();
      await text.whenRendered();
      const chunks = () => [...text.env.renderer.getNodeForMorph(text).querySelectorAll('.line > span')];
      const style = node => text.env.domEnv.window.getComputedStyle(node);
      expect(style(chunks()[0]).textDecorationColor).equals(Color.blue.toP3ColorString().replace(' / 1', ''));
      expect(style(chunks()[1]).textDecorationColor).equals(Color.red.toP3ColorString().replace(' / 1', ''));
      expect(style(chunks()[0]).textDecorationLine).equals('underline');
      expect(style(chunks()[1]).textDecorationLine).equals('underline');
      text.textDecorationColor = null;
      await text.whenRendered();
      expect(style(chunks()[0]).textDecorationColor).equals(Color.green.toP3ColorString().replace(' / 1', ''));
      expect(style(chunks()[1]).textDecorationColor).equals(Color.red.toP3ColorString().replace(' / 1', ''));
    });
  }

  it('preserves decoration colors and overflow through serialization', () => {
    text = new Text({
      textDecorationColor: Color.blue, textOverflow: 'ellipsis',
      textAndAttributes: ['run', { textDecorationColor: Color.red }]
    });
    const copy = text.copy();
    expect(copy.textDecorationColor).equals(Color.blue);
    expect(copy.textAndAttributes[1].textDecorationColor).equals(Color.red);
    expect(copy.textOverflow).equals('ellipsis');
  });

  it('bounds static ellipsis lines and updates when resized or shortened', async () => {
    text = new Text({
      readOnly: true, fixedWidth: true, fixedHeight: true,
      textOverflow: 'ellipsis', padding: Rectangle.inset(8),
      extent: pt(120, 40), textString: 'a long line that must overflow the available space'
    }).openInWorld();
    await text.whenRendered();
    const line = () => text.env.renderer.getNodeForMorph(text).querySelector('.line');
    expect(getComputedStyle(line()).textOverflow).equals('ellipsis');
    expect(line().clientWidth).at.most(text.width - 16);
    expect(line().scrollWidth).greaterThan(line().clientWidth);
    const initialWidth = line().clientWidth;
    text.width = 180;
    await text.whenRendered();
    expect(line().clientWidth).greaterThan(initialWidth);
    text.textString = 'short';
    await text.whenRendered();
    expect(line().scrollWidth).equals(line().clientWidth);
    text.textOverflow = 'clip';
    await text.whenRendered();
    expect(getComputedStyle(line()).textOverflow).equals('clip');
    expect(getComputedStyle(line()).overflow).equals('visible');
  });

  it('keeps editable text unclipped by the static ellipsis option', async () => {
    text = new Text({
      readOnly: false, fixedWidth: true, textOverflow: 'ellipsis',
      extent: pt(100, 40), textString: 'a long editable line that can scroll'
    }).openInWorld();
    await text.whenRendered();
    const line = text.env.renderer.getNodeForMorph(text).querySelector('.line');
    expect(getComputedStyle(line).textOverflow).equals('clip');
    expect(getComputedStyle(line).overflow).equals('visible');
  });
});
