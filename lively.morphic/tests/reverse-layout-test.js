/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph, TilingLayout } from '../index.js';
import { pt } from 'lively.graphics';

describe('reversed tiling layouts', () => {
  for (const axis of ['row', 'column']) {
    for (const renderViaCSS of [false, true]) {
      it(`toggles ${axis} order without rebuilding unchanged Yoga children (CSS: ${renderViaCSS})`, async () => {
        const children = [new Morph({ extent: pt(30, 30) }), new Morph({ extent: pt(40, 40) })];
        const layout = new TilingLayout({ axis, renderViaCSS });
        const container = new Morph({ extent: pt(200, 200), submorphs: children, layout }).openInWorld();
        try {
          await container.whenRendered();
          container.env.forceUpdate();
          const position = axis === 'row' ? 'left' : 'top';
          const offset = axis === 'row' ? 'offsetLeft' : 'offsetTop';
          expect(children[0][position]).below(children[1][position]);
          layout.orderByIndex = false;
          container.env.forceUpdate();
          expect(children[1][position]).below(children[0][position]);
          for (const child of children) {
            expect(container.env.renderer.getNodeForMorph(child)[offset]).closeTo(child[position], 0.1);
          }
          expect(layout.copy().orderByIndex).equals(false);
          const yogaNode = container._yogaNode;
          const removeChild = yogaNode.removeChild;
          let removed = 0;
          yogaNode.removeChild = function (node) { removed++; return removeChild.call(this, node); };
          try { layout.computeLayout(); } finally { yogaNode.removeChild = removeChild; }
          expect(removed).equals(0);
          layout.orderByIndex = true;
          container.env.forceUpdate();
          expect(children[0][position]).below(children[1][position]);
        } finally { container.remove(); }
      });
    }
  }
});
