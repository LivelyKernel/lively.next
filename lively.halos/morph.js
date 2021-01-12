/* global System */
import {
  Morph, Label, StyleSheet, HorizontalLayout,
  Path,
  Text,
  GridLayout,
  morph,
  Icon
} from 'lively.morphic';
import { createMorphSnapshot } from 'lively.morphic/serialization.js';
import { Color, pt, rect, Rectangle, LinearGradient } from 'lively.graphics';
import { obj, Path as PropertyPath, promise, properties, num, arr } from 'lively.lang';
import { connect, signal, disconnect, disconnectAll, once } from 'lively.bindings';

import { showAndSnapToGuides, showAndSnapToResizeGuides, removeSnapToGuidesOf } from './drag-guides.js';
import { CommentBrowser, CommentIndicator } from 'lively.collab';
import { resource } from 'lively.resources';
import { show } from './markers.js';

const haloBlue = Color.rgb(23, 160, 251);
const componentAccent = Color.magenta;
const derivedAccent = Color.purple;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// The halo morph controls a group of halo items, each of which can control or
// inspect properties of a target morph in some way
export default class Halo extends Morph {
  relayout () { this.alignWithTarget(); }

  static get properties () {
    return {
      fill: { defaultValue: Color.transparent },
      resizeOnly: { defaultValue: false },
      pointerId: {},
      hasFixedPosition: { defaultValue: true },
      respondsToVisibleWindow: { defaultValue: true },
      submorphs: {
        after: ['target'],
        initialize () {
          this.initButtons();
          this.alignWithTarget();
        }
      },
      layout: {
        after: ['submorphs'],
        initialize () {
          this.initLayout();
        }
      },
      hasTinyTarget: {
        derived: true,
        get () { return this.target.bounds().extent().dist(pt(0)) < 40; }
      },
      target: {
        get () { return this.state ? this.state.target : null; },
        set (t) {
          if (!this.state) this.state = {};
          const isUpdate = !!this.state.target;
          this.detachFromTarget();
          t = this.prepareTarget(t);
          this.state.target = t;
          isUpdate && this.alignWithTarget();
          // this.hasFixedPosition = [t, ...t.ownerChain()].find(m => m.hasFixedPosition);
          connect(t, 'onChange', this, 'alignWithTarget');
          connect(t, 'onOwnerChanged', this, 'removeIfDetached');
        }
      }
    };
  }

  get keybindings () {
    return [
      { keys: { mac: 'Meta-C', win: 'Ctrl-C' }, command: { command: 'clipboard copy', passEvent: true } }
    ];
  }

  get commands () {
    return [{
      name: 'clipboard copy',
      doc: 'copy selected morph(s) to clipboard',
      scrollCursorIntoView: false,
      exec: function (halo) {
        halo.copyHalo().copyToClipBoard();
      }
    }];
  }

  removeIfDetached () {
    setTimeout(() => {
      if (!this.target.owner) this.remove();
    });
  }

  initLayout () {
    const layout = this.layout = new GridLayout({
      autoAssign: false,
      fitToCell: false,
      columns: [
        0, { fixed: 36, paddingRight: 10 },
        2, { fixed: 26 }, 4, { fixed: 26 },
        6, { fixed: 36, paddingLeft: 10 }
      ],
      rows: [
        0, { fixed: 36, paddingBottom: 10 },
        2, { fixed: 26 }, 4, { fixed: 26 }, 6, { fixed: 26 },
        7, { fixed: 36, paddingTop: 10 }
      ],
      grid: [
        ['menu', null, 'grab', null, 'drag', null, 'close'],
        [null, null, null, null, null, null, null],
        ['copy', null, null, null, null, null, 'edit'],
        [null, null, null, null, null, null, null],
        ['component', null, null, null, null, null, 'inspect'],
        [null, null, null, null, null, null, null],
        ['rotate', null, null, null, null, null, 'resize'],
        [null, 'name', 'name', 'name', 'name', 'name', null]]
    });

    layout.col(1).row(7).group.align = 'center';
    layout.col(1).row(7).group.resize = false;
  }

  initButtons () {
    this.submorphs = [
      ...this.ensureResizeHandles(),
      ...this.resizeOnly
        ? []
        : [
            this.closeHalo(),
            this.dragHalo(),
            this.grabHalo(),
            this.menuHalo(),
            this.inspectHalo(),
            this.editHalo(),
            this.copyHalo(),
            this.componentHalo(),
            this.rotateHalo(),
            this.nameHalo(),
            this.originHalo()
          ]
    ];
  }

  get isEpiMorph () { return true; }

  get isHaloItem () { return true; }

  get isHalo () { return true; }

  get borderBox () {
    return this.getSubmorphNamed('border-box') || this.addMorphBack(morph({
      name: 'border-box',
      fill: Color.transparent,
      borderColor: this.target.isComponent ? componentAccent : haloBlue,
      borderWidth: 1
    }));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // target access
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get pointerId () { return this.state ? this.state.pointerId : null; }
  set pointerId (p) { if (!this.state) this.state = {}; this.state.pointerId = p; }

  prepareTarget (target) {
    if (!obj.isArray(target)) return target;
    if (target.length <= 1) return target[0];

    // create a SelectionTarget morph that is a placeholder for all selected
    // morphs and that the current halo will operate on
    target = target[0].world().addMorph(
      new MultiSelectionTarget({ selectedMorphs: target }));
    target.alignWithSelection();
    target.modifiesSelectedMorphs = true;
    return target;
  }

  refocus (newTarget) {
    this.target = newTarget;
    this.alignWithTarget();
  }

  alignWithTarget (change) {
    if (change && !['extent', 'position', 'scale', 'rotation'].includes(change.prop)) { return; }
    if (this.active || !this.target) return;
    const world = this.target.world() || $world;
    const worldBounds = world.visibleBounds();
    const targetBounds = this.target.globalBounds();
    const haloBounds = targetBounds.insetBy(-36).intersection(worldBounds);
    const boxBounds = targetBounds.intersection(worldBounds);
    // we could fix this, if instead of transforming to world coordinates, we just transform to halo coordinates
    this.layout && this.layout.disable();

    this.setBounds(haloBounds.translatedBy(world.scroll.negated())); // needs adhere to fixedness of halo
    this.borderBox.setBounds($world.transformRectToMorph(this, boxBounds));

    if (this.state.activeButton) {
      this.buttonControls.forEach(ea => ea.visible = false);
      this.ensureResizeHandles().forEach(h => h.visible = false);
      this.state.activeButton.visible = true;
      this.updatePropertyDisplay(this.state.activeButton);
    } else {
      if (this.changingName) this.nameHalo().toggleActive([false]);
      this.ensureResizeHandles().forEach(h => h.visible = true);
      this.buttonControls.forEach(b => { b.visible = true; });
      this.propertyDisplay.disable();
    }
    this.nameHalo().alignInHalo();
    this.ensureResizeHandles().forEach(h => h.alignInHalo());
    if (!this.resizeOnly) this.originHalo().alignInHalo();
    this.layout && this.layout.enable();
    return this;
  }

  detachFromTarget () {
    const { target } = this;
    if (!target) return;
    disconnect(target, 'onChange', this, 'alignWithTarget');
    disconnect(target, 'onOwnerChanged', this, 'removeIfDetached');
    if (target instanceof MultiSelectionTarget) {
      target.modifiesSelectedMorphs = false;
      target.remove();
    } else if (typeof target.detachedHalo === 'function') {
      target.detachedHalo(this);
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic bheavior
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  remove () {
    this.detachFromTarget();
    super.remove();
  }

  // rk 2017-01-20 FIXME why is this overwritten? To remove the halo from
  // click-throughs? in that case it should be dealt with in the event code.
  // Disabling morph position lookup creates a big exception for halos that
  // might complicate things
  morphsContainingPoint (list) { return list; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get propertyDisplay () { return HaloPropertyDisplay.for(this); }
  nameHalo () { return NameHaloItem.for(this); }
  closeHalo () { return CloseHaloItem.for(this); }
  grabHalo () { return GrabHaloItem.for(this); }
  dragHalo () { return DragHaloItem.for(this); }
  menuHalo () { return MenuHaloItem.for(this); }
  inspectHalo () { return InspectHaloItem.for(this); }
  editHalo () { return EditHaloItem.for(this); }
  rotateHalo () { return RotateHaloItem.for(this); }
  copyHalo () { return CopyHaloItem.for(this); }
  originHalo () { return OriginHaloItem.for(this); }
  componentHalo () { return ComponentHaloItem.for(this); }

  get buttonControls () { return this.submorphs.filter(m => m.isHaloItem && !m.isResizeHandle); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morph selection support
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async addMorphToSelection (morph) {
    const world = this.world();
    const currentTargets = this.target.isMorphSelection
      ? this.target.selectedMorphs
      : [this.target];
    if (currentTargets.includes(morph)) return;
    this.remove();
    return await world.showHaloForSelection([...currentTargets, morph], this.state.pointerId);
  }

  async removeMorphFromSelection (morph) {
    const world = this.world();
    this.remove();
    if (this.target.isMorphSelection) {
      arr.remove(this.target.selectedMorphs, morph);
      return await world.showHaloForSelection(
        this.target.selectedMorphs,
        this.state.pointerId);
    }
  }

  isAlreadySelected (morph) {
    return this.target == morph ||
      this.target.isMorphSelection && this.target.selectsMorph(morph);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resizing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  updateBoundsFor (corner, proportional, delta, bounds, origin) {
    const proportionalMask = {
      topLeft: rect(-1, -1, 1, 1),
      topCenter: proportional ? rect(1, -1, 0, 1) : rect(0, -1, 0, 1),
      topRight: rect(0, -1, 1, 1),
      rightCenter: proportional ? rect(0, 1, 1, 1) : rect(0, 0, 1, 0),
      bottomRight: rect(0, 0, 1, 1),
      bottomCenter: proportional ? rect(1, 0, 0, 1) : rect(0, 0, 0, 1),
      bottomLeft: rect(-1, 0, 1, 1),
      leftCenter: proportional ? rect(-1, 1, 1, 0) : rect(-1, 0, 1, 0)
    };
    const { x, y, width, height } = proportionalMask[corner];
    var delta = proportional ? this.proportionalDelta(corner, delta, bounds) : delta;
    const offsetRect = rect(
      delta.x * x,
      delta.y * y,
      delta.x * width,
      delta.y * height);
    this.active = true;
    this.target.setBounds(bounds.insetByRect(offsetRect));
    if (this.target.isPolygon || this.target.isPath) {
      // refrain from adjusting origin
      this.target.moveBy(this.target.origin.negated());
    }
    this.active = false;
    this.alignWithTarget();
    this.world().withTopBarDo(tb => {
      if (tb.activeSideBars.includes('Styling Palette')) {
        tb.stylingPalette.onHierarchyChange();
      }
    });
  }

  proportionalDelta (corner, delta, bounds) {
    const { width, height } = bounds;
    const diagonals = {
      topLeft: pt(-1, -1),
      topCenter: pt(0, -1),
      topRight: pt(1, -1),
      leftCenter: pt(-1, 0),
      rightCenter: pt(1, 0),
      bottomLeft: pt(-1, 1),
      bottomCenter: pt(0, 1),
      bottomRight: pt(1, 1)
    };
    const w = width / Math.max(width, height);
    const h = height / Math.max(height, width);
    const gradients = {
      topLeft: pt(-w, -h),
      topCenter: pt(1 / (2 * height / width), -1),
      topRight: pt(w, -h),
      leftCenter: pt(-1, height / (2 * width)),
      rightCenter: pt(1, height / (3 * width)),
      bottomLeft: pt(-w, h),
      bottomCenter: pt(1 / (2 * height / width), 1),
      bottomRight: pt(w, h)
    };
    const diagonal = diagonals[corner];
    const gradient = gradients[corner];
    return gradient.scaleBy(diagonal.dotProduct(delta) / diagonal.dotProduct(diagonal));
  }

  ensureResizeHandles () { return ResizeHandle.resizersFor(this); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // updating

  updatePropertyDisplay (haloItem) {
    const val = haloItem.valueForPropertyDisplay();
    if (typeof val !== 'undefined') { this.propertyDisplay.displayProperty(val); } else { this.propertyDisplay.disable(); }
  }

  toggleDiagonal (active, corner) {
    if (rect(0).sides.includes(corner)) return;
    let diagonal = this.getSubmorphNamed('diagonal');
    if (!active) { diagonal && diagonal.fadeOut(500); return; }

    const { x, y, width, height } = this.target.globalBounds();
    const bounds = this.localize(pt(x, y))
      .extent(pt(width, height))
      .scaleRectTo(this.innerBounds());
    const vertices = {
      topLeft: [pt(width, height), pt(0, 0)],
      topRight: [pt(0, height), pt(width, 0)],
      bottomRight: [pt(0, 0), pt(width, height)],
      bottomLeft: [pt(width, 0), pt(0, height)]
    };

    if (diagonal) { diagonal.setBounds(bounds); return; }

    const [v1, v2] = vertices[corner];
    const guideGradient = new LinearGradient({
      stops: [
        { offset: 0, color: Color.orange.withA(0) },
        { offset: 0.2, color: Color.orange },
        { offset: 0.8, color: Color.orange },
        { offset: 1, color: Color.orange.withA(0) }
      ]
    });

    diagonal = this.addMorphBack(new Path({
      opacity: 0,
      name: 'diagonal',
      borderStyle: 'dotted',
      borderWidth: 5,
      bounds,
      borderColor: guideGradient,
      vertices: [v1, v2]
    }));
    diagonal.setBounds(bounds);
    diagonal.animate({ opacity: 1, duration: 500 });
  }

  toggleRotationIndicator (active, haloItem) {
    let rotationIndicator = this.getSubmorphNamed('rotationIndicator');
    if (!active || !haloItem) {
      rotationIndicator && rotationIndicator.remove();
      return;
    }

    const originPos = this.getSubmorphNamed('origin').center;
    const localize = (p) => rotationIndicator.localizePointFrom(p, this);
    rotationIndicator = rotationIndicator || this.addMorphBack(new Path({
      name: 'rotationIndicator',
      borderColor: haloBlue,
      borderWidth: 1,
      vertices: []
    }));
    rotationIndicator.setBounds(haloItem.bounds().union(this.innerBounds()));
    rotationIndicator.vertices = [localize(originPos), localize(haloItem.center)];
  }

  toggleMorphHighlighter (active, target, showLayout = false) {
    if (!target) return;
    if (target.onHaloGrabover) {
      target.onHaloGrabover(active);
      return;
    }
    const h = MorphHighlighter.for(this, target, showLayout);
    if (active && target && target != this.world()) h && h.show(target);
    else h && h.deactivate();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ui events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  onMouseDown (evt) {
    const target = evt.state.clickedOnMorph;
    if (!evt.isCommandKey() && target == this.borderBox) return this.remove();
    if (evt.isShiftDown() && evt.isCommandKey()) {
      const actualMorph = this.target.isMorphSelection
        ? this.target.morphBeneath(evt.position)
        : this.morphBeneath(evt.position);
      this.isAlreadySelected(actualMorph)
        ? this.removeMorphFromSelection(actualMorph)
        : this.addMorphToSelection(actualMorph);
      return;
    }
    if (target == this.borderBox && evt.isCommandKey()) {
      // cycle to the next morph below at the point we clicked
      const morphsBelow = evt.world
        .morphsContainingPoint(evt.position)
        .filter(ea => ea.halosEnabled);
      const morphsBelowHaloMorph = morphsBelow.slice(morphsBelow.indexOf(this.target) + 1);
      const newTarget = morphsBelowHaloMorph[0] || morphsBelow[0] || evt.world;
      newTarget && evt.world.showHaloFor(newTarget, evt.domEvt.pointerId);
      this.remove();
    }
    if (target == this && evt.isCommandKey()) {
      const newTarget = this.morphBeneath(evt.position);
      evt.world.showHaloFor(newTarget, evt.domEvt.pointerId);
    }
    if (target == this) this.remove();
  }

  onKeyUp (evt) {
    if (!this.changingName) { this.buttonControls.map(b => b.onKeyUp(evt)); }
  }

  getMesh ({ x, y }, offset = pt(0, 0)) {
    const { height, width } = this.world().visibleBounds();
    const defaultGuideProps = {
      borderStyle: 'dotted',
      borderWidth: 2,
      borderColor: Color.orange
    };
    const mesh =
          this.get('mesh') ||
          this.addMorph(
            new Morph({
              name: 'mesh',
              styleClasses: ['halo-mesh'],
              extent: pt(width, height),
              fill: null,
              submorphs: [
                new Path({ name: 'vertical', ...defaultGuideProps }),
                new Path({ name: 'horizontal', ...defaultGuideProps })
              ]
            })
          );
    mesh.globalPosition = offset;
    mesh.getSubmorphNamed('vertical').vertices = [
      pt(x, 0).subPt(offset),
      pt(x, height).subPt(offset)
    ];
    mesh.getSubmorphNamed('horizontal').vertices = [
      pt(0, y).subPt(offset),
      pt(width, y).subPt(offset)
    ];
    return mesh;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// The thing at the top left of the halo that indicates currently changing
// properties such as the position of the halo target
class HaloPropertyDisplay extends Label {
  static get morphName () { return 'propertyDisplay'; }
  static get defaultPosition () { return pt(25, 0); }

  static for (halo) {
    return halo.getSubmorphNamed(this.morphName) || halo.addMorph(new this({ name: this.morphName }));
  }

  static get properties () {
    return {
      name: { defaultValue: this.name },
      fill: { defaultValue: Color.black.withA(0.7) },
      borderRadius: { defaultValue: 7 },
      padding: { defaultValue: Rectangle.inset(5) },
      visible: { defaultValue: false },
      readOnly: { defaultValue: true },
      fontSize: { defaultValue: 12 },
      fontColor: { defaultValue: Color.white },
      position: { defaultValue: this.defaultPosition }
    };
  }

  get isHaloItem () { return false; }

  get halo () { return this.owner; }

  displayedValue () { return this.textString; }

  displayProperty (val) {
    const activeButton = this.halo.state.activeButton;
    val = String(val);
    this.visible = true;
    this.textString = val;
    this.position = this.constructor.defaultPosition;
    if (this.bounds().insetBy(10).intersects(activeButton.bounds())) {
      this.position = pt(activeButton.topRight.x + 10, this.position.y);
    }
  }

  disable () {
    this.position = this.constructor.defaultPosition;
    this.visible = false;
  }
}

// Placeholder for halot.target when multiple morphs are selected
class MultiSelectionTarget extends Morph {
  static get properties () {
    return {
      visible: { defaultValue: false },
      modifiesSelectedMorphs: { defaultValue: false },
      selectedMorphs: { defaultValue: [] },
      halosEnabled: { defaultValue: false }
    };
  }

  get isHaloItem () { return true; }
  get isMorphSelection () { return true; }

  selectsMorph (morph) { return this.selectedMorphs.includes(morph); }

  alignWithSelection () {
    const bounds = this.selectedMorphs
      .map(m => m.globalBounds())
      .reduce((a, b) => a.union(b));
    this.setBounds(bounds);
  }

  onGrab (evt) {
    // shove all of the selected Morphs into the hand
    this.grabbingHand = evt.hand;
    this.selectionGrabbed = true;
    evt.hand.grab(this.selectedMorphs);
    once(evt.hand, 'dropMorphsOn', this, 'onGrabEnd');
    connect(evt.hand, 'position', this, 'alignWithSelection');
  }

  onGrabEnd () {
    this.selectionGrabbed = false;
    disconnectAll(this.grabbingHand);
  }

  updateExtent ({ prevValue, value }) {
    const delta = value.subPt(prevValue);
    this.selectedMorphs.forEach(m => m.resizeBy(delta));
  }

  updatePosition ({ prevValue, value }) {
    if (this.selectionGrabbed) return;
    const delta = value.subPt(prevValue);
    this.selectedMorphs.forEach(m => m.moveBy(delta));
  }

  updateRotation ({ prevValue, value }) {
    const delta = value - prevValue;
    this.selectedMorphs.forEach(m => {
      const oldOrigin = m.origin;
      m.adjustOrigin(m.localize(this.worldPoint(pt(0, 0))));
      m.rotation += delta;
      m.adjustOrigin(oldOrigin);
    });
  }

  updateScale ({ prevValue, value }) {
    const delta = value - prevValue;
    this.selectedMorphs.forEach(m => {
      const oldOrigin = m.origin;
      m.adjustOrigin(m.localize(this.worldPoint(pt(0, 0))));
      m.scale += delta;
      m.adjustOrigin(oldOrigin);
    });
  }

  onChange (change) {
    super.onChange(change);
    if (!this.modifiesSelectedMorphs) return;
    switch (change.prop) {
      case 'extent': this.updateExtent(change); break;
      case 'scale': this.updateScale(change); break;
      case 'position': this.updatePosition(change); break;
      case 'rotation': this.updateRotation(change); break;
    }
    return change;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// Abstract halo item, subclasses are specific ui elements that control /
// display morph properties
class HaloItem extends Morph {
  static get properties () {
    return {
      borderRadius: { defaultValue: 15 },
      nativeCursor: { defaultValue: 'pointer' },
      fill: { defaultValue: Color.gray.withA(0.7) },
      grabbable: { defaultValue: false },
      extent: { defaultValue: pt(24, 24) },
      halo: {}
    };
  }

  static for (halo) {
    return halo.getSubmorphNamed(this.morphName) ||
        halo.addMorph(new this({ halo, name: this.morphName }));
  }

  get isEpiMorph () { return true; }
  get isHaloItem () { return true; }

  menuItems () { return []; }

  init () {}
  update () {}
  stop () {}
  valueForPropertyDisplay () { return undefined; }
}

// name label + input of a morph
class NameHolder extends Morph {
  static get properties () {
    return {
      tooltip: { defaultValue: "Click to edit the morph's name" },
      draggable: { defaultValue: false },
      fill: { defaultValue: Color.transparent },
      forceUniqueName: { defaultValue: false },
      halo: {},
      layout: {
        after: ['nameHolder'],
        initialize () { this.layout = new HorizontalLayout({ resizeContainer: true, spacing: 7 }); }
      },
      nameHolder: {
        after: ['submorphs'],
        initialize () {
          this.nameHolder = this.addMorph(new Text({
            fill: Color.transparent,
            fontColor: Color.white,
            fontWeight: 'bold',
            active: true
          }));
          connect(this.nameHolder, 'onBlur', this, 'accept');
        }
      }
    };
  }

  onHoverIn (evt) {
    if (this.highlightOnHover && this.nameHolder.active) {
      this.halo.toggleMorphHighlighter(true, this.target);
      this.nameHolder.fontColor = Color.orange;
    }
  }

  onHoverOut (evt) {
    if (this.highlightOnHover) {
      this.halo.toggleMorphHighlighter(false, this.target);
      this.nameHolder.fontColor = Color.darkgray;
    }
  }

  accept () {
    if (this.target.name !== this.nameHolder.textString) { this.updateName(this.nameHolder.textString); }
  }

  onKeyDown (evt) {
    if (evt.keyCombo == 'Enter') {
      this.accept();
      this.halo.focus();
      evt.stop();
    } else {
      super.onKeyDown(evt);
    }
  }

  onMouseUp () {
    signal(this, 'active', [true, this]);
  }

  onMouseDown (evt) {
    this.nameHolder.fontColor = Color.white;
    this.halo.toggleMorphHighlighter(false, this.target);
  }

  onKeyUp (evt) {
    const newName = this.nameHolder.textString; const owner = this.target.owner;
    this.validName = !owner || !owner.getSubmorphNamed(newName) ||
      this.target.name == newName;
    signal(this, 'valid', [this.validName, newName]);
  }

  update () {
    if (this.nameHolder.textString === this.target.name) return;
    this.nameHolder.textString = this.target.name;
    this.whenRendered().then(() => this.nameHolder.fit());
  }

  activate () {
    this.nameHolder.readOnly = false;
    this.nameHolder.active = true;
    this.nameHolder.animate({ opacity: 1 });
  }

  deactivate () {
    this.nameHolder.readOnly = true;
    this.nameHolder.active = false;
    this.nameHolder.animate({ opacity: 0.3 });
  }

  updateName (newName) {
    if (!this.forceUniqueName || this.validName) {
      this.target.name = newName;
      signal(this, 'active', [false, this]);
    }
  }
}

class NameHaloItem extends HaloItem {
  static get morphName () { return 'name'; }
  static get properties () {
    return {
      borderRadius: { defaultValue: 4 },
      fill: { defaultValue: haloBlue },
      borderColor: { defaultValue: Color.green },
      layout: {
        initialize () {
          this.layout = new HorizontalLayout({
            resizeContainer: true, spacing: 0, align: 'center', orderByIndex: true
          });
        }
      }
    };
  }

  constructor (props) {
    super(props);

    this.initComponentLink();

    this.initNameHolders();

    this.validityIndicator = Icon.makeLabel('check', {
      fontColor: Color.green,
      fontSize: 15,
      padding: rect(4, 6, 4, 0)
    });

    this.fill = this.halo.target.isComponent ? componentAccent : haloBlue;

    this.alignInHalo();
  }

  initComponentLink () {
    const target = this.halo.target;
    if (!target || target.isMorphSelection) return;
    if (target.master) {
      const appliedMaster = target.master.determineMaster(target);
      const isLocal = appliedMaster && !!appliedMaster.world();
      const linkToWorld = appliedMaster ? target.master.getWorldUrlFor(appliedMaster) : 'this project';
      const masterLink = this.addMorph(Icon.makeLabel(linkToWorld ? 'external-link-alt' : 'exclamation-triangle', {
        nativeCursor: 'pointer',
        fontColor: Color.white,
        padding: rect(8, 0, -8, 0),
        name: 'master link',
        tooltip: 'Located in ' + linkToWorld
      }));
      linkToWorld && connect(masterLink, 'onMouseDown', () => {
        isLocal ? this.showLocalMaster(appliedMaster) : window.open(linkToWorld);
      });
    }
  }

  showLocalMaster (masterComponent) {
    let win;
    if (win = masterComponent.getWindow()) {
      win.activate();
      if (win.minimized) win.minimized = false;
    }
    masterComponent.show();
  }

  targets () {
    if (!this.halo.target) return [];
    return this.halo.target.isMorphSelection
      ? this.halo.target.selectedMorphs.map(target => {
          return { target, highlightOnHover: true };
        })
      : [{ target: this.halo.target, highlightOnHover: false }];
  }

  initNameHolders () {
    this.nameHolders = this.targets().map(({ target, highlightOnHover }) => {
      const nh = new NameHolder({ halo: this.halo, highlightOnHover, target });
      connect(nh, 'active', this, 'toggleActive');
      connect(nh, 'valid', this, 'toggleNameValid');
      return nh;
    });
    this.submorphs = [...this.submorphs, ...arr.interpose(this.nameHolders, {
      extent: pt(1, 28),
      fill: Color.black.withA(0.4)
    })];
  }

  toggleActive ([active, nameHolder]) {
    if (this.halo.changingName === active) { return; }
    this.halo.changingName = active;
    const masterLink = this.get('master link');
    if (masterLink) { masterLink.visible = masterLink.isLayoutable = !active; }
    if (active) {
      this.nameHolders.forEach(nh => nh != nameHolder && nh.deactivate());
      this.borderWidth = 3;
      this.addMorph(this.validityIndicator);
      this.fill = Color.darkGray;
      setTimeout(() => nameHolder.nameHolder.selectAll());
    } else {
      this.fill = haloBlue;
      this.nameHolders.forEach(nh => nh != nameHolder && nh.activate());
      this.borderWidth = 0;
      this.validityIndicator.remove();
      // this.halo.focus();
    }
    this.alignInHalo();
  }

  toggleNameValid ([valid, name]) {
    this.validName = valid;
    if (valid) {
      this.conflictingMorph = null;
      this.borderColor = Color.green;
      this.validityIndicator.nativeCursor = 'auto';
      this.validityIndicator.fontColor = Color.green;
      Icon.setIcon(this.validityIndicator, 'check');
    } else {
      this.conflictingMorph = this.get(name);
      this.borderColor = Color.red;
      this.validityIndicator.fontColor = Color.red;
      this.validityIndicator.nativeCursor = 'pointer';
      Icon.setIcon(this.validityIndicator, 'exclamation-circle');
    }
  }

  alignInHalo () {
    arr.zip(this.targets(), this.nameHolders).map(([{ target }, nh]) => {
      nh.target = target;
      nh.update();
    });
    const { x, y } = this.halo.innerBounds().bottomCenter().addPt(pt(0, 2));
    this.topCenter = pt(Math.max(x, 30), Math.max(y, 80));
  }

  onMouseDown (evt) {
    const m = this.conflictingMorph;
    if (m) {
      this.halo.toggleMorphHighlighter(true, m);
      setTimeout(() => this.halo.toggleMorphHighlighter(false, m), 1000);
    }
  }
}

class CloseHaloItem extends HaloItem {
  static get morphName () { return 'close'; }

  static get properties () {
    return {
      styleClasses: { defaultValue: ['fas', 'fa-trash'] },
      draggable: { defaultValue: false },
      tooltip: { defaultValue: 'Remove this morph from the world' }
    };
  }

  update () {
    const { halo } = this; const o = halo.target.owner;
    o.undoStart('close-halo');
    halo.target.selectedMorphs
      ? halo.target.selectedMorphs.forEach(m => m.abandon())
      : halo.target.abandon();
    o.undoStop('close-halo');
    halo.remove();
  }

  onMouseDown (evt) { this.update(); }
}

class GrabHaloItem extends HaloItem {
  static get morphName () { return 'grab'; }

  static get properties () {
    return {
      styleClasses: { defaultValue: ['far', 'fa-hand-rock'] },
      tooltip: { defaultValue: 'Grab the morph' },
      draggable: { defaultValue: true }
    };
  }

  adjustTarget (target, pos) {
    if (PropertyPath('owner.layout.autoResize').get(target)) {
      if (!target.globalBounds().insetBy(10).containsPoint(pos)) target = target.owner;
    }
    return target;
  }

  valueForPropertyDisplay () {
    const { hand, halo, prevDropTarget } = this;
    const world = hand.world();
    let dropTarget = hand.findDropTarget(
      hand.globalPosition,
      [halo.target],
      morph => {
        return !morph.isHaloItem && !morph.ownerChain().some(m =>
          m.isHaloItem || !m.visible || m.opacity == 0);
      });
    if (!dropTarget) return;
    dropTarget = this.adjustTarget(dropTarget, hand.globalPosition);
    halo.toggleMorphHighlighter(dropTarget && dropTarget != world, dropTarget, true);
    if (prevDropTarget && prevDropTarget != dropTarget) { halo.toggleMorphHighlighter(false, prevDropTarget); }
    this.prevDropTarget = dropTarget;
    return dropTarget && dropTarget.name;
  }

  init (hand) {
    const { halo } = this;
    const undo = halo.target.undoStart('grab-halo');
    undo && undo.addTarget(halo.target.owner);
    this.hand = hand;
    halo.target.onGrab({ halo, hand, isShiftDown: () => false });
    halo.state.activeButton = this;
    this.opacity = 0.3;
    const c = connect(hand, 'update', this, 'update');
    once(halo.target, 'remove', () => c.disconnect());
  }

  stop (evt) {
    const { halo, prevDropTarget } = this;
    const undo = halo.target.undoInProgress;
    let dropTarget = evt.hand.findDropTarget(
      evt.hand.globalPosition,
      [halo.target],
      m => !m.isHaloItem && !m.ownerChain().some(m => m.isHaloItem));
    dropTarget = this.adjustTarget(dropTarget, evt.hand.globalPosition);
    disconnect(evt.hand, 'update', this, 'update');
    MorphHighlighter.interceptDrop(halo, dropTarget, halo.target);
    undo.addTarget(dropTarget);
    dropTarget.onDrop(evt);
    halo.state.activeButton = null;
    halo.alignWithTarget();
    halo.toggleMorphHighlighter(false, prevDropTarget);
    MorphHighlighter.removeHighlighters(halo);
    halo.target.undoStop('grab-halo');
    this.opacity = 1;
  }

  update () { this.halo.alignWithTarget(); }
  onDragStart (evt) { this.init(evt.hand); }
  onDragEnd (evt) { this.stop(evt); }
}

class DragHaloItem extends HaloItem {
  static get morphName () { return 'drag'; }

  static get properties () {
    return {
      draggable: { defaultValue: true },
      styleClasses: { defaultValue: ['fas', 'fa-arrows-alt'] },
      tooltip: { defaultValue: "Change the morph's position. Press (alt) while dragging to align the morph's position along a grid." }
    };
  }

  valueForPropertyDisplay () { return this.halo.target.position; }

  updateAlignmentGuide (active) {
    let mesh = this.halo.getSubmorphNamed('mesh');
    if (!active) { mesh && mesh.remove(); return; }

    mesh = this.halo.getMesh(this.halo.target.worldPoint(pt(0, 0)));

    this.focus();
    return mesh;
  }

  init () {
    const target = this.halo.target;
    target.undoStart('drag-halo');
    this.halo.state.activeButton = this;
    this.actualPos = target.position;
    this.targetTransform = target.owner.getGlobalTransform().inverse();
  }

  stop () {
    this.halo.target.undoStop('drag-halo');
    this.halo.state.activeButton = null;
    this.halo.alignWithTarget();
    this.updateAlignmentGuide(false);
    removeSnapToGuidesOf(this.halo.target);
  }

  update (delta, grid = false, snapToGuides = false) {
    let newPos = this.actualPos.addPt(this.targetTransform.transformDirection(delta));
    this.actualPos = newPos;
    if (grid) {
      newPos = newPos.griddedBy(pt(10, 10));
    }
    this.halo.target.position = newPos;
    this.updateAlignmentGuide(grid);
    this.world().withTopBarDo(tb => {
      if (tb.activeSideBars.includes('Styling Palette')) {
        tb.stylingPalette.onHierarchyChange();
      }
    });
    if (!grid) {
      showAndSnapToGuides(
        this.halo.target, true /* showGuides */, snapToGuides,
        5/* eps */, 500/* maxDist */);
    }
  }

  onDragStart (evt) { this.init(); }
  onDrag (evt) { this.update(evt.state.dragDelta, evt.isAltDown(), evt.isCtrlDown()); }
  onDragEnd (evt) { this.stop(); }
  onKeyUp (evt) { this.updateAlignmentGuide(false); }
}

class InspectHaloItem extends HaloItem {
  static get morphName () { return 'inspect'; }

  static get properties () {
    return {
      tooltip: { defaultValue: "Inspect the morph's local state" },
      draggable: { defaultValue: false },
      styleClasses: { defaultValue: ['fas', 'fa-cogs'] }
    };
  }

  onMouseDown (evt) {
    (async () => {
      const { default: Inspector } = await System.import('lively.ide/js/inspector.js');
      const existing = this.world().getSubmorphsByStyleClassName('Inspector')
        .find(i => i.targetObject == this.halo.target);
      let win;
      if (existing && (win = existing.getWindow())) {
        win.minimized = false;
        win.activate();
        win.animate({ center: this.world().visibleBounds().center(), duration: 200 });
      } else {
        Inspector.openInWindow({ targetObject: this.halo.target });
      }
      this.halo.remove();
    })();
  }
}

class EditHaloItem extends HaloItem {
  static get morphName () { return 'edit'; }

  static get properties () {
    return {
      tooltip: { defaultValue: "Edit the morph's definition" },
      draggable: { defaultValue: false },
      styleClasses: { defaultValue: ['fas', 'fa-wrench'] }
    };
  }

  onMouseDown (evt) {
    const existing = this.world().getSubmorphsByStyleClassName('ObjectEditor')
      .find(oe => oe.target == this.halo.target);
    if (existing) {
      const win = existing.getWindow();
      win.bringToFront();
      win.minimized = false;
      win.animate({ center: this.world().visibleBounds().center(), duration: 200 });
    } else {
      $world.execCommand('open object editor', { target: this.halo.target });
    }
    this.halo.remove();
  }
}

class RotateHaloItem extends HaloItem {
  static get morphName () { return 'rotate'; }

  static get properties () {
    return {
      draggable: {
        defaultValue: true
      }
    };
  }

  constructor (props) { super(props); this.adaptAppearance(false); }

  get angle () { return this.getProperty('angle') || 0; }
  set angle (val) { this.setProperty('angle', val); }
  get scaleGauge () { return this.getProperty('scaleGauge') || null; }
  set scaleGauge (val) { this.setProperty('scaleGauge', val); }
  get initRotation () { return this.getProperty('initRotation') || 0; }
  set initRotation (val) { this.setProperty('initRotation', val); }

  valueForPropertyDisplay () {
    const { scaleGauge, halo: { target: t } } = this;
    return scaleGauge
      ? t.scale.toFixed(4).toString()
      : num.toDegrees(t.rotation).toFixed(1) + '°';
  }

  init (angleToTarget) {
    this.detachFromLayout();
    this.halo.target.undoStart('rotate-halo');
    this.halo.state.activeButton = this;
    this.angle = angleToTarget;
    this.initRotation = this.halo.target.rotation;
    this.halo.toggleRotationIndicator(true, this);
  }

  initScale (gauge) {
    this.detachFromLayout();
    this.halo.state.activeButton = this;
    this.scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
    this.halo.toggleRotationIndicator(true, this);
  }

  update (angleToTarget) {
    this.scaleGauge = null;
    let newRotation = this.initRotation + (angleToTarget - this.angle);
    newRotation = num.toRadians(num.detent(num.toDegrees(newRotation), 10, 45));
    this.halo.target.rotation = newRotation;
    this.halo.toggleRotationIndicator(true, this);
  }

  updateScale (gauge) {
    let { scaleGauge: scaleG, halo } = this;
    if (!scaleG) scaleG = this.scaleGauge = gauge.scaleBy(1 / halo.target.scale);
    this.angle = gauge.theta();
    this.initRotation = halo.target.rotation;
    halo.target.scale = num.detent(gauge.dist(pt(0, 0)) / scaleG.dist(pt(0, 0)), 0.1, 0.5);
    halo.toggleRotationIndicator(true, this);
  }

  stop () {
    this.attachToLayout();
    this.scaleGauge = null;
    this.halo.state.activeButton = null;
    this.halo.alignWithTarget();
    this.halo.toggleRotationIndicator(false, this);
    this.halo.target.undoStop('rotate-halo');
    this.halo.ensureResizeHandles();
  }

  adaptAppearance (scaling) {
    this.styleClasses = ['fas', scaling ? 'fa-search-plus' : 'fa-redo'];
    this.tooltip = scaling ? 'Scale morph' : 'Rotate morph';
  }

  detachFromLayout () {
    this.savedLayout = this.halo.layout;
    this.halo.layout = null;
  }

  attachToLayout () {
    this.halo.layout = this.savedLayout;
  }

  // events
  onDragStart (evt) {
    this.adaptAppearance(evt.isShiftDown());
    if (evt.isShiftDown()) {
      this.initScale(evt.position.subPt(this.halo.target.globalPosition));
    } else {
      this.init(evt.position.subPt(this.halo.target.globalPosition).theta());
    }
  }

  onDrag (evt) {
    this.globalPosition = evt.position.addPt(pt(-10, -10));
    this.adaptAppearance(evt.isShiftDown());
    if (evt.isShiftDown()) {
      this.updateScale(evt.position.subPt(this.halo.target.globalPosition));
    } else {
      this.update(evt.position.subPt(this.halo.target.globalPosition).theta());
    }
  }

  onDragEnd (evt) {
    this.adaptAppearance(evt.isShiftDown());
    this.stop();
  }

  onKeyDown (evt) { this.adaptAppearance(evt.isShiftDown()); }
  onKeyUp (evt) { this.adaptAppearance(evt.isShiftDown()); }
}

const nameNumberRe = /(.+)([0-9]+)$/;

class ComponentHaloItem extends HaloItem {
  static get morphName () { return 'component'; }

  static get properties () {
    return {
      tooltip: {
        get () {
          return this.halo.target.isComponent ? 'Retract Component' : 'Turn into Component';
        }
      },
      styleClasses: {
        initialize () {
          this.styleClasses = this.halo.target.isComponent ? ['fas', 'fa-eraser'] : ['fas', 'fa-cube'];
        }
      }
    };
  }

  updateComponentIndicator () {
    const world = this.world();
    const target = this.halo.target;
    this.halo.remove();
    world.showHaloFor(target);
  }

  async checkForDuplicateNamesInHierarchy () {
    const target = this.halo.target;
    const world = this.world();
    const morphsInHierarchy = [];
    target.withAllSubmorphsDoExcluding(m => {
      if (m != target) morphsInHierarchy.push(m);
    }, m => m.master);
    const nameGroups = arr.groupBy(morphsInHierarchy, m => m.name);
    const defaultStyle = { fontWeight: 'normal', fontSize: 16 };
    // initial warn to allow the user to cancel the component conversion
    if (Object.values(nameGroups).find(ms => ms.length > 1)) {
      const numberOfAmbigousMorphs = arr.sum(Object.values(nameGroups).filter(ms => ms.length > 1).map(ms => ms.length));
      const canProceed = await world.confirm([
        'Ambigous Names in Submorph Hierarchy  ', {}, ...Icon.textAttribute('exclamation-triangle', { fontColor: Color.rgb(230, 126, 34), fontSize: 30, lineHeight: '40px' }),
        `\nThe morph you are about to turn into a component has ${numberOfAmbigousMorphs} morphs within its submorph hierarchy, that have ambigous names. This can lead to incorrect applications of style properties when you create derived instances from this component.\n\n`, { ...defaultStyle, textAlign: 'left' },
        'Usually ambigous names are caused if your component is in some kind of intermittent state, where it already displays an example state or code has run that automatically created interface elements. This can be fixed by resetting the submorphs of this morph, usually by implementing a ', { ...defaultStyle, textAlign: 'left', fontStyle: 'italic' }, 'reset()', { ...defaultStyle, fontStyle: 'italic', fontFamily: 'IBM Plex Mono' }, ' routine you can invoke to put the morph into some kind of "neutral" state. Alternatively you can go ahead and rename the duplicate morphs to have proper unique names. If you have a hard time giving the conflicting morphs appropriate names, this can be an indication that the component you are declaring is too large, and you need to decompose your component into subcomponents further.', { ...defaultStyle, textAlign: 'left', fontStyle: 'italic' }
      ], {
        width: 600,
        confirmLabel: 'PROCEED TO RENAME',
        rejectLabel: 'CANCEL',
        align: 'left'
      });
      if (!canProceed) return;
    }

    for (const name in nameGroups) {
      if (nameGroups[name].length < 2) continue;
      let nonUniqueMorphs = nameGroups[name];
      while (nonUniqueMorphs.length > 1) {
        const morphToBeRenamed = nonUniqueMorphs[0];
        // morphToBeRenamed = that
        show(morphToBeRenamed, true);
        const newName = await world.prompt([
          'Name Collision\n', {},
          'The name of\n', defaultStyle,
          morphToBeRenamed.toString(), {
            ...defaultStyle, fontStyle: 'italic', fontWeight: 'bold'
          },
          '\nis not unique within the submorph hierachy of\n', { ...defaultStyle },
          target.name, { ...defaultStyle, fontStyle: 'italic', fontWeight: 'bold' },
          `\nThere ${nonUniqueMorphs.length > 2 ? 'are ' + (nonUniqueMorphs.length - 1) + ' other morphs' : 'is one other morph'} with the exact same name located in this component.`, defaultStyle,
          ' Duplicate names can cause errors when applying styles to derived morphs of this master component, so it is essential that there is no name ambiguity. Please enter a new name for this or the other conflicting morphs:', defaultStyle
        ], {
          input: morphToBeRenamed.name,
          lineWrapping: true,
          width: 500,
          fontSize: 12,
          rejectLabel: 'IGNORE',
          confirmLabel: 'RENAME',
          errorMessage: 'Provided name is not unique',
          validate: (val) => !Object.keys(nameGroups).includes(val)
        });
        signal(world, 'hideMarkers');
        // remove the indicator
        if (newName) morphToBeRenamed.name = newName;
        if (newName in nameGroups) continue;
        else if (!newName) {
          nonUniqueMorphs = arr.rotate(nonUniqueMorphs);
          continue; // force rename
        }
        arr.remove(nonUniqueMorphs, morphToBeRenamed);
      }
    }
    return true;
  }

  async onMouseDown () {
    const target = this.halo.target;
    const toBeComponent = !target.isComponent;
    const numDuplicates = $world.getAllNamed(target.name).length;
    if (toBeComponent && numDuplicates > 1) {
      const newName = await $world.prompt([
        'Name Conflict\n', {},
        `The morph\'s name you are about to turn into a component is already used by ${numDuplicates - 1} other morph${numDuplicates > 2 ? 's' : ''}. Please enter a `, {
          fontWeight: 'normal'
        }, 'unique identifier', { fontStyle: 'italic' },
        ' for this component within this project.', {
          fontWeight: 'normal', fontSize: 16
        }], {
        input: target.name,
        lineWrapping: true,
        width: 400,
        errorMessage: 'Identifier not unique',
        validate: (input) => $world.getAllNamed(input).length == 0
      });
      if (!newName) return;
      target.name = newName;
    }
    target.isComponent = toBeComponent && await this.checkForDuplicateNamesInHierarchy();
    if (!this.world()) target.world().showHaloFor(target); // halo got disposed
    else this.updateComponentIndicator();
  }
}

class CopyHaloItem extends HaloItem {
  static get morphName () { return 'copy'; }

  static get properties () {
    return {
      draggable: { defaultValue: true },
      tooltip: { defaultValue: 'Copy morph' },
      styleClasses: { defaultValue: ['far', 'fa-clone'] }
    };
  }

  init (hand) {
    const { halo } = this; const { target } = halo; const world = halo.world();
    const isMultiSelection = target instanceof MultiSelectionTarget;
    halo.remove();
    connect(hand, 'update', this, 'update');
    if (isMultiSelection) {
      // FIXME! haaaaack
      const copies = target.selectedMorphs.map(ea => {
        if (ea.canBeCopied()) {
          const copy = ea.copy(true);
          world.addMorph(copy);
          return copy;
        }
      }).filter(copy => copy);

      const positions = copies.map(ea => { ea.name = findNewName(target, ea.name); return ea.position; });
      copies[0].undoStart('copy-halo');
      world.addMorph(halo);
      halo.refocus(copies);
      hand.grab(halo.target);
      halo.target.onGrab({ halo, hand, isShiftDown: () => false });
      positions.forEach((pos, i) => copies[i].globalPosition = pos);
      halo.alignWithTarget();
    } else {
      const pos = target.globalPosition;
      const copy = target.copy(true);
      if (target.isComponent) {
        copy.isComponent = false;
        copy.withAllSubmorphsDoExcluding(m => {
          if (m == copy || !m.master) { delete m._parametrizedProps; }
        }, m => m.master && m != copy);
        copy.master = target;
      }
      copy.name = findNewName(target, target.name);
      world.addMorph(copy);
      copy.globalPosition = pos;
      copy.undoStart('copy-halo');
      hand.grab(copy);
      world.addMorph(halo);

      halo.visible = false;
    }

    function findNewName (originalMorph, name) {
      if (!name.match(nameNumberRe)) return name + '1';
      return name.replace(nameNumberRe, (_, name, num) => {
        if (!num) num = '0';
        let n = Number(num);
        while (originalMorph.get(name + ++n)) {}
        return name + n;
      });
    }
  }

  stop (hand) {
    const { halo } = this;
    const [copy] = hand.grabbedMorphs;
    const dropTarget = hand.findDropTarget(
      hand.globalPosition,
      [halo.target],
      m => !m.isHaloItem && !m.ownerChain().some(m => m.isHaloItem));
    const undo = halo.target.undoInProgress;
    disconnect(hand, 'update', this, 'update');
    undo.addTarget(dropTarget);
    hand.dropMorphsOn(dropTarget);
    halo.target.undoStop('copy-halo');
    halo.remove();
    hand.world().showHaloFor(copy);
  }

  onDragStart (evt) { this.init(evt.hand); }
  onDragEnd (evt) { this.stop(evt.hand); }
  update () { this.halo.alignWithTarget(); }

  async copyToClipBoard () {
    const { halo } = this;

    if (halo.nameHalo().nameHolders.find(nh => nh.nameHolder === $world.focusedMorph)) return;

    const t = halo.target;
    const world = halo.world();
    const isMultiSelection = t instanceof MultiSelectionTarget;
    const origin = t.globalBounds().topLeft();
    // the original morphs are needed so we can refocus them with a halo after copying
    const morphsToCopy = isMultiSelection ? t.selectedMorphs : [t];
    const modifiedMorphsToCopy = morphsToCopy.filter(morph => !morph.isCommentIndicator).map(morph => morph.copy(true));
    const snapshots = [];
    let html = `<!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            ${document.querySelector('#lively-morphic-css').outerHTML}
          </head>
          <body>`;

    halo.remove(); // we do not want to copy the halo
    try {
      for (const m of modifiedMorphsToCopy) {
        const snap = await createMorphSnapshot(m, { addPreview: false, testLoad: false });
        snap.copyMeta = { offset: m.worldPoint(pt(0, 0)).subPt(origin) };
        snapshots.push(snap);
        html += m.renderPreview();
      }

      html += '</body></html>';

      const data = JSON.stringify(snapshots);

      await this.env.eventDispatcher.doCopyWithMimeTypes([
        { type: 'text/html', data: html },
        { type: 'application/morphic', data }
      ]);
    } catch (e) { world.logError(e); return; }
    world.addMorph(halo);
    halo.refocus(morphsToCopy);
    halo.setStatusMessage('copied');
  }

  async onMouseUp (evt) {
    evt.stop();
    await this.copyToClipBoard();
  }
}

class OriginHaloItem extends HaloItem {
  static get morphName () { return 'origin'; }

  static get properties () {
    return {
      borderWidth: { defaultValue: 3 },
      nativeCursor: { defaultValue: '-webkit-grab' },
      draggable: { defaultValue: true },
      borderColor: {
        after: ['halo'],
        initialize () {
          this.borderColor = this.halo.target.isComponent ? componentAccent : haloBlue;
        }
      }
    };
  }

  get fill () { return Color.white.interpolate(0.2, this.borderColorTop); }
  get extent () { return pt(15, 15); }
  get tooltip () { return "Change the morph's origin"; }

  computePositionAtTarget () {
    const topLeft = this.halo.target.globalPosition;
    return this.halo.localize(topLeft);
  }

  alignInHalo () {
    this.visible = !this.halo.hasTinyTarget;
    this.center = this.computePositionAtTarget();
  }

  valueForPropertyDisplay () { return this.halo.target.origin; }

  init () {
    this.halo.target.undoStart('origin-halo');
    this.halo.state.activeButton = this;
  }

  stop () {
    this.halo.target.undoStop('origin-halo');
    this.halo.state.activeButton = null;
    this.halo.alignWithTarget();
  }

  update (delta) {
    const { halo } = this;
    const oldOrigin = halo.target.origin;
    const globalOrigin = halo.target.worldPoint(oldOrigin);
    const newOrigin = halo.target.localize(globalOrigin.addPt(delta)).subPt(halo.target.scroll);
    delta = newOrigin.subPt(oldOrigin);
    halo.target.adjustOrigin(halo.target.origin.addPt(delta));
  }

  onDragStart (evt) { this.init(); }
  onDragEnd (evt) { this.stop(); }
  onDrag (evt) { this.update(evt.state.dragDelta); }
}

// The white thingies at the corner and edges of a morph
class ResizeHandle extends HaloItem {
  static get properties () {
    return {
      corner: {},
      location: {},
      draggable: { defaultValue: true },
      isResizeHandle: {
        readOnly: true,
        get () { return true; }
      }
    };
  }

  static getResizeParts (rotation) {
    if (rotation > 0) rotation = rotation - 360;
    let offset = -8 - (rotation / 45).toFixed();
    if (offset == 0) offset = 8;

    return arr.zip(
      arr.rotate(
        [
          ['topLeft', delta => delta.negated()],
          ['topCenter', delta => delta.withX(0).negated()],
          ['topRight', delta => delta.withX(0).negated()],
          ['rightCenter', delta => pt(0, 0)],
          ['bottomRight', delta => pt(0, 0)],
          ['bottomCenter', delta => pt(0, 0)],
          ['bottomLeft', delta => delta.withY(0).negated()],
          ['leftCenter', delta => delta.withY(0).negated()]
        ],
        offset
      ),
      [
        ['nwse-resize', 'topLeft'],
        ['ns-resize', 'topCenter'],
        ['nesw-resize', 'topRight'],
        ['ew-resize', 'rightCenter'],
        ['nwse-resize', 'bottomRight'],
        ['ns-resize', 'bottomCenter'],
        ['nesw-resize', 'bottomLeft'],
        ['ew-resize', 'leftCenter']
      ]
    );
  }

  static resizersFor (halo) {
    if (!halo.target) return [];
    const globalRot = halo.target.getGlobalTransform().getRotation();
    return arr.compact(this.getResizeParts(globalRot)
      .map(([[corner, deltaMask, originDelta], [nativeCursor, location]]) =>
        this.for(halo, corner, location, nativeCursor))).map(h => h.alignInHalo());
  }

  static for (halo, corner, location, nativeCursor) {
    const name = 'Resize ' + corner;
    const resizer = halo.getSubmorphNamed(name) || new this({
      name,
      halo,
      corner,
      tooltip: 'Resize ' + corner,
      extent: pt(10, 10),
      borderWidth: 1,
      borderRadius: 0,
      borderColor: halo.target.isComponent ? componentAccent : haloBlue,
      fill: Color.white
    });
    return Object.assign(resizer, { nativeCursor, location });
  }

  valueForPropertyDisplay () {
    const { x: width, y: height } = this.halo.target.extent;
    return `${width.toFixed(1)}x${height.toFixed(1)}`;
  }

  positionInHalo () {
    let bounds = this.halo.borderBox.bounds();
    if (this.halo.hasTinyTarget) {
      if (Rectangle.prototype.sides.includes(this.location)) this.visible = false;
      bounds = bounds.insetBy(-4);
    }
    return bounds.partNamed(this.location);
  }

  alignInHalo () { this.center = this.positionInHalo(); return this; }

  onKeyUp (evt) {
    if (this.halo.state.activeButton == this) { this.halo.toggleDiagonal(evt.isShiftDown(), this.corner); }
  }

  onKeyDown (evt) {
    if (this.halo.state.activeButton == this) { this.halo.toggleDiagonal(evt.isShiftDown(), this.corner); }
  }

  onDragStart (evt) {
    this.init(evt.position, evt.isShiftDown());
  }

  onDragEnd (evt) {
    this.stop(evt.isShiftDown());
  }

  onDrag (evt) {
    this.update(evt.position, evt.isShiftDown(), evt.isAltDown(), evt.isCtrlDown());
    this.focus();
  }

  init (startPos, proportional = false) {
    const { origin, position, extent } = this.halo.target;
    this.startPos = startPos;
    this.startBounds = position.subPt(origin).extent(extent);
    this.startOrigin = this.halo.target.origin;
    this.savedLayout = this.halo.layout;
    this.halo.layout = null;
    this.halo.state.activeButton = this;
    this.tfm = this.halo.target.getGlobalTransform().inverse();
    const globalRot = this.halo.target.getGlobalTransform().getRotation();
    this.offsetRotation = num.toRadians(globalRot % 45);
    // add up rotations
    this.halo.toggleDiagonal(proportional, this.corner);
  }

  update (currentPos, shiftDown = false, altDown = false, ctrlDown = false) {
    const { corner, tfm, startPos, halo: { target } } = this;
    const { x, y } = startPos.subPt(currentPos);
    let delta = tfm.transformDirection(pt(x, y));
    if (altDown) {
      delta = delta.griddedBy(pt(10, 10));
    }
    this.halo.updateBoundsFor(
      corner,
      shiftDown,
      delta,
      this.startBounds,
      this.startOrigin
    );
    this.halo.toggleDiagonal(shiftDown, corner);
    this.updateAlignmentGuide(altDown);

    const sides = [];
    const cl = corner.toLowerCase();
    if (cl.includes('left')) sides.push('left');
    if (cl.includes('top')) sides.push('top');
    if (cl.includes('bottom')) sides.push('bottom');
    if (cl.includes('right')) sides.push('right');

    showAndSnapToResizeGuides(
      this.halo.target, sides,
      true/* showGuides */, ctrlDown/* snap */,
      5/* epsilon */, 200/* maxDist */);
  }

  stop (proportional) {
    const { halo: h } = this;
    h.layout = this.savedLayout;
    h.state.activeButton = null;
    h.alignWithTarget();
    h.toggleDiagonal(false);
    this.updateAlignmentGuide(false);
    removeSnapToGuidesOf(h.target);
  }

  updateAlignmentGuide (active) {
    let mesh = this.halo.getSubmorphNamed('mesh');
    if (!active) { mesh && mesh.remove(); return; }
    const { x, y } = this.halo.target.extent;
    const offset = pt(x % 10, y % 10);
    mesh = this.halo.getMesh(this.globalPosition.addPt(this.extent.scaleBy(0.5)), offset);

    this.focus();
    return mesh;
  }
}

class MenuHaloItem extends HaloItem {
  static get morphName () { return 'menu'; }

  static get properties () {
    return {
      draggable: { defaultValue: false },
      tooltip: { defaultValue: 'Opens the morph menu' },
      styleClasses: { defaultValue: ['fas', 'fa-bars'] }
    };
  }

  async onMouseDown (evt) {
    const target = this.halo.target;
    this.halo.remove();
    const menuItems = await target.menuItems();
    target.world().openMenu(menuItems).hasFixedPosition = this.halo.hasFixedPosition;
  }
}

// The orange thing that indicates a drop target when a grabbed morph is
// hovered over another morph. For some reason it doubles as the container for
// the "layout halo" items

export class MorphHighlighter extends Morph {
  static get properties () {
    return {
      draggable: { defaultValue: false },
      name: { defaultValue: 'morphHighlighter' },
      styleClasses: { defaultValue: ['inactive'] },
      reactsToPointer: { defaultValue: false },
      hasFixedPosition: { defaultValue: true },
      fill: { defaultValue: Color.orange.withA(0.3) },
      borderWidth: { defaultValue: 2 },
      borderColor: { defaultValue: Color.orange },
      halo: {},
      epiMorph: { defaultValue: true },
      isHighlighter: { readOnly: true, defaultValue: true },
      highlightedSides: {
        defaultValue: [],
        set (sides) {
          this.setProperty('highlightedSides', sides);
          this.submorphs = sides.map(side => {
            return {
              type: 'ellipse',
              isHaloItem: true,
              fill: Color.orange,
              center: this.innerBounds()[side]()
            };
          });
          this.addMorph({
            type: 'label',
            name: 'name tag',
            padding: Rectangle.inset(5, 5, 5, 5),
            fontColor: Color.white,
            fill: Color.orange,
            borderRadius: 3
          });
          this.alignWithHalo();
        }
      },
      showLayout: { defaultValue: false },
      targetId: {},
      target: {
        readOnly: true,
        derived: true,
        get () {
          return (this.world() || this.env.world).getMorphWithId(this.targetId);
        }
      }
    };
  }

  static removeHighlighters (halo = $world) {
    const store = halo._morphHighlighters;
    for (const id in store) { store[id].remove(); }
    delete halo._morphHighlighters;
  }

  static for (halo, morph, showLayout = false, highlightedSides = []) {
    const store = (halo._morphHighlighters = halo._morphHighlighters || {});
    properties.forEachOwn(store, (_, h) => h.alignWithHalo());
    if (!morph || morph.ownerChain().find(owner => owner.isHaloItem)) return null;
    store[morph.id] = store[morph.id] || new this({ targetId: morph.id, halo, showLayout });
    halo.addMorph(store[morph.id]);
    store[morph.id].highlightedSides = highlightedSides;
    return store[morph.id];
  }

  static interceptDrop (halo, target, morph) {
    const store = halo._morphHighlighters = halo._morphHighlighters || {};
    store && store[target.id] && store[target.id].handleDrop(morph);
  }

  alignWithHalo () {
    if (this.target) {
      this.position = this.halo.localize(this.target.globalBounds().topLeft());
      if (this.halo.isWorld) this.position = this.position.subPt(this.halo.scroll);
      this.extent = this.target.globalBounds().extent();
      this.get('name tag').value = this.target.name;
      this.get('name tag').topCenter = this.innerBounds().insetBy(-10).bottomCenter();
    }
  }

  show () {
    if (this.target && this.target.layout && this.showLayout) {
      this.layoutHalo =
        this.layoutHalo || this.world().showLayoutHaloFor(this.target, this.pointerId);
      if (this.layoutHalo && this.layoutHalo.previewDrop) {
        this.visible = false;
        this.alignWithHalo();
        if (this.halo.get('grab').hand.grabbedMorphs) { this.layoutHalo.previewDrop(this.halo.get('grab').hand.grabbedMorphs); }
        return;
      }
    }

    this.visible = true;
    this.alignWithHalo();
  }

  handleDrop (morph) {
    this.layoutHalo && this.layoutHalo.handleDrop(morph);
  }

  deactivate () {
    if (this.layoutHalo) {
      this.layoutHalo.remove();
      this.layoutHalo = null;
    }
    this.visible = false;
    this.alignWithHalo();
    this.remove();
  }
}

export class InteractiveMorphSelector {
  static selectMorph (world, controllingMorph, filterFn) {
    const sel = new this(world, controllingMorph, filterFn);
    sel.selectNewTarget();
    return sel.whenDone;
  }

  constructor (world = $world, controllingMorph = null, filterFn) {
    this.controllingMorph = controllingMorph;
    this.selectorMorph = null;
    this.morphHighlighter = null;
    this.possibleTarget = null;
    this.world = world;
    this.filterFn = filterFn;
    this.whenDone = null;
  }

  selectNewTarget () {
    this.targetObject = null;
    const deferred = promise.deferred();
    deferred.promise.resolve = deferred.resolve;
    this.whenDone = deferred.promise;
    this.selectorMorph = Icon.makeLabel('crosshairs', { fontSize: 20, hasFixedPosition: true, epiMorph: true }).openInWorld();
    connect(this.world.firstHand, 'position', this, 'scanForTargetAt');
    once(this.selectorMorph, 'onMouseDown', this, 'selectTarget');
    once(this.selectorMorph, 'onKeyDown', this, 'stopSelect');
    this.selectorMorph.focus();
    this.scanForTargetAt(this.world.firstHand.position);
  }

  scanForTargetAt () {
    const pos = this.world.firstHand.globalPosition;
    this.selectorMorph.center = pos;
    this.selectorMorph.focus();
    let target = this.selectorMorph.morphBeneath(pos); let hiddenMorph;
    let { possibleTarget, controllingMorph, filterFn, world, morphHighlighter } = this;
    if (morphHighlighter == target) {
      target = morphHighlighter.morphBeneath(pos);
    } else if (target && target.isEpiMorph) {
      target = target.morphBeneath(pos);
    }
    while (target && (hiddenMorph = [target, ...target.ownerChain()].find(m => {
      return !m.visible;
    }))) {
      target = hiddenMorph = hiddenMorph.morphBeneath(pos);
    }
    if (target && filterFn && !filterFn(target)) {
      while (target && ![target, ...target.ownerChain()].find(filterFn)) {
        target = target.morphBeneath(pos);
      }
    }
    if (!target) return;
    if (target != possibleTarget &&
        (!controllingMorph ||
         !target.ownerChain().includes(controllingMorph.getWindow()))) {
      if (morphHighlighter) morphHighlighter.deactivate();
      this.possibleTarget = possibleTarget = target;
      if (possibleTarget && !possibleTarget.isWorld) {
        const h = this.morphHighlighter = MorphHighlighter.for(world, target);
        h && h.show();
      }
    }
  }

  selectTarget () {
    this.targetObject = this.possibleTarget;
    this.stopSelect();
  }

  stopSelect () {
    MorphHighlighter.removeHighlighters(this.world);
    disconnect(this.world.firstHand, 'position', this, 'scanForTargetAt');
    this.selectorMorph.remove();
    this.whenDone && this.whenDone.resolve(this.targetObject);
  }
}
