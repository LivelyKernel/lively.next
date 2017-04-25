import { arr, fun, obj, tree, string, promise } from "lively.lang";
import { pt, Rectangle, Color } from "lively.graphics";
import { Label } from "lively.morphic/text/label.js";
import { Morph } from "lively.morphic";
import { connect, signal } from "lively.bindings";
import { zip } from "lively.lang/array.js";

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

var treeMorph = new Tree({
  extent: pt(200,70), fill: Color.white, border: {color: Color.gray, width: 1},
  treeData: root
}).openInWorld();

*/

export class TreeNode extends Morph {

  static get properties() {
    return {

      myNode: {},

      tree: {
        derived: true, readOnly: true,
        get() { var o = this.owner; return o ? o.owner : null; }
      },

      toggle: {
        after: ["submorphs"], derived: true, readOnly: true,
        get() {
          return this.getSubmorphNamed("toggle") || (this.addMorph({
            type: Label, name: "toggle",
            fill: null, textString: this.isCollapsed ? "\uf196" : "\uf147",
            padding: Rectangle.inset(2),
            fontSize: this.fontSize-3,
            textStyleClasses: ["fa"],
            fontFamily: "FontAwesome",
            nativeCursor: "pointer"
          }));
        }
      },

      label: {
        after: ["submorphs"], derived: true, readOnly: true,
        get() {
          return this.getSubmorphNamed("label") || (this.addMorph({
            type: Label, name: "label", autofit: false,
            fontSize: this.fontSize, fontWeight: this.fontWeight, fontFamily: this.fontFamily,
            fill: null
          }));
        }
      },

      labelValue: {
        after: ["label"], derived: true,
        get() { var l = this.label; return l.owner ? l.value : ""; },
        set(val) { var l = this.label; l.value = val; }
      },

      displayedMorph: {
        after: ["submorphs", "toggle"], derived: true,
        get() { return arr.without(this.submorphs, this.getSubmorphNamed("toggle"))[0]; },
        set(m) {
          var prev = this.displayedMorph;
          if (prev === m) return;
          prev && prev.remove();
          m.owner !== this && this.addMorph(m);
        }
      },

      selectionFontColor: {
        defaultValue: Color.white,
      },

      nonSelectionFontColor: {
        defaultValue: Color.rgbHex("333"),
      },

      selectionColor: {
        defaultValue: Color.blue,
      },

      fontFamily: {
        after: ["label", "toggle", 'displayedMorph'],
        set(fontFamily) {
          this.setProperty("fontFamily", fontFamily);
          this.displayedMorph.fontFamily = fontFamily;
        }
      },

      fontSize: {
        after: ["label", "toggle", 'displayedMorph'],
        set(fontSize) {
          this.setProperty("fontSize", fontSize);
          this.displayedMorph.fontSize = fontSize;
          var toggle = this.getSubmorphNamed("toggle");
          if (toggle) toggle.fontSize = fontSize-3;
        }
      },

      fontColor: {
        after: ["label", "toggle", 'displayedMorph'],
        defaultValue: Color.rgbHex("333"),
        set(fontColor) {
          this.setProperty("fontColor", fontColor);
          this.displayedMorph.fontColor = fontColor;
          var toggle = this.getSubmorphNamed("toggle");
          if (toggle) toggle.fontColor = fontColor;
        }
      },

      fontWeight: {
        after: ['displayedMorph', "label", "toggle"],
        set(fontWeight) {
          this.setProperty("fontWeight", fontWeight);
          // rms: this still seems to be initialized before displayedMorph is set
          (this.displayedMorph || this.label).fontWeight = fontWeight;
          var toggle = this.getSubmorphNamed("toggle");
          if (toggle) toggle.fontWeight = fontWeight;
        }
      },

      isCollapsed: {
        defaultValue: false,
        set(bool) {
          let {isCollapsed, tree, myNode} = this;
          if (isCollapsed === bool) return;
          this.setProperty("isCollapsed", bool);
          var toggle = this.getSubmorphNamed("toggle");
          toggle && (toggle.textString = bool ? "\uf196" : "\uf147");
          if (myNode) {
            let payload = {node: myNode, isCollapsed: bool};
            signal(this, "collapseChanged", payload);
            tree && tree.onNodeCollapseChanged(payload);
          }
        }
      },

      isCollapsable: {
        defaultValue: false,
        set(bool) {
          this.setProperty("isCollapsable", bool);
          var toggle = this.getSubmorphNamed("toggle");
          if (!bool && toggle) toggle.remove();
          if (bool && !toggle) this.addMorph(this.toggle);
          this.relayout();
        }
      },

    }
  }

  constructor(props = {}) {
    super(props);
    this.relayout();
  }

  displayNode(displayedNode, node, pos, defaultToggleWidth, goalWidth, isSelected, isCollapsable, isCollapsed) {
    if (this.myNode) this.myNode.renderedNode = null;
    this.myNode = null;

    this.fill = isSelected ? this.selectionColor : null;

    this.position = pos;

    this.isCollapsable = isCollapsable;
    this.isCollapsed = isCollapsed;

    var {label} = this,
        toggle = this.getSubmorphNamed("toggle"),
        displayedMorph;

    if (!isCollapsable && toggle) { toggle.remove(); }
    if (!displayedNode) displayedNode = "";
    if (displayedNode.isMorph) {
      if (label.owner) label.remove();
      displayedMorph = this.displayedMorph = displayedNode;

    } else {
      if (!label.owner) this.addMorph(label);
      displayedMorph = this.displayedMorph = label;
      this.labelValue = displayedNode;
      displayedMorph.fit()
      if (goalWidth) {
        displayedMorph.width = Math.max(
          displayedMorph.textBounds().width,
          goalWidth - defaultToggleWidth);
      }
    }

    this.fontColor = isSelected ? this.selectionFontColor : this.nonSelectionFontColor;

    if (toggle) {
      toggle.fit();
      var toggleWidth = toggle.right + toggle.padding.right(),
          {y: height} = this.extent = displayedMorph.extent.addXY(toggleWidth, 0);
      toggle.leftCenter = pt(0, height/2+toggle.padding.top()/2);
      displayedMorph.topLeft = pt(toggleWidth, 0);
    } else {
      displayedMorph.topLeft = pt(defaultToggleWidth, 0);
      this.extent = displayedMorph.extent.addXY(defaultToggleWidth, 0)
    }

// if (this.owner) this.width = this.owner.width;

    this.myNode = node;
    if (this.myNode) this.myNode.renderedNode = this;
  }

  relayout() {
    var { label } = this;
    var toggle = this.getSubmorphNamed("toggle");
    label.owner && label.fit();
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

  onContextMenu(evt) {
    this.owner.owner.contextMenuForNode(this, evt)
  }

  onMouseDown(evt) {
    if (!evt.leftMouseButtonPressed() || evt.isCtrlDown()) return;

    var toggle = this.getSubmorphNamed("toggle");
    if (toggle && evt.state.clickedOnMorph === toggle) {
      this.toggleCollapse();
    } else {
      this.select();
    }
  }

  toggleCollapse() { this.isCollapsed = !this.isCollapsed; }

  select() {
    let {tree, myNode} = this;
    tree && (tree.selection = myNode)
    signal(this, "selected", myNode);
  }

  highlight() {
   if (this.displayedMorph.highlight) return this.displayedMorph.highlight();
   if (this.highlighter) this.highlighter.remove();
   const hl = this.highlighter = this.addMorph(this.displayedMorph.copy());
   hl.fontWeight = "bold", hl.fontColor = Color.orange;
   hl.reactsToPointer = false;
   hl.fadeOut(2000);
  }

}


export class Tree extends Morph {

  static get properties() {

    return {
      clipMode: {defaultValue: "auto"},
      padding: {defaultValue: Rectangle.inset(2)},

      additionalRenderSpace: { // render a little more than is seen
        defaultValue: 140
      },

      resizeNodes: {
        defaultValue: false,
        set(val) { this.setProperty("resizeNodes", val); this.resetCache(); this.update(); }
      },

      treeData: {
        set(val) { this.setProperty("treeData", val); this.resetCache(); this.update(); }
      },

      selection: {
        set(sel) { this.setProperty("selection", sel); this.update(); }
      },

      selectedIndex: {
        derived: true, after: ["selection", "nodes"],
        get() { return this.selection ? this.nodes.indexOf(this.selection) : -1; },
        set(i) { this.selection = this.nodes[i]; }
      },

      nodes: {
        derived: true, after: ["treeData"],
        get() { return this.treeData.asList(); },
      },

      selectedNodeAndSiblings: {
        readOnly: true, derived: true, after: ["selection", "treeData"],
        get() {
          return this.selection ?
            this.treeData.nodeWithSiblings(this.selection) : [];
        },
      },

      fontFamily: {
        defaultValue: "Inconsolata, monospace",
        set(fontFamily) { this.setProperty("fontFamily", fontFamily); this.update(); }
      },

      fontSize: {
        defaultValue: 15,
        set(fontSize) { this.setProperty("fontSize", fontSize); this.update(); }
      },

      fontColor: {
        defaultValue: Color.almostBlack,
        set(fontColor) { this.setProperty("fontColor", fontColor); this.update(); }
      },

      fontWeight: {
        set(fontWeight) { this.setProperty("fontWeight", fontWeight); this.update(); }
      },

      submorphs: {
        initialize() {
          this.submorphs = [{
            name: "nodeItemContainer",
            extent: this.extent, fill: null,
            draggable: false, grabbable: false, clipMode: "visible"
          }];
        }
      },

      nodeItemContainer: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() { return this.submorphs[0]; },
      },

      nodeMorphs: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() { return this.nodeItemContainer.submorphs.slice(); }
      }

    }
  }

  constructor(props = {}) {
    if (!props.treeData)
      throw new Error("Cannot create tree without TreeData!");
    super(props);
    this.resetCache();
    this.update();
    connect(this, 'extent', this, 'update');
  }

  resetCache() { this._lineHeightCache = null; }

  get isTree() { return true; }

  get nodeStyle() {
    return {
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontColor: this.fontColor,
      fontWeight: this.fontWeight,
      autofit: !this.resizeNodes
    }
  }

  get defaultNodeHeight() {
    return this.defaultNodeMorphTextBounds.height;
  }

  get defaultNodeMorphTextBounds() {
    if (this._cachedNodeMorphBounds) return this._cachedNodeMorphBounds;
    var nodeMorph = new TreeNode(this.nodeStyle);
    nodeMorph.displayNode("x", null, pt(0,0), 0, 0, false, true, true);
    var {width, height} = nodeMorph,
        {width: toggleWidth, height: toggleHeight} = nodeMorph.toggle;
    toggleWidth += nodeMorph.toggle.padding.right();
    return this._cachedNodeMorphBounds = {width, height, toggleHeight, toggleWidth};
  }

  get lineHeightCache() {
    if (!this._lineHeightCache) this.update();
    return this._lineHeightCache;
  }

  lineBounds(idx) {
    var lineHeightCache = this._lineHeightCache,
        y = arr.sum(lineHeightCache.slice(0,idx)) + this.padding.top(),
        height = lineHeightCache[idx] || this.defaultNodeHeight,
        {width} = this;
    return new Rectangle(this.padding.left(), y, width, height);
  }

  update() {
    if (!this.treeData || !this.nodeItemContainer) return;

    let {
          treeData,
          padding, scroll: {y: scrollY}, extent,
          additionalRenderSpace,
          defaultNodeMorphTextBounds, resizeNodes,
          nodeMorphs, nodeItemContainer: container, selection
        } = this,
        {
          width: defaultCharWidth,
          height: defaultNodeHeight,
          toggleWidth
        } = defaultNodeMorphTextBounds,
        visibleBottom = scrollY + extent.y + additionalRenderSpace,
        visibleTop = scrollY - additionalRenderSpace,
        nodes = treeData.asListWithIndexAndDepth(),
        i = 1, y = padding.top(), x = padding.left(),
        goalWidth = resizeNodes ? extent.x - (padding.left() + padding.right()) : null,
        maxWidth = 0;

    let dummyNodeMorph = new TreeNode(this.nodeStyle),
        lineHeightCache = this._lineHeightCache || (this._lineHeightCache = [0/*root*/]);

    // skip not visible notes out of scroll bounds
    for (; i < nodes.length; i++) {
      var height;
      if (lineHeightCache[i]) {
        height = lineHeightCache[i];
      } else {
        var node = nodes[i].node,
            displayed = treeData.safeDisplay(node);
        if (typeof displayed === "string") {
          height = defaultNodeHeight;
          maxWidth = Math.max(maxWidth, displayed.length*defaultCharWidth);
        } else {
          dummyNodeMorph.displayNode(
            displayed, null,
            pt(x+(toggleWidth+4)*(nodes[i].depth-1), y),
            toggleWidth,
            goalWidth,
            false, true, true);

          height = dummyNodeMorph.height;
          maxWidth = Math.max(maxWidth, dummyNodeMorph.width);
        }
        lineHeightCache[i] = height;
      }
      if (y + height >= visibleTop) break;
      y += height;
    }

    this.dontRecordChangesWhile(() => {
      // render visible nodes
      for (; i < nodes.length; i++) {
        if (y >= visibleBottom) break;
        var nodeMorph = nodeMorphs.shift();
        if (!nodeMorph) {
          nodeMorph = container.addMorph(new TreeNode(this.nodeStyle));
        }

        var node = nodes[i].node;
        nodeMorph.displayNode(
          treeData.safeDisplay(node),
          node,
          pt(x+(toggleWidth+4)*(nodes[i].depth-1), y),
          toggleWidth,
          goalWidth,
          node === selection,
          !treeData.isLeaf(node),
          treeData.isCollapsed(node));

        var height = nodeMorph.height;
        lineHeightCache[i] = height;
        maxWidth = Math.max(maxWidth, nodeMorph.width);

        y += height;
      }

      nodeMorphs.forEach(ea => ea.remove()); // remove invisible left overs
    });

    for (; i < nodes.length; i++) {
      var height;
      if (lineHeightCache[i]) {
        height = lineHeightCache[i];
      } else {
        var node = nodes[i].node,
            displayed = treeData.safeDisplay(node), height;
        if (typeof displayed === "string") {
          height = defaultNodeHeight;
          maxWidth = Math.max(maxWidth, displayed.length*defaultCharWidth);
        } else {
          dummyNodeMorph.displayNode(
            displayed, null,
            pt(x+(toggleWidth+4)*(nodes[i].depth-1), y),
            toggleWidth,
            goalWidth,
            false, true, true);
          height = dummyNodeMorph.height;
          maxWidth = Math.max(maxWidth, dummyNodeMorph.width);
        }
        lineHeightCache[i] = height;
      }
      y += height;
    }

    if (lineHeightCache.length > i)
      lineHeightCache.splice(i, lineHeightCache.length-i)

    // resize container to allow scrolling
    container.extent = pt(maxWidth, y+padding.bottom());

  }

  buildViewState(nodeIdFn) {
    if (typeof nodeIdFn !== "function")
      nodeIdFn = node => node;

    var selId = this.selection ? nodeIdFn(this.selection) : null,
        collapsedMap = new Map();

    tree.prewalk(this.treeData.root,
      node => collapsedMap.set(nodeIdFn(node), this.treeData.isCollapsed(node)),
      node => this.treeData.getChildrenIfUncollapsed(node));

    return {
      selectionId: selId,
      collapsedMap,
      scroll: this.scroll
    }
  }

  async applyViewState(viewState, nodeIdFn) {
    if (typeof nodeIdFn !== "function")
      nodeIdFn = node => node;

    var { selectionId, collapsedMap, scroll } = viewState,
        i = 0, newSelIndex = -1;

    while (true) {
      var nodes = this.nodes;
      if (i >= nodes.length) break;
      var id = nodeIdFn(nodes[i]);
      if (selectionId === id) newSelIndex = i;
      if (collapsedMap.has(id) && !collapsedMap.get(id))
        await this.treeData.collapse(nodes[i], false);
      i++;
    }

    this.update();
    this.selectedIndex = newSelIndex;
    this.scroll = scroll;
    this.scrollSelectionIntoView();
    await promise.delay(0);
  }

  async maintainViewStateWhile(whileFn, nodeIdFn) {
    // keeps the scroll, selection, and node collapse state, useful when updating the list
    // specify a nodeIdFn to compare old and new nodes, useful when you
    // generate a new tree but still want to have the same elements uncollapsed in
    // the new.

    var viewState = this.buildViewState(nodeIdFn);
    await whileFn();
    await this.applyViewState(viewState, nodeIdFn);
  }

  async onNodeCollapseChanged({node, isCollapsed}) {
    this.resetCache();
    try {
      await this.treeData.collapse(node, isCollapsed);
      this.update();
    } catch (e) { this.showError(e); }
  }

  async uncollapse(node = this.selection) {
    if (!node || !this.treeData.isCollapsed(node)) return;
    await this.onNodeCollapseChanged({node, isCollapsed: false});
    this.update()
    return node;
  }

  async collapse(node = this.selection) {
    if (!node || this.treeData.isCollapsed(node)) return;
    await this.onNodeCollapseChanged({node, isCollapsed: true});
    this.update()
    return node;
  }

  selectedPath() { return this.treeData.pathOf(this.selection); }

  async selectPath(path) { return this.selection = await this.treeData.followPath(path); }

  gotoIndex(i) {
    this.selection = this.nodes[i];
    this.scrollIndexIntoView(i);
  }

  onScroll() {
    fun.throttleNamed("onScroll-update-" + this.id, 100, () => { this.update(); })();
  }

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

  contextMenuForNode(nodeMorph, evt) {
    signal(this, "contextMenuRequested", {nodeMorph, evt});
  }

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

  highlightChangedNodes(treeData) {
    /* highlights all visible nodes that contain different information
       to their (location-wise) counterparts in 'treeData'. */
    let changedNodes = this.treeData.diff(treeData);
    changedNodes.forEach(([n,_]) => n.renderedNode && n.renderedNode.highlight());
  }

}


export class TreeData {

  constructor(root) {
    this.root = root;
    this.parentMap = new WeakMap();
  }

  get __dont_serialize__() { return ["parentMap"]; }
  __deserialize__() { this.parentMap = new WeakMap(); }

  display(node) { throw new Error("Not yet implemented"); }
  isCollapsed(node) { throw new Error("Not yet implemented"); }
  collapse(node, bool) { throw new Error("Not yet implemented"); }
  getChildren(node) { throw new Error("Not yet implemented"); }
  isLeaf(node) { throw new Error("Not yet implemented"); }

  getChildrenIfUncollapsed(node) {
    return this.isCollapsed(node) ? [] : this.getChildren(node);
  }

  safeDisplay(node) {
    try { return this.display(node); }
    catch (e) { return `[TreeData] Error when trying to display node: ${e}`}
  }

  nodeToString(node) {
    // for extracting rich text in textAttributes format
    var value = this.safeDisplay(node);
    if (typeof value === "string") return value;
    if (!value || !Array.isArray(value)) return String(value);
    return value.map((text, i) => i%2===0? text: "").join("");
  }

  parentNode(childNode) {
    return this.parentMap.get(childNode) || tree.detect(this.root,
      node => !this.isLeaf(node) && this.getChildrenIfUncollapsed(node).includes(childNode),
      node => this.getChildrenIfUncollapsed(node));
  }

  nodeWithSiblings(node) {
    var parent = this.parentNode(node);
    return parent ? this.getChildrenIfUncollapsed(parent) : [];
  }

  asList() {
    return this.asListWithIndexAndDepth().map(ea => ea.node);
  }

  asListWithIndexAndDepth() {
    var nodesWithIndex = []
    tree.prewalk(this.root,
      (node, i, depth) => nodesWithIndex.push({node, depth, i}),
      (node) => this.getChildrenIfUncollapsed(node));
    return nodesWithIndex;
  }

  pathOf(node) {
    var path = [];
    while (node) { path.unshift(node); node = this.parentNode(node); };
    return path;
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
          nextNode = this.getChildrenIfUncollapsed(currentNode).find(ea => eqFn(nextPathPart, ea));

      if (!nextNode)
        throw new Error(`Cannot descend into tree, next node of ${path.join(".")} not found at ${this.safeDisplay(currentNode)}`);

      currentNode = nextNode;
    }

    return currentNode;
  }

  diff(treeData) {
    /* Returns the nodes that are different to the ones in 'treeData'.
       Once a node has been determined different, it is no longer traversed further
       which means that its children are not inspected for changes.  */
    let changedNodes = [],
        aList = this.asListWithIndexAndDepth(),
        bList = treeData.asListWithIndexAndDepth();
    if (aList.length != bList.length) return [];
    for (var [a, b] of zip(aList, bList)) {
      if (!obj.equals(a.node.value, b && b.node.value)) changedNodes.push([a.node, b.node]);
    }
    return changedNodes;
  }

  patch(treeData) {
    /* change a tree in place, leaving all the unchanged nodes
       untouched */
    let changedNodes = this.diff(treeData);
    if (changedNodes.length > 0) {
      for (let [a, b] of changedNodes) {
        a.value = b.value;
      }
      return this;
    } else {
      return treeData;
    }
  }

}

var treeCommands = [

  {
    name: "select via filter",
    exec: async tree => {
      var td = tree.treeData,
          nodes = td.asListWithIndexAndDepth(),
          data = td.asListWithIndexAndDepth().map(ea =>
            Object.assign(ea, {string: td.nodeToString(ea.node)})),
          lines = string.lines(
            string.printTree(td.root, td.nodeToString.bind(td), td.getChildrenIfUncollapsed.bind(td))),
          items = td.asList().map((ea, i) => ({isListItem: true, string: lines[i], value: ea})),
          {selected: [node]} = await tree.world().filterableListPrompt("Select item", items);
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
    exec: async (treeMorph, opts = {what: "collapse"}) => {

      var doCollapse = opts.what === "collapse";
      var td = treeMorph.treeData;
      var nodesToChange

      if (doCollapse) {
        // find all the parent nodes of the nodes deepest in the tree below the
        // selected node and collapse those
        if (td.isCollapsed(treeMorph.selection)) return true;

        var startNode = td.parentNode(treeMorph.selection)
        var maxDepth = -1;
        tree.prewalk(startNode,
          (node, i, depth) => {
            if (depth < maxDepth) return;
            if (depth > maxDepth) {
              maxDepth = depth;
              nodesToChange = [];
            }
            if (depth === maxDepth)
              arr.pushIfNotIncluded(nodesToChange, td.parentNode(node));
          },
          td.getChildrenIfUncollapsed.bind(td))

      } else {
        // find the non-leaf nodes below the selection that are at the same
        // depth and at least one of those non-leaf nodes is collapsed:
        // uncollapse all collapsed of this set
        var parents = arr.compact([td.parentNode(treeMorph.selection)]);
        while (true) {
          if (!parents.length) break;
          nodesToChange = arr.flatmap(parents, n => allNonLeafChildren(n));
          var needCollapseChange = nodesToChange.every(n => td.isCollapsed(n) === doCollapse);
          if (!needCollapseChange) break;
          parents = nodesToChange;
        }
      }

      await collapseOrUncollapse(nodesToChange, doCollapse)

      treeMorph.scrollSelectionIntoView();

      return true;

      function allNonLeafChildren(parent) {
        return td.getChildrenIfUncollapsed(parent).filter(n => !td.isLeaf(n));
      }

      function collapseOrUncollapse(nodes, doCollapse) {
        return Promise.all(nodes.map(node => treeMorph.onNodeCollapseChanged({node, isCollapsed: doCollapse})));
      }

    }
  },

  {
    name: "select node above",
    exec: treeMorph => {
      var nodes = treeMorph.nodes,
          index = treeMorph.selectedIndex;
      if (index <= 1) index = nodes.length;
      treeMorph.selection = nodes[index-1];
      treeMorph.scrollSelectionIntoView();
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
      var td = treeMorph.treeData,
          content = string.printTree(td.root, td.nodeToString.bind(td), td.getChildrenIfUncollapsed.bind(td)),
          title = treeMorph.getWindow() ?
            "printed " + treeMorph.getWindow().title :
            treeMorph.name;

      return treeMorph.world().execCommand("open text window", {title, content, name: title, fontFamily: "Inconsolata, monospace"});
    }
  }

]
