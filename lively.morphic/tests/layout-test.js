/* global declare, it, describe, beforeEach, afterEach, before, after */
import { expect } from 'mocha-es6';
import { Morph, morph, VerticalLayout, HorizontalLayout, TilingLayout, GridLayout, MorphicEnv } from '../index.js';
import { pt, Rectangle, Point, Color, rect } from 'lively.graphics';
import { arr } from 'lively.lang';
import { ProportionalLayout } from '../layout.js';

let world, m, env, grid, layout;

function createDummyWorld () {
  world = morph({
    type: 'world',
    name: 'world',
    extent: pt(300, 300),
    submorphs: [new Morph({
      layout: new VerticalLayout({ renderViaCSS: false }),
      center: pt(150, 150),
      extent: pt(200, 400),
      fill: Color.random(),
      submorphs: [
        new Morph({ name: 'm1', fill: Color.random(), extent: pt(100, 75) }),
        new Morph({ name: 'm2', fill: Color.random(), extent: pt(50, 50) }),
        new Morph({ name: 'm3', fill: Color.random(), extent: pt(100, 50) })
      ]
    })]
  });
  m = world.submorphs[0];
  world.applyLayoutIfNeeded();
  return world;
}

function closeToPoint (p1, p2, q = 0.1) {
  let { x, y } = p1;
  expect(x).closeTo(p2.x, q, 'x');
  expect(y).closeTo(p2.y, q, 'y');
}

async function checkJSAndCSS (aMorph, test) {
  test();
  aMorph.layout.renderViaCSS = true;
  await aMorph.whenRendered();
  test();
  aMorph.layout.renderViaCSS = false;
  await aMorph.whenRendered();
}

describe('layout', () => {
  before(async () => env = await MorphicEnv.pushDefault(new MorphicEnv()));
  after(() => {
    MorphicEnv.popDefault().uninstall();
    $world.hands.map(h => h.remove());
    $world = MorphicEnv.default().world;
    // $world = this.env.world;
  });
  beforeEach(() => env.setWorld(createDummyWorld()));

  describe('vertical layout', () => {
    beforeEach(() => {
      m.layout.renderViaCSS = false;
    });

    it('renders submorphs vertically', async () => {
      const [item1, item2, item3] = m.submorphs;
      await checkJSAndCSS(m, () => {
        expect(item1.position).equals(pt(0, 0));
        expect(item2.position).equals(item1.bottomLeft);
        expect(item3.position).equals(item2.bottomLeft);
      });
    });

    it('may render submorphs from bottom to top', async () => {
      const [item1, item2, item3] = m.submorphs;
      m.layout.direction = 'bottomToTop';
      m.layout.autoResize = false;
      m.height = 500;
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(item3.bottom).equals(m.height);
      });
      m.layout.spacing = 5;
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(item3.bottom).equals(m.height - 5);
      });
    });

    it('may render submorph centered', async () => {
      const [item1, item2, item3] = m.submorphs;
      m.layout.align = 'center';
      m.layout.direction = 'centered';
      m.layout.spacing = 5;
      m.layout.autoResize = false;
      m.extent = pt(500, 500);
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        closeToPoint(m.submorphBounds().center(), m.innerBounds().center(), 0.5);
      });
    });

    it('adjusts layout when submorph changes extent', async () => {
      const [item1, item2, item3] = m.submorphs;
      item2.extent = pt(100, 100);
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(item1.position).equals(pt(0, 0));
        expect(item2.position).equals(item1.bottomLeft);
        expect(item3.position).equals(item2.bottomLeft);
      });
    });

    it('adjusts layout when submorph is removed', async () => {
      const [item1, item2, item3] = m.submorphs;
      item2.remove();
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(item3.position).equals(item1.bottomLeft);
      });
    });

    it('adjusts layout when submorph is inserted', async () => {
      const [item1, item2, item3] = m.submorphs;
      const item4 = new Morph({ extent: pt(200, 200) });
      m.addMorphAt(item4, 1);
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(item4.position).equals(item1.bottomLeft);
        expect(item2.position).equals(item4.bottomLeft);
      });
    });

    it('can vary the spacing between submorphs', async () => {
      const [item1, item2, item3] = m.submorphs;
      m.layout = new VerticalLayout({ spacing: 10, renderViaCSS: false });
      await checkJSAndCSS(m, () => {
        expect(item2.position).equals(item1.bottomLeft.addPt(pt(0, 10)));
        expect(item3.position).equals(item2.bottomLeft.addPt(pt(0, 10)));
      });
    });

    it('adjusts width to widest item', async () => {
      m.layout = new VerticalLayout({ resizeSubmorphs: false, autoResize: true, renderViaCSS: false });
      const maxWidth = 1000;
      m.submorphs[1].width = maxWidth;
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(m.width).equals(maxWidth);
      });
    });

    it('can resize width of submorphs', async () => {
      m.layout.resizeSubmorphs = new VerticalLayout({ resizeSubmorphs: true, renderViaCSS: false });
      m.width = 600;
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(m.width).equals(m.submorphs[1].width);
      });
    });

    it('can resize width of submorphs and adjust height', async () => {
      m.layout.resizeSubmorphs = new VerticalLayout({ resizeSubmorphs: true, autoResize: true, renderViaCSS: false });
      m.width = 600;
      m.height = 1000;
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(m.width).equals(m.submorphs[1].width);
        expect(m.height).equals(m.submorphBounds().height);
      });
    });

    it('adjusts height to number of items', async () => {
      const totalHeight = m.submorphs.reduce((h, m) => h + m.height, 0);
      await checkJSAndCSS(m, () => {
        expect(m.height).equals(totalHeight);
      });
    });

    it('can leave the container extent untouched', async () => {
      const [item1, item2, item3] = m.submorphs;
      m.layout = new VerticalLayout({ autoResize: false, renderViaCSS: true });
      let extentBefore = m.extent;
      item1.width = 10;
      item2.height = 10;
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(m.extent).equals(extentBefore);
      });
    });

    it('will not resize the container if no submorphs present', async () => {
      let extentBefore = m.extent;
      m.layout.autoResize = false;
      m.submorphs = [];
      m.layout.autoResize = true;
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(m.extent).equals(extentBefore);
      });
    });
  });

  describe('horizontal layout', () => {
    beforeEach(() => {
      m.layout = new HorizontalLayout({ renderViaCSS: false });
      m.applyLayoutIfNeeded();
    });

    it('renders submorphs horizontally', async () => {
      const [item1, item2, item3] = m.submorphs;
      await checkJSAndCSS(m, () => {
        expect(item1.position).equals(pt(0, 0));
        expect(item2.position).equals(item1.topRight);
        expect(item3.position).equals(item2.topRight);
      });
    });

    it('adjusts width to number of items', async () => {
      const totalWidth = m.submorphs.reduce((w, m) => w + m.width, 0);
      await checkJSAndCSS(m, () => {
        expect(m.width).equals(totalWidth);
      });
    });

    it('adjusts height to highest item', async () => {
      const maxHeight = arr.max(m.submorphs.map(m => m.height));
      await checkJSAndCSS(m, () => {
        expect(m.height).equals(maxHeight);
      });
    });

    it('enforces minimum height and minimum width', async () => {
      m.extent = pt(50, 50);
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(m.height).equals(75);
        expect(m.width).equals(250);
      });
    });

    it('enforces minimum height and minimum width when centered', async () => {
      m.layout.direction = 'centered';
      m.layout.autoResize = false;
      m.width = 500;
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(m.submorphBounds().topCenter().x).equals(250);
      });
    });
  });

  describe('tiling layout', () => {
    beforeEach(() => {
      m.layout = new TilingLayout({ renderViaCSS: false });
      m.width = 200;
      m.applyLayoutIfNeeded();
    });

    it('tiles submorphs to fit the bounds', async () => {
      const [m1, m2, m3] = m.submorphs;
      await checkJSAndCSS(m, () => {
        expect(m1.position).equals(pt(0, 0));
        expect(m2.position).equals(m1.topRight);
        expect(m3.position).equals(m1.bottomLeft);
      });
    });

    it('updates layout on changed extent', async () => {
      const [m1, m2, m3] = m.submorphs;
      m.extent = pt(400, 100);
      m.applyLayoutIfNeeded();
      await checkJSAndCSS(m, () => {
        expect(m1.position).equals(pt(0, 0));
        expect(m2.position).equals(m1.topRight);
        expect(m3.position).equals(m2.topRight);
      });
    });

    describe('variations', () => {
      let container;
      beforeEach(() => {
        container = morph({ fill: Color.random(), extent: pt(300, 200), clipMode: 'hidden' });
        container.submorphs = arr.range(0, 20).map(_ => morph({ fill: Color.random(), extent: Point.random(pt(100, 20)).maxPt(pt(20, 20)) }));
      });

      it('preserves policies on reassignement', () => {
        container.layout = new TilingLayout({ padding: Rectangle.inset(5), spacing: 5, axis: 'row', renderViaCSS: false, wrapSubmorphs: false });
        container.layout.setResizePolicyFor(container.submorphs[0], { width: 'fill', height: 'fixed' });
        expect(container.layout.getResizeWidthPolicyFor(container.submorphs[0])).equals('fill');
        container.layout = container.layout;
        expect(container.layout.getResizeWidthPolicyFor(container.submorphs[0])).equals('fill');
      });

      it('axis: row', async () => {
        container.layout = new TilingLayout({ padding: Rectangle.inset(5), spacing: 5, axis: 'row', renderViaCSS: false });
        let rows = arr.groupBy(container.submorphs, m => m.position.y).toArray().map(row => arr.sortBy(row, ea => ea.position.x));
        rows.slice(0, -1).forEach(row => expect(row.length).gt(1));
        await checkJSAndCSS(m, () => {
          expect(rows[0][0].position).deep.equals(pt(5, 5), 'first morph pos');
          for (let i = 0; i < rows.length; i++) {
            for (let j = 0; j < rows[i].length - 1; j++) {
              let [a, b] = rows[i].slice(j);
              expect(a.topRight.addXY(5, 0)).deep.equals(b.topLeft, `layout: row ${j}, col ${j}`);
            }
          }
        });
      });

      it('axis: row, align: center', async () => {
        container.layout = new TilingLayout({
          padding: Rectangle.inset(10),
          spacing: 10,
          axis: 'row',
          align: 'center',
          renderViaCSS: false
        });

        let rows = arr.groupBy(container.submorphs, m => m.position.y).toArray().map(row => arr.sortBy(row, ea => ea.position.x));
        await checkJSAndCSS(m, () => {
          rows.slice(0, -1).forEach(row => expect(row.length).gt(1));
          for (let i = 0; i < rows.length; i++) {
            expect(rows[i][0].left).closeTo(container.width - arr.last(rows[i]).right, 1, 'correctly centers row items');
            for (let j = 0; j < rows[i].length - 1; j++) {
              let [a, b] = rows[i].slice(j);
              expect(a.topRight.addXY(10, 0)).deep.equals(b.topLeft, `layout: row ${j}, col ${j}`);
            }
          }
        });
      });
    });
  });

  describe('layout cells', () => {
    beforeEach(() => {
      m.layout = null;
      m.width = 300;
      m.height = 300;
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid: [[null, 'm1', null],
          ['m2', null, null],
          [null, null, 'm3']]
      });
      layout = m.layout;
      layout.apply();
      grid = m.layout.grid;
    });

    it('connects cells in a grid', () => {
      expect(grid.right.bottom.right.bottom
        .left.top.left.top).equals(grid);
    });

    it('computes its bounds', () => {
      expect(grid.row(1).col(2).bounds()).equals(pt(200, 100).extent(pt(100, 100)));
    });

    it('connects cells to other cells', () => {
      let a = grid.row(2).col(2);
      let b = grid.row(1).col(2);
      let bGroup = b.group;
      expect(layout.cellGroups.length).equals(9);
      expect(a.group.cells).equals([a]);
      expect(layout.cellGroups.includes(bGroup)).to.be.true;
      a.group.connect(b);
      expect(a.group.cells).equals([a, b]);
      expect(a.group).equals(b.group);
      expect(bGroup.cells).equals([]);
      expect(layout.cellGroups.includes(bGroup)).to.be.false;
      expect(layout.cellGroups.length).equals(8);
    });

    it('assigns morph of connected cell to group if previously morphless', () => {
      let a = grid.row(2).col(2);
      let b = grid.row(1).col(2);
      let aGroup = a.group;
      expect(aGroup.morph).not.to.be.null;
      expect(b.group.morph).to.be.null;
      b.group.connect(a);
      expect(b.group.morph).not.to.be.null;
    });

    it("computes the group's bounds", () => {
      let a = grid.row(1).col(2);
      let b = grid.row(0).col(2);
      a.group.connect(b);
      expect(a.group.bounds()).equals(rect(200, 0, 100, 200));
    });

    it('inserts rows and columns of cells', () => {
      grid.row(0).addBefore();
      grid.col(1).addAfter();
      expect(grid.col(1).items.length).equals(4);
      expect(grid.row(1).items.length).equals(4);
    });

    it('can fix its height or width', () => {
      grid.col(1).fixed = true;
      grid.row(1).fixed = true;
      layout.container.resizeBy(pt(100, 100));
      layout.container.applyLayoutIfNeeded();
      expect(grid.col(0).row(0).dynamicWidth).equals(300);
      expect(grid.col(0).row(0).width).equals(150);
      closeToPoint(grid.col(1).row(1).bounds().extent(), pt(100, 100));
      closeToPoint(grid.col(0).row(0).bounds().extent(), pt(150, 150));
    });

    it('can change its height or width proportion', () => {
      grid.col(1).width += 50;
      grid.row(1).height += 50;
      expect(grid.col(1).row(1).bounds().extent()).equals(pt(150, 150));
      expect(grid.col(0).row(0).bounds().extent()).equals(pt(100, 100));
      expect(grid.col(2).row(2).bounds().extent()).equals(pt(50, 50), 'steals from next flexible axis');
    });

    it('propagates sizing changes to neighbors', () => {
      grid.col(1).width += 50;
      expect(grid.col(0).width).equals(100);
      expect(grid.col(2).width).equals(50);
    });
  });

  describe('grid layout', () => {
    beforeEach(() => {
      m.layout = null;
      m.width = 300;
      m.height = 300;
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid: [
          [null, 'm1', null],
          ['m2', null, null],
          [null, null, 'm3']
        ]
      });
      m.layout.apply();
    });

    it('aligns submorphs along a grid', () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 100));
      expect(m3.position).equals(pt(200, 200));
    });

    it('aligns stores the dynamic proportions', () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m.layout.col(0).proportion).equals(1 / 3);
      expect(m.layout.col(1).proportion).equals(1 / 3);
      expect(m.layout.col(2).proportion).equals(1 / 3);
      expect(m.layout.row(0).proportion).equals(1 / 3);
      expect(m.layout.row(2).proportion).equals(1 / 3);
      expect(m.layout.row(2).proportion).equals(1 / 3);
    });

    it('adjusts dynamic proportions on axis fixation', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(1).fixed = true;
      m.layout.row(1).fixed = true;
      expect(m.layout.col(0).proportion).equals(1 / 2);
      expect(m.layout.col(2).proportion).equals(1 / 2);
      expect(m.layout.row(0).proportion).equals(1 / 2);
      expect(m.layout.row(2).proportion).equals(1 / 2);
      m.layout.col(1).fixed = false;
      m.layout.row(1).fixed = false;
      expect(m.layout.col(0).proportion).equals(1 / 3);
      expect(m.layout.col(2).proportion).equals(1 / 3);
      expect(m.layout.row(0).proportion).equals(1 / 3);
      expect(m.layout.row(2).proportion).equals(1 / 3);
    });

    it('expands container when fixed size exceeds initial extent', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(0).fixed = 500;
      m.applyLayoutIfNeeded();
      expect(m.extent).equals(pt(500, 300));
    });

    it('adjusts dynamic proportions when one axis adjusts width or height', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(1).width += 100;
      m.layout.row(1).height += 100;
      expect(m.layout.col(0).proportion).equals(1 / 3);
      expect(m.layout.col(1).proportion).equals(2 / 3);
      expect(m.layout.col(2).proportion).equals(0);
      expect(m.layout.row(0).proportion).equals(1 / 3);
      expect(m.layout.row(1).proportion).equals(2 / 3);
      expect(m.layout.row(2).proportion).equals(0);
    });

    it('adjusts dynamic proportions when one axis reaches or leaves minimum', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(1).min = 50;
      m.layout.row(1).min = 50;
      m.extent = pt(25, 25);
      m.applyLayoutIfNeeded();
      expect(m.extent).equals(pt(50, 50));
      expect(m.layout.col(0).proportion).equals(1 / 2);
      expect(m.layout.col(2).proportion).equals(1 / 2);
      expect(m.layout.row(0).proportion).equals(1 / 2);
      expect(m.layout.row(2).proportion).equals(1 / 2);
      m.extent = pt(200, 200);
      m.applyLayoutIfNeeded();
      expect(m.layout.col(1).proportion).equals(1 / 3, 'col 1');
      expect(m.layout.col(2).proportion).equals(1 / 3, 'col 3');
      expect(m.layout.col(0).proportion).equals(1 / 3, 'col 0');
      expect(m.layout.row(0).proportion).equals(1 / 3);
      expect(m.layout.row(2).proportion).equals(1 / 3);
    });

    it('appends missing cells', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
        grid:
                          [[null, 'm1'],
                            ['m2'],
                            [null, null, 'm3']]
      });
      expect(m.layout.rowCount).equals(3);
      expect(m.layout.columnCount).equals(3);
      expect(m3.position).equals(pt(200, 200));
    });

    it('can create an empty grid and auto assign submorphs to closest cell', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = null;
      m1.position = pt(288, 20);
      m2.position = pt(15, 20);
      m3.position = pt(10, 220);
      m.layout = new GridLayout({ columnCount: 3, rowCount: 3, renderViaCSS: false });
      expect(m2.position).equals(pt(0, 0));
      expect(m3.position).equals(pt(0, 200));
      expect(m1.position).equals(pt(200, 0));
    });

    it('allows morphs to take up multiple cells', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid: [
          [null, 'm1', null],
          ['m2', 'm2', null],
          [null, null, 'm3']
        ]
      });
      expect(m2.position).equals(pt(0, 100));
    });

    it('allows morphs to be reassigned to cells', () => {
      const [m1, m2, m3] = m.submorphs;
      let group = m.layout.row(2).col(1).group;
      group.morph = m2;
      m.layout.apply();
      expect(m.layout.row(1).col(0).group.morph).equals(null);
      expect(m2.position).equals(pt(100, 200));
      group = m.layout.row(0).col(0).group;
      group.connect(m.layout.col(0).row(1));
      group.connect(m.layout.col(0).row(2));
      group.morph = m1;
      m.layout.apply();
      expect(m1.position).equals(pt(0, 0));
      expect(m1.height).equals(300);
    });

    it('updates layout on changed extent', () => {
      const [m1, m2, m3] = m.submorphs;
      m.resizeBy(pt(300, 300));
      m.applyLayoutIfNeeded();
      expect(m1.position).equals(pt(200, 0));
      expect(m2.position).equals(pt(0, 200));
      expect(m3.position).equals(pt(400, 400));
      m.resizeBy(pt(-300, 0));
      m.applyLayoutIfNeeded();
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 200));
      expect(m3.position).equals(pt(200, 400));
      m.resizeBy(pt(0, -300));
      m.applyLayoutIfNeeded();
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 100));
      expect(m3.position).equals(pt(200, 200));
    });

    it('allows rows and columns to be fixed', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid: /* 50px */
          [[null, 'm1', null], /* 50 px */
            ['m2', null, null],
            [null, null, 'm3']]
      });
      // m.width = m.height = 300;
      m.layout.col(1).width = 50;
      m.layout.row(0).height = 50;
      m.layout.row(0).fixed = true;
      m.layout.col(1).fixed = true;
      m.layout.apply();
      expect(m2.position).equals(pt(0, 50));
      expect(m3.position.roundTo(0.1)).equals(pt(150, 200));
      expect(m1.position).equals(pt(100, 0));
      m.resizeBy(pt(100, 100));
      m.layout.col(1).fixed = false;
      expect(m.layout.col(1).width).equals(50);
    });

    it('is numerically stable', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid: [
          [null, 'm1', null],
          ['m2', null, null],
          [null, null, 'm3']]
      });
      m.applyLayoutIfNeeded();
      expect(m.layout.col(0).proportion).equals(1 / 3);
      m.extent = pt(0, 0);
      m.applyLayoutIfNeeded();
      expect(m.layout.col(0).proportion).equals(1 / 3, 'preserve proportion');
      expect(m.extent).equals(pt(0, 0));
      expect(m1.position).equals(pt(0, 0));
      expect(m2.position).equals(pt(0, 0));
      expect(m3.position).equals(pt(0, 0), 'm3 position');
      m.extent = pt(300, 300);
      m.applyLayoutIfNeeded();
      expect(m.layout.col(0).proportion).equals(1 / 3, 'preserve proportion');
      expect(m.layout.col(0).width).equals(100, 'proportion defines length');
      expect(m.extent).equals(pt(300, 300));
      expect(m1.position).equals(pt(100, 0));
      expect(m2.position).equals(pt(0, 100));
      expect(m3.position).equals(pt(200, 200));
    });

    it('can set minimum spacing for columns and rows', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid:
        /* 50px */
        [[null, 'm1', null], /* 50 px */
          ['m2', null, null],
          [null, null, 'm3']]
      });
      m.layout.col(0).min = 50;
      m.layout.row(0).min = 50;
      m.extent = pt(25, 25); // too small!
      m.applyLayoutIfNeeded();
      expect(m.extent).equals(pt(50, 50), 'framed extent');
      expect(m.layout.col(0).proportion).equals(1 / 3);
      expect(m1.position).equals(pt(50, 0));
      expect(m2.position).equals(pt(0, 50));
      expect(m3.position).equals(pt(50, 50), 'm3 position');
      m.extent = pt(100, 100);
      m.applyLayoutIfNeeded();
      expect(m.extent).equals(pt(100, 100));
      expect(m1.position).equals(pt(50, 0));
      expect(m2.position).equals(pt(0, 50));
      expect(m3.position).equals(pt(75, 75));
    });

    it("by default enforces the cell's extent upon the contained morph", () => {
      const [m1, m2, m3] = m.submorphs;
      expect(m1.extent).equals(pt(100, 100));
      expect(m2.extent).equals(pt(100, 100));
      expect(m3.extent).equals(pt(100, 100));
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid:
        [[null, 'm1', null],
          ['m2', 'm2', 'm3'],
          [null, null, 'm3']]
      });
      expect(m1.extent).equals(pt(100, 100));
      expect(m2.extent).equals(pt(200, 100));
      expect(m3.extent).equals(pt(100, 200));
    });

    it('can vary the proportional width and height of rows and columns', () => {
      m.layout.col(0).width += 60;
      expect(m.layout.col(0).width).equals(160);
      expect(m.layout.col(1).width).equals(40);
      m.layout.row(0).height += 60;
      expect(m.layout.row(0).height).equals(160);
      expect(m.layout.row(1).height).equals(40);
      m.layout.col(0).width += 300;
      expect(m.layout.col(0).width).equals(200);
      expect(m.layout.col(1).width).equals(0);
      m.layout.row(0).height += 300;
      expect(m.layout.row(0).height).equals(200);
      expect(m.layout.row(1).height).equals(0);
      expect(m.layout.row(0).col(0).height).equals(200);
      expect(m.layout.row(1).col(0).height).equals(0);
    });

    it('can vary proportion of the last column', () => {
      m.layout.col(2).width += 100;
      expect(m.width).equals(300);
      expect(m.layout.col(0).width).equals(100);
      expect(m.layout.col(1).width).equals(0);
      expect(m.layout.col(2).width).equals(200);
    });

    it('widens container when varying fixed width column', () => {
      m.layout.col(2).fixed = true;
      m.layout.col(2).width += 100;
      expect(m.layout.col(2).width).equals(200);
      expect(m.width).equals(400);
    });

    it('can vary the fixed space of axis', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid:
        /* 50px */
        [[null, 'm1', null], /* 50 px */
          ['m2', null, null],
          [null, null, 'm3']]
      });
      m.layout.col(1).fixed = true;
      m.layout.col(1).width += 50;
      expect(m.width).equals(350);
      expect(m.layout.col(1).width).equals(150);
      expect(m.layout.col(0).width).equals(100);
      expect(m.layout.col(2).width).equals(100);
    });

    it('can vary proportions correctly in presence of fixed axis', () => {
      let [m1, m2, m3] = m.submorphs;
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid:
        /* 100px 100px */
        [[null, 'm1', null, null],
          ['m2', null, null, null],
          [null, null, null, 'm3']]
      });
      m.width = 400;
      m.applyLayoutIfNeeded(); // that is a problem, if it comes later than the col tweaking
      m.layout.col(2).fixed = true;
      m.layout.col(1).fixed = true;
      expect(m.layout.col(3).width).equals(100);
      expect(m.layout.col(0).width).equals(100);
      m.layout.col(0).width += 50;
      m.layout.apply();
      expect(m2.width).equals(150);
      expect(m3.width).equals(50);
      m.layout.col(3).width += 60;
      m.layout.apply();
      expect(m2.width).equals(90);
      expect(m3.width).equals(110);
      m.layout.col(3).width -= 60;
      m.layout.apply();
      expect(m2.width).equals(150);
      expect(m3.width).equals(50);
      m.layout.col(3).width -= 50; // 0
      m.layout.apply();
      expect(m.layout.col(3).width).equals(0);
      expect(m.layout.col(0).width).equals(200);
      expect(m2.width).equals(200);
      expect(m3.width).equals(0);
      m.layout.col(3).width -= 50;
      m.applyLayoutIfNeeded();
      expect(m3.width).equals(0, 'prevent negative widths');
      expect(m2.width).closeTo(200, 0.0001);
      expect(m.layout.col(3).width).equals(0);
      expect(m.layout.col(0).width).equals(200);
      m.layout.col(3).fixed = m.layout.col(2).fixed = m.layout.col(1).fixed = 100;
      m.width = 400;
      m.layout.apply();
      expect(m.layout.col(0).dynamicLength).equals(100);
      m.layout.col(0).width += 300;
      m.layout.apply();
      expect(m.layout.col(0).dynamicLength).equals(400);
      expect(m.layout.col(0).width).equals(400);
      expect(m.width).equals(700);
      expect(m2.width).closeTo(400, 0.001);
      expect(m3.width).closeTo(100, 0.0001);
      expect(m1.width).closeTo(100, 0.0001);
    });

    it('can add rows and columns', () => {
      // [[X, null, "m1", null],
      //  [X, X,     X,    X ]
      //  [X, "m2", null, null],
      //  [X, null, null, "m3"]]
      const [m1, m2, m3] = m.submorphs;
      m.layout.row(0).fixed = 75;
      m.height = 300;
      m.layout.row(0).addAfter();
      m.layout.col(0).addBefore();
      m.layout.apply();
      expect(m.layout.row(0).height).equals(300 / 4, 'row 0');
      expect(m.layout.row(1).proportion).closeTo(1 / 3, 0.0001, 'row 1');
      expect(m.layout.row(1).dynamicLength).closeTo(225, 0.0001, 'row 1 dyn length');
      expect(m.layout.row(1).length).closeTo(225 / 3, 0.0001, 'row 1 length');
      expect(m.layout.row(2).proportion).closeTo(1 / 3, 0.0001, 'row 2');
      expect(m.layout.row(3).proportion).closeTo(1 / 3, 0.0001, 'row 3');
      expect(m.layout.columnCount).equals(4);
      expect(m.layout.col(3)).to.not.be.null;
      expect(m.layout.rowCount).equals(4);
      expect(m1.position).equals(pt((300 / 2), 0));
      expect(m2.position).equals(pt((300 / 4), 2 * (300 / 4)));
      expect(m3.position).equals(pt(3 * (300 / 4), 3 * (300 / 4)));
    });

    it('can remove rows and columns', () => {
      // [[null, null],
      //  [null, "m3"]]
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(0).remove();
      m.layout.row(1).remove();
      m.layout.apply();
      expect(m.width).equals(300);
      expect(m3.position).equals(pt(150, 150));
      m.layout.col(1).remove();
      expect(m.layout.col(0).after).to.be.undefined;
    });

    it('removes removed submorphs from layout', () => {
      const [m1, m2, m3] = m.submorphs;
      m1.remove();
      expect(m.layout.row(0).col(1).group.morph).to.be.null;
    });

    it('can add a padding to different axis', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.col(1).paddingLeft = 10;
      m.layout.col(1).paddingRight = 10;
      m.layout.row(0).paddingTop = 5;
      m.layout.apply();
      expect(m2.position).equals(pt(0, 100));
      expect(m1.position).equals(pt(110, 5));
      expect(m1.topRight).equals(pt(190, 5));
      expect(m1.width).equals(80);
      expect(m1.height).equals(95);
    });

    it('can compensate origin', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.compensateOrigin = true;
      m.adjustOrigin(pt(50, 50));
      m.layout.apply();
      expect(m2.position).equals(pt(-50, 50));
      expect(m1.position).equals(pt(50, -50));
    });

    it('allows submorphs to preserve their original extent', () => {
      const [m1, m2, m3] = m.submorphs;
      m.layout.fitToCell = false;
      m1.extent = pt(22, 33);
      m.layout.apply();
      expect(m1.extent).equals(pt(22, 33));
    });

    it('also layouts submorphs that are added afterwards', () => {
      m.layout = new GridLayout({
        renderViaCSS: false,
        grid: [
          [null, 'm1', null],
          ['m2', 'm2', 'm4'],
          [null, null, 'm3']
        ]
      });
      m.addMorph({ name: 'm4', extent: pt(22, 22) });
      expect(m.layout.layoutableSubmorphs.length).equals(4);
      expect(m.layout.layoutableSubmorphBounds.length).equals(3);
      expect(m.layout.submorphBoundsChanged).is.true;
      m.applyLayoutIfNeeded();
      expect(m.getSubmorphNamed('m4').bounds()).equals(rect(200, 100, 100, 100));
    });
  });

  describe('proportional layout', () => {
    let container;
    beforeEach(() => container = morph({
      extent: pt(100, 100),
      fill: Color.yellow,
      layout: new ProportionalLayout({}),
      submorphs: [
        { name: 'a', extent: pt(10, 10), fill: Color.red, position: pt(10, 10) },
        { name: 'b', extent: pt(10, 10), fill: Color.orange, position: pt(50, 50) }
      ]
    }));

    it('scales by default', () => {
      container.extent = pt(120, 120);
      container.applyLayoutIfNeeded();
      expect(container.submorphs[0].bounds()).equals(rect(12, 12, 12, 12));
    });

    it('moves', () => {
      container.layout = new ProportionalLayout({ submorphSettings: [['a', 'move']] });
      container.extent = pt(120, 120);
      container.applyLayoutIfNeeded();
      expect(container.submorphs[0].bounds()).equals(rect(30, 30, 10, 10));
    });

    it('fixed', () => {
      container.layout = new ProportionalLayout({ submorphSettings: [['a', 'fixed']] });
      container.extent = pt(120, 120);
      container.applyLayoutIfNeeded();
      expect(container.submorphs[0].bounds()).equals(rect(10, 10, 10, 10));
    });
  });

  describe('updating policy', () => {
    beforeEach(() => {
      m = morph({
        name: 'A',
        layout: new TilingLayout({ renderViaCSS: false }),
        submorphs: [
          morph({
            name: 'B',
            layout: new HorizontalLayout({
              renderViaCSS: false,
              autoResize: true
            }),
            submorphs: [
              morph({
                name: 'C',
                layout: new VerticalLayout({
                  renderViaCSS: false,
                  autoResize: true
                }),
                submorphs: [morph({ name: 'D' })]
              })
            ]
          })
        ]
      });
    });

    it('schedules layout updates on submorph change', () => {
      let b = m.get('B'); let c = m.get('C'); let d = m.get('D'); let a = m;
      expect(a.layout.applyRequests).is.false;
      expect(c.layout.layoutableSubmorphBounds[0]).equals(d.bounds());
      d.extent = pt(20, 20);
      expect(a.layout.applyRequests).equals(true);
      expect(b.layout.applyRequests).equals(true);
      expect(c.layout.applyRequests).equals(true);
      expect(b.layout.boundsChanged(b)).is.true;
      expect(b.layout.submorphBoundsChanged).is.true;
      expect(c.layout.boundsChanged(c)).is.true;
      expect(c.layout.submorphBoundsChanged).is.true;
      c.clipMode = 'hidden';
      c.layout.autoResize = false;
      expect(c.layout.boundsChanged(c)).is.false;
      expect(c.layout.submorphBoundsChanged).is.true;
      expect(c.layout.noLayoutActionNeeded).is.false;
      c.extent = pt(100, 100);
      expect(c.layout.boundsChanged(c)).is.true;
      expect(c.layout.noLayoutActionNeeded).is.false;
      a.applyLayoutIfNeeded();
      c.extent = pt(25, 25);
      expect(c.layout.noLayoutActionNeeded).is.false;
    });

    it('ignores updates in response to changes that did not affect layout', () => {
      let b = m.get('B'); let c = m.get('C'); let d = m.get('D'); let a = m;
      c.layout.autoResize = false;
      d.extent = pt(100, 100);
      expect(c.layout.boundsChanged(c)).is.true;
      expect(c.layout.submorphBoundsChanged).is.true;
      expect(b.layout.boundsChanged(b)).is.true;
      expect(b.layout.submorphBoundsChanged).is.true;
      c.clipMode = 'hidden';
      expect(c.layout.boundsChanged(c)).is.false;
      expect(c.layout.submorphBoundsChanged).is.true;
      expect(b.layout.boundsChanged(b)).is.false;
      expect(b.layout.submorphBoundsChanged).is.false;
      a.applyLayoutIfNeeded();
      expect(b.layout.boundsChanged(b)).is.false;
      expect(b.layout.submorphBoundsChanged).is.false;
      expect(c.layout.boundsChanged(c)).is.false;
      expect(c.layout.submorphBoundsChanged).is.false;
      d.extent = pt(20, 20);
      expect(b.layout.boundsChanged(b)).is.false;
      expect(b.layout.submorphBoundsChanged).is.false;
      expect(c.layout.boundsChanged(c)).is.false;
      expect(c.layout.submorphBoundsChanged).is.true;
    });

    it('does not respond to scroll changes of clipped morphs', () => {
      let b = m.get('B'); let c = m.get('C'); let d = m.get('D'); let a = m;
      c.clipMode = 'hidden';
      d.extent = pt(100, 100);
      a.applyLayoutIfNeeded();
      b.layout.refreshBoundsCache();
      expect(b.layout.noLayoutActionNeeded).is.true;
      c.scroll = pt(0, -40);
      expect(b.layout.noLayoutActionNeeded).is.true;
    });

    it('does layout if extent of morph changes', () => {
      let b = m.get('B'); let c = m.get('C'); let d = m.get('D'); let a = m;
      a.applyLayoutIfNeeded();
      b.extent = pt(25, 25);
      expect(b.layout.noLayoutActionNeeded).is.false;
    });

    it('properly supports nesting in vertical layouts', () => {
      let m = morph({
        layout: new VerticalLayout({ resizeSubmorphs: true, autoResize: true, renderViaCSS: false }),
        extent: pt(200, 200),
        name: 'root',
        fill: Color.blue,
        submorphs: arr.range(1, 3).map(() => morph({
          name: 'twig',
          fill: Color.green,
          layout: new TilingLayout({ renderViaCSS: false }),
          submorphs: arr.range(1, 3).map(() => morph({
            fill: Color.red,
            name: 'leaf',
            extent: pt(50, 50)
          }))
        }))
      });
      // m.openInWorld()
      expect(m.height).equals(150);
      m.width = 100;
      m.applyLayoutIfNeeded();
      expect(m.height).equals(300);
      expect(m.submorphBounds().height).equals(300);
    });

    it('properly supports nesting in horizontal layouts', () => {
      let m = morph({
        layout: new HorizontalLayout({ resizeSubmorphs: true, autoResize: true, renderViaCSS: false }),
        extent: pt(200, 200),
        name: 'root',
        fill: Color.blue,
        submorphs: arr.range(1, 3).map(() => morph({
          name: 'twig',
          fill: Color.green,
          layout: new TilingLayout({ axis: 'column', renderViaCSS: false }),
          submorphs: arr.range(1, 3).map(() => morph({
            fill: Color.red,
            name: 'leaf',
            extent: pt(50, 50)
          }))
        }))
      });
      expect(m.width).equals(150);
      m.height = 100;
      m.applyLayoutIfNeeded();
      expect(m.width).equals(300);
      expect(m.submorphBounds().width).equals(300);
    });
  });
});
