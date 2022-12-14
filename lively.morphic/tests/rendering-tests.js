/* global it, describe, beforeEach, afterEach,System */
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { morph, MorphicEnv } from '../index.js';
import { expect } from 'mocha-es6';
import { pt, Color, rect } from 'lively.graphics';
import { num, promise } from 'lively.lang';

let env;
let world, submorph1, submorph2, submorph3, image, ellipse;
function createDummyWorld () {
  world = morph({
    type: 'world',
    name: 'world',
    extent: pt(300, 300),
    submorphs: [{
      name: 'submorph1',
      extent: pt(100, 100),
      position: pt(10, 10),
      fill: Color.red,
      submorphs: [{ name: 'submorph2', extent: pt(20, 20), position: pt(5, 10), fill: Color.green }]
    },
    { name: 'submorph3', extent: pt(50, 50), position: pt(200, 20), fill: Color.yellow },
    { type: 'image', name: 'image', extent: pt(80, 80), position: pt(20, 200), fill: Color.lightGray },
    { type: 'ellipse', name: 'ellipse', extent: pt(50, 50), position: pt(200, 200), fill: Color.pink }
    ]
  });
  image = world.submorphs[2];
  ellipse = world.submorphs[3];
  submorph1 = world.submorphs[0];
  submorph2 = world.submorphs[0].submorphs[0];
  submorph3 = world.submorphs[1];
  return world;
}

describe('rendering', function () {
  // jsdom sometimes takes its time to initialize...
  if (System.get('@system-env').node) { this.timeout(10000); }

  beforeEach(async () => env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment())).setWorld(createDummyWorld()));
  afterEach(() => MorphicEnv.popDefault().uninstall());

  it('morph id is DOM node id', () => {
    expect(world.id).equals(env.renderer.rootNode.id);
  });

  it('can be moved to the front', () => {
    submorph1.bringToFront();
    expect(world.submorphs).equals([submorph3, image, ellipse, submorph1]);
  });

  describe('transforms', () => {
    it('scale and rotation are rendered', async () => {
      submorph1.rotateBy(num.toRadians(45));
      submorph1.renderOnGPU = true;
      env.forceUpdate();
      expect(env.renderer.getNodeForMorph(submorph1)).deep.property('style.transform')
        .match(/translate.*10px/)
        .match(/rotate\((0.8|0\.79+)rad\)/)
        .match(/scale\(1,\s*1\)/);
    });

    it('origin rendered via origin transform', async () => {
      submorph1.origin = pt(20, 10);
      env.forceUpdate();
      expect(env.renderer.getNodeForMorph(submorph1))
        .deep.property('style.transformOrigin').match(/20px 10px/);
    });
  });

  describe('shapes', () => {
    beforeEach(() => {
      env.forceUpdate(); // ensure scene rendered
    });

    it('shape influences node style', () => {
      const style = env.renderer.getNodeForMorph(ellipse).style;
      expect(style.borderRadius).match(/50%/);
      expect(style.position).equals('absolute');
    });

    it('morph type influences node structure', () => {
      const ellipseNode = env.renderer.getNodeForMorph(ellipse);
      const imageNode = env.renderer.getNodeForMorph(image);
      expect(ellipseNode.nodeName).equals('DIV');
      expect(imageNode.childNodes[0].nodeName).equals('IMG');
    });

    it('morph type influences node attributes', () => {
      const ellipseNode = env.renderer.getNodeForMorph(ellipse);
      const imageNode = env.renderer.getNodeForMorph(image);
      expect(ellipseNode).not.to.have.property('src');
      expect(imageNode.childNodes[0]).to.have.property('src');
    });
  });

  describe('scroll', () => {
    it('scroll extent', () => {
      const HTMLScrollbarOffset = pt(15, 15);
      expect(submorph1.scrollExtent).equals(pt(100, 100).addPt(HTMLScrollbarOffset), '1');
      submorph1.clipMode = 'auto';
      expect(submorph1.scrollExtent).equals(pt(100, 100).addPt(HTMLScrollbarOffset), '2');
      submorph2.extent = pt(200, 200);
      submorph2.bounds().bottomRight();
      expect(submorph1.scrollExtent)
        .equals(submorph2.extent.addPt(submorph2.position).addPt(HTMLScrollbarOffset), '3');
    });

    it('scroll is bounded', () => {
      const HTMLScrollbarOffset = pt(15, 15);
      submorph1.clipMode = 'auto';
      submorph2.extent = pt(200, 200);
      submorph1.scroll = pt(100000, 100000);
      expect(submorph1.scroll).equals(submorph2.bounds().bottomRight().subPt(submorph1.extent).addPt(HTMLScrollbarOffset), '1');
      submorph1.scroll = pt(-100000, -100000);
      expect(submorph1.scroll).equals(pt(0, 0), '2');
    });

    it('clip morph can specify scroll', () => {
      submorph1.clipMode = 'auto';
      submorph2.extent = pt(200, 200);
      submorph1.scroll = pt(40, 50);
      env.forceUpdate();
      let node = env.renderer.getNodeForMorph(submorph1);
      expect(node.style.overflow).equals('auto');
      expect(node.scrollLeft).equals(40);
      expect(node.scrollTop).equals(50);
    });

    it('inner morphs have correct transform', async () => {
      submorph1.clipMode = 'auto';
      submorph2.extent = pt(200, 200);
      let submorph2Bounds = submorph2.globalBounds();
      submorph1.scroll = pt(40, 50);
      env.forceUpdate();
      expect(submorph1.globalBounds()).equals(rect(10, 10, 100, 100));
      expect(submorph1.bounds()).equals(rect(10, 10, 100, 100));
      expect(submorph2.globalBounds()).equals(submorph2Bounds.translatedBy(submorph1.scroll.negated()));
      submorph1.scroll = pt(0, 0);
      expect(submorph2.globalBounds()).equals(submorph2Bounds);
    });

    it('updates scroll of DOM nodes of morphs and their siblings when morph moves in scene graph', async () => {
      // ref: https://github.com/LivelyKernel/lively.morphic/issues/55

      world.submorphs = [
        {
          position: pt(0, 0),
          extent: pt(100, 100),
          submorphs: [{ position: pt(75, 75), extent: pt(125, 125) }],
          fill: Color.blue,
          clipMode: 'auto',
          scroll: pt(50, 50)
        },
        {
          position: pt(100, 0),
          extent: pt(100, 100),
          submorphs: [{ position: pt(75, 75), extent: pt(125, 125) }],
          fill: Color.green,
          clipMode: 'auto',
          scroll: pt(50, 50)
        }];
      let [m1, m2] = world.submorphs;
      env.forceUpdate();
      m1.scroll = m2.scroll = pt(50, 50); // this is wrong
      await promise.delay(50);

      let node1 = env.renderer.getNodeForMorph(m1);
      expect(node1.scrollLeft).equals(50, 'm1 scrollLeft after setup');
      expect(node1.scrollTop).equals(50, 'm1 scrollTop after setup');
      let node2 = env.renderer.getNodeForMorph(m2);
      expect(node2.scrollLeft).equals(50, 'm2 scrollLeft after setup');
      expect(node2.scrollTop).equals(50, 'm2 scrollTop after setup');

      m1.bringToFront();
      await promise.delay(500);
      node1 = env.renderer.getNodeForMorph(m1);
      expect(node1.scrollLeft).equals(50, 'm1 scrollLeft 1');
      expect(node1.scrollTop).equals(50, 'm1 scrollTop 1');
      node2 = env.renderer.getNodeForMorph(m2);
      expect(node2.scrollLeft).equals(50, 'm2 scrollLeft 1');
      expect(node2.scrollTop).equals(50, 'm2 scrollTop 1');

      m2.bringToFront();
      await promise.delay(50);
      node1 = env.renderer.getNodeForMorph(m1);
      expect(node1.scrollLeft).equals(50, 'm1 scrollLeft 2');
      expect(node1.scrollTop).equals(50, 'm1 scrollTop 2');
      node2 = env.renderer.getNodeForMorph(m2);
      expect(node2.scrollLeft).equals(50, 'm2 scrollLeft 2');
      expect(node2.scrollTop).equals(50, 'm2 scrollTop 2');
    });
  });
});
