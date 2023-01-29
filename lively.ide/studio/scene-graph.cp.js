import { component, ViewModel, part, easings, touchInputDevice, Icon, morph, TilingLayout } from 'lively.morphic';
import { pt, Rectangle, Color } from 'lively.graphics';
import { rect } from 'lively.graphics/geometry-2d.js';
import { Label } from 'lively.morphic/text/label.js';
import { PropLabel } from 'lively.ide/studio/shared.cp.js';
import { SceneGraphTree, InteractiveTreeData } from './interactive-tree.js';
import { SearchField } from 'lively.components/inputs.cp.js';
import { getClassName } from 'lively.serializer2';
import { arr, obj, fun } from 'lively.lang';
import { connect } from 'lively.bindings';

export class MorphPanelModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['toggle', 'onWorldResize', 'relayout', 'clearFocus', 'reset', 'isSceneGraphPanel'];
        }
      },
      bindings: {
        get () {
          return [
            {
              target: 'scene graph', signal: 'selectedNode', handler: 'showHaloFor'
            },
            {
              target: 'scene graph', signal: 'reselectedCurrentSelection', handler: 'showHaloFor'
            },
            {
              model: 'search field', signal: 'searchInput', handler: 'filterMorphs'
            },
            {
              signal: 'onDrag', handler: 'resize', override: true
            }
          ];
        }
      }
    };
  }

  get isSceneGraphPanel () {
    return true;
  }

  showHaloFor (node) {
    if (!node) return;
    this.world().halos().forEach(h => h.remove());
    this.world().showHaloFor(node.container.viewModel.target);
  }

  relayout () {
    this.onWorldResize();
  }

  attachToWorld (world) {
    connect(world, 'onChange', this, 'onHierarchyChange', {
      garbageCollect: true
    });
    connect(world, 'onSubmorphChange', this, 'onHierarchyChange', {
      garbageCollect: true
    });
    connect(world, 'showHaloFor', this, 'selectNode', {
      garbageCollect: true
    });
    this.reset(world);
  }

  reset (world) {
    this.ui.sceneGraph.setTarget(world);
  }

  selectNode (target) {
    if (Array.isArray(target) && target.length === 1) target = target[0];
    // fixme: add support for multi selections of 2 or more morphs
    if (target.isMorph) { this.ui.sceneGraph.selectMorphInTarget(target); }
  }

  clearFocus () {
    this.ui.sceneGraph.clearSelection();
  }

  onHierarchyChange (change) {
    if (change.selector === 'addMorphAt' ||
        change.selector === 'removeMorph' ||
        change.prop === 'name') {
      const { sceneGraph } = this.ui;
      if (!sceneGraph) return;
      if (!sceneGraph.owner.visible) return;
      if (change.target && change.target.isHand) return;
      if (change.target && sceneGraph.ignoreMorph(change.target)) return;
      if (change.args && !change.args[0].isHalo && sceneGraph.ignoreMorph(change.args[0])) return;
      if (change.target.ownerChain().find(m => sceneGraph.ignoreMorph(m))) return;
      fun.debounceNamed('scene-graph-update', 50, () => sceneGraph.refresh())();
    }
  }

  detachFromWorld (world) {
    world.attributeConnections.forEach(conn => {
      if (conn.targetObj === this) conn.disconnect();
    });
  }

  onWorldResize (align = true) {
    const { view } = this;
    const bounds = $world.visibleBounds();
    const offsetTop = navigator.standalone && touchInputDevice ? 25 : 0;
    view.height = bounds.height - offsetTop;
    view.top = offsetTop + bounds.top();
    if (!align) return;
    if (view.visible) {
      view.topLeft = bounds.topLeft();
    } else view.topRight = bounds.topLeft();
  }

  async toggle (active) {
    const { view } = this;
    const bounds = $world.visibleBounds();
    const versionViewer = $world.get('lively version checker');
    this.onWorldResize(false);
    if (active) {
      $world.withTopBarDo(tb => {
        view.opacity = 0;
        $world.addMorph(view, tb.view);
      });
      view.topRight = bounds.topLeft();
      view.withAnimationDo(() => {
        view.opacity = 1;
        view.topLeft = bounds.topLeft();
        if (versionViewer) versionViewer.relayout();
      }, {
        duration: 300,
        easing: easings.outCirc
      });
      this.attachToWorld($world);
      this.ui.sceneGraph.refresh();
    } else {
      this.detachFromWorld($world);
      await view.withAnimationDo(() => {
        view.opacity = 0;
        view.topRight = bounds.topLeft();
        if (versionViewer) versionViewer.relayout();
      }, {
        duration: 300
      });
      view.remove();
    }
  }

  resize ($onDrag, evt) {
    this.view.width += evt.state.dragDelta.x;
    this.ui.sceneGraph.refresh();
  }

  filterMorphs (searchTerm) {
    this.ui.sceneGraph.filterMorphs(searchTerm);
  }
}

export class NewSceneGraphTree extends SceneGraphTree {
  renderContainerFor (submorph = morph({ name: 'root' }), embedded = true) {
    const container = part(MorphNode, { // eslint-disable-line no-use-before-define
      width: this.width,
      viewModel: {
        tree: this,
        target: submorph
      }
    });
    if (submorph._data) {
      container._data = submorph._data;
      submorph._data.container = container;
    } else {
      container._data = {
        name: submorph.name,
        isCollapsed: true,
        container,
        children: []
      };
    }
    container.refresh();
    return container;
  }

  clearSelection () {
    this.selectedNode = null;
  }

  onHoverOut (evt) {
    super.onHoverOut(evt);
    this.removeMarker('hovered node');
  }

  showDropPreviewFor (aMorph) {
    super.showDropPreviewFor(aMorph);
    this.removeMarker('hovered node');
  }

  highlightLineAtCursor (evt, style) {
    const pos = this.textPositionFromPoint(evt.positionIn(this));
    this.removeMarker('hovered node');
    const range = this.lineRange(pos.row, true);
    range.start.column = 0;
    // range.end.column = 15;
    if (!this.textAndAttributesInRange(range).find(m => m && m.isMorph)) return;
    this.addMarker({
      id: 'hovered node',
      range,
      style
    });
  }

  onMouseMove (evt) {
    super.onMouseMove(evt);
    this.highlightLineAtCursor(evt, {
      background: Color.transparent,
      transform: 'translateY(-6px)',
      borderColor: '#B2EBF2',
      borderWidth: '1px',
      borderStyle: 'solid'
    });
  }
}

export class MorphNodeModel extends ViewModel {
  static get properties () {
    return {
      target: {
        serialize: false
      },
      isContainer: {
        get () { return true; }
      },
      tree: {},
      node: {
        readOnly: true,
        get () {
          const treeData = this.tree.treeData;
          return treeData && treeData.asList().find(m => m.container === this.view);
        }
      },
      dragTriggerDistance: {
        defaultValue: 15
      },
      nameNeedsUpdate: {
        derived: true,
        get () {
          if (this.target) {
            if (this.ui.nameLabel.textString.slice(2, -1) !== this.target.name) return true;
            if (this.connectionCount !== (this.target.attributeConnections || []).length) return true;
          }
          return false;
        }
      },
      sideBar: {
        derived: true,
        get () {
          return this.view.owner.owner;
        }
      },
      expose: {
        get () {
          return ['refresh', 'highlightTerm', 'target', 'dragTriggerDistance', 'isContainer', 'onDragOutside', 'tree', 'insertAsChild', 'onChildAdded', 'onChildRemoved', 'nameNeedsUpdate'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onContextMenu', handler: 'onContextMenu' },
            { signal: 'onBeingDroppedOn', handler: 'onBeingDroppedOn', override: true },
            { signal: 'wantsToBeDroppedOn', handler: 'wantsToBeDroppedOn', override: true },
            { signal: 'onGrab', handler: 'onGrab', override: true },
            { signal: 'onHoverIn', handler: 'showControls' },
            { signal: 'onHoverOut', handler: 'hideControls' },
            { target: 'visibility icon', signal: 'onMouseDown', handler: 'toggleVisibility' }
          ];
        }
      }
    };
  }

  onContextMenu (evt) {
    this.target.onContextMenu({
      targetMorph: this.target,
      stop: () => {}
    });
  }

  toggleVisibility () {
    this.target.withMetaDo({ reconcileChanges: true }, () => {
      this.target.visible = !this.target.visible;
    });
    this.refresh();
  }

  showControls () {
    this.ui.visibilityIcon.visible = true;
  }

  hideControls () {
    this.ui.visibilityIcon.visible = !this.target.visible;
  }

  async refresh () {
    const target = this.target;
    if (!target) return;
    const { morphIcon, layoutIndicator, nameLabel, visibilityIcon } = this.ui;
    const icon = this.getIcon(target);
    let indicatorVisibility = false;
    let indicatorRot = 0;
    if (target.layout && target.layout.name() === 'Tiling') {
      indicatorVisibility = true;
      indicatorRot = target.layout.axis === 'column' ? Math.PI / 2 : 0;
    }
    if (layoutIndicator.visible !== indicatorVisibility) { layoutIndicator.visible = indicatorVisibility; }
    if (layoutIndicator.rotation !== indicatorRot) { layoutIndicator.rotation = indicatorRot; }
    if (!obj.equals(icon, morphIcon.value)) {
      morphIcon.value = icon;
    }
    if (nameLabel.textString !== target.name) {
      nameLabel.textString = target.name;
      nameLabel.fit();
    }
    visibilityIcon.value = [
      target.visible ? '\ue8f4' : '\ue8f5', {
        fontSize: 16,
        fontFamily: 'Material Icons'
      }
    ];
  }

  applyLayoutIfNeeded () {
    // only if visible
  }

  getIcon (target) {
    const klassIconMapping = {
      Morph: 'square',
      Ellipse: 'circle',
      Text: 'font',
      Label: 'tag',
      Polygon: 'draw-polygon',
      Path: 'bezier-curve',
      Image: 'image',
      Canvas: 'chess-board',
      HTMLMorph: 'code'
    };
    return Icon.textAttribute(klassIconMapping[getClassName(target)] || 'codepen', {
      paddingTop: '0px',
      fontSize: this.tree.fontSize - 2,
      opacity: 1
    });
  }

  highlightTerm (term) {
    const { nameLabel } = this.ui;
    const termToHighlight = nameLabel.textString; // just remove the icon
    const inBetween = termToHighlight.split(term);
    if (inBetween.length === 1) {
      nameLabel.textAndAttributes = [inBetween[0]];
      return;
    }

    nameLabel.textAndAttributes = [...arr.interpose(
      inBetween.map(x => [x, {}]), [term, { fontWeight: '900' }]
    ).flat()];
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
      tree.showDropPreviewFor(this.view);
    }
  }

  wantsToBeDroppedOn ($super, target) {
    const res = $super(target);
    this.showPreviewOn(target);
    if (![target, ...target.ownerChain()].includes(this.tree)) this.onDragOutside();
    return res;
  }

  async onGrab ($onGrab, evt) {
    const { view, tree, node } = this;
    tree._dropInProgress = true;
    const globalTargetPosition = this.target.globalPosition;
    $onGrab(evt);
    if (!node) return;

    tree.collapse(node); // collapse the node that is removed in case it is expanded
    tree.treeData.parentNode(node).container.onChildRemoved(this); // remove the node from the data
    this._data = tree.treeData.remove(node); // store the data in case it is needed again
    view.withMetaDo({ reconcileChanges: true }, () => {
      node.container.target.remove(); // remove the morph from the world aready
    });
    tree.update(true); // refresh the tree to render the new tree

    this._data.globalTargetPosition = globalTargetPosition;
    if (!tree.fullContainsWorldPoint(view.globalPosition)) {
      this.onDragOutside();
    } else view.leftCenter = pt(-20, 0);
    this.tree._dropInProgress = false;
  }

  onDragOutside () {
    if (!this.queue) {
      const { tree } = this;
      this.queue = fun.createQueue('container-hover-queue', async (self, thenDo) => {
        const {
          opacity: originalOpacity,
          scale: originalScale
        } = self.target;
        self.target.opacity = 0;
        self.target.scale = 0.5;
        $world.halos().forEach(h => h.remove());
        $world.firstHand.grab(self.target);
        self.target._data = self._data;
        self.remove();
        self.target.position = pt(0, 0);
        tree.treeData.remove(this.tree._previewNode);
        tree.update(true);
        await self.target.animate({
          opacity: originalOpacity,
          scale: originalScale,
          duration: 200
        });
        thenDo();
      });
    }
    this.queue.push(this.view);
  }

  onChildAdded (child) {
    const nextIndex = this.node.children.indexOf(child.node || child._data) + 1;
    const neighbor = this.node.children[nextIndex];
    const posBackup = child.target.position;
    this.target.withMetaDo({ reconcileChanges: true }, () => {
      child.target.remove();
      if (neighbor) {
        const actualIndex = this.target.submorphs.indexOf(neighbor.container.target);
        this.target.addMorphAt(child.target, actualIndex);
        child.target.globalPosition = posBackup;
      } else {
        this.target.addMorph(child.target);
        child.target.globalPosition = posBackup;
      }
    });
    if (child._data.globalTargetPosition) {
      child.target.position = this.target.localize(child._data.globalTargetPosition);
    } else if (this.target.isWorld) {
      child.target.center = $world.center;
      child.target.show();
    }
  }

  onChildRemoved (child) {
    // child.show()
  }

  async insertAsChild (node) {
    this.tree.treeData.add(node._data, this.node, this.node.children[0]); // add as child of node
    this.tree.uncollapse(this.node);
    this.tree.treeData.remove(this.tree._previewNode);
    this.tree.update(true);
    this.onChildAdded(node);
  }

  onBeingDroppedOn ($super, hand, recipient) {
    const { view } = this;
    this.tree._dropInProgress = true;
    const after = () => {
      view.fill = Color.gray.withA(0.5);
      view.opacity = 1;
      this.tree._dropInProgress = false;
      this.tree.refresh();
    };

    if (recipient.isTree) {
      recipient.insertAtPlaceholder(this.view).then(after);
    } else if (recipient.isContainer) {
      recipient.insertAsChild(this.view).then(after);
    } else {
      after();
    }
  }
}

const MorphNode = component({
  name: 'morph node',
  defaultViewModel: MorphNodeModel,
  fill: Color.rgba(255, 255, 255, 0),
  borderRadius: 5,
  clipMode: 'hidden',
  layout: new TilingLayout({
    axisAlign: 'center',
    orderByIndex: true,
    padding: rect(10, 0, 0, 0),
    resizePolicies: [['name label', {
      height: 'fill',
      width: 'fill'
    }]],
    spacing: 10,
    wrapSubmorphs: false
  }),
  draggable: true,
  grabbable: true,
  extent: pt(174.1, 30.8),
  submorphs: [{
    type: Label,
    name: 'morph icon',
    opacity: 0.4,
    fontSize: 16,
    fill: Color.rgba(229, 231, 233, 0),
    fontColor: Color.rgb(208, 208, 208),
    fontFamily: 'Material Icons',
    reactsToPointer: false,
    padding: Rectangle.inset(0, 0, 0, 5),
    textAndAttributes: ['', {
      fontSize: 16,
      fontFamily: 'Material Icons'
    }]
  }, part(PropLabel, {
    name: 'name label',
    lineHeight: 2.5,
    fixedWidth: true,
    fixedHeight: true,
    clipMode: 'hidden',
    reactsToPointer: false,
    master: PropLabel,
    padding: rect(0),
    textAndAttributes: ['some text morph', null]
  }), {
    type: Label,
    name: 'visibility icon',
    fill: Color.rgba(229, 231, 233, 0),
    fontColor: Color.rgb(208, 208, 208),
    fontFamily: 'Material Icons',
    fontSize: 16,
    nativeCursor: 'pointer',
    textAndAttributes: ['\ue8f4', {
      fontSize: 16,
      fontFamily: 'Material Icons'
    }]
  }, {
    type: Label,
    name: 'layout indicator',
    rotation: 1.5707963267948966,
    fill: Color.rgba(229, 231, 233, 0),
    fontColor: Color.rgb(208, 208, 208),
    fontFamily: 'Material Icons',
    fontSize: 16,
    nativeCursor: 'pointer',
    textAndAttributes: ['\ue8e9', {
      fontSize: 16,
      fontFamily: 'Material Icons'
    }]
  }
  ]
});

const MorphPanel = component({
  defaultViewModel: MorphPanelModel,
  name: 'morph panel',
  nativeCursor: 'ew-resize',
  extent: pt(250, 1000),
  draggable: true,
  layout: new TilingLayout({
    axis: 'column',
    orderByIndex: true,
    padding: rect(0, 0, 5, 0),
    resizePolicies: [['panel bg', {
      height: 'fill',
      width: 'fill'
    }]],
    wrapSubmorphs: false
  }),
  fill: Color.transparent,
  submorphs: [{
    name: 'panel bg',
    clipMode: 'hidden',
    layout: new TilingLayout({
      axis: 'column',
      orderByIndex: true,
      padding: rect(0, 60, 0, -60),
      resizePolicies: [['search field', {
        height: 'fixed',
        width: 'fill'
      }], ['scene graph', {
        height: 'fill',
        width: 'fill'
      }]],
      spacing: 5,
      wrapSubmorphs: false
    }),
    fill: Color.rgb(30, 30, 30).withA(0.95),
    submorphs: [
      part(SearchField, {
        name: 'search field',
        fontColor: Color.rgb(247, 247, 247),
        fontSize: 13,
        extent: pt(238, 24.9),
        borderWidth: 0,
        fill: Color.rgb(152, 152, 152),
        borderRadius: 0,
        submorphs: [{
          name: 'placeholder',
          fontSize: 14
        }]
      }),
      {
        type: NewSceneGraphTree,
        treeData: new InteractiveTreeData({}),
        name: 'scene graph',
        acceptsDrops: true,
        selectionColor: Color.rgbHex('B2EBF2').withA(0.25),
        fill: Color.rgba(255, 255, 255, 0),
        clipMode: 'hidden',
        lineHeight: 2,
        fontColor: Color.white
      }
    ]
  }]
});

export { MorphNode, MorphPanel };
