/* global it, describe, beforeEach, afterEach, System */
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { MorphicEnv } from '../index.js';
import { expect } from 'mocha-es6';
import { morph } from '../index.js';
import { HTMLMorph } from '../html-morph.js';
import { pt } from 'lively.graphics';

let world, env;
function createDummyWorld () {
  return world = morph({ type: 'world', name: 'world', extent: pt(300, 300), env });
}

describe('html morph', function () {
  // jsdom sometimes takes its time to initialize...
  if (System.get('@system-env').node) { this.timeout(10000); }

  beforeEach(async () => env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment())).setWorld(createDummyWorld()));
  afterEach(() => MorphicEnv.popDefault().uninstall());

  it('renders html', async () => {
    let m = world.addMorph(new HTMLMorph({ html: '<div>This is a <h2>test</h2></div>', env }));
    world.env.forceUpdate();
    expect(m.domNode.innerHTML).equals('<div>This is a <h2>test</h2></div>', 'initial rendering wrong');
    expect(m.domNode.parentNode).equals(env.renderer.getNodeForMorph(m), 'rendered node not child node of morph node');
    let node = m.domNode;
    m.position = pt(10, 20);
    expect(m.domNode).equals(node, 'node not the same after morph change');
    expect(m.domNode.parentNode).equals(env.renderer.getNodeForMorph(m), 'custom node child node of morph node after change');
  });
});
