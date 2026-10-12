/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, TilingLayout } from '../index.js';
import { pt } from 'lively.graphics';

describe('hugging containers with filling children', () => {
  for (const axis of ['row', 'column']) {
    for (const renderViaCSS of [false, true]) {
      it(`uses a fixed sibling to determine the ${axis} cross-axis size (CSS: ${renderViaCSS})`, async () => {
        const dimension = axis === 'column' ? 'width' : 'height';
        const hugging = axis === 'column' ? 'hugContentsHorizontally' : 'hugContentsVertically';
        const fixed = new Morph({ name: 'fixed', extent: pt(240, 240), borderWidth: 2 });
        const filling = new Morph({ name: 'filling', extent: pt(70, 70) });
        const container = new Morph({ extent: pt(500, 500), submorphs: [fixed, filling], layout: new TilingLayout({
          axis, renderViaCSS, padding: 10, spacing: 5, [hugging]: true,
          resizePolicies: [['filling', { width: dimension === 'width' ? 'fill' : 'fixed', height: dimension === 'height' ? 'fill' : 'fixed' }]]
        }) }).openInWorld();
        try {
          await container.whenRendered();
          container.env.forceUpdate();
          expect(container.layout[hugging]).equals(true);
          expect(container[dimension]).closeTo(260, 0.1);
          expect(filling[dimension]).closeTo(240, 0.1);
          fixed[dimension] = 180;
          container.env.forceUpdate();
          expect(container[dimension]).closeTo(200, 0.1);
          expect(filling[dimension]).closeTo(180, 0.1);
          const copy = container.copy();
          expect(copy.layout[hugging]).equals(true);
          copy.remove();
          fixed.visible = false;
          container.env.forceUpdate();
          expect(container.layout[hugging]).equals(false);
          fixed.visible = true;
          container.env.forceUpdate();
          expect(container.layout[hugging]).equals(true);
          expect(container[dimension]).closeTo(200, 0.1);
        } finally { container.remove(); }
      });
    }
  }
});
