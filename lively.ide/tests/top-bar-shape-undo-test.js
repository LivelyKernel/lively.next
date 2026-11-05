/* global describe, it, beforeEach, afterEach, System, xdescribe */
import { expect } from 'mocha-es6';
import { signal } from 'lively.bindings';
import { Color, pt } from 'lively.graphics';
import { MorphicEnv, component, morph, part } from 'lively.morphic';
import { without } from 'lively.morphic/components/core.js';
import { LivelyWorld } from '../world.js';
import { TopBar } from '../studio/top-bar.cp.js';

const describeInBrowser = System.get('@system-env').browser ? describe : xdescribe;
const ShapeTestTopBar = component(TopBar, { submorphs: [without('right UI wrapper')] });

describeInBrowser('top bar shape creation undo', () => {
  let env, world, model, previousWorld, previousRenderer, hand, root;

  beforeEach(() => {
    env = world = model = hand = root = null;
    previousWorld = System.global.$world;
    previousRenderer = System.global.renderer;
    // The browser already has morphic CSS. Use its document without another
    // iframe stylesheet request in every beforeEach hook.
    env = MorphicEnv.pushDefault(new MorphicEnv());
    root = env.domEnv.document.createElement('div');
    env.domEnv.document.body.appendChild(root);
    world = morph({ type: LivelyWorld, extent: pt(1000, 1000) });
    env.setWorld(world, root);
    System.global.$world = world;
    // Login/network widgets start unrelated async work after their world closes.
    const topBar = part(ShapeTestTopBar);
    world.addMorph(topBar);
    model = topBar.viewModel;
    model.attachToTarget(world);
    hand = world.handForPointerId(1);
    hand.position = pt(200, 200);
    env.undoManager.reset();
  });

  afterEach(async () => {
    try {
      if (world) {
        // Finish font-triggered fits before uninstalling their renderer and metrics.
        const texts = world.withAllSubmorphsDo(m => m).filter(m => m.isText);
        await Promise.all(texts.map(m => m.whenFontLoaded()));
        env.forceUpdate();
        await env.whenRendered(world);
      }
    } finally {
      try {
        model?.detachFromTarget(world);
      } finally {
        if (env) {
          if (MorphicEnv.default() === env) MorphicEnv.popDefault();
          env.uninstallSystemChangeHandlers();
          env.renderer?.placeholder?.remove();
          await env.uninstall();
        }
        root?.remove();
        System.global.$world = previousWorld;
        System.global.renderer = previousRenderer;
      }
    }
  });

  /** Enter creation mode through the component's button binding. */
  function chooseShape (type) {
    if (type === 'Text') signal(model.ui.textModeButton, 'onMouseDown', {});
    else {
      model.currentShapeMode = type;
      signal(model.ui.shapeModeButton, 'onMouseDown', {});
    }
  }

  /** Use world coordinates while supporting creation inside an owner. */
  function event (targetMorph = world, position = hand.position) {
    return {
      targetMorph, position,
      positionIn: target => target.localize(position),
      targetMorphs: [targetMorph],
      state: {},
      stop () {},
      leftMouseButtonPressed: () => true
    };
  }

  /** Dispatch the target bindings that complete a single click. */
  function click () {
    const before = new Set(world.submorphs);
    signal(world, 'onMouseDown', event());
    signal(world, 'onMouseUp', event());
    return world.submorphs.find(m => !before.has(m));
  }

  for (const type of ['Text', 'Image']) {
    it(`undoes and redoes click-created ${type} with its identity and order`, () => {
      chooseShape(type);
      const shape = click();
      expect(shape, 'actual top-bar creation binding').to.be.ok;
      const bounds = shape.bounds();
      const index = world.submorphs.indexOf(shape);
      const sibling = world.addMorph({ fill: Color.red, extent: pt(10, 10) });
      expect(env.undoManager.undos).to.have.length(1);
      expect(env.undoManager.undoInProgress).equals(null);
      env.undoManager.undo();
      expect(shape.owner).equals(null);
      expect(sibling.owner).equals(world);
      env.undoManager.redo();
      expect(world.submorphs[index]).equals(shape);
      expect(world.submorphs[index + 1]).equals(sibling);
      expect(shape.bounds()).equals(bounds);
      if (type === 'Text') expect(shape.editorPlugin.shortName).equals('richText');
    });
  }

  it('keeps movement and click creation as separate undo steps', async () => {
    const moved = world.addMorph({ position: pt(20, 30), extent: pt(60, 60) });
    const halo = await world.showHaloFor(moved);
    halo.dragHalo().init();
    halo.dragHalo().update(pt(10, 15));
    halo.dragHalo().stop();
    chooseShape('Text');
    const shape = click();
    expect(env.undoManager.undos).to.have.length(2);
    env.undoManager.undo();
    expect(shape.owner).equals(null);
    expect(moved.position).equals(pt(30, 45));
    env.undoManager.undo();
    expect(moved.position).equals(pt(20, 30));
    env.undoManager.redo();
    env.undoManager.redo();
    expect(moved.position).equals(pt(30, 45));
    expect(shape.owner).equals(world);
  });

  it('does not close an existing undo group', () => {
    chooseShape('Text');
    const group = world.undoStart('existing gesture');
    const shape = click();
    expect(env.undoManager.undoInProgress).equals(group);
    expect(env.undoManager.undos).to.have.length(0);
    world.undoStop();
    env.undoManager.undo();
    expect(shape.owner).equals(null);
  });

  it('does not record a cancelled click or a rectangle click without a drag', () => {
    chooseShape('Text');
    signal(world, 'onMouseDown', event());
    model.onKeyDown({ key: 'Escape', isAltDown: () => false, isCommandKey: () => false });
    signal(world, 'onMouseUp', event());
    chooseShape('Rectangle');
    expect(click()).equals(undefined);
    expect(env.undoManager.undos).to.have.length(0);
    expect(env.undoManager.undoInProgress).equals(null);
  });
});
