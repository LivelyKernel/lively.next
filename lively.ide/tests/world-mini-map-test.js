/* global beforeEach, afterEach, describe, it */
import { expect } from 'mocha-es6';
import { Morph, part } from 'lively.morphic';
import { pt, rect } from 'lively.graphics';
import { WorldMiniMap } from '../world-mini-map.cp.js';

describe('world minimap geometry', () => {
  let map, model, originalWorld;

  beforeEach(() => {
    map = part(WorldMiniMap);
    model = map.viewModel;
    originalWorld = globalThis.$world;
  });

  afterEach(() => {
    globalThis.$world = originalWorld;
    map.remove();
  });

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
      const expected = [pt(0, 0), pt(target.width, 0), pt(0, target.height), target.extent].map(point => {
        const position = $world.screenToWorld(target.getGlobalTransform().transformPoint(point));
        return pt(model.widthFromCanvasSpaceToMapSpace(position.x + model.balanceNegativeLeft + model.widthCorrection / 2), model.heightFromCanvasSpaceToMapSpace(position.y + model.balanceNegativeTop + model.heightCorrection / 2));
      });
      expect(rendered.length).equals(4);
      rendered.forEach((point, index) => expect(point.dist(expected[index])).below(0.001));
    });
  }

  it('includes transformed outlying children in the map area', () => {
    const parent = new Morph({ position: pt(40, 40), extent: pt(30, 30) });
    const child = parent.addMorph(new Morph({ position: pt(-200, -150), origin: pt(20, 10), extent: pt(50, 40), rotation: Math.PI / 4, scale: 2 }));
    setWorld([parent]);
    model.updateMapSpace();
    const bounds = child.getGlobalTransform().transformRectToRect(child.innerBounds());
    expect(model.balanceNegativeLeft).closeTo(-bounds.left(), 0.001);
    expect(model.balanceNegativeTop).closeTo(-bounds.top(), 0.001);
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
