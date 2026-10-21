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
          expect(children[0][position]).below(children[1][position], 'default order follows owner indices');
          layout.reverseOrder = true;
          container.env.forceUpdate();
          expect(children[1][position]).below(children[0][position], 'reverseOrder reverses the chosen order');
          expect(container.submorphs).deep.equals(children, 'reversal preserves owner indices');
          for (const child of children) {
            expect(container.env.renderer.getNodeForMorph(child)[offset]).closeTo(child[position], 0.1);
          }
          expect(layout.copy().reverseOrder).equals(true, 'copy retains reversal');
          const yogaNode = container._yogaNode;
          const removeChild = yogaNode.removeChild;
          let removed = 0;
          yogaNode.removeChild = function (node) { removed++; return removeChild.call(this, node); };
          try { layout.computeLayout(); } finally { yogaNode.removeChild = removeChild; }
          expect(removed).equals(0, 'unchanged Yoga children are reused');
          layout.reverseOrder = false;
          container.env.forceUpdate();
          expect(children[0][position]).below(children[1][position], 'disabling reversal restores forward order');
        } finally { container.remove(); }
      });

      it(`orders ${axis} by position independently of reverseOrder (CSS: ${renderViaCSS})`, async () => {
        const position = axis === 'row' ? 'left' : 'top';
        const children = [80, 0, 40].map(offset => new Morph({
          extent: pt(20, 20), position: axis === 'row' ? pt(offset, 0) : pt(0, offset)
        }));
        const layout = new TilingLayout({ axis, renderViaCSS, orderByIndex: false });
        const container = new Morph({ extent: pt(200, 200), submorphs: children });
        layout.container = container;
        expect(layout.layoutableSubmorphs).deep.equals([children[1], children[2], children[0]], 'false selects spatial order, not reversed owner indices');
        container.layout = layout;
        container.openInWorld();
        try {
          await container.whenRendered();
          container.env.forceUpdate();
          expect(children[1][position]).below(children[2][position], 'spatially first child remains first');
          expect(children[2][position]).below(children[0][position], 'spatially last child remains last');
          expect(layout.orderByIndex).equals(false, 'position mode stays enabled');
          expect(layout.reverseOrder).equals(false, 'position mode does not enable reversal');
        } finally { container.remove(); }
      });

      it(`ignores reverseOrder in ${axis} position mode across relayouts (CSS: ${renderViaCSS})`, async () => {
        let forwardPositions;
        for (const reverseOrder of [false, true]) {
          const children = [80, 0, 40].map(offset => new Morph({
            extent: pt(20, 20), position: axis === 'row' ? pt(offset, 0) : pt(0, offset)
          }));
          const layout = new TilingLayout({ axis, renderViaCSS, orderByIndex: false, reverseOrder });
          const container = new Morph({ extent: pt(200, 200), submorphs: children, layout }).openInWorld();
          const expectedOrder = [children[1], children[2], children[0]];
          const position = axis === 'row' ? 'left' : 'top';
          const positions = () => children.map(child => child.position.toTuple());
          try {
            await container.whenRendered();
            container.env.forceUpdate();
            expect([...children].sort((a, b) => a[position] - b[position])).deep.equals(expectedOrder, 'position mode keeps spatial order even with reverseOrder');
            if (!reverseOrder) forwardPositions = positions();
            expect(positions()).deep.equals(forwardPositions, 'reverseOrder has no effect on positional endpoints');
            for (let iteration = 0; iteration < 3; iteration++) {
              container.extent = container.extent.addPt(pt(1, 1));
              layout.computeLayout();
              container.env.forceUpdate();
              expect(positions()).deep.equals(forwardPositions, 'relayout and extent changes preserve purely positional order');
              if (renderViaCSS) {
                for (const child of children) {
                  const style = {};
                  layout.addSubmorphCSS(child, style);
                  expect(style.order).equals(expectedOrder.indexOf(child), 'CSS ignores reverseOrder in position mode');
                }
              }
            }
            expect(container.submorphs).deep.equals(children, 'position mode preserves owner indices');
            expect(layout.reverseOrder).equals(reverseOrder, 'position mode preserves the inactive flag');
          } finally { container.remove(); }
        }
      });
    }
  }

  it('normalizes truthy and falsy ordering options consistently in constructors and setters', () => {
    for (const flag of ['orderByIndex', 'reverseOrder']) {
      for (const value of [false, 0, null, '', true, 1, 'yes']) {
        const layout = new TilingLayout({ [flag]: value });
        expect(layout[flag]).equals(!!value, `${flag} constructor normalizes ${String(value)}`);
        expect(layout.copy()[flag]).equals(!!value, `${flag} constructor survives copy`);
        layout[flag] = value ? 0 : 1;
        expect(layout[flag]).equals(!value, `${flag} setter normalizes ${String(value)}`);
        expect(new TilingLayout(layout.getSpec())[flag]).equals(!value, `${flag} setter survives spec round-trip`);
      }
    }
  });

  it('preserves both ordering options through detached and attached copy, spec and equality', () => {
    for (const renderViaCSS of [false, true]) {
      for (const orderByIndex of [false, true]) {
        for (const reverseOrder of [false, true]) {
          const layout = new TilingLayout({ renderViaCSS, orderByIndex, reverseOrder });
          for (const attached of [false, true]) {
            if (attached) new Morph({ layout });
            const copy = layout.copy();
            const restored = new TilingLayout(layout.getSpec());
            expect(copy.orderByIndex).equals(orderByIndex, 'copy retains index/position mode');
            expect(copy.reverseOrder).equals(reverseOrder, 'copy retains direction');
            expect(restored.orderByIndex).equals(orderByIndex, 'spec retains index/position mode');
            expect(restored.reverseOrder).equals(reverseOrder, 'spec retains direction');
            expect(layout.equals(copy)).equals(true, 'copy compares equal');
            expect(layout.equals(restored)).equals(true, 'spec round-trip compares equal');
            expect(layout.equals(layout.with({ orderByIndex: !orderByIndex }))).equals(false, 'equality distinguishes the order mode');
            expect(layout.equals(layout.with({ reverseOrder: !reverseOrder }))).equals(false, 'equality distinguishes direction');
          }
        }
      }
    }
  });
});
