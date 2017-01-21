import {
  Morph,
  Path,
  Text,
  GridLayout,
  morph
} from "../index.js";
import { Color, pt, rect, Rectangle, LinearGradient } from "lively.graphics";
import { obj, arr, properties } from "lively.lang";
import { connect, disconnect, disconnectAll, once } from "lively.bindings";

import { inspectHalo, morphHighlighter, resizeHandle, nameHalo, editHalo, copyHalo, dragHalo, grabHalo, closeHalo, rotateHalo, originHalo, stylizeHalo } from "./items.js";



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// 
export class Halo extends Morph {

  constructor(props = {}) {
    var target = props.target;
    super({
      fill: Color.transparent,
      ...obj.dissoc(props, ["target"])
    });
    this.target = props.target;
    this.initButtons();
    this.initLayout();
    this.focus();
  }

  initButtons() {
    this.submorphs = this.submorphs.concat([
      ...this.resizeHalos(),
      this.closeHalo(),
      this.dragHalo(),
      this.grabHalo(),
      this.inspectHalo(),
      this.editHalo(),
      this.copyHalo(),
      this.rotateHalo(),
      this.stylizeHalo(),
      this.nameHalo(),
      this.originHalo()
    ]);
  }

  initLayout() {
    this.layout = new GridLayout({
      autoAssign: false,
      grid: [
          [null,    null, "grab", null, "drag", null, "close"],
          [null,    null,  null,  null,  null,  null,  null],
          ["copy",  null,  null,  null,  null,  null, "edit"],
          [null,    null,  null,  null,  null,  null, null],
          ["style", null,  null,  null,  null,  null, "inspect"],
          [null,    null,  null,  null,  null,  null, null],
          ["rotate",null,  null,  null,  null,  null, "resize"],
          [null,    "name","name","name","name","name", null]]});

    this.layout.col(0).fixed = 36;
    this.layout.col(0).paddingRight = 10;
    this.layout.col(2).fixed = 26;
    this.layout.col(4).fixed = 26;
    this.layout.col(6).fixed = 36;
    this.layout.col(6).paddingLeft = 10;

    this.layout.row(0).fixed = 36;
    this.layout.row(0).paddingBottom = 10;
    this.layout.row(2).fixed = 26;
    this.layout.row(4).fixed = 26;
    this.layout.row(6).fixed = 26;
    this.layout.row(7).fixed = 36;
    this.layout.row(7).paddingTop = 10;

    this.layout.col(1).row(7).group.align = "center";
    this.layout.col(1).row(7).group.resize = false;
  }

  get isEpiMorph() { return true; }

  get isHaloItem() { return true }

  get isHalo() { return true }

  get borderBox() {
    return this.getSubmorphNamed("border-box") || this.addMorphBack({
      isHalo: true,
      name: "border-box", fill: Color.transparent,
      borderColor: Color.red, borderWidth: 2
    });
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // target access
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get pointerId() { return this.state ? this.state.pointerId : null; }
  set pointerId(p) { if (!this.state) this.state = {}; this.state.pointerId = p; }

  get target() { return this.state ? this.state.target : null; }
  set target(t) {
    this.target && disconnect(this.target, "onChange", this, "alignWithTarget");
    if (this.targetProxy) {
      this.targetProxy.modifiesSelectedMorphs = false;
      this.targetProxy.remove();
      this.targetProxy = null;
    }

    if (!this.state) this.state = {};
    t = this.prepareTarget(t);
    this.state.target = t
    this.alignWithTarget();
    connect(t, "onChange", this, "alignWithTarget");
  }

  prepareTarget(target) {
    if (!obj.isArray(target)) return target;
    if (target.length <= 1) return target[0];

    // create a SelectionTarget morph that is a placeholder for all selected
    // morphs and that the current halo will operate on
    this.targetProxy = target[0].world().addMorph(
      new MultiSelectionTarget({selectedMorphs: target}));
    this.targetProxy.alignWithSelection();
    this.targetProxy.modifiesSelectedMorphs = true;
    return this.targetProxy;
  }

  refocus(newTarget) {
    this.target = newTarget;
    this.alignWithTarget();
  }

  alignWithTarget() {
    if (!this.world()) {
      this.visible = false;
      return this.whenRendered().then(() => {
        this.visible = true;
        this.alignWithTarget();
      });
    }
    const targetBounds = this.target.globalBounds(),
          worldBounds = this.target.world().innerBounds(),
          {x, y, width, height} = targetBounds.intersection(worldBounds);
    this.setBounds(targetBounds.insetBy(-36).intersection(worldBounds));
    this.borderBox.setBounds(this.localize(pt(x,y)).extent(pt(width,height)));
    if (this.activeButton) {
      this.buttonControls.forEach(ea => ea.visible = false);
      this.activeButton.visible = true;
      this.updatePropertyDisplay(this.activeButton);
    } else {
      if (this.changingName) this.nameHalo().toggleActive([false]);
      this.buttonControls.forEach(b => { b.visible = true;});
      this.propertyDisplay.disable();
    }
    this.resizeHandles().forEach(h => h.alignInHalo());
    this.originHalo().alignInHalo();
    return this;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic bheavior
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  remove() {
    disconnect(this.target, "onChange", this, "alignWithTarget");
    if (this.targetProxy) {
      this.targetProxy.modifiesSelectedMorphs = false;
      this.targetProxy.remove();
      this.targetProxy = null;
    }
    super.remove();
  }

  // rk 2017-01-20 FIXME why is this overwritten? To remove the halo from
  // click-throughs? in that case it should be dealt with in the event code.
  // Disabling morph position lookup creates a big exception for halos that
  // might complicate things
  morphsContainingPoint(list) { return list; }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get propertyDisplay() {
    return this.getSubmorphNamed("propertyDisplay")
        || this.addMorph(new HaloPropertyDisplay());
  }

  nameHalo() {
    return this.getSubmorphNamed("name")
        || this.addMorph(nameHalo(this));
  }


  closeHalo() {
    return this.getSubmorphNamed("close") || this.addMorph(closeHalo(this));
  }

  grabHalo() {
    var dropTarget;
    return this.getSubmorphNamed("grab") || this.addMorph(grabHalo(this));
  }

  dragHalo() {
    return this.getSubmorphNamed("drag") || this.addMorph(dragHalo(this));
  }

  inspectHalo() {
    return this.getSubmorphNamed("inspect") || this.addMorph(inspectHalo(this));
  }

  editHalo() {
    return this.getSubmorphNamed("edit") || this.addMorph(editHalo(this));
  }

  rotateHalo() {
    return this.getSubmorphNamed("rotate") || this.addMorph(rotateHalo(this));
  }

  copyHalo() {
    return this.getSubmorphNamed("copy") || this.addMorph(copyHalo(this));
  }

  originHalo() {
    return this.getSubmorphNamed("origin") || this.addMorph(originHalo(this));
  }

  stylizeHalo() {
    return this.getSubmorphNamed("style") || this.addMorph(stylizeHalo(this));
  }

  get buttonControls() { return this.submorphs.filter(m => m.isHaloItem); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morph selection support
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  addMorphToSelection(morph) {
    const world = this.world(),
          currentTargets = this.target.isMorphSelection ?
                             this.target.selectedMorphs : [this.target];
    this.remove();
    return world.showHaloForSelection([...currentTargets, morph], this.state.pointerId);
  }

  removeMorphFromSelection(morph) {
    const world = this.world();
    this.remove();
    if (this.target.isMorphSelection) {
      arr.remove(this.target.selectedMorphs, morph);
      return world.showHaloForSelection(
        this.target.selectedMorphs,
        this.state.pointerId);
    }
  }

  isAlreadySelected(morph) {
    return this.target == morph ||
      this.target.isMorphSelection && this.target.selectsMorph(morph);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resizing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  updateBoundsFor(corner, proportional, delta, bounds, origin) {
    var proportionalMask = {
          topLeft: rect(-1, -1, 1, 1),
          topCenter: proportional ? rect(1, -1, 0, 1) : rect(0, -1, 0, 1),
          topRight: rect(0, -1, 1, 1),
          rightCenter: proportional ? rect(0, 1, 1, 1) : rect(0, 0, 1, 0),
          bottomRight: rect(0, 0, 1, 1),
          bottomCenter: proportional ? rect(1, 0, 0, 1) : rect(0, 0, 0, 1),
          bottomLeft: rect(-1, 0, 1, 1),
          leftCenter: proportional ? rect(-1, 1, 1, 0) : rect(-1, 0, 1, 0)
        },
        {x, y, width, height} = proportionalMask[corner],
        delta = proportional ? this.proportionalDelta(corner, delta, bounds) : delta,
        offsetRect = rect(
          delta.x * x,
          delta.y * y,
          delta.x * width,
          delta.y * height),
        oldPosition = this.target.position;
    this.target.setBounds(bounds.insetByRect(offsetRect));
    if (this.target.isPolygon || this.target.isPath) {
      // refrain from adjusting origin
      this.target.moveBy(this.target.origin.negated());
    } else {
      this.target.origin = origin.addPt({x: -offsetRect.x, y: -offsetRect.y});
      this.target.position = oldPosition;
    }
  }

  proportionalDelta(corner, delta, bounds) {
    let {width, height} = bounds,
        diagonals = {
          topLeft: pt(-1, -1),
          topCenter: pt(0, -1),
          topRight: pt(1, -1),
          leftCenter: pt(-1, 0),
          rightCenter: pt(1, 0),
          bottomLeft: pt(-1, 1),
          bottomCenter: pt(0, 1),
          bottomRight: pt(1, 1)
        },
        w = width / Math.max(width, height),
        h = height / Math.max(height, width),
        gradients = {
          topLeft: pt(-w, -h),
          topCenter: pt(1 / (2 * height / width), -1),
          topRight: pt(w, -h),
          leftCenter: pt(-1, height / (2 * width)),
          rightCenter: pt(1, height / (3 * width)),
          bottomLeft: pt(-w, h),
          bottomCenter: pt(1 / (2 * height / width), 1),
          bottomRight: pt(w, h)
        },
        diagonal = diagonals[corner],
        gradient = gradients[corner];
    return gradient.scaleBy(diagonal.dotProduct(delta) / diagonal.dotProduct(diagonal));
  }

  getGlobalRotation() {
    return this.target.getGlobalTransform().getRotation();
  }

  getGlobalScale() {
    return this.target.getGlobalTransform().getScale();
  }

  getResizeParts(rotation) {
    if (rotation > 0) rotation = rotation - 360;
    var offset = -8 - (rotation / 45).toFixed();
    if (offset == 0) offset = 8;

    return arr.zip(
      arr.rotate(
        [
          ["topLeft", delta => delta.negated()],
          ["topCenter", delta => delta.withX(0).negated()],
          ["topRight", delta => delta.withX(0).negated()],
          ["rightCenter", delta => pt(0, 0)],
          ["bottomRight", delta => pt(0, 0)],
          ["bottomCenter", delta => pt(0, 0)],
          ["bottomLeft", delta => delta.withY(0).negated()],
          ["leftCenter", delta => delta.withY(0).negated()]
        ],
        offset
      ),
      [
        ["nwse-resize", "topLeft"],
        ["ns-resize", "topCenter"],
        ["nesw-resize", "topRight"],
        ["ew-resize", "rightCenter"],
        ["nwse-resize", "bottomRight"],
        ["ns-resize", "bottomCenter"],
        ["nesw-resize", "bottomLeft"],
        ["ew-resize", "leftCenter"]
      ]
    );
  }

  resizeHandles() { return this.submorphs.filter(h => h.isHandle); }

  updateResizeHandles() {
    this.borderBox.remove();
    this.resizeHandles().forEach(h => h.remove());
    this.submorphs = [this.borderBox, ...this.resizeHalos(), ...this.submorphs];
  }

  resizeHalos() {
    return this
      .getResizeParts(this.getGlobalRotation())
      .map(([c, l]) => this.placeHandleFor(c, l));
  }

  placeHandleFor([corner, deltaMask, originDelta], [nativeCursor, location]) {
    return resizeHandle(
      this,
      corner,
      deltaMask,
      originDelta,
      nativeCursor,
      location
    );
  }

  updatePropertyDisplay(haloItem) {
    var val = haloItem.valueForPropertyDisplay();
    if (typeof val !== "undefined")
      this.propertyDisplay.displayProperty(val);
    else
      this.propertyDisplay.disable();
  }

  toggleDiagonal(active, corner) {
    if (rect(0).sides.includes(corner)) return;
    var diagonal = this.getSubmorphNamed("diagonal");
    if (!active) { diagonal && diagonal.fadeOut(500); return; }

    var {x,y,width, height } = this.target.globalBounds(),
        bounds = this.localize(pt(x,y))
                     .extent(pt(width, height))
                     .scaleRectTo(this.innerBounds()),
        vertices = {topLeft: [pt(width, height), pt(0,0)],
                    topRight: [pt(0, height), pt(width, 0)],
                    bottomRight: [pt(0,0), pt(width, height)],
                    bottomLeft: [pt(width, 0), pt(0, height)]};

    if (diagonal) { diagonal.setBounds(bounds); return; }
    
    const [v1, v2] = vertices[corner],
          guideGradient = new LinearGradient({
            stops: [
              {offset: 0, color: Color.orange.withA(0)},
              {offset: 0.2, color: Color.orange},
              {offset: 0.8, color: Color.orange},
              {offset: 1, color: Color.orange.withA(0)}
            ]
          });

    diagonal = this.addMorphBack(new Path({
      opacity: 0,
      name: "diagonal",
      borderStyle: "dotted",
      borderWidth: 5,
      bounds,
      borderColor: guideGradient,
      vertices: [v1, v2]
    }));
    diagonal.setBounds(bounds);
    diagonal.animate({opacity: 1, duration: 500});
  }

  toggleRotationIndicator(active, haloItem) {
    var rotationIndicator = this.getSubmorphNamed("rotationIndicator");
    if (!active || !haloItem) {
      rotationIndicator && rotationIndicator.remove();
      return;
    }

    const originPos = this.getSubmorphNamed("origin").center,
          localize = (p) => rotationIndicator.localizePointFrom(p, this);
    rotationIndicator = rotationIndicator || this.addMorphBack(new Path({
      name: "rotationIndicator",
      borderColor: Color.red,
      borderWidth: 1,
      vertices: []
    }));
    rotationIndicator.setBounds(haloItem.bounds().union(this.innerBounds()));
    rotationIndicator.vertices = [localize(originPos), localize(haloItem.center)];
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // indicator - morph highlighter
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  clearMorphHighlighters() {
    for (var id in this.morphHighlighters) {
      this.morphHighlighters[id].remove();
      delete this.morphHighlighters[id];
    }
  }

  toggleMorphHighlighter(active, target, showLayout = false) {
    const h = morphHighlighter(this, target, showLayout);
    if (active && target && target != this.world()) {
      h && h.show(target);
    } else {
      h && h.deactivate(target);
    }
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ui events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  onMouseDown(evt) {
    const target = evt.state.clickedOnMorph;
    if (!evt.isCommandKey() && target == this.borderBox) return this.remove();
    if (evt.isShiftDown() && evt.isCommandKey()) {
      const actualMorph = this.target.isMorphSelection ?
        this.target.morphBeneath(evt.position) : this.morphBeneath(evt.position);
      this.isAlreadySelected(actualMorph) ?
          this.removeMorphFromSelection(actualMorph) :
          this.addMorphToSelection(actualMorph);
      return;
    }
    if (target == this.borderBox && evt.isCommandKey()) {
      // cycle to the next morph below at the point we clicked
     var morphsBelow = evt.world
           .morphsContainingPoint(evt.position)
           .filter(ea => ea.halosEnabled),
         morphsBelowHaloMorph = morphsBelow.slice(morphsBelow.indexOf(this.target) + 1),
         newTarget = morphsBelowHaloMorph[0] || morphsBelow[0] || evt.world;
      newTarget && evt.world.showHaloFor(newTarget, evt.domEvt.pointerId);
      this.remove();
    }
    if (target == this) this.remove();
  }

  onKeyUp(evt) {
    if (!this.changingName)
      this.buttonControls.map(b => b.onKeyUp(evt));
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// The thing at the top left of the halo that indicates currently changing
// properties such as the position of the halo target
class HaloPropertyDisplay extends Text {

  get isHaloItem() { return false; }

  get halo() { return this.owner; }

  get defaultPosition() { return pt(25,0); }

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      name: "propertyDisplay",
      fill: Color.gray.withA(.7),
      borderRadius: 15,
      padding: Rectangle.inset(5),
      visible: false,
      readOnly: true,
      fontSize: 12,
      fontColor: Color.white,
      position: this.defaultPosition
    }
  }

  displayedValue() { return this.textString; }

  displayProperty(val) {
    var activeButton = this.halo.activeButton;
    val = String(val);
    this.visible = true;
    this.textString = val;
    this.position = this.defaultPosition;
    if (this.bounds().insetBy(10).intersects(activeButton.bounds())) {
      this.position = pt(activeButton.topRight.x + 10, this.position.y);
    }
  }

  disable() {
    this.position = this.defaultPosition;
    this.visible = false;
  }
}

// Placeholder for halot.target when multiple morphs are selected
class MultiSelectionTarget extends Morph {

  get isHaloItem() { return true }
  get isMorphSelection() { return true; }

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      visible: false,
      modifiesSelectedMorphs: false,
      selectedMorphs: [],
    }
  }

  set selectedMorphs(morphs) { return this.setProperty("selectedMorphs", morphs); }
  get selectedMorphs() { return this.getProperty("selectedMorphs"); }
  set modifiesSelectedMorphs(bool) { return this.setProperty("modifiesSelectedMorphs", bool); }
  get modifiesSelectedMorphs() { return this.getProperty("modifiesSelectedMorphs"); }

  selectsMorph(morph) {
    return this.selectedMorphs.includes(morph);
  }

  alignWithSelection() {
    const bounds = this.selectedMorphs
      .map(m => m.globalBounds())
      .reduce((a, b) => a.union(b));
    this.setBounds(bounds);
  }

  onGrab(evt) {
    // shove all of the selected Morphs into the hand
    this.grabbingHand = evt.hand;
    this.selectionGrabbed = true;
    evt.hand.grab(this.selectedMorphs);
    once(evt.hand, "dropMorphsOn", this, "onGrabEnd");
    connect(evt.hand, "position", this, "alignWithSelection");
  }

  onGrabEnd() {
    this.selectionGrabbed = false;
    disconnectAll(this.grabbingHand);
  }

  updateExtent({prevValue, value}) {
    const delta = value.subPt(prevValue);
    this.selectedMorphs.forEach(m => m.resizeBy(delta));
  }

  updatePosition({prevValue, value}) {
    const delta = value.subPt(prevValue);
    this.selectedMorphs.forEach(m => m.moveBy(delta));
  }

  updateRotation({prevValue, value}) {
    const delta = value - prevValue;
    this.selectedMorphs.forEach(m => {
      const oldOrigin = m.origin;
      m.adjustOrigin(m.localize(this.worldPoint(pt(0, 0))));
      m.rotation += delta;
      m.adjustOrigin(oldOrigin);
    });
  }

  updateScale({prevValue, value}) {
    const delta = value - prevValue;
    this.selectedMorphs.forEach(m => {
      const oldOrigin = m.origin;
      m.adjustOrigin(m.localize(this.worldPoint(pt(0, 0))));
      m.scale += delta;
      m.adjustOrigin(oldOrigin);
    });
  }

  onChange(change) {
    super.onChange(change);
    if (!this.modifiesSelectedMorphs) return;
    switch (change.prop) {
      case "extent": this.updateExtent(change); break;
      case "scale": this.updateScale(change); break;
      case "position": this.updatePosition(change); break;
      case "rotation": this.updateRotation(change); break;
    }
    return change;
  }

}

