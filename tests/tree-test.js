/*global declare, it, describe, beforeEach, afterEach, before, after*/
import { morph,  World, MorphicEnv } from "../index.js";
import { Tree, TreeData } from "../tree.js";
import { expect } from "mocha-es6";
import { pt, rect, Color, Rectangle, Transform } from "lively.graphics";
import { arr } from "lively.lang";
import { dummyFontMetric as fontMetric } from "./test-helpers.js";
import { createDOMEnvironment } from "../rendering/dom-helper.js";

function testTreeData() {
  class TestTreeData extends TreeData {
    display(node) { return node.morph || node.name }
    isCollapsed(node) { return node.isCollapsed }
    collapse(node, bool) { node.isCollapsed = bool; }
    getChildren(node) { return node.isLeaf ? null : node.isCollapsed ? [] : node.children }
    isLeaf(node) { return node.isLeaf }
  }

  return new TestTreeData({
    name: "root",
    isCollapsed: false,
    isLeaf: false,
    children: [
      {name: "child 1", isLeaf: true},
      {name: "child 2", isLeaf: false, isCollapsed: true, children: [{name: "child 2 - 1", isLeaf: true}]},
      {name: "child 3", isLeaf: false,
       isCollapsed: false,
       children: [
         {name: "child 3 - 1", isLeaf: true},
         {name: "child 3 - 2", isLeaf: true}
       ]},
      {name: "child 4", isLeaf: true},
    ]
  });
}

var tree;
function createTree(props) {
  return tree = new Tree({
    extent: pt(200,200), fill: Color.white, border: {color: Color.gray, width: 1},
    padding: Rectangle.inset(0), treeData: testTreeData(), ...props
  })
}

var env;
async function createMorphicEnv() {
  env = new MorphicEnv(await createDOMEnvironment());
  env.domEnv.document.body.style = "margin: 0";
  env.fontMetric = fontMetric;
  MorphicEnv.pushDefault(env);
  await env.setWorld(new World({extent: pt(400,300)}));
}
async function destroyMorphicEnv() { MorphicEnv.popDefault().uninstall(); }

describe("tree", function() {

  this.timeout(10000);

  beforeEach(async () => {
    await createMorphicEnv();
    createTree({env});
  });
  afterEach(() => destroyMorphicEnv());

  it("renders visible items without root", () => {
    expect(arr.pluck(tree.nodeMorphs, "labelString"))
      .equals(["child 1", "child 2", "child 3", "child 3 - 1", "child 3 - 2", "child 4"]);
    var h = tree.lineBounds(1).height;
    tree.height = h*3;
    tree.scroll = pt(0, 2*h-3);
    tree.update();
    expect(arr.pluck(tree.nodeMorphs, "labelString"))
      .equals(["child 2", "child 3", "child 3 - 1", "child 3 - 2"]);
  });

  it("selects", () => {
    expect(tree.selectedIndex).equals(-1);
    expect(tree.selection).equals(null)
    tree.selection = tree.treeData.root.children[1];
    expect(tree.selectedIndex).equals(2);
    expect(tree.selection).containSubset({isCollapsed: true, name: "child 2"});
  })

  it("descends along path and returns node", async () => {
    var path = ["root", "child 3", "child 3 - 2"],
        td = tree.treeData,
        found = await td.followPath(path,
          (pathPart, node) => td.display(node) === pathPart);
    expect(td.root.children[2].children[1]).equals(found);
  });

  describe("morphs as tree nodes", () => {

    it("inserts morph when node specifies one in display()", async () => {
      var m = morph({extent: pt(50,50), fill: Color.red});
      tree.treeData.root.children[1].morph = m;
      // tree.openInWorld()
      // tree.remove()
      tree.update();

      expect(tree.nodeMorphs[1].submorphs[1]).equals(m, "morph not rendered in display node morph");
      await tree.onNodeCollapseChanged({node: tree.treeData.root.children[1], isCollapsed: false})
      expect(tree.nodes[3].name).equals("child 2 - 1", "node not uncollapsed");
      expect(tree.nodeMorphs[2].top).gte(tree.nodeMorphs[1].bottom, "vertical layout wrong");
    });

  });

  describe("view state", () => {
  
    it("can be externalized and applied", async () => {
      var tree1 = tree,
          tree2 = createTree();
      // env.world.addMorph(tree1); // env.world.addMorph(tree2);
      // tree2.moveBy(pt(300,0))
      // tree1.remove(); tree2.remove();
      
      tree2.nodes.forEach((n) => tree2.treeData.collapse(n, true));
      tree2.update();

      expect(tree2.nodes).equals([tree2.treeData.root]);
      expect(tree2.treeData.root).not.equals(tree1.treeData.root);

      var viewState = tree1.buildViewState((n) => n.name);
      await tree2.applyViewState(viewState, (n) => n.name);

      expect(arr.pluck(tree2.nodes, "name"))
        .equals(["root", "child 1", "child 2", "child 3", "child 3 - 1", "child 3 - 2", "child 4"]);
    });
  
  });
});
