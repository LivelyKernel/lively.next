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
*/

export class TreeNode extends Morph {

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
    this.state = {node: null};
  }

  displayNode(displayedNode, node, pos, isSelected, isCollapsable, isCollapsed) {
    this.fill = isSelected ? this.selectionColor : null;

    this.state = null;
    this.position = pos;

    this.isCollapsable = isCollapsable;
    this.isCollapsed = isCollapsed;

    var {label, toggle} = this,
        displayedMorph;

    if (!isCollapsable && toggle) { toggle.remove(); toggle = null; }
    if (!displayedNode) displayedNode = "";
    if (displayedNode.isMorph) {
      displayedMorph = this.displayedMorph = displayedNode;

    } else {
      displayedMorph = this.displayedMorph = label || this.ensureLabel();
      this.labelString = displayedNode;
      displayedMorph.fit();
    }

    this.fontColor = isSelected ? this.selectionFontColor : this.nonSelectionFontColor;

    if (toggle) {
      toggle.fit();
      var toggleWidth = toggle.right + toggle.padding.right(),
          {y: height} = this.extent = displayedMorph.extent.addXY(toggleWidth, 0);
      toggle.leftCenter = pt(0, height/2+toggle.padding.top()/2);
      displayedMorph.topLeft = pt(toggleWidth, 0);
    } else {
      displayedMorph.topLeft = pt(0,0);
      this.extent = displayedMorph.extent;
    }

    this.state = {node};
  }

  relayout() {
    var { label, toggle } = this;
    label && label.fit();
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

  ensureLabel() {
    return this.label || this.addMorph(new Label({name: "label", fill: null, fontSize: this.fontSize, fontWeight: this.fontWeight, fontFamily: this.fontFamily}))
  }

  ensureToggle() {
    return this.toggle || this.addMorph({
      type: Label,
      name: "toggle",
      fill: null, textString: "",
      padding: Rectangle.inset(2),
      fontSize: this.fontSize-3,
      textStyleClasses: this.isCollapsed ? ["fa", "fa-plus-square-o"] : ["fa", "fa-minus-square-o"],
      fontFamily: "FontAwesome",
      nativeCursor: "pointer"
    });
  }

  get toggle() { return this.getSubmorphNamed("toggle"); }
  get label() { return this.getSubmorphNamed("label"); }
  get labelString() { var l = this.label; return l ? l.textString : ""; }
  set labelString(s) { var l = this.label; l && (l.textString = s); }
  get displayedMorph() { return arr.without(this.submorphs, this.toggle)[0]; }
  set displayedMorph(m) {
    var prev = this.displayedMorph;
    if (prev === m) return;
    prev && prev.remove();
    m.owner !== this && this.addMorph(m);
  }

  get selectionFontColor() { return this.getProperty("selectionFontColor"); }
  set selectionFontColor(c) { this.addValueChange("selectionFontColor", c); }

  get nonSelectionFontColor() { return this.getProperty("nonSelectionFontColor"); }
  set nonSelectionFontColor(c) { this.addValueChange("nonSelectionFontColor", c); }

  get selectionColor() { return this.getProperty("selectionColor"); }
  set selectionColor(c) { this.addValueChange("selectionColor", c); }

  get fontSize() { return this.getProperty("fontSize"); }
  set fontSize(fontSize) {
    this.addValueChange("fontSize", fontSize);
    var l = this.label;
    l && (l.fontSize = fontSize);
    var toggle = this.toggle;
    toggle && (toggle.fontSize = fontSize-3);
  }

  get fontColor() { return this.getProperty("fontColor"); }
  set fontColor(fontColor) {
    this.addValueChange("fontColor", fontColor);
    var l = this.label;
    l && (l.fontColor = fontColor);
    var toggle = this.toggle;
    toggle && (toggle.fontColor = fontColor);
  }

  get fontWeight() { return this.getProperty("fontWeight"); }
  set fontWeight(fontWeight) {
    this.addValueChange("fontWeight", fontWeight);
    var l = this.label;
    l && (l.fontWeight = fontWeight);
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
    if (bool && !toggle) this.ensureToggle();
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

  get defaultNodeHeight() {
    return this.defaultNodeMorphTextBounds.height;
  }

  get defaultNodeMorphTextBounds() {
    if (this._cachedNodeMorphBounds) return this._cachedNodeMorphBounds;
    var nodeMorph = new TreeNode({fontMetric: this._fontMetric, ...this.nodeStyle});
    nodeMorph.displayNode("x", null, pt(0,0), false, true, true);
    var {width, height} = nodeMorph,
        {width: toggleWidth, height: toggleHeight} = nodeMorph.toggle;
    return this._cachedNodeMorphBounds = {width, height, toggleHeight, toggleWidth};
  }

  get lineHeightCache() {
    if (!this._lineHeightCache) this.update();
    return this._lineHeightCache;
  }

  lineBounds(idx) {
    if (!this._lineHeightCache) this.update();
    var y = arr.sum(this._lineHeightCache.slice(0,idx)) + this.padding.top(),
        height = this._lineHeightCache[idx] || this.defaultNodeHeight,
        {width} = this;
    return new Rectangle(this.padding.left(), y, width, height);
  }

  update() {
    if (!this.treeData || !this.nodeItemContainer) return;
    var {
          treeData,
          padding, scroll: {y: visibleTop}, extent,
          defaultNodeMorphTextBounds,
          nodeMorphs, nodeItemContainer: container, selection} = this,
        visibleBottom = visibleTop + extent.y,
        nodes = treeData.asListWithIndexAndDepth(),
        {height: defaultNodeHeight, toggleWidth} = defaultNodeMorphTextBounds,
        i = 1, y = padding.top(), x = padding.left();

    // resize container to allow scrolling
    container.extent = pt(this.width, padding.top()+padding.bottom()+nodes.length*defaultNodeHeight);

    var dummyNodeMorph = new TreeNode({fontMetric: this._fontMetric, ...this.nodeStyle});

    var lineHeightCache = this._lineHeightCache || (this._lineHeightCache = [0/*root*/]);

    // skip not visible notes out of scroll bounds
    for (; i < nodes.length; i++) {
      var node = nodes[i].node,
          displayed = treeData.display(node), height;
      if (typeof displayed === "string") {
        height = defaultNodeHeight;
      } else {
        dummyNodeMorph.displayNode(
          displayed, null,
          pt(x+(toggleWidth+4)*(nodes[i].depth-1), y),
          false, true, true);
        height = dummyNodeMorph.height;
      }
      lineHeightCache[i] = height;
      if (y + height >= visibleTop) break;
      y += height;
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

      var node = nodes[i].node;
      nodeMorph.displayNode(
        treeData.display(node),
        node,
        pt(x+(toggleWidth+4)*(nodes[i].depth-1), y),
        node === selection,
        !treeData.isLeaf(node),
        treeData.isCollapsed(node));

      var height = nodeMorph.height;
      lineHeightCache[i] = height;

      y += height;
    }

// that._owner.fileTree._boundsCache

    nodeMorphs.forEach(ea => ea.remove()); // remove invisible left overs

    for (; i < nodes.length; i++) {
      var node = nodes[i].node,
          displayed = treeData.display(node), height;
      if (typeof displayed === "string") {
        height = defaultNodeHeight;
      } else {
        dummyNodeMorph.displayNode(
          displayed, null,
          pt(x+(toggleWidth+4)*(nodes[i].depth-1), y),
          false, true, true);
        height = dummyNodeMorph.height;
      }
      lineHeightCache[i] = height;
      if (y + height >= visibleTop) break;
      y += height;
    }
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
    this.scrollIndexIntoView(i);
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

    var {scroll} = this, offsetX = 0, offsetY = 0,
        lineBounds = this.lineBounds(idx),
        visibleBounds = this.innerBounds().translatedBy(scroll);

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
    this.parentMap = new WeakMap();
  }

  display(node) { throw new Error("Not yet implemented"); }
  isCollapsed(node) { throw new Error("Not yet implemented"); }
  collapse(node, bool) { throw new Error("Not yet implemented"); }
  getChildren(node) { throw new Error("Not yet implemented"); }
  isLeaf(node) { throw new Error("Not yet implemented"); }

  parentNode(childNode) {
    return this.parentMap.get(childNode) || tree.detect(this.root,
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
      tree.scrollPageUp(1);
      var {scroll} = tree,
          y = tree.padding.top(),
          targetY = scroll.y,
          newIndex = tree.lineHeightCache.findIndex(h => targetY <= (y += h))
      newIndex--; // ignore root
      tree.gotoIndex(Math.max(1, newIndex));
      return true;
    }
  },

  {
    name: "page down",
    exec: tree => {
      tree.scrollPageDown(1);
      var {scroll} = tree,
          y = tree.padding.top(),
          targetY = scroll.y + tree.height,
          newIndex = tree.lineHeightCache.findIndex(h => targetY <= (y += h));
      newIndex--; // ignore root
      tree.gotoIndex(Math.min(newIndex, tree.nodes.length-1));
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
      var td = tree.treeData;
      var nodesToChange

      if (doCollapse) {
        // find all the parent nodes of the nodes deepest in the tree below the
        // selected node and collapse those
        if (td.isCollapsed(tree.selection)) return true;

        var startNode = td.parentNode(tree.selection)
        var maxDepth = -1;
        lively.lang.tree.prewalk(startNode,
          (node, i, depth) => {
            if (depth < maxDepth) return;
            if (depth > maxDepth) {
              maxDepth = depth;
              nodesToChange = [];
            }
            if (depth === maxDepth)
              arr.pushIfNotIncluded(nodesToChange, td.parentNode(node));
          },
          td.getChildren.bind(td))

      } else {
        // find the non-leaf nodes below the selection that are at the same
        // depth and at least one of those non-leaf nodes is collapsed:
        // uncollapse all collapsed of this set
        var parents = arr.compact([td.parentNode(tree.selection)]);
        while (true) {
          if (!parents.length) break;
          nodesToChange = arr.flatmap(parents, n => allNonLeafChildren(n));
          var needCollapseChange = nodesToChange.every(n => td.isCollapsed(n) === doCollapse);
          if (!needCollapseChange) break;
          parents = nodesToChange;
        }
      }

      await collapseOrUncollapse(nodesToChange, doCollapse)

      tree.scrollSelectionIntoView();

      return true;

      function allNonLeafChildren(parent) {
        return td.getChildren(parent).filter(n => !td.isLeaf(n));
      }

      function collapseOrUncollapse(nodes, doCollapse) {
        return Promise.all(nodes.map(node => tree.onNodeCollapseChanged({node, isCollapsed: doCollapse})));
      }

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
      var {padding, selectedIndex: idx, scroll: {x: scrollX, y: scrollY}} = tree,
          lineBounds = tree.lineBounds(idx),
          pos = lineBounds.topLeft(),
          offsetX = 0, offsetY = 0,
          h = tree.height - lineBounds.height;
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
        td.getChildren.bind(td));
      printedNodes.shift();

      var content = lively.lang.string.printTree(td.root, td.display.bind(td), td.getChildren.bind(td)),
          title = treeMorph.getWindow() ? "printed " + treeMorph.getWindow().title : treeMorph.name;
      return treeMorph.world().execCommand("open text window", {title, content, name: title, fontFamily: "Inconsolata, monospace"});
    }
  }

]
