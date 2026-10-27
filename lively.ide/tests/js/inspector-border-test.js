/* global describe, it, beforeEach, afterEach, System, xdescribe */
import { expect } from 'mocha-es6';
import sinon from 'sinon';
import { signal } from 'lively.bindings';
import { Color, pt } from 'lively.graphics';
import { promise } from 'lively.lang';
import { Morph, MorphicEnv, morph, part } from 'lively.morphic';
import { SystemInspector } from '../../js/inspector/ui.cp.js';
import { LivelyWorld } from '../../world.js';

const describeInBrowser = System.get('@system-env').browser ? describe : xdescribe;

describeInBrowser('inspector border properties', () => {
  let env, world, target, inspector, tree, inspectedMorph, root, previousWorld, previousRenderer, previousTitle, popupFade;

  beforeEach(async () => {
    previousWorld = System.global.$world;
    previousRenderer = System.global.renderer;
    previousTitle = document.title;
    env = MorphicEnv.pushDefault(new MorphicEnv());
    root = env.domEnv.document.createElement('div');
    env.domEnv.document.body.appendChild(root);
    world = new LivelyWorld({ extent: pt(1000, 1000) });
    env.setWorld(world, root);
    System.global.$world = world;
    // These tests check property bindings; the native inspector workflow covers the visual fade.
    popupFade = sinon.stub(Morph.prototype, 'fadeIntoWorld').callsFake(async function (position) {
      return this.openInWorld(position);
    });
    target = world.addMorph(morph({
      position: pt(40, 50), extent: pt(200, 100),
      borderWidth: { top: 1, left: 2, right: 3, bottom: 4 },
      borderRadius: { topLeft: 5, topRight: 6, bottomLeft: 7, bottomRight: 8 },
      borderColor: { top: Color.red, left: Color.green, right: Color.blue, bottom: Color.black },
      borderStyle: { top: 'solid', left: 'dotted', right: 'dashed', bottom: 'double' }
    }));
    inspector = world.addMorph(part(SystemInspector, { viewModel: { targetObject: target } })).viewModel;
    await inspector.editorModeInitialized;
    await promise.waitFor(5000, () => !inspector.isUpdating());
    inspector.view.stopStepping();
    tree = inspector.ui.propertyTree.treeData;
    inspectedMorph = tree.root.children[0];
  });

  afterEach(async () => {
    try {
      inspector?.closeOpenWidget();
      inspector?.onWindowClose();
    } finally {
      popupFade?.restore();
      if (MorphicEnv.default() === env) MorphicEnv.popDefault();
      env.uninstallSystemChangeHandlers();
      env.renderer?.placeholder?.remove();
      await env.uninstall();
      root.remove();
      System.global.$world = previousWorld;
      System.global.renderer = previousRenderer;
      document.title = previousTitle;
    }
  });

  /** Retrieve the actual property node and, if requested, an unfolded member. */
  function propertyNode (key, member) {
    const node = inspectedMorph.children.find(node => node.key === key);
    if (!member) return node;
    tree.collapse(node, false);
    inspector.ui.propertyTree.update(true);
    return node.children.find(node => node.key === member);
  }

  /** Open the popup through the rendered property value's mouse handler. */
  async function clickValue (node) {
    inspector.ui.propertyTree.selectedNode = node;
    const rendered = node.display(inspector);
    const attributes = rendered.find(value => !value?.isMorph && value?.onMouseDown);
    expect(attributes, 'property value has an edit handler').to.be.ok;
    await attributes.onMouseDown({ positionIn: () => pt(100, 100) });
    return inspector.openWidget;
  }

  it('renders mixed border values without changing their individual members', () => {
    for (const key of ['borderWidth', 'borderRadius', 'borderColor', 'borderStyle']) {
      const original = target[key];
      const rendered = propertyNode(key).display(inspector);
      expect(Array.isArray(rendered), key + ' renders in the property tree').equals(true);
      for (const member of propertyNode(key).spec.foldable) expect(target[key][member]).equals(original[member]);
    }
  });

  it('expands only the declared border members, excluding the valueOf helper', () => {
    for (const key of ['borderWidth', 'borderRadius', 'borderColor', 'borderStyle']) {
      const node = propertyNode(key);
      tree.collapse(node, false);
      expect(node.children.map(child => child.key).sort()).deep.equals([...node.spec.foldable].sort());
      for (const child of node.children) expect(Array.isArray(child.display(inspector))).equals(true);
    }
  });

  it('expands a mixed whole-value hotspot without overwriting its members', async () => {
    for (const key of ['borderWidth', 'borderRadius', 'borderColor', 'borderStyle']) {
      const node = propertyNode(key);
      const original = target[key];
      await clickValue(node);
      for (const member of node.spec.foldable) expect(target[key][member]).equals(original[member]);
      expect(node.isCollapsed).equals(false);
      expect(node.children.map(child => child.key).sort()).deep.equals([...node.spec.foldable].sort());
      expect(inspector.openWidget).not.to.be.ok;
    }
  });

  it('changes one border width without moving the morph or changing the other sides', async () => {
    const popup = await clickValue(propertyNode('borderWidth', 'left'));
    expect(popup.value).equals(2);
    popup.viewModel.ui.valueInput.number = 12;
    expect(target.borderWidthLeft).equals(12);
    expect(target.borderWidthTop).equals(1);
    expect(target.borderWidthRight).equals(3);
    expect(target.borderWidthBottom).equals(4);
    expect(target.position).equals(pt(40, 50));
  });

  it('changes one corner radius through its generated morph accessor', async () => {
    const popup = await clickValue(propertyNode('borderRadius', 'topLeft'));
    expect(popup.value).equals(5);
    popup.viewModel.ui.valueInput.number = 15;
    expect(target.borderRadiusTopLeft).equals(15);
    expect(target.borderRadiusTopRight).equals(6);
    expect(target.borderRadiusBottomLeft).equals(7);
    expect(target.borderRadiusBottomRight).equals(8);
    expect(target.topLeft).equals(pt(40, 50));
  });

  it('changes one border color without overwriting the other sides', async () => {
    const popup = await clickValue(propertyNode('borderColor', 'bottom'));
    signal(popup, 'value', Color.purple);
    expect(target.borderColorBottom).equals(Color.purple);
    expect(target.borderColorTop).equals(Color.red);
    expect(target.borderColorLeft).equals(Color.green);
    expect(target.borderColorRight).equals(Color.blue);
    expect(target.position).equals(pt(40, 50));
  });

  it('changes one border style through the existing enum actions', async () => {
    let menuItems;
    world.openWorldMenu = async (evt, items) => {
      menuItems = items;
      return { close () {} };
    };
    await clickValue(propertyNode('borderStyle', 'right'));
    menuItems.find(item => item.string === 'double').action();
    expect(target.borderStyleRight).equals('double');
    expect(target.borderStyleTop).equals('solid');
    expect(target.borderStyleLeft).equals('dotted');
    expect(target.borderStyleBottom).equals('double');
  });

  it('opens a uniform numeric border value as a number and edits all sides', async () => {
    target.borderWidth = 3;
    const node = propertyNode('borderWidth');
    node.refreshProperty();
    const popup = await clickValue(node);
    expect(popup.value).equals(3);
    popup.viewModel.ui.valueInput.number = 9;
    for (const side of ['Top', 'Left', 'Right', 'Bottom']) expect(target['borderWidth' + side]).equals(9);
  });
});
