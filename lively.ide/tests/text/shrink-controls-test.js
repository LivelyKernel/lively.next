/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, Text, TilingLayout, part } from 'lively.morphic';
import { ShapeControl } from '../../studio/controls/shape.cp.js';
import { pt } from 'lively.graphics';

describe('text shrink inspector control', () => {
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
