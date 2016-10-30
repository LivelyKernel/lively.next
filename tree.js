import { arr, obj, fun, tree } from "lively.lang"
import { pt, Rectangle, rect, Color } from "lively.graphics"
import { Label } from "lively.morphic/text/label.js";
import { Morph, show } from "lively.morphic"
import { connect, disconnect, signal } from "lively.bindings"

/*

This module provides a tree widget to display hierarchical data. The tree data passed to the tree can be arbitrary and should be wrapped into a TreeData object. Besides the main tree structure this object receives a function to extract a name from a tree node

var root = new (class extends TreeData {
  display(node) { return node.name }
  isCollapsed(node) { return node.isCollapsed }
  collapse(node, bool) { node.isCollapsed = bool; }
  getChildren(node) { return node.isLeaf ? null : node.isCollapsed ? [] : node.children }
  isLeaf(node) { return node.isLeaf }
})({
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

var tree = new Tree({
  extent: pt(200,70), fill: Color.white, border: {color: Color.gray, width: 1},
  treeData: root
}).openInWorld();

tree.remove()

tree.scroll = pt(0, tree.nodeMorphHeight+4)
arr.pluck(tree.nodeMorphs, "labelString")
["child 1", "child 2", "child 3", "child 3 - 1", "child 3 - 2", "child 4"]
*/

export class TreeNode extends Label {

  constructor(props = {}) {
    var {isCollapsed, isCollapsable} = props;
    super({
      textString: "",
      selectionFontColor: Color.white,
      nonSelectionFontColor: Color.rgbHex("333"),
      selectionColor: Color.blue,
      fontColor: Color.rgbHex("333"),

      ...obj.dissoc(props, ["isCollapsed", "isCollapsable"])
    });
    this.isCollapsable = props.hasOwnProperty("isCollapsable") ? props.isCollapsable : false;
    this.isCollapsed = props.hasOwnProperty("isCollapsed") ? props.isCollapsed : false;
    this.relayout();
    this.state = {node: null, depth: 0, n: 0};
  }

  displayNode(treeData, nodeData, pos, isSelected) {
    var {node, i, depth} = nodeData,
        node = node;
    this.fill = isSelected ? this.selectionColor : null;
    this.fontColor = isSelected ? this.selectionFontColor : this.nonSelectionFontColor;
    this.state = null;
    this.position = pos
    this.textString = String(treeData.nameOfNode(node));
    this.isCollapsable = !treeData.isLeaf(node);
    this.isCollapsed = treeData.isCollapsed(node);
    this.state = {node, depth, n: i};
  }

  relayout() {
    this.fit();
    var toggle = this.toggle;
    if (toggle) {
      toggle.fit();
      var bounds = toggle.textBounds();
      this.height = Math.max(bounds.height, this.height);
      this.padding = Rectangle.inset(bounds.width+4, 1, 1, 1);
      toggle.leftCenter = pt(1, (this.height)/2);
    } else {
      this.padding = Rectangle.inset(1);
    }
  }

  get toggle() { return this.getSubmorphNamed("toggle"); }
  get label() { return this.getSubmorphNamed("label"); }
  get labelString() { var l = this.label; return l ? l.textString : ""; }
  set labelString(s) { var l = this.label; l && (l.textString = s); }

  get selectionFontColor() { return this.getProperty("selectionFontColor"); }
  set selectionFontColor(c) { this.addValueChange("selectionFontColor", c); }

  get nonSelectionFontColor() { return this.getProperty("nonSelectionFontColor"); }
  set nonSelectionFontColor(c) { this.addValueChange("nonSelectionFontColor", c); }

  get selectionColor() { return this.getProperty("selectionColor"); }
  set selectionColor(c) { this.addValueChange("selectionColor", c); }

  get fontSize() { return super.fontSize; }
  set fontSize(fontSize) {
    super.fontSize = fontSize;
    var toggle = this.toggle;
    toggle && (toggle.fontSize = fontSize-3);
  }

  get fontColor() { return super.fontColor; }
  set fontColor(fontColor) {
    super.fontColor = fontColor;
    var toggle = this.toggle;
    toggle && (toggle.fontColor = fontColor);
  }

  get fontWeight() { return super.fontWeight; }
  set fontWeight(fontWeight) {
    super.fontWeight = fontWeight;
    var toggle = this.toggle;
    toggle && (toggle.fontWeight = fontWeight);
  }

  get isCollapsed() { return this.getProperty("isCollapsed"); }
  set isCollapsed(bool) {
    if (this.isCollapsed === bool) return;

    this.addValueChange("isCollapsed", bool);
    var toggle = this.toggle;
    toggle && (toggle.textStyleClasses = bool ? ["fa", "fa-plus-square-o"] : ["fa", "fa-minus-square-o"]);
    if (this.state && this.state.node) {
      signal(this, "collapseChanged", {node: this.state.node, isCollapsed: bool});
    }
  }

  get isCollapsable() { return this.getProperty("isCollapsable"); }
  set isCollapsable(bool) {
    this.addValueChange("isCollapsable", bool);
    var toggle = this.toggle;
    if (!bool && toggle) toggle.remove();
    if (bool && !toggle) this.addMorph({
      type: Label,
      name: "toggle",
      fill: this.fill, textString: "",
      fontSize: this.fontSize-3,
      textStyleClasses: this.isCollapsed ? ["fa", "fa-plus-square-o"] : ["fa", "fa-minus-square-o"],
      fontFamily: "FontAwesome",
      nativeCursor: "pointer"
    });
    this.relayout();
  }

  onMouseDown(evt) {
    if (this.toggle && evt.state.clickedOnMorph === this.toggle) {
      this.toggleCollapse();
    } else {
      this.select();
    }
  }

  toggleCollapse() { this.isCollapsed = !this.isCollapsed; }

  select() {
    signal(this, "selected", this.state.node);
  }

}


export class Tree extends Morph {

  constructor(props = {}) {
    if (!props.treeData)
      throw new Error("Cannot create tree without TreeData!");

    var { fontMetric } = props;

    super({selection: null, clipMode: "auto", padding: Rectangle.inset(2), ...obj.dissoc(props, ["fontMetric"])});
    if (fontMetric) this._fontMetric = fontMetric;
    this.addMorph({name: "nodeItemContainer", extent: this.extent, fill: null, draggable: false, grabbable: false, clipMode: "visible"});
    this.update();
    connect(this, 'extent', this, 'update');
  }

  get isTree() { return true; }

  get nodeItemContainer() { return this.submorphs[0]; }
  get nodeMorphs() { return this.nodeItemContainer.submorphs.slice(); }

  get nodeStyle() {
    return {
      fontSize: 15,
      fontFamily: "Inconsolata, monospace"
    }
  }

  get treeData() { return this.getProperty("treeData"); }
  set treeData(val) { this.addValueChange("treeData", val); this.update(); }

  get selection() { return this.getProperty("selection"); }
  set selection(sel) {
    this.addValueChange("selection", sel);
    this.update();
  }

  get selectedIndex() { return this.selection ? this.nodes.indexOf(this.selection) : -1; }
  set selectedIndex(i) { this.selection = this.nodes[i]; }

  get nodes() { return this.treeData.asList(); }
  get selectedNodeAndSiblings() {
    return this.selection ?
      this.treeData.nodeWithSiblings(this.selection) : [];
  }

  get padding() { return this.getProperty("padding"); }
  set padding(bool) { this.addValueChange("padding", bool); }

  get nodeMorphHeight() {
    return this.nodeMorphBounds.height;
  }

  get nodeMorphBounds() {
    if (this._cachedNodeMorphBounds) return this._cachedNodeMorphBounds;
    var node = new TreeNode({fontMetric: this._fontMetric, isCollapsable: true, textString: "x", ...this.nodeStyle});
    node.fit(); node.toggle.fit();
    var {width, height} = node,
        {width: toggleWidth, height: toggleHeight} = node.toggle;
    return this._cachedNodeMorphBounds = {width, height, toggleHeight, toggleWidth};
  }

  update() {
    if (!this.treeData || !this.nodeItemContainer) return;
    var {
          treeData,
          padding, scroll: {y: visibleTop},
          extent, nodeMorphs, nodeMorphBounds,
          nodeItemContainer: container,
          selection} = this,
        visibleBottom = visibleTop + extent.y,
        {height: nodeHeight, toggleWidth} = nodeMorphBounds,
        nodes = treeData.asListWithIndexAndDepth(),
        i = 1, y = padding.top(), x = padding.left();

    // resize container to allow scrolling
    container.extent = pt(this.width, padding.top()+padding.bottom()+nodes.length*nodeHeight);

    // skip not visible notes out of scroll bounds
    for (; i < nodes.length; i++) {
      if (y+nodeHeight >= visibleTop) break;
      y += nodeHeight;
    }

    // render visible nodes
    for (; i < nodes.length; i++) {
      if (y >= visibleBottom) break;
      var nodeMorph = nodeMorphs.shift();
      if (!nodeMorph) {
        nodeMorph = container.addMorph(new TreeNode({fontMetric: this._fontMetric, ...this.nodeStyle}));
        connect(nodeMorph, 'collapseChanged', this, 'onNodeCollapseChanged');
        connect(nodeMorph, 'selected', this, 'selection');
      }
      nodeMorph.displayNode(
        treeData, nodes[i],
        pt(x+(toggleWidth+4)*(nodes[i].depth-1), y),
        nodes[i].node === selection);
      y += nodeHeight;
    }

    nodeMorphs.forEach(ea => ea.remove()); // remove invisible left overs
  }

  async maintainViewStateWhile(whileFn, nodeIdFn) {
    // keeps the scroll, selection, and node collapse state, useful when updating the list
    // specify a nodeIdFn to compare old and new nodes, useful when you
    // generate a new tree but still want to have the same elements uncollapsed in
    // the new.

    if (typeof nodeIdFn !== "function")
      nodeIdFn = node => node;

    var selId = this.selection ? nodeIdFn(this.selection) : -1,
        collapsedMap = new Map();

    lively.lang.tree.prewalk(this.treeData.root,
      node => collapsedMap.set(nodeIdFn(node), this.treeData.isCollapsed(node)),
      node => this.treeData.getChildren(node));

    await whileFn();

    var i = 0, newSelIndex = -1;
    while (true) {
      var nodes = this.nodes;
      if (i >= nodes.length) break;
      var id = nodeIdFn(nodes[i]);
      if (selId === id) newSelIndex = i;
      if (collapsedMap.has(id) && !collapsedMap.get(id))
        await this.treeData.collapse(nodes[i], false);
      i++;
    }

    this.update();
    this.selectedIndex = newSelIndex;
    this.scrollSelectionIntoView();
  }

  async onNodeCollapseChanged({node, isCollapsed}) {
    try {
      await this.treeData.collapse(node, isCollapsed);
      this.update();
    } catch (e) { this.showError(e); }
  }

  gotoIndex(i) {
    this.selection = this.nodes[i];
    this.scrollIndexIntoView(i)
  }

  onScroll() { this.update(); }

  scrollSelectionIntoView() {
    this.selection && this.scrollIndexIntoView(this.selectedIndex);
  }

  scrollIndexIntoView(idx) { this.scrollToIndex(idx, "into view"); }

  centerSelection() {
    this.selection && this.scrollToIndex(this.selectedIndex, "center");
  }

  scrollToIndex(idx, how = "into view") {
    // how = "into view"|"top"|"bottom"|"center"
    idx--; // disregard root, it's not visible
    var {scroll, width, nodeMorphHeight} = this,
        lineBounds = new Rectangle(0, idx*nodeMorphHeight, width, nodeMorphHeight),
        visibleBounds = this.innerBounds().translatedBy(scroll),
        offsetX = 0, offsetY = 0
    if (how === "into view") {
      if (lineBounds.bottom() > visibleBounds.bottom())
        offsetY = lineBounds.bottom() - visibleBounds.bottom()
      if (lineBounds.top() < visibleBounds.top())
        offsetY = lineBounds.top() - visibleBounds.top()
    } else {
      offsetX = -scroll.x;
      if (how === "top")
        offsetY = visibleBounds.top() - lineBounds.top()
      else if (how === "center")
        offsetY = lineBounds.leftCenter().y - visibleBounds.leftCenter().y;
      else if (how === "bottom")
        offsetY = visibleBounds.bottom() - lineBounds.bottom()
    }
    this.scroll = scroll.addXY(offsetX, offsetY);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // event handling
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  get keybindings() {
    return [
      {keys: "Up|Ctrl-P", command: "select node above"},
      {keys: "Down|Ctrl-N", command: "select node below"},

      {keys: "Left", command: "collapse selected node"},
      {keys: "Right", command: "uncollapse selected node"},

      {keys: "Alt-V|PageUp", command: "page up"},
      {keys: "Ctrl-V|PageDown", command: "page down"},

      {keys: "Alt-Shift-,", command: "goto first item"},
      {keys: "Alt-Shift-.", command: "goto last item"},

      {keys: "Alt-Space", command: "select via filter"},

      {keys: "Ctrl-L", command: "realign top-bottom-center"},

      {keys: {mac: "Meta-[", win: "Ctrl-["}, command: {command: "collapse or uncollapse all siblings", args: {what: "collapse"}}},
      {keys: {mac: "Meta-]", win: "Ctrl-]"}, command: {command: "collapse or uncollapse all siblings", args: {what: "uncollapse"}}},

      {keys: "Alt-N", command: "goto next sibling"},
      {keys: "Alt-P", command: "goto prev sibling"},
      {keys: "Alt-U", command: "goto parent"},
    ].concat(super.keybindings);
  }

  get commands() {
    return treeCommands;
  }

}

export class TreeData {

  constructor(root) {
    this.root = root;
  }

  display(node) { throw new Error("Not yet implemented"); }
  isCollapsed(node) { throw new Error("Not yet implemented"); }
  collapse(node, bool) { throw new Error("Not yet implemented"); }
  getChildren(node) { throw new Error("Not yet implemented"); }
  isLeaf(node) { throw new Error("Not yet implemented"); }

  parentNode(childNode) {
    return tree.detect(this.root,
      node => !this.isLeaf(node) && this.getChildren(node).includes(childNode),
      node => this.getChildren(node));
  }

  nodeWithSiblings(node) {
    var parent = this.parentNode(node);
    return parent ? this.getChildren(parent) : [];
  }

  asList() {
    return this.asListWithIndexAndDepth().map(ea => ea.node);
  }

  asListWithIndexAndDepth() {
    var nodesWithIndex = []
    tree.prewalk(this.root,
      (node, i, depth) => nodesWithIndex.push({node, depth, i}),
      (node) => this.getChildren(node));
    return nodesWithIndex;
  }

  async followPath(path, eqFn, startNode = this.root) {
    // takes a path list that should denote a path into a node inside the tree.
    // path[n] does not necessarily be directly a node of treeData, when eqFn
    // is passed this fuction is used to find the right node for the path part
    // eqFn(pathPath, node) should return true if pathPart denotes node and
    // should be selected for the next descend step.
    //
    // Example:
    // // Let's use a tree of resources (lively.resource) describing a file system structure.
    // var target = resource("file://foo/bar/baz.js");
    // // assume that treeData.root.resource === resource("file://foo/");
    // var path = target.parents().concat(target)
    // var found = await td.followPath(path, (resource, node) => resource.equals(node.resource));
    // found.resource // => resource("file://foo/bar/baz.js")
    // // + the path to the node is now uncollapsed and e.g. can be selected via
    // tree.selection = found; tree.centerSelection();

    if (!eqFn) eqFn = (pathPart, node) => pathPart === node;

    var startIndex = path.findIndex(ea => eqFn(ea, startNode));
    path = path.slice(startIndex+1);

    if (!path.length) return null;

    var currentNode = startNode;
    while (true) {
      if (!path.length) break;

      if (this.isCollapsed(currentNode))
        await this.collapse(currentNode, false);

      var nextPathPart = path.shift(),
          nextNode = this.getChildren(currentNode).find(ea => eqFn(nextPathPart, ea));

      if (!nextNode)
        throw new Error(`Cannot descend into tree, next node of ${path.join(".")} not found at ${this.display(currentNode)}`);

      currentNode = nextNode;
    }

    return currentNode;
  }

}

var treeCommands = [

  {
    name: "select via filter",
    exec: async tree => {
      var treeData = tree.treeData;
      var nodes = treeData.asListWithIndexAndDepth()
      var items = nodes.map(({node, depth, i}) => ({isListItem: true, string: " ".repeat(depth)+treeData.display(node), value: node}))
      var {selected: [node]} = await tree.world().filterableListPrompt("Select item", items);
      if (node) {
        tree.selection = node;
        tree.scrollSelectionIntoView();
      }
      return true;
    }
  },

  {
    name: "page up",
    exec: tree => {
      var index = tree.selectedIndex || 1,
          newIndex = Math.max(1, index - Math.round(tree.height / tree.nodeMorphHeight));
      tree.gotoIndex(newIndex);
      return true;
    }
  },

  {
    name: "page down",
    exec: tree => {
      var index = tree.selectedIndex,
          newIndex = Math.min(tree.nodes.length-1, index + Math.round(tree.height / tree.nodeMorphHeight))
      tree.gotoIndex(newIndex);
      return true;
    }
  },

  {
    name: "goto first item",
    exec: tree => { tree.gotoIndex(1); return true; }
  },

  {
    name: "goto last item",
    exec: tree => { tree.gotoIndex(tree.nodes.length-1); return true; }
  },

  {
    name: "goto next sibling",
    exec: tree => {
      var withSiblings = tree.selectedNodeAndSiblings,
          next = withSiblings[withSiblings.indexOf(tree.selection)+1];
      if (next) {
        tree.selection = next;
        tree.scrollSelectionIntoView();
      }
      return true;
    }
  },

  {
    name: "goto prev sibling",
    exec: tree => {
      var withSiblings = tree.selectedNodeAndSiblings,
          next = withSiblings[withSiblings.indexOf(tree.selection)-1];
      if (next) {
        tree.selection = next;
        tree.scrollSelectionIntoView();
      }
      return true;
    }
  },

  {
    name: "goto parent",
    exec: tree => {
      if (tree.selection) {
        tree.selection = tree.treeData.parentNode(tree.selection)
        tree.scrollSelectionIntoView();
      }
      return true;
    }
  },

  {
    name: "collapse selected node",
    exec: tree => {
      var sel = tree.selection;
      if (!sel) return true;
      if (!tree.treeData.isCollapsed(sel))
        tree.onNodeCollapseChanged({node: tree.selection, isCollapsed: true})
      else {
        tree.selection = tree.treeData.parentNode(sel);
        tree.scrollSelectionIntoView();
      }
      return true;
    }
  },

  {
    name: "uncollapse selected node",
    exec: tree => {
      if (tree.selection)
        tree.onNodeCollapseChanged({node: tree.selection, isCollapsed: false})
      return true;
    }
  },

  {
    name: "collapse or uncollapse all siblings",
    exec: async (tree, opts = {what: "collapse"}) => {
      var doCollapse = opts.what === "collapse";
      await Promise.all(
        tree.selectedNodeAndSiblings.map(node =>
          !tree.treeData.isLeaf(node)
        && tree.treeData.isCollapsed(node) !== doCollapse
        && tree.onNodeCollapseChanged({node, isCollapsed: doCollapse})));
      tree.scrollSelectionIntoView();
      return true;
    }
  },

  {
    name: "select node above",
    exec: tree => {
      var nodes = tree.nodes,
          index = tree.selectedIndex;
      if (index <= 1) index = nodes.length;
      tree.selection = nodes[index-1];
      tree.scrollSelectionIntoView();
      return true;
    }
  },

  {
    name: "select node below",
    exec: tree => {
      var nodes = tree.nodes,
          index = tree.selectedIndex;
      if (index <= -1 ||  index >= nodes.length-1) index = 0;
      tree.selection = nodes[index+1];
      tree.scrollSelectionIntoView();
      return true;
    }
  },

  {
    name: "realign top-bottom-center",
    exec: tree => {
      if (!tree.selection) return;
      var {padding, selectedIndex: idx, nodeMorphHeight: itemHeight, scroll: {x: scrollX, y: scrollY}} = tree,
          idx = idx-1, // ignore root
          pos = pt(0, idx*itemHeight),
          offsetX = 0, offsetY = 0,
          h = tree.height - itemHeight - padding.top() - padding.bottom();
      if (Math.abs(pos.y - scrollY) < 2) {
        scrollY = pos.y - h;
      } else if (Math.abs(pos.y - scrollY - h * 0.5) < 2) {
        scrollY = pos.y;
      } else {
        scrollY = pos.y - h * 0.5;
      }
      tree.scroll = pt(scrollX, scrollY);
      return true;
    }
  },

  {
    name: "print contents in text window",
    exec: treeMorph => {
      var printedNodes = [],
          td = treeMorph.treeData;

      tree.prewalk(
        td.root,
        (node, i, depth) => printedNodes.push(" ".repeat(Math.max(0, depth-1))+td.display(node)),
        td.getChildren);
      printedNodes.shift();

      var content = lively.lang.string.printTree(td.root, td.display, td.getChildren),

      // var content = printedNodes.join("\n"),
          title = treeMorph.getWindow() ? "printed " + treeMorph.getWindow().title : treeMorph.name;
      return treeMorph.world().execCommand("open text window", {title, content, name: title, fontFamily: "Inconsolata, monospace"});
    }
  }

]
