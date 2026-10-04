/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph } from '../morph.js';
import { morph, MorphicEnv } from '../index.js';
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { pt } from 'lively.graphics';
import { promise } from 'lively.lang';
import { GridLayout, TilingLayout } from '../layout.js';
import Renderer from '../rendering/renderer.js';

function testMorph (id, submorphs = []) {
  return { id, submorphs, renderingState: { needsRerender: true },
    applyLayoutIfNeeded () {}, withAllSubmorphsDo: Morph.prototype.withAllSubmorphsDo };
}

function testRenderer (world) {
  const renderer = Object.create(Renderer.prototype);
  Object.assign(renderer, {
    worldMorph: world, renderMap: new WeakMap(), renderFixedMorphs () {}, renderMorph () {},
    renderLayoutChange (m) { m.renderingState.hasCSSLayoutChange = false; },
    renderStylingChanges (m) { m.renderingState.needsRerender = false; },
    renderStructuralChanges (m) { m.renderingState.hasStructuralChanges = m.renderingState.hasMorphRemoved = false; },
    handleAddedAnimationChange (m) { m.renderingState.animationAdded = false; }
  });
  return renderer;
}

function gridFixture (morphs) {
  const grid = Object.create(GridLayout.prototype);
  grid.container = {};
  Object.defineProperty(grid, 'layoutableSubmorphs', { value: morphs });
  grid.cellGroups = morphs.map(morph => ({ morph, resize: true }));
  grid.getNodeFor = () => ({});
  grid.updateContainerViaDom = () => {};
  return grid;
}

function tilingFixture (submorphs, options = {}) {
  const renderer = { _layoutCSSOrder: new WeakMap() };
  const layout = new TilingLayout({ ...options });
  layout.container = { get submorphs () { return submorphs.concat(); },
    getProperty () { return submorphs; },
    env: { renderer, changeManager: { defaultMeta: {} } }, renderingState: {},
    scrollbarVisible: { vertical: false, horizontal: false } };
  layout.getResizeWidthPolicyFor = layout.getResizeHeightPolicyFor = () => 'fixed';
  Object.defineProperties(layout, {
    hugContentsVertically: { value: false }, hugContentsHorizontally: { value: false }
  });
  submorphs.forEach(m => {
    m.isLayoutable = true;
    m.makeDirty = () => {};
    m._yogaNode = { _computedMargin: { top: 0, bottom: 0, left: 0, right: 0 } };
  });
  return layout;
}

describe('morphic rendering performance regressions', () => {
  it('takes one child snapshot after the container layout and visits it despite sibling mutations', () => {
    const visited = [];
    let snapshots = 0;
    const children = ['a', 'b'].map(id => ({ applyLayoutIfNeeded () { visited.push(id); } }));
    const c = { applyLayoutIfNeeded () { visited.push('c'); } };
    children[0].applyLayoutIfNeeded = () => { visited.push('a'); children.reverse(); };
    const parent = { needsRerender: () => true,
      layout: { onContainerRender () { children.push(c); } },
      get submorphs () { snapshots++; return children.concat(); } };
    Morph.prototype.applyLayoutIfNeeded.call(parent);
    expect(snapshots).equals(1);
    expect(visited).deep.equals(['a', 'b', 'c']);
  });

  it('preserves reverse preorder styling and measurements, and removal-before-addition ordering', () => {
    const a = testMorph('a'); const b = testMorph('b'); const c = testMorph('c');
    const world = testMorph('world', [a, b, c]);
    const renderer = testRenderer(world);
    const styled = []; const measured = []; const structured = [];
    const layout = { measureSubmorph (m) { measured.push(m.id); } };
    [world, a, b, c].forEach(m => { m.renderingState.cssLayoutToMeasureWith = layout; });
    a.renderingState.hasStructuralChanges = true;
    b.renderingState.hasMorphRemoved = c.renderingState.hasMorphRemoved = true;
    renderer.renderStylingChanges = m => { styled.push(m.id); m.renderingState.needsRerender = false; };
    renderer.renderStructuralChanges = m => { structured.push(m.id); };
    renderer.renderStep();
    expect(styled).deep.equals(['c', 'b', 'a', 'world', 'c', 'b', 'a', 'world']);
    expect(measured).deep.equals(['c', 'b', 'a', 'world', 'c', 'b', 'a', 'world']);
    expect(structured).deep.equals(['c', 'b', 'a']);
  });

  it('collects nested morphs without calling the array-producing traversal', () => {
    const leaf = testMorph('leaf'); const branch = testMorph('branch', [leaf]);
    const world = testMorph('world', [branch]);
    world.withAllSubmorphsDo = () => { throw new Error('Allocating traversal used'); };
    const styled = [];
    const renderer = testRenderer(world);
    renderer.renderStylingChanges = m => { styled.push(m.id); m.renderingState.needsRerender = false; };
    expect(renderer.renderStep()).equals(false);
    expect(styled).deep.equals(['leaf', 'branch', 'world']);
  });

  it('synchronizes a grid once per measurement pass while restyling every measured morph', () => {
    const a = testMorph('a'); const b = testMorph('b');
    const world = testMorph('world', [a, b]);
    const grid = gridFixture([a, b]);
    let updates = 0;
    grid.updateSubmorphViaDom = () => { updates++; };
    a.renderingState.cssLayoutToMeasureWith = b.renderingState.cssLayoutToMeasureWith = grid;
    const styled = [];
    const renderer = testRenderer(world);
    renderer.renderStylingChanges = m => { styled.push(m.id); m.renderingState.needsRerender = false; };
    renderer.renderStep();
    expect(updates).equals(4); // Two cells, two passes; previously eight updates.
    expect(styled).deep.equals(['b', 'a', 'world', 'b', 'a']);
  });

  it('does not let an ineligible grid measurement suppress later valid measurements', () => {
    const member = testMorph('member'); const grid = gridFixture([member]);
    const measured = new Set();
    let updates = 0;
    grid.updateSubmorphViaDom = () => { updates++; };
    grid.measureSubmorph(testMorph('outsider'), measured);
    expect(measured.has(grid)).equals(false);
    grid.measureSubmorph(member, measured);
    grid.measureSubmorph(member, measured);
    expect(updates).equals(1);
    grid.measureSubmorph(member); // Direct calls still measure independently.
    expect(updates).equals(2);
  });

  it('stops a coalesced render burst after the scene settles and keeps the retry budget', () => {
    for (const pendingSteps of [1, 3, Infinity]) {
      const callbacks = [];
      let steps = 0;
      const renderer = testRenderer(testMorph('world'));
      renderer.requestAnimationFrame = fn => { callbacks.push(fn); return callbacks.length; };
      renderer.renderStep = () => ++steps < pendingSteps;
      for (let i = 0; i < 100; i++) renderer.renderLater(2);
      expect(callbacks.length).equals(1);
      while (callbacks.length) callbacks.shift()();
      expect(steps).equals(Math.min(pendingSteps, 3));
    }
  });

  it('preserves a new render request made during the current render step', () => {
    const callbacks = [];
    let steps = 0;
    const renderer = testRenderer(testMorph('world'));
    renderer.requestAnimationFrame = fn => { callbacks.push(fn); return callbacks.length; };
    renderer.renderStep = () => {
      if (++steps === 1) renderer.renderLater(4);
      return false;
    };
    renderer.renderLater(0);
    while (callbacks.length) callbacks.shift()();
    expect(steps).equals(2);
    expect(renderer.renderWorldLoopLaterCounter).equals(4);
  });

  it('checks late flags and new morphs instead of only world dirtiness', () => {
    for (const flag of ['needsRerender', 'hasStructuralChanges', 'hasMorphRemoved', 'hasCSSLayoutChange',
      'cssLayoutToMeasureWith', 'animationAdded', 'needsFit', 'needsRemeasure',
      'needsScrollLayerAdded', 'needsScrollLayerRemoved', 'needsLinesToBeCleared']) {
      const world = testMorph('world');
      const renderer = testRenderer(world);
      renderer.renderStylingChanges = m => {
        m.renderingState.needsRerender = false;
        const lateChild = testMorph('late');
        lateChild.isLabel = true;
        lateChild.renderingState = { [flag]: true };
        world.submorphs.push(lateChild);
      };
      expect(renderer.renderStep(), flag).equals(true);
    }
  });

  it('clears sibling caches after a render error', () => {
    const renderer = testRenderer(testMorph('world'));
    renderer.renderStylingChanges = () => { throw new Error('failed render'); };
    expect(() => renderer.renderStep()).throws('failed render');
    expect(renderer._layoutCSSOrder).equals(null);
  });

  it('keeps z-index distinct from custom layout order and ignored morphs', () => {
    const a = { name: 'a', priority: 2 }; const b = { name: 'b', priority: 1 }; const c = { name: 'c', priority: 0 };
    const layout = tilingFixture([a, b, c], { ignore: ['b'], layoutOrder: m => m.priority });
    const first = {}; const second = {}; const ignored = {};
    layout.addSubmorphCSS(a, first);
    layout.addSubmorphCSS(c, second);
    layout.addSubmorphCSS(b, ignored);
    expect([first['z-index'], second['z-index'], ignored['z-index']]).deep.equals([0, 2, 1]);
    expect([first.order, second.order, ignored.order]).deep.equals([1, 0, -1]);
  });

  it('reuses sibling lists within a pass and invalidates on morph and layout changes', () => {
    const a = { name: 'a' }; const b = { name: 'b' }; const children = [a, b];
    const layout = tilingFixture(children);
    const cache = layout.container.env.renderer._layoutCSSOrder;
    let copies = 0;
    Object.defineProperty(layout.container, 'submorphs', { get () { copies++; return children.concat(); } });
    layout.addSubmorphCSS(a, {});
    const firstCopies = copies;
    layout.addSubmorphCSS(b, {});
    expect(copies).equals(firstCopies);
    children.reverse();
    layout.onSubmorphChange(a, { prop: 'name', meta: {} });
    expect(cache.has(layout)).equals(false);
    const reordered = {};
    layout.addSubmorphCSS(a, reordered);
    expect(reordered['z-index']).equals(1);
    expect(reordered.order).equals(1);
    layout.onChange({ prop: 'name', meta: {} });
    expect(cache.has(layout)).equals(false);
    layout.addSubmorphCSS(a, {});
    layout.onConfigUpdate();
    expect(cache.has(layout)).equals(false);
  });

  it('does not retain sibling order between direct calls outside a render pass', () => {
    const a = { name: 'a' }; const b = { name: 'b' }; const children = [a, b];
    const layout = tilingFixture(children);
    layout.container.env.renderer._layoutCSSOrder = null;
    const first = {}; const second = {};
    layout.addSubmorphCSS(a, first);
    children.reverse();
    layout.addSubmorphCSS(a, second);
    expect(first.order).equals(0);
    expect(second.order).equals(1);
  });

  it('settles a real DOM scene and synchronizes nested CSS grids after resize', async () => {
    const env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
    try {
      const plain = new Morph({ extent: pt(20, 20) });
      const nested = new Morph({ name: 'nested', layout: new GridLayout({ grid: [['inner']], fitToCell: true }),
        submorphs: [new Morph({ name: 'inner', extent: pt(10, 10) })] });
      const grid = new Morph({ extent: pt(200, 100),
        layout: new GridLayout({ grid: [['nested', 'sibling']], fitToCell: true }),
        submorphs: [nested, new Morph({ name: 'sibling', extent: pt(10, 10) })] });
      const world = morph({ type: 'world', extent: pt(500, 300), submorphs: [plain, grid] });
      await env.setWorld(world);
      const settled = () => !env.renderer.renderWorldLoopLater && !world.needsRerender();
      await promise.waitFor(2000, settled);
      const renderStep = env.renderer.renderStep.bind(env.renderer);
      let steps = 0;
      env.renderer.renderStep = () => { steps++; return renderStep(); };
      plain.position = pt(15, 25);
      await promise.waitFor(2000, settled);
      expect(steps).equals(1);
      const plainNode = env.renderer.getNodeForMorph(plain);
      expect(pt(plainNode.offsetLeft, plainNode.offsetTop)).equals(plain.position);
      grid.width = 400;
      await promise.waitFor(2000, settled);
      for (const m of [nested, nested.submorphs[0], grid.submorphs[1]]) {
        const node = env.renderer.getNodeForMorph(m);
        expect(m.width).equals(node.offsetWidth);
        expect(m.height).equals(node.offsetHeight);
        expect(m.position).equals(pt(node.offsetLeft, node.offsetTop));
      }
      expect(nested.width).equals(200);
      expect(nested.submorphs[0].width).equals(200);
      expect(await nested.whenRendered()).equals(true);
    } finally {
      MorphicEnv.popDefault().uninstall();
    }
  });

});
