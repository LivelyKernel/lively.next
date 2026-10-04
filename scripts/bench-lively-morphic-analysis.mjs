// ponytail: synthetic fixtures exclude DOM costs; validate frame gains with a browser trace.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import * as arr from '../lively.lang/array.js';
import * as tree from '../lively.lang/tree.js';

const root = new URL('../', import.meta.url);
const baseline = process.argv[2] || 'd62a66be8';
function sourceMethod (file, name, before = false, className) {
  let source = before
    ? execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' })
    : readFileSync(new URL(file, root), 'utf8');
  if (className) source = source.slice(source.indexOf(`export class ${className}`));
  const match = source.match(new RegExp(`^  ${name} [(][^]*?^  [}]`, 'm'));
  assert(match, `Cannot find ${name}; update extraction if source formatting changes`);
  return match[0];
}
const compile = source => new Function('arr', 'tree', `return ({${source}})`)(arr, tree);
const method = (file, name, before = false, className) => compile(sourceMethod(file, name, before, className))[name];
const morphFile = 'lively.morphic/morph.js';
const rendererFile = 'lively.morphic/rendering/renderer.js';
const layoutFile = 'lively.morphic/layout.js';
const traversal = method(morphFile, 'withAllSubmorphsDo');

function medianMs (fn) {
  for (let i = 0; i < 3; i++) fn();
  const samples = [];
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    for (let j = 0; j < 3; j++) fn();
    samples.push((performance.now() - start) / 3);
  }
  return samples.sort((a, b) => a - b)[3];
}
const timings = []; const counts = [];
function compare (scenario, before, after) {
  const baselineMs = medianMs(before); const implementedMs = medianMs(after);
  timings.push({ scenario, baselineMs: +baselineMs.toFixed(3), implementedMs: +implementedMs.toFixed(3) });
}

const beforeLayout = method(morphFile, 'applyLayoutIfNeeded', true);
const afterLayout = method(morphFile, 'applyLayoutIfNeeded');
for (const width of [1000, 5000, 10000]) {
  let copies = 0; let visits = 0;
  const children = Array.from({ length: width }, () => ({ applyLayoutIfNeeded () { visits++; } }));
  const parent = { needsRerender: () => true, get submorphs () { copies++; return children.concat(); } };
  beforeLayout.call(parent);
  assert.equal(copies, 2 * width + 1); assert.equal(visits, width);
  copies = visits = 0;
  afterLayout.call(parent);
  assert.equal(copies, 1); assert.equal(visits, width);
  counts.push({ scenario: `layout ${width} children`, baselineCopies: 2 * width + 1, implementedCopies: copies });
  compare(`layout ${width} children`, () => beforeLayout.call(parent), () => afterLayout.call(parent));
}
for (const depth of [100, 1000]) {
  let rootNode = null;
  for (let id = depth - 1; id >= 0; id--) {
    const children = rootNode ? [rootNode] : [];
    rootNode = { id, get submorphs () { return children.concat(); }, withAllSubmorphsDo: traversal };
  }
  const collect = () => { const result = []; tree.prewalk(rootNode, m => result.push(m), m => m.submorphs); return result; };
  assert.deepEqual(rootNode.withAllSubmorphsDo(m => m), collect());
  compare(`traversal chain ${depth} nodes`, () => rootNode.withAllSubmorphsDo(m => m), collect);
}

const beforeRender = method(rendererFile, 'renderStep', true);
const afterRender = method(rendererFile, 'renderStep');
const emptyRenderQueues = method(rendererFile, 'emptyRenderQueues');
function rendererFixture (size, trace, mixed = false, layout) {
  const log = (kind, morph) => { if (trace) trace.push(`${kind}:${morph.id}`); };
  layout ||= { measureSubmorph (m) { log('measure', m); } };
  const morphs = Array.from({ length: Math.max(size, 1) }, (_, id) => ({ id, submorphs: [],
    renderingState: {}, applyLayoutIfNeeded () {}, withAllSubmorphsDo: traversal }));
  morphs[0].submorphs = morphs.slice(1);
  const renderer = { emptyRenderQueues, worldMorph: morphs[0], morphs,
    reset () {
      for (const m of morphs) m.renderingState = { needsRerender: !mixed || m.id % 2 === 0,
        cssLayoutToMeasureWith: layout, hasStructuralChanges: mixed && m.id % 3 === 0,
        hasMorphRemoved: mixed && m.id % 5 === 0, animationAdded: mixed && m.id % 4 === 0,
        hasCSSLayoutChange: mixed && m.id % 6 === 0 };
    },
    renderMap: new WeakMap(morphs.map(m => [m, {}])), renderFixedMorphs () {}, renderMorph (m) { log('create', m); },
    renderLayoutChange (m) { log('layout', m); m.renderingState.hasCSSLayoutChange = false; },
    renderStylingChanges (m) { log('style', m); m.renderingState.needsRerender = false; },
    renderStructuralChanges (m) { log('structure', m); m.renderingState.hasStructuralChanges = m.renderingState.hasMorphRemoved = false; },
    handleAddedAnimationChange (m) { log('animation', m); m.renderingState.animationAdded = false; }
  };
  renderer.reset();
  return renderer;
}
for (const size of [1, 12]) {
  const before = []; const after = [];
  beforeRender.call(rendererFixture(size, before, true));
  afterRender.call(rendererFixture(size, after, true));
  assert.deepEqual(after, before, 'Preserve styling, measurement, removal, and animation order');
}
for (const size of [1000, 5000, 10000]) {
  const renderer = rendererFixture(size);
  compare(`renderer control ${size} dirty and measured morphs`,
    () => { renderer.reset(); beforeRender.call(renderer); },
    () => { renderer.reset(); afterRender.call(renderer); });
}

function gridFixture (size, before) {
  const grid = compile(sourceMethod(layoutFile, 'measureSubmorph', before, 'GridLayout') + ',\n' +
    sourceMethod(layoutFile, 'onDomResize', before, 'GridLayout'));
  grid.container = {}; grid.layoutableSubmorphs = [];
  grid.cellGroups = Array.from({ length: size }, () => ({ morph: {}, resize: true }));
  grid.getNodeFor = () => ({});
  grid.updateContainerViaDom = () => {};
  grid.updates = 0;
  grid.updateSubmorphViaDom = () => { grid.updates++; };
  return grid;
}
for (const size of [100, 1000]) {
  const beforeGrid = gridFixture(size, true); const afterGrid = gridFixture(size, false);
  const before = rendererFixture(size, null, false, beforeGrid); const after = rendererFixture(size, null, false, afterGrid);
  beforeGrid.layoutableSubmorphs = before.morphs; afterGrid.layoutableSubmorphs = after.morphs;
  beforeRender.call(before); afterRender.call(after);
  assert.equal(beforeGrid.updates, 2 * size * size); assert.equal(afterGrid.updates, 2 * size);
  counts.push({ scenario: `grid ${size} measured morphs/cells`, baselineCellUpdates: beforeGrid.updates,
    implementedCellUpdates: afterGrid.updates });
  compare(`grid ${size} measured morphs/cells`,
    () => { before.reset(); beforeRender.call(before); }, () => { after.reset(); afterRender.call(after); });
}

for (const size of [100, 1000]) {
  const submorphs = Array.from({ length: size }, () => ({ isLayoutable: true,
    _yogaNode: { _computedMargin: { top: 0, bottom: 0, left: 0, right: 0 } } }));
  const beforeCSS = method(layoutFile, 'addSubmorphCSS', true, 'TilingLayout');
  const afterCSS = method(layoutFile, 'addSubmorphCSS', false, 'TilingLayout');
  let copies = 0;
  const layout = { axis: 'row', hugContentsVertically: false, hugContentsHorizontally: false,
    container: { get submorphs () { copies++; return submorphs.concat(); }, env: { renderer: {} }, scrollbarVisible: {} },
    get layoutableSubmorphs () { copies++; return submorphs.concat(); },
    getResizeWidthPolicyFor: () => 'fixed', getResizeHeightPolicyFor: () => 'fixed' };
  const styleAll = fn => {
    layout.container.env.renderer._layoutCSSOrder = new WeakMap();
    return submorphs.map(m => { const style = {}; fn.call(layout, m, style); return style; });
  };
  const after = styleAll(afterCSS);
  assert.equal(copies, 2);
  copies = 0;
  assert.deepEqual(after, styleAll(beforeCSS));
  assert.equal(copies, 2 * size);
  counts.push({ scenario: `tiling CSS ${size} siblings`, baselineListCopies: copies, implementedListCopies: 2 });
  compare(`tiling CSS ${size} siblings (precomputed layoutable list)`, () => styleAll(beforeCSS), () => styleAll(afterCSS));
}

function scheduledSteps (before) {
  const callbacks = []; let steps = 0;
  const scheduler = { renderLater: method(rendererFile, 'renderLater', before),
    requestAnimationFrame (fn) { callbacks.push(fn); return callbacks.length; }, renderStep () { steps++; return false; } };
  for (let i = 0; i < 100; i++) scheduler.renderLater();
  assert.equal(callbacks.length, 1, 'Frame requests must coalesce');
  while (callbacks.length) callbacks.shift()();
  return steps;
}
assert.equal(scheduledSteps(true), 11); assert.equal(scheduledSteps(false), 1);
console.log(JSON.stringify({ baseline, node: process.version, platform: process.platform, arch: process.arch,
  method: '3 warmup calls; median of 7 batches of 3 calls; synthetic fixtures; no DOM',
  counts, settledRenderLaterSteps: { baseline: 11, implemented: 1 }, orderChecks: 'passed', timings }, null, 2));
