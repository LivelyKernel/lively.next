/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text, TilingLayout, part } from 'lively.morphic';
import { ShapeControl } from '../../studio/controls/shape.cp.js';
import { pt } from 'lively.graphics';

describe('text shrink inspector control', () => {
  it('leaves room after the Shrink caret and keeps shape fields aligned', async () => {
    const text = new Text({ name: 'label', textString: 'A label' });
    const container = new Morph({ extent: pt(300, 100), submorphs: [text], layout: new TilingLayout() }).openInWorld();
    const control = part(ShapeControl).openInWorld();
    try {
      await control.whenRendered();
      control.viewModel.focusOn(text);
      const selector = control.get('width mode selector');
      selector.selection = 'shrink';
      const label = selector.get('label');
      await label.whenFontLoaded();
      for (const scale of [1, 1.8]) {
        control.scale = scale;
        container.env.forceUpdate();
        const node = control.env.renderer.getNodeForMorph(label);
        const range = document.createRange();
        range.selectNodeContents(node.querySelector('.line'));
        expect(range.getBoundingClientRect().right).lessThan(selector.globalBounds().right() - 8 * scale);
      }
      control.viewModel.focusOn(container);
      container.env.forceUpdate();
      const rows = [['x input', 'y input', 'buffer after position'], ['width input', 'height input', 'proportional resize toggle'], ['width mode selector', 'height mode selector', 'buffer'], ['rotation input', 'radius input', 'independent corner toggle']];
      for (const [left, right, button] of rows) {
        expect(control.get(left).width).equals(selector.width);
        expect(control.get(right).width).equals(selector.width);
        expect(control.get(left).left).closeTo(control.get('width input').left, 1);
        expect(control.get(right).left).closeTo(control.get('height input').left, 1);
        expect(control.get(button).center.y).closeTo(control.get(left).center.y, 1);
      }
    } finally { control.remove(); container.remove(); }
  });

  it('offers shrink only for text in tiling layouts and applies it from the selector', async () => {
    const text = new Text({ name: 'label', textString: 'A label' });
    const container = new Morph({ extent: pt(300, 100), submorphs: [text], layout: new TilingLayout() }).openInWorld();
    const control = part(ShapeControl).openInWorld();
    try {
      await control.whenRendered();
      control.viewModel.focusOn(text);
      const selector = control.get('width mode selector');
      expect(selector.items.some(item => item.value === 'shrink')).equals(true);
      selector.selection = 'shrink';
      container.env.forceUpdate();
      expect(container.layout.getResizeWidthPolicyFor(text)).equals('shrink');
      expect(text.fixedWidth).equals(true);
      expect(text.lineWrapping).equals('by-words');
      control.viewModel.refreshFromTarget();
      expect(selector.selection).equals('shrink');
      control.viewModel.focusOn(container);
      expect(selector.items.some(item => item.value === 'shrink')).equals(false);
    } finally { control.remove(); container.remove(); }
  });
});
