/* global System, it, describe, beforeEach, afterEach */

import { World, MorphicEnv } from 'lively.morphic';
import { pt } from 'lively.graphics';
import { expect } from 'mocha-es6';
import { NumberWidget } from '../value-widgets.js';
import { createDOMEnvironment } from 'lively.morphic/rendering/dom-helper.js';

let env, field;
async function createMorphicEnv () {
  if (System.get('@system-env').browser) {
    env = MorphicEnv.default();
    return;
  }
  env = new MorphicEnv(await createDOMEnvironment());
  env.domEnv.document.body.style = 'margin: 0';
  MorphicEnv.pushDefault(env);
  await env.setWorld(new World({ name: 'world', extent: pt(300, 300) }));
}

async function destroyMorphicEnv () {
  if (field) field.remove();
  if (System.get('@system-env').browser) return;
  MorphicEnv.popDefault().uninstall();
}

describe('number widget', () => {
  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it('it fits bounds to content', async () => {
    field = new NumberWidget({
      autofit: true, number: 0.5, min: 0, max: 1, floatingPoint: true
    });
    let valueContainer = field.getSubmorphNamed('value');
    env.world.addMorph(field);
    await field.whenRendered();
    expect(valueContainer.fixedWidth).to.be.true;
    expect(field.bounds()).equals(field.submorphBounds());
    expect(field.width).equals(field.getSubmorphNamed('value').width + 20);
    expect(field.height).equals(field.getSubmorphNamed('value').height);
    expect(field.width).equals(field.getSubmorphNamed('up').right);
    expect(field.width).equals(field.getSubmorphNamed('down').right);
  });

  it('it allows to resize widgets', async () => {
    field = new NumberWidget({
      autofit: false, number: 0.5, min: 0, max: 1, floatingPoint: true, width: 100, height: 25
    });
    let valueContainer = field.getSubmorphNamed('value');
    env.world.addMorph(field);
    await field.whenRendered();
    expect(field.width).equals(100, 'field has width');
    expect(field.height).equals(25, 'filed has height');
    expect(valueContainer.scaleToBounds).to.be.true;
    expect(valueContainer.fixedWidth).to.be.true;
    field.layout.forceLayout();
    // all the other invariants apply as well
    expect(field.width).equals(field.getSubmorphNamed('value').width + 20, 'value container stretches across field');
    expect(field.width).equals(field.getSubmorphNamed('up').right, 'up button aligned correctly');
    expect(field.width).equals(field.getSubmorphNamed('down').right, 'down button aligned correctly');
  });

  it('keeps bounds on copy', async () => {
    field = new NumberWidget({
      autofit: false,
      number: 0.5,
      min: 0,
      max: 1,
      floatingPoint: false,
      width: 100,
      height: 25
    });
    env.world.addMorph(field);
    await field.whenRendered();
    expect(field.width).equals(100, 'width before');

    field.remove();
    env.world.addMorph(field = field.copy());
    await field.whenRendered();

    expect(field.width).equals(100, 'width after');
    expect(field.height).equals(25);
  });
});
