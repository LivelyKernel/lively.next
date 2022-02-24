/* global declare, it, describe, beforeEach, afterEach, before, after,System,xit */
import { morph, World, MorphicEnv } from 'lively.morphic';
import { Tree, TreeData } from 'lively.components/tree.js';
import { expect } from 'mocha-es6';
import { pt, Color, Rectangle } from 'lively.graphics';
import { arr } from 'lively.lang';
import { dummyFontMetric as fontMetric } from 'lively.morphic/tests/test-helpers.js';
import { createDOMEnvironment } from 'lively.morphic/rendering/dom-helper.js';

let inBrowser = System.get('@system-env').browser
  ? it
  : (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); };

function testTreeData () {
  class TestTreeData extends TreeData {
    display (node) { return node.morph || node.name; }
    isCollapsed (node) { return node.isCollapsed; }
    collapse (node, bool) { node.isCollapsed = bool; }
    getChildren (node) { return node.isLeaf ? null : node.isCollapsed ? [] : node.children; }
    isLeaf (node) { return node.isLeaf; }
  }

  return new TestTreeData({
    name: 'root',
    isCollapsed: false,
    isLeaf: false,
    children: [
      { name: 'child 1', isLeaf: true },
      { name: 'child 2', isLeaf: false, isCollapsed: true, children: [{ name: 'child 2 - 1', isLeaf: true }] },
      {
        name: 'child 3',
        isLeaf: false,
        isCollapsed: false,
        children: [
          { name: 'child 3 - 1', isLeaf: true },
          { name: 'child 3 - 2', isLeaf: true }
        ]
      },
      { name: 'child 4', isLeaf: true }
    ]
  });
}

let tree;
function createTree (props = {}) {
  return tree = new Tree({
    extent: pt(200, 200),
    fill: Color.white,
    border: { color: Color.gray, width: 1 },
    padding: Rectangle.inset(0),
    treeData: testTreeData(),
    ...props
  }).openInWorld();
}

describe('tree', function () {
  this.timeout(10000);

  beforeEach(async () => {
    createTree({});
  });

  afterEach(() => tree && tree.remove());

  inBrowser('renders items without root', () => {
    expect(tree.document.lines.slice(0, tree.lineCount() - 1).map(l => l.textAndAttributes[4]))
      .equals(['child 1', 'child 2', 'child 3', 'child 3 - 1', 'child 3 - 2', 'child 4']);
  });

  it('selects', () => {
    expect(tree.selectedIndex).equals(-1);
    expect(tree.selectedNode).equals(undefined);
    tree.selectedNode = tree.treeData.root.children[1];
    expect(tree.selectedIndex).equals(2);
    expect(tree.selectedNode).containSubset({ isCollapsed: true, name: 'child 2' });
  });

  it('descends along path and returns node', async () => {
    let path = ['root', 'child 3', 'child 3 - 2'];
    let td = tree.treeData;
    let found = await td.followPath(path,
      (pathPart, node) => td.display(node) === pathPart);
    expect(td.root.children[2].children[1]).equals(found);
  });

  describe('morphs as tree nodes', () => {
    inBrowser('inserts morph when node specifies one in display()', async () => {
      // let tree = createTree();
      // tree.openInWorld()
      // tree.remove()
      let m = morph({ extent: pt(50, 50), fill: Color.red });
      tree.treeData.root.children[1].morph = m;
      tree.update(true);
      await tree.whenRendered();

      expect(tree.submorphs[0]).equals(m, 'morph not rendered in display node morph');
      await tree.onNodeCollapseChanged({ node: tree.treeData.root.children[1], isCollapsed: false });
      expect(tree.nodes[3].name).equals('child 2 - 1', 'node not uncollapsed');
      expect(tree.nodeMorphs[0].top).gte(tree.lineHeight * 2, 'vertical layout wrong');
    });
  });

  describe('view state', () => {
    it('can be preserved while tree data is being changed', async () => {
      tree.selectedIndex = 4;
      await tree.maintainViewStateWhile(
        () => tree.treeData = tree.treeData,
        node => node.name);
      expect(tree.selectedIndex).equals(4);
    });

    it('can be externalized and applied', async () => {
      // createTree({});
      let tree1 = tree;
      let tree2 = createTree({ position: pt(200, 0) });

      // tree1.openInWorld()
      // tree2.openInWorld()
      // env.world.addMorph(tree1); // env.world.addMorph(tree2);
      // tree2.moveBy(pt(300,0))
      // tree1.remove(); tree2.remove();

      tree2.nodes.forEach((n) => tree2.treeData.collapse(n, true));
      tree2.update();

      expect(tree2.nodes).equals([tree2.treeData.root]);
      expect(tree2.treeData.root).not.equals(tree1.treeData.root);

      let viewState = tree1.buildViewState((n) => n.name);
      await tree2.applyViewState(viewState, (n) => n.name);

      expect(arr.pluck(tree2.nodes, 'name'))
        .equals(['root', 'child 1', 'child 2', 'child 3', 'child 3 - 1', 'child 3 - 2', 'child 4']);
    });
  });
});
