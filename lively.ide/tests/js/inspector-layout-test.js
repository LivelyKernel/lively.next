/* global describe, it, beforeEach, afterEach, System, xdescribe */
import { expect } from 'mocha-es6';
import { signal } from 'lively.bindings';
import { pt } from 'lively.graphics';
import { promise } from 'lively.lang';
import { GridLayout, MorphicEnv, TilingLayout, World, morph } from 'lively.morphic';
import { Inspector, PropertyControl } from '../../js/inspector/index.js';

const describeInBrowser = System.get('@system-env').browser ? describe : xdescribe;

describeInBrowser('inspector layout property', () => {
  let env, world, target, inspector, root, previousWorld, previousRenderer, rerenders;

  beforeEach(() => {
    previousWorld = System.global.$world;
    previousRenderer = System.global.renderer;
    env = MorphicEnv.pushDefault(new MorphicEnv());
    root = env.domEnv.document.createElement('div');
    env.domEnv.document.body.appendChild(root);
    world = new World({ extent: pt(1000, 1000) });
    env.setWorld(world, root);
    System.global.$world = world;
    target = world.addMorph(morph({ extent: pt(200, 100) }));
    inspector = new Inspector();
    rerenders = 0;
  });

  afterEach(async () => {
    try {
      inspector?.closeOpenWidget();
    } finally {
      if (MorphicEnv.default() === env) MorphicEnv.popDefault();
      env.uninstallSystemChangeHandlers();
      env.renderer?.placeholder?.remove();
      await env.uninstall();
      root.remove();
      System.global.$world = previousWorld;
      System.global.renderer = previousRenderer;
    }
  });

  /** Click the same value attribute used by the inspector property tree. */
  async function clickLayout () {
    const rendered = PropertyControl.renderLayoutControl({
      keyString: 'layout', valueString: 'TilingLayout', value: target.layout, target,
      tree: { owner: inspector }, node: { rerender () { rerenders++; } }
    });
    const attributes = rendered.find(value => value?.onMouseDown);
    await attributes.onMouseDown({ positionIn: () => pt(100, 100) });
    expect(inspector.openWidget, 'clicking the inspector layout value opens an editor').to.be.ok;
    return inspector.openWidget;
  }

  it('edits existing layout through the shared layout control bindings', async () => {
    const original = target.layout = new TilingLayout({ spacing: 3 });
    const popup = await clickLayout();
    const control = popup.viewModel.models.layoutControl;
    expect(control.targetMorph).equals(target);
    expect(target.layout, 'opening the editor preserves the layout').equals(original);
    signal(control.ui.vertical, 'onMouseDown', {});
    expect(target.layout.axis).equals('column');
    control.ui.spacingInput.number = 13;
    expect(target.layout.spacing).equals(13);
    control.ui.totalPaddingInput.number = 7;
    expect(target.layout.padding.top()).equals(7);
    signal(control.ui.wrapSubmorphsCheckbox, 'checked', true);
    expect(target.layout.wrapSubmorphs).equals(true);
  });

  it('adds and removes layout without changing the target just by opening the editor', async () => {
    const popup = await clickLayout();
    const control = popup.viewModel.models.layoutControl;
    expect(target.layout).equals(undefined);
    signal(control.ui.addButton, 'onMouseDown', {});
    expect(target.layout.name()).equals('Tiling');
    signal(control.ui.removeButton, 'onMouseDown', {});
    expect(target.layout).equals(undefined);
    expect(rerenders).equals(2);
  });

  it('preserves another layout until explicitly enabling auto layout', async () => {
    const original = target.layout = new GridLayout({});
    const popup = await clickLayout();
    const control = popup.viewModel.models.layoutControl;
    expect(target.layout).equals(original);
    signal(control.ui.addButton, 'onMouseDown', {});
    expect(target.layout.name()).equals('Tiling');
  });

  it('closes the alignment popup when the inspector closes its editor', async () => {
    target.layout = new TilingLayout();
    const popup = await clickLayout();
    const control = popup.viewModel.models.layoutControl;
    signal(control.ui.miniLayoutPreview, 'onMouseDown', {});
    const alignmentPopup = control.popup;
    expect(alignmentPopup.owner).equals(world);
    inspector.closeOpenWidget();
    expect(popup.owner).equals(null);
    expect(alignmentPopup.owner).equals(null);
  });

  it('waits for its editor mode before evaluating the inspector environment', async () => {
    const ready = promise.deferred();
    let evaluations = 0;
    const plugin = { runEval: async () => { evaluations++; return { value: false }; }, highlight () {} };
    const codeEditor = { pluginFind: () => plugin, textString: '' };
    const update = Inspector.prototype.toggleWindowStyle.call({
      editorModeInitialized: ready.promise, ui: { codeEditor }, view: { getWindow: () => null }
    }, false);
    try {
      await Promise.resolve();
      expect(evaluations).equals(0);
    } finally { ready.resolve(); }
    await update;
    expect(evaluations).equals(1);
  });
});
