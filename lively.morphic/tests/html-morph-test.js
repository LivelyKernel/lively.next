/* global it, describe, before, after */
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { createDOMEnvironment } from '../rendering/dom-helper.js';
import { MorphicEnv } from '../index.js';
import { expect } from 'mocha-es6';
import { morph } from '../index.js';
import { HTMLMorph } from '../html-morph.js';
import { pt } from 'lively.graphics';

let world, env, m;
function createDummyWorld () {
  return world = morph({ type: 'world', name: 'world', extent: pt(300, 300), env });
}

describe('html morph', function () {
  before(async () => env = await MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment())).setWorld(createDummyWorld()));
  after(() => {
    MorphicEnv.popDefault().uninstall();
    m.remove();
  });

  it('renders html', async () => {
    m = world.addMorph(new HTMLMorph({ html: '<div>This is a <h2>test</h2></div>', env }));
    world.env.forceUpdate();
    expect(m.domNode.innerHTML).equals('<div>This is a <h2>test</h2></div>', 'initial rendering wrong');
    expect(m.domNode.parentNode).equals(env.renderer.getNodeForMorph(m), 'rendered node not child node of morph node');
    let node = m.domNode;
    m.position = pt(10, 20);
    expect(m.domNode).equals(node, 'node not the same after morph change');
    expect(m.domNode.parentNode).equals(env.renderer.getNodeForMorph(m), 'custom node child node of morph node after change');
  });

  it('mounts and removes custom CSS node', async () => {
    m = world.addMorph(new HTMLMorph({ html: '<div>This is a <h2>test</h2></div>', env, name: 'testMorph' }));
    m.cssDeclaration = '.p { background: green; }';
    world.env.forceUpdate();
    const id = m.id;
    let cssNode = env.domEnv.document.getElementById('css-for-' + id);
    expect(cssNode).to.be.ok;
    m.remove();
    world.env.forceUpdate();
    cssNode = env.domEnv.document.getElementById('css-for-' + id);
    expect(cssNode).to.not.be.ok;
  });
});
