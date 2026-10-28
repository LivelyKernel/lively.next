/* global beforeEach, afterEach, describe, it */
import { expect } from 'mocha-es6';
import { Morph, part } from 'lively.morphic';
import { pt, rect } from 'lively.graphics';
import { WorldMiniMap } from '../world-mini-map.cp.js';

describe('world minimap geometry', () => {
  let map, model, originalWorld, owner;

  beforeEach(() => {
    map = part(WorldMiniMap);
    model = map.viewModel;
    originalWorld = globalThis.$world;
  });

  afterEach(() => {
    globalThis.$world = originalWorld;
    owner?.remove();
    owner = null;
    map.remove();
  });

  /** Provide controlled canvas coordinates for navigation-only checks. */
  function setWorld (morphs, scale = 1, offset = pt(0, 0)) {
    globalThis.$world = {
      scaleFactor: scale,
      morphsInWorld: morphs,
      morphsInWorldWithSubmorphs: morphs.flatMap(m => m.withAllSubmorphsSelect(() => true)),
      screenToWorld: p => p.scaleBy(1 / scale).addPt(offset),
      windowBounds: () => rect(0, 0, 400, 300),
      topLeft: pt(0, 0),
      bottomRight: pt(400, 300)
    };
    model.ratio = 4 / 3;
    map.extent = pt(300, 225);
  }

  for (const nested of [false, true]) {
    it('paints the transformed own box with ' + (nested ? 'nested transforms and canvas zoom' : 'a nonzero origin'), async () => {
      const parent = new Morph({ position: pt(150, 100), origin: pt(35, 20), extent: pt(80, 60), rotation: nested ? Math.PI / 3 : 0, scale: nested ? 2 : 1 });
      const target = nested
        ? parent.addMorph(new Morph({ position: pt(30, 20), origin: pt(10, 5), extent: pt(25, 15), rotation: -Math.PI / 4, scale: 1.5 }))
        : parent;
      setWorld([parent], nested ? 2 : 1, nested ? pt(20, 30) : pt(0, 0));
      const rendered = [];
      const render = model.renderMorphPreviewOnCanvas;
      model.renderMorphPreviewOnCanvas = function (morph, x, y, width, height, context) {
        render.call(this, morph, x, y, width, height, context);
        if (morph !== target) return;
        const transform = context.getTransform();
        for (const point of [pt(x, y), pt(x + width, y), pt(x, y + height), pt(x + width, y + height)]) {
          rendered.push(pt(transform.a * point.x + transform.c * point.y + transform.e, transform.b * point.x + transform.d * point.y + transform.f));
        }
      };
      await model.drawMorphs();
      const ownBox = target.origin.negated().extent(target.extent);
      const expected = [ownBox.topLeft(), ownBox.topRight(), ownBox.bottomLeft(), ownBox.bottomRight()].map(point => {
        const position = $world.screenToWorld(target.getGlobalTransform().transformPoint(point));
        return pt(model.widthFromCanvasSpaceToMapSpace(position.x + model.balanceNegativeLeft + model.widthCorrection / 2), model.heightFromCanvasSpaceToMapSpace(position.y + model.balanceNegativeTop + model.heightCorrection / 2));
      });
      expect(rendered.length).equals(4);
      rendered.forEach(point => expect(Math.min(...expected.map(corner => point.dist(corner)))).below(0.001));
    });
  }

  it('includes transformed outlying children in the map area', () => {
    const parent = new Morph({ position: pt(40, 40), extent: pt(30, 30) });
    const child = parent.addMorph(new Morph({ position: pt(-200, -150), origin: pt(20, 10), extent: pt(50, 40), rotation: Math.PI / 4, scale: 2 }));
    setWorld([parent]);
    model.updateMapSpace();
    const bounds = child.globalBounds();
    expect(model.balanceNegativeLeft).closeTo(-bounds.left(), 0.001);
    expect(model.balanceNegativeTop).closeTo(-bounds.top(), 0.001);
  });

  for (const transformed of [false, true]) {
    it('matches actual rendered bounds for origins' + (transformed ? ' under nested rotation and scale' : ''), async () => {
      owner = new Morph({ position: pt(150, 100), origin: pt(35, 20), extent: pt(80, 60),
        rotation: transformed ? Math.PI / 5 : 0, scale: transformed ? 1.5 : 1 }).openInWorld();
      const child = owner.addMorph(new Morph({ position: pt(10, 10), origin: pt(8, 4), extent: pt(25, 20),
        rotation: transformed ? -Math.PI / 7 : 0, scale: transformed ? 0.8 : 1 }));
      model.ratio = 4 / 3;
      map.extent = pt(300, 225);
      owner.env.forceUpdate();
      const painted = new Map();
      const render = model.renderMorphPreviewOnCanvas;
      model.renderMorphPreviewOnCanvas = function (morph, x, y, width, height, context) {
        render.call(this, morph, x, y, width, height, context);
        if (morph !== owner && morph !== child) return;
        const t = context.getTransform();
        const points = [pt(x, y), pt(x + width, y), pt(x, y + height), pt(x + width, y + height)]
          .map(p => pt(t.a * p.x + t.c * p.y + t.e, t.b * p.x + t.d * p.y + t.f));
        painted.set(morph, [pt(Math.min(...points.map(p => p.x)), Math.min(...points.map(p => p.y))),
          pt(Math.max(...points.map(p => p.x)), Math.max(...points.map(p => p.y)))]);
      };
      await model.drawMorphs();
      const worldDOM = $world.env.renderer.getNodeForMorph($world).getBoundingClientRect();
      for (const morph of [owner, child]) {
        const dom = morph.env.renderer.getNodeForMorph(morph).getBoundingClientRect();
        const expected = [pt(dom.left - worldDOM.left, dom.top - worldDOM.top), pt(dom.right - worldDOM.left, dom.bottom - worldDOM.top)]
          .map(p => $world.screenToWorld(p))
          .map(p => pt(model.widthFromCanvasSpaceToMapSpace(p.x + model.balanceNegativeLeft + model.widthCorrection / 2),
            model.heightFromCanvasSpaceToMapSpace(p.y + model.balanceNegativeTop + model.heightCorrection / 2)));
        expect(painted.has(morph)).equals(true);
        painted.get(morph).forEach((point, index) => expect(point.dist(expected[index])).below(0.5, 'canvas preview must match the DOM renderer'));
      }
    });
  }

  it('keeps the viewport stroke visible at different world scales and sizes', async () => {
    const widths = [];
    const render = model.renderMorphPreviewOnCanvas;
    model.renderMorphPreviewOnCanvas = function (morph, x, y, width, height, context) {
      render.call(this, morph, x, y, width, height, context);
      if (morph.name === 'viewport') {
        const transform = context.getTransform();
        widths.push(context.lineWidth * Math.hypot(transform.a, transform.b));
      }
    };
    for (const size of [400, 40000]) {
      for (const scale of [1, 2]) {
        setWorld([new Morph({ extent: pt(size, size) })], scale);
        await model.drawMorphs();
      }
    }
    expect(widths.length).equals(4);
    widths.forEach(width => expect(width).closeTo(2, 0.001));
  });

  it('keeps the viewport and map navigation aligned while zoomed and scrolled', () => {
    setWorld([], 2, pt(-90, 80));
    model.updateMapSpace();
    const viewport = model.createCurrentViewPortMorph();
    const bounds = viewport.getGlobalTransform().transformRectToRect(viewport.innerBounds());
    expect(bounds).equals($world.windowBounds());
    for (const screenPoint of [bounds.topLeft(), bounds.bottomRight()]) {
      const position = $world.screenToWorld(screenPoint);
      const x = model.widthFromCanvasSpaceToMapSpace(position.x + model.balanceNegativeLeft + model.widthCorrection / 2);
      const y = model.heightFromCanvasSpaceToMapSpace(position.y + model.balanceNegativeTop + model.heightCorrection / 2);
      expect(model.xFromMapSpaceToCanvasSpace(x)).closeTo(position.x, 0.001);
      expect(model.yFromMapSpaceToCanvasSpace(y)).closeTo(position.y, 0.001);
    }
  });
});
