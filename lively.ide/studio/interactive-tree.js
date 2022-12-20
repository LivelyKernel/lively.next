import { Tree, TreeData } from 'lively.components/tree.js';
import { morph, TilingLayout, Icon, easings, Morph } from 'lively.morphic/index.js';
import { Color, Rectangle, rect, pt } from 'lively.graphics/index.js';
import { noUpdate } from 'lively.bindings/index.js';
import { arr, obj, fun, tree } from 'lively.lang/index.js';

import { getClassName } from 'lively.serializer2';
import Layout from 'lively.morphic/text/layout.js';

export class InteractiveTreeContainer extends Morph {
  static get properties () {
    return {
      fill: {
        defaultValue: Color.transparent
      },
      isContainer: {
        get () {
          return true;
        }
      },
      tree: {

      },
      node: {
        readOnly: true,
        get () {
          const treeData = this.tree.treeData;
          return treeData && treeData.asList().find(m => m.container === this);
        }
      }
    };
  }

  onChildRemoved (child) {

  }

  onChildAdded (child) {

  }

  toggleSelected (active) {
    if (!this.tree) return;
    const { selectionFontColor, nonSelectionFontColor } = this.tree;
    // FIXME: The "Label" Styleclass should no longer be applied, one would think
    // However, no appearances seem to be broken? ¯\_(ツ)_/¯
    this.submorphs.filter(m => !m._isControlElement && m.styleClasses.includes('Label')).forEach(m => {
      m.fontColor = active ? selectionFontColor : nonSelectionFontColor;
    });
  }

  onGrab (evt) {
    const tree = this.tree; const node = this.node;
    this.fill = Color.gray.withA(0.5);
    this.fontColor = tree.selectionFontColor;
    this.opacity = 0.8;
    super.onGrab(evt);
    if (!node) return;
    this.toggleSelected(false);
    tree.collapse(node);
    tree.treeData.parentNode(node).container.onChildRemoved(this);
    this._data = tree.treeData.remove(node);
    node.container.target.remove();
    tree.update(true);
  }

  wantsToBeDroppedOn (dropTarget) {
    this.showPreviewOn(dropTarget);
    return true;
  }

  showPreviewOn (target) {
    let tree;
    if (target.isContainer) {
      tree = target.tree;
    }
    if (target.isTree) {
      tree = target;
    }
    if (tree && tree.showDropPreviewFor) {
      tree.showDropPreviewFor(this);
    }
  }

  async insertAsChild (node) {
    this.tree.treeData.add(node._data, this.node, this.node.children[0]); // add as child of node
    this.tree.uncollapse(this.node);
    this.tree.treeData.remove(this.tree._previewNode);
    this.tree.update(true);
    this.onChildAdded(node);
  }

  onBeingDroppedOn (hand, recipient) {
    this.tree._dropInProgress = true;
    super.onBeingDroppedOn(hand, recipient);
    const after = () => {
      this.fill = Color.gray.withA(0.5);
      this.opacity = 1;
      this.tree._dropInProgress = false;
      this.tree.refresh();
    };

    if (recipient.isTree) {
      recipient.insertAtPlaceholder(this).then(after);
    } else if (recipient.isContainer) {
      recipient.insertAsChild(this).then(after);
    } else {
      after();
    }
  }
}

export class InteractiveTreeData extends TreeData {
  display (node) {
    // display the morph container of that node by default

    // in case it provides a "fast render" (i.e. text based) version
    // render that in case we are not about to interact with that node
    if (!node.container) node.container = node.getContainer();
    return [node.container || '<NO CONTAINER>', {}];
  }

  isCollapsed (node) { return node.isCollapsed; }
  collapse (node, bool) { node.isCollapsed = bool; }
  getChildren (node) {
    return node.isLeaf
      ? null
    // huge GC impact
      : (this.filterActive ? node.children.filter(n => n && n.visible) : node.children);
  }

  isLeaf (node) { return (this.getChildren(node) || []).length === 0; }

  add (node, parent = this.root, before) {
    if (!parent.children) parent.children = [];
    if (before) { arr.pushAt(parent.children, node, parent.children.indexOf(before)); } else parent.children.push(node);
    parent.isLeaf = false;
  }

  replace (nodeA, nodeB) {
    const parent = this.parentNode(nodeA);
    const idx = parent.children.indexOf(nodeA);
    parent.children[idx] = nodeB;
  }

  next (node) {
    const parent = this.parentNode(node);
    return parent && parent.children[parent.children.indexOf(node) + 1];
  }

  isBefore (nodeA, nodeB) {
    this.next(nodeA) === nodeB;
  }

  isAfter (nodeA, nodeB) {
    this.next(nodeB) === nodeA;
  }

  addBefore (node, next) {
    this.add(node, this.parentNode(next), next);
  }

  addAfter (node, prev) {
    const parent = this.parentNode(prev);
    const nextIndex = parent.children.indexOf(prev) + 1;
    this.add(node, parent, parent.children[nextIndex]);
  }

  remove (node) {
    const parent = this.parentNode(node);
    if (!parent) return;
    arr.remove(parent.children, node);
    if (parent.children === []) {
      parent.children = null;
    }
    return node;
  }

  async filter (iterator, maxDepth = 1) {
    await this.uncollapseAll((node, depth) => depth < maxDepth + 1);
    const active = this.filterActive;
    this.filterActive = false;
    this.asListWithIndexAndDepth(false).reverse().forEach(({ node, depth }) => {
      if (depth === 0) return (node.visible = true);
      node.visible = iterator(node);
      if (!node.isCollapsed && node.children.find(n => n.visible)) {
        node.visible = true;
        node.container.opacity = 0.5;
      } else node.container.opacity = 1;
      return node.visible;
    });
    this.filterActive = active;
  }
}

export class InteractiveTree extends Tree {
  update (force) {
    super.update(force);
    this.treeData && this.relayoutContainers();
    if (force) {
      this.embeddedMorphs.forEach(m => {
        if (m.isContainer) {
          if (!obj.equals(m.fill, Color.transparent)) { m.fill = Color.transparent; }
          if (m.fontFamily !== this.fontFamily) { m.fontFamily = this.fontFamily; }
          if (m.fontSize !== this.fontSize) { m.fontSize = this.fontSize; }
        }
      });
    }
  }

  onDrop (evt) {
    super.onDrop(evt);
    this.treeData.remove(this._previewNode);
    this.update(true);
  }

  onDropHoverIn (evt) {
    // prevents the default text behavior
  }

  onDropHoverUpdate (evt) {
    // prevent default
  }

  onDropHoverOut (evt) {
    // prevent default
  }

  async onHoverOut (evt) {
    super.onHoverOut(evt);
    if (this._previewNode && this._previewNode.container.world()) {
      this.treeData.remove(this._previewNode);
    }
    this.resetContainerSelection();
    this.update(true);
  }

  async insertAtPlaceholder (node) {
    const newParent = this.treeData.parentNode(this._previewNode);
    this.treeData.replace(this._previewNode, node._data);
    this.treeData.remove(this._previewNode);
    console.log('hello');
    this.update(true);
    if (newParent.container) newParent.container.onChildAdded(node);
  }

  scrollUpSlowly () {
    if (this._scrollingUp) return;
    this._scrollingUp = true;
    const scrollUp = async () => {
      if (this._scrollingUp && this.scroll.y > 0) {
        await this.animate({
          scroll: this.scroll.subXY(0, 30),
          duration: 300,
          easing: easings.linear
        });
        scrollUp();
      } else {
        this._scrollingUp = false;
      }
    };
    scrollUp();
  }

  scrollDownSlowly () {
    if (this._scrollingDown) return;
    this._scrollingDown = true;
    const scrollDown = async () => {
      if (this._scrollingDown && this.scroll.y < this.scrollExtent.y - this.height) {
        await this.animate({
          scroll: this.scroll.addXY(0, 30),
          duration: 300,
          easing: easings.linear
        });
        scrollDown();
      } else {
        this._scrollingDown = false;
      }
    };
    scrollDown();
  }

  stopScrollingSlowly () {
    this._scrollingUp = this._scrollingDown = false;
  }

  resetContainerSelection () {
    this.embeddedMorphs.forEach(m => {
      if (m.isContainer) m.fill = Color.transparent;
    });
  }

  showDropPreviewFor (target) {
    const borderDist = 4;
    const pos = this.localize(target.globalBounds().center());
    const docPos = this.textPositionFromPoint(pos);
    const nodes = this.treeData.asListWithIndexAndDepth(({ node }) =>
      node !== this._previewNode && node.container && node.container.world());
    const { node } = nodes.find(node => node.i - 1 === docPos.row) || {};
    const hoveredContainer = node && node.container;
    const placeholder = this.ensurePlaceholder();
    const previewContainer = placeholder.container;
    const previewIsShown = !!previewContainer.world();

    const positionInFrame = pos.subPt(this.scroll).subPt(this.scrollbarOffset);

    if (positionInFrame.y < 10) {
      this.scrollUpSlowly();
    } else if (positionInFrame.y > this.height - 50) {
      this.scrollDownSlowly();
    } else {
      this.stopScrollingSlowly();
    }

    this.resetContainerSelection();

    if (!hoveredContainer) {
      if (nodes.length > docPos.row) {
        return;
      }
      if (arr.last(this.treeData.root.children) === placeholder) return;
      this.treeData.remove(placeholder);
      this.treeData.add(placeholder);
      this.update(true);
    }
    if (hoveredContainer) {
      const charBounds = this.textLayout.boundsFor(this, docPos);
      if (Math.abs(charBounds.top() - pos.y) < borderDist) {
        if (this.treeData.isBefore(placeholder, node)) return;
        this.treeData.remove(placeholder);
        this.treeData.addBefore(placeholder, node);
        this.update(true);
      } else if (Math.abs(charBounds.bottom() - pos.y) < borderDist &&
                 (node.isCollapsed || this.treeData.isLeaf(node))) {
        if (this.treeData.isAfter(placeholder, node)) return;
        this.treeData.remove(placeholder);
        this.treeData.addAfter(placeholder, node);
        this.update(true);
      } else {
        hoveredContainer.fill = Color.gray.withA(0.5);
        if (!previewIsShown) return;
        this.treeData.remove(placeholder);
        this.update(true);
      }
    }
  }

  ensurePlaceholder () {
    const basicLineExtent = pt(this.width - 100, this.document.getLine(0).height);
    if (!this._previewNode) {
      this._previewNode = {
        container: morph({
          acceptsDrops: false,
          reactsToPointer: false,
          fill: Color.gray.withA(0.5),
          borderRadius: 5
        }),
        isCollapsed: true,
        isLeaf: true
      };
    }
    this._previewNode.container.extent = basicLineExtent;
    return this._previewNode;
  }

  relayoutContainers () {
    this.env.forceUpdate();
    const selectedIndex = this.selectedIndex;
    for (let { node, i } of this.treeData.asListWithIndexAndDepth()) {
      if (!node.container) continue;
      if (!this.isLineVisible(i)) continue;
      node.container.nativeCursor = 'grab';
      const newWidth = this.width - node.container.left - this.padding.right();
      if (node.container.width !== newWidth) { node.container.width = newWidth; }
    }
  }
}

class SceneGraphTreeLayout extends Layout {
  estimateExtentOfLine (morph, line, transform = morph.getGlobalTransform()) {
    const container = line.textAndAttributes.find(m => m && m.isMorph);
    if (container) { line.changeExtent(morph.width, container.height); }
  }
}

export class SceneGraphTree extends InteractiveTree {
  static get properties () {
    return {
      target: {
        serialize: false
      },
      textLayout: {
        initialize () {
          this.textLayout = new SceneGraphTreeLayout(this);
        }
      }
    };
  }

  // this.reset()
  // this.onLoad()

  beforePublish () {
    this.submorphs = [];
    this.reset();
  }

  selectMorphInTarget (morph) {
    let node = this.treeData.asList().find(n => n.container && n.container.target === morph);
    if (node && this.selectedNode !== node) {
      this.selectPath(this.treeData.pathOf(node));
    }

    if (node) return;
    this.refresh();
    this.treeData.followPath([morph, ...morph.ownerChain()].reverse(), (m, node) => {
      if (!node.container) node.container = node.getContainer();
      if (node.container) return node.container.target === m;
    }).then(node => {
      if (node) this.selectedNode = node;
    });
  }

  async onLoad () {
    this.textLayout = new SceneGraphTreeLayout(this);
    if (this.ownerChain().find(m => m.isComponent)) return;
    this.submorphs = [];
  }

  adjustProportions (evt) {
    const { y } = evt ? evt.state.dragDelta : { y: 0 };
    const inspector = this.get('inspector');
    const resizer = this.get('scene graph resizer');
    const selector = this.get('mode selector');
    const connectionTree = this.get('connections tree');

    this.height += y;
    inspector.height -= y;
    connectionTree.height -= y;
    resizer.top = this.bottom;
    resizer.left = 0;
    selector.top = resizer.bottom;
    connectionTree.top = inspector.top = selector.bottom + 5;
  }

  reset () {
    this.treeData = new InteractiveTreeData({
      children: [],
      container: morph()
    });
    this.get('inspector').targetObject = {};
    this.selectedNode = null;
    this.anchors.filter(a => a.id === null).forEach(a => this.removeAnchor(a));
  }

  // this.setTarget($world)
  // this.treeData

  async setTarget (morph) {
    // scan the morph hierarchy, collapse all initially, create all nodes
    this.target = morph;
    this.treeData = this.getTreeFromSubmorphHierarchy(morph);
    await this.uncollapse(this.treeData.root);
    this.refresh();
  }

  isNodeOutOfSync (node) {
    if (node === this._previewNode) return false; // preview does not represent a real morph
    if (this.treeData.root === node) {
      return (
        this.treeData.root.children.length !==
        this.target.submorphs.filter(m => !this.ignoreMorph(m)).length);
    }
    if (node.container.nameNeedsUpdate) return true;
    const actualSubmorphs = node.container.target.submorphs.filter(m => !this.ignoreMorph(m));
    if (actualSubmorphs.length !== node.children.length) return true;
    if (actualSubmorphs.map(m => m.name).join('') !== node.children.map(m => m.target ? m.target.name : '').join('')) return true;
    return false;
  }

  getTarget (node) {
    return node === this.treeData.root ? this.target : node.container.target;
  }

  getNewChildren (node) {
    const nodeSubmorphs = this.getTarget(node).submorphs.map(m =>
      m.__scene_graph_target__ ? m.__scene_graph_target__() : m
    ).filter(m => !this.ignoreMorph(m));
    const newChildren = [];
    for (const i in nodeSubmorphs) {
      const m = nodeSubmorphs[i];
      const children = arr.without(node.children, this._previewNode);
      const existingChild = children.find(n => n.container && n.container.target.id === m.id);
      if (existingChild) newChildren[i] = existingChild;
      else newChildren[i] = this.readMorphHierarchy(m);
    }
    return newChildren;
  }

  refresh () {
    // update the treeData in place and rerender the tree
    if (this._updating || this._dropInProgress) return;
    let changes = false;
    const { root } = this.treeData;
    // we ca not use the treeData.asList() since we are modifying the tree structure
    tree.prewalk(root, (node) => {
      if (node === root && this.isNodeOutOfSync(node)) {
        node.children = this.getNewChildren(node);
      }
      if (node.container && this.isNodeOutOfSync(node)) {
        changes = true;
        node.name = node.container.target.name;
        node.container.refresh(); // because the tree will only update structure we need to tell the containers to update themselves explicitly
        node.children = this.getNewChildren(node);
      }
    }, node => node.children);
    this.update(changes);
  }

  // this.refresh()

  ignoreMorph (m) {
    if (!m.isMorph) return false;
    return m.isContainer || m.isWindow || m.getWindow() || m.isEpiMorph || m.isHand || m.isHaloItem || m.isCommentIndicator ||
      ['lively.halos'].includes(m.constructor[Symbol.for('lively-module-meta')].package.name) ||
      ['Menu'].includes(m.constructor.name);
  }

  onDropHoverOut (evt) {
    const container = evt.hand.grabbedMorphs[0];
    const target = evt.hand.findDropTarget();
    if (target === this) return;
    if (target && target.ownerChain().includes(this)) return;
    if (container && container.isContainer) container.onDragOutside();
  }

  onDropHoverIn (evt) {
    const morph = evt.hand.grabbedMorphs[0];
    if (morph && !morph.isContainer) {
      $world.halos().forEach(h => h.remove());
      morph.remove();
      Object.assign(morph, evt.hand._grabbedMorphProperties.get(morph).pointerAndShadow);
      const container = this.renderContainerFor(morph, false);
      evt.hand.grab(container);
      container.leftCenter = pt(-20, 0);
    }
  }

  getTreeFromSubmorphHierarchy (morph) {
    return new InteractiveTreeData(this.readMorphHierarchy(morph));
  }

  readMorphHierarchy (morph) {
    return tree.mapTree(morph, (m, children) => {
      const res = {
        name: m.name,
        isCollapsed: true,
        getContainer: () => this.renderContainerFor(m),
        visible: true,
        children
      };
      if (m.isWorld) res.container = res.getContainer();
      return res;
    }, m => {
      return m.submorphs.filter(sub =>
        m.isWorld ? !this.ignoreMorph(sub) : true
      );
    });
  }

  // this.refresh()

  collapseAll () {
    this.treeData.asList().forEach(node =>
      node !== this.treeData.root ? (node.isCollapsed = true) : (node.isCollapsed = false));
  }

  async filterMorphs (term) {
    const searchTerm = term.tokens[0];

    if (!this.treeData.filterActive && !this._collapseState) {
      this._collapseState = new WeakMap(this.treeData.asList().map(n => [n, n.isCollapsed]));
    }

    this.treeData.filterActive = !!searchTerm;
    await this.treeData.filter(node => {
      const matches = !!searchTerm && node.name.includes(searchTerm);
      if (!node.container) node.container = node.getContainer();
      if (matches) {
        node.container.highlightTerm(searchTerm);
      } else {
        node.container.highlightTerm();
      }
      return matches;
    }, 3);

    if (!this.treeData.filterActive) {
      this.treeData.asList().forEach(node => {
        if (node.container) node.container.highlightTerm();
        node.visible = true;
        node.isCollapsed = this._collapseState.has(node) ? this._collapseState.get(node) : true;
      });
      this._collapseState = null;
    }
    this.refresh();
  }
}
