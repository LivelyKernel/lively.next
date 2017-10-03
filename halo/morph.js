/* global System */
import {
  Morph, StyleSheet, HorizontalLayout,
  Path,
  Text,
  GridLayout,
  morph
} from "../index.js";
import { Color, pt, rect, Rectangle, LinearGradient } from "lively.graphics";
import { obj, promise, properties, num, arr } from "lively.lang";
import { connect, signal, disconnect, disconnectAll, once } from "lively.bindings";
import { Icon } from "lively.morphic/components/icons.js";
import { createMorphSnapshot } from "../serialization.js";
import { ConnectionHalo } from "../fabrik.js";
import { showAndSnapToGuides, showAndSnapToResizeGuides, removeSnapToGuidesOf } from "./drag-guides.js";




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// The halo morph controls a group of halo items, each of which can control or
// inspect properties of a target morph in some way
export default class Halo extends Morph {

  static get properties() {
    return {
      fill: {defaultValue: Color.transparent},
      resizeOnly: {defaultValue: false},
      target: {},
      pointerId: {},
      submorphs: {
        after: ["target"],
        initialize() {
          this.initButtons();
          this.alignWithTarget();
        }
      },
      layout: {
        after: ["submorphs"],
        initialize() {
          this.initLayout();
        }
      },
      target: {
        get() {
          return this.state ? this.state.target : null;
        },
        set(t) {
          let isUpdate = !!this.state.target;
          this.detachFromTarget();
          if (!this.state) this.state = {};
          t = this.prepareTarget(t);
          this.state.target = t;
          isUpdate && this.alignWithTarget();
          connect(t, "onChange", this, "alignWithTarget");
        }
      }
    };  }

  initLayout() {
    var layout = this.layout = new GridLayout({
      autoAssign: false,
      columns: [
        0, {fixed: 36, paddingRight: 10},
        2, {fixed: 26}, 4, {fixed: 26},
        6, {fixed: 36, paddingLeft: 10}
      ],
      rows: [
        0, {fixed: 36, paddingBottom: 10},
        2, {fixed: 26}, 4, {fixed: 26}, 6, {fixed: 26},
        7, {fixed: 36, paddingTop: 10}
      ],
      grid: [
          ["menu",   null,   "grab", null,  "drag", null,   "close"  ],
          [null,     null,   null,   null,  null,   null,   null     ],
          ["copy",   null,   null,   null,  null,   null,   "edit"   ],
          [null,     null,   null,   null,  null,   null,   null     ],
          ["connections",  null,   null,   null,  null,   null,   "inspect"],
          [null,     null,   null,   null,  null,   null,   null     ],
          ["rotate", null,   null,   null,  null,   null,   "resize" ],
          [null,     "name", "name", "name","name", "name", null     ]]});

    layout.col(1).row(7).group.align = "center";
    layout.col(1).row(7).group.resize = false;
  }

  initButtons() {
    this.submorphs = [
      ...this.ensureResizeHandles(),
      ...this.resizeOnly ? [] : [
        this.closeHalo(),
        this.dragHalo(),
        this.grabHalo(),
        this.menuHalo(),
        this.connectionHalo(),
        this.inspectHalo(),
        this.editHalo(),
        this.copyHalo(),
        this.rotateHalo(),
        this.nameHalo(),
        this.originHalo()
      ]
    ];
  }

  get isEpiMorph() { return true; }

  get isHaloItem() { return true }

  get isHalo() { return true }

  get borderBox() {
    return this.getSubmorphNamed("border-box") || this.addMorphBack(morph({
      isHalo: true,
      name: "border-box", fill: Color.transparent,
      borderColor: Color.red, borderWidth: 1
    }));
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // target access
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get pointerId() { return this.state ? this.state.pointerId : null; }
  set pointerId(p) { if (!this.state) this.state = {}; this.state.pointerId = p; }

  prepareTarget(target) {
    if (!obj.isArray(target)) return target;
    if (target.length <= 1) return target[0];

    // create a SelectionTarget morph that is a placeholder for all selected
    // morphs and that the current halo will operate on
    target = target[0].world().addMorph(
      new MultiSelectionTarget({selectedMorphs: target}));
    target.alignWithSelection();
    target.modifiesSelectedMorphs = true;
    return target;
  }

  refocus(newTarget) {
    this.target = newTarget;
    this.alignWithTarget();
  }

  alignWithTarget() {
    if (this.active) return;
    const targetBounds = this.target.globalBounds(),
          worldBounds = this.target.world().visibleBounds(),
          {x, y, width, height} = targetBounds.intersection(worldBounds);
    this.layout && this.layout.disable();
    this.setBounds(targetBounds.insetBy(-36).intersection(worldBounds));
    this.borderBox.setBounds(pt(x,y).subPt(this.position).extent(pt(width,height)));
    if (this.state.activeButton) {
      this.buttonControls.forEach(ea => ea.visible = false);
      this.ensureResizeHandles().forEach(h => h.visible = false);
      this.state.activeButton.visible = true;
      this.updatePropertyDisplay(this.state.activeButton);
    } else {
      if (this.changingName) this.nameHalo().toggleActive([false]);
      this.ensureResizeHandles().forEach(h => h.visible = true);
      this.buttonControls.forEach(b => { b.visible = true;});
      this.propertyDisplay.disable();
    }
    this.nameHalo().alignInHalo();
    this.ensureResizeHandles().forEach(h => h.alignInHalo());
    !this.resizeOnly && this.originHalo().alignInHalo();
    this.layout && this.layout.enable();
    return this;
  }

  detachFromTarget() {
    var {target} = this;
    if (!target) return
    disconnect(target, "onChange", this, "alignWithTarget");
    if (target instanceof MultiSelectionTarget) {
      target.modifiesSelectedMorphs = false;
      target.remove();
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic bheavior
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  remove() {
    this.detachFromTarget();
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

  get propertyDisplay() { return HaloPropertyDisplay.for(this); }
  nameHalo() { return NameHaloItem.for(this); }
  closeHalo() { return CloseHaloItem.for(this); }
  grabHalo() { return GrabHaloItem.for(this); }
  dragHalo() { return DragHaloItem.for(this); }
  menuHalo() { return MenuHaloItem.for(this); }
  connectionHalo() { return ConnectionsHaloItem.for(this); }
  inspectHalo() { return InspectHaloItem.for(this); }
  editHalo() { return EditHaloItem.for(this); }
  rotateHalo() { return RotateHaloItem.for(this); }
  copyHalo() { return CopyHaloItem.for(this); }
  originHalo() { return OriginHaloItem.for(this); }

  get buttonControls() { return this.submorphs.filter(m => m.isHaloItem && !m.isResizeHandle); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morph selection support
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async addMorphToSelection(morph) {
    const world = this.world(),
          currentTargets = this.target.isMorphSelection ?
                             this.target.selectedMorphs : [this.target];
    this.remove();
    return await world.showHaloForSelection([...currentTargets, morph], this.state.pointerId);
  }

  async removeMorphFromSelection(morph) {
    const world = this.world();
    this.remove();
    if (this.target.isMorphSelection) {
      arr.remove(this.target.selectedMorphs, morph);
      return await world.showHaloForSelection(
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
    this.active = true;
    this.target.setBounds(bounds.insetByRect(offsetRect));
    if (this.target.isPolygon || this.target.isPath) {
      // refrain from adjusting origin
      this.target.moveBy(this.target.origin.negated());
    } else {
      this.target.origin = origin.addPt({x: -offsetRect.x, y: -offsetRect.y});
      this.target.position = oldPosition;
    }
    this.active = false;
    this.alignWithTarget();
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

  ensureResizeHandles() { return ResizeHandle.resizersFor(this); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // updating

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

  toggleMorphHighlighter(active, target, showLayout = false) {
    const h = MorphHighlighter.for(this, target, showLayout);
    if (active && target && target != this.world()) h && h.show(target);
    else h && h.deactivate();
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

  getMesh({x, y}, offset = pt(0, 0)) {
    var {height, width} = this.world().visibleBounds(),
        defaultGuideProps = {
          borderStyle: "dotted",
          borderWidth: 2,
          borderColor: Color.orange
        },
        mesh =
          this.get("mesh") ||
          this.addMorph(
            new Morph({
              name: "mesh",
              styleClasses: ["halo-mesh"],
              extent: pt(width, height),
              fill: null,
              submorphs: [
                new Path({name: "vertical", ...defaultGuideProps}),
                new Path({name: "horizontal", ...defaultGuideProps})
              ]
            })
          );
    mesh.globalPosition = offset;
    mesh.getSubmorphNamed("vertical").vertices = [
      pt(x, 0).subPt(offset),
      pt(x, height).subPt(offset)
    ];
    mesh.getSubmorphNamed("horizontal").vertices = [
      pt(0, y).subPt(offset),
      pt(width, y).subPt(offset)
    ];
    return mesh;
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// The thing at the top left of the halo that indicates currently changing
// properties such as the position of the halo target
class HaloPropertyDisplay extends Text {

  static get morphName() { return "propertyDisplay"; }
  static get defaultPosition() { return pt(25,0); }

  static for(halo) {
    return halo.getSubmorphNamed(this.morphName) || halo.addMorph(new this({name: this.morphName}));
  }

  static get properties() {
    return {
      name:         {defaultValue: this.name},
      fill:         {defaultValue: Color.black.withA(.7)},
      borderRadius: {defaultValue: 7},
      padding:      {defaultValue: Rectangle.inset(5)},
      visible:      {defaultValue: false},
      readOnly:     {defaultValue: true},
      fontSize:     {defaultValue: 12},
      fontColor:    {defaultValue: Color.white},
      position:     {defaultValue: this.defaultPosition}
    }
  }

  get isHaloItem() { return false; }

  get halo() { return this.owner; }

  displayedValue() { return this.textString; }

  displayProperty(val) {
    var activeButton = this.halo.state.activeButton;
    val = String(val);
    this.visible = true;
    this.textString = val;
    this.position = this.constructor.defaultPosition;
    if (this.bounds().insetBy(10).intersects(activeButton.bounds())) {
      this.position = pt(activeButton.topRight.x + 10, this.position.y);
    }
  }

  disable() {
    this.position = this.constructor.defaultPosition;
    this.visible = false;
  }
}

// Placeholder for halot.target when multiple morphs are selected
class MultiSelectionTarget extends Morph {

  static get properties() {
    return {
      visible:                {defaultValue: false},
      modifiesSelectedMorphs: {defaultValue: false},
      selectedMorphs:         {defaultValue: []},
    }
  }

  get isHaloItem() { return true }
  get isMorphSelection() { return true; }

  selectsMorph(morph) { return this.selectedMorphs.includes(morph); }

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
    if (this.selectionGrabbed) return;
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


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// Abstract halo item, subclasses are specific ui elements that control /
// display morph properties
class HaloItem extends Morph {

  static get properties() {
    return {
      borderRadius: {defaultValue: 15},
      fill:         {defaultValue: Color.gray.withA(.7)},
      grabbable:    {defaultValue: false},
      extent:       {defaultValue: pt(24,24)},
      halo:         {},
    }
  }

  static for(halo) {
    return halo.getSubmorphNamed(this.morphName) || halo.addMorph(new this({halo, name: this.morphName}));
  }

  get isEpiMorph() { return true; }
  get isHaloItem() { return true };

  menuItems() { return []; }

  init() {}
  update() {}
  stop() {}
  valueForPropertyDisplay() { return undefined; }
}



// name label + input of a morph
class NameHolder extends Morph {

  static get properties() {

    return {
      tooltip:   {defaultValue: "Click to edit the morph's name"},
      draggable: {defaultValue: false},
      fill:      {defaultValue: Color.transparent},
      forceUniqueName: {defaultValue: false},
      layout:    {
        after: ["nameHolder"],
        initialize() { this.layout = new HorizontalLayout({spacing: 7}); }
      },
      nameHolder: {
        after: ["submorphs"],
        initialize() {
          this.nameHolder = this.addMorph(new Text({
            fill: Color.transparent,
            fontColor: Color.darkgray,
            active: true
          }));
          connect(this.nameHolder, 'onBlur', this, 'accept');
        }
      }
    }

  }

  onHoverIn(evt) {
    if (this.highlightOnHover && this.nameHolder.active) {
      this.halo.toggleMorphHighlighter(true, this.target);
      this.nameHolder.fontColor = Color.orange;
    }
  }

  onHoverOut(evt) {
    if (this.highlightOnHover) {
      this.halo.toggleMorphHighlighter(false, this.target);
      this.nameHolder.fontColor = Color.darkgray;
    }
  }

  accept() {
    if (this.target.name !== this.nameHolder.textString)
      this.updateName(this.nameHolder.textString);
  }

  onKeyDown(evt) {
    if ("Enter" == evt.keyCombo) {
      this.accept(); evt.stop();
    } else {
      super.onKeyDown(evt);
    }
  }

  onMouseUp() {
    signal(this, "active", [true, this]);
  }

  onMouseDown(evt) {
    this.nameHolder.fontColor = Color.darkgray;
    this.halo.toggleMorphHighlighter(false, this.target);
  }

  onKeyUp(evt) {
    const newName = this.nameHolder.textString, owner = this.target.owner;
    this.validName = !owner || !owner.getSubmorphNamed(newName) ||
      this.target.name == newName;
    signal(this, "valid", [this.validName, newName]);
  }

  update() {
    this.nameHolder.textString = this.target.name;
    this.nameHolder.fit();
  }

  activate() {
    this.nameHolder.readOnly = false;
    this.nameHolder.active = true;
    this.nameHolder.animate({opacity: 1});
  }

  deactivate() {
    this.nameHolder.readOnly = true;
    this.nameHolder.active = false;
    this.nameHolder.animate({opacity: 0.3});
  }

  updateName(newName) {
    if (!this.forceUniqueName || this.validName) {
      this.target.name = newName;
      signal(this, "active", [false, this]);
    }
  }

}

class NameHaloItem extends HaloItem {

  static get morphName() { return "name"; }
  static get properties() {
    return {
      borderRadius: {defaultValue: 15},
      fill: {defaultValue: Color.gray.withA(0.7)},
      borderColor: {defaultValue: Color.green},
      layout: {initialize() { this.layout = new HorizontalLayout({spacing: 0}); }},
    }
  }

  constructor(props) {
    super(props);

    this.initNameHolders();

    this.validityIndicator = Icon.makeLabel("check", {
      fontColor: Color.green,
      fontSize: 15,
      padding: rect(4, 6, 4, 0)
    });

    this.alignInHalo();
  }

  targets() {
    return this.halo.target.isMorphSelection
      ? this.halo.target.selectedMorphs.map(target => {
        return {target, highlightOnHover: true};
      }) : [{target: this.halo.target, highlightOnHover: false}];
  }

  initNameHolders() {
    this.nameHolders = this.targets().map(({target, highlightOnHover}) => {
      const nh = new NameHolder({halo: this.halo, highlightOnHover, target});
      connect(nh, "active", this, "toggleActive");
      connect(nh, "valid", this, "toggleNameValid");
      return nh;
    });
    this.submorphs = arr.interpose(this.nameHolders, {
      extent: pt(1, 28),
      fill: Color.black.withA(0.4)
    });
  }

  toggleActive([active, nameHolder]) {
    if (this.halo.changingName === active)
      return;
    this.halo.changingName = active;
    if (active) {
      this.nameHolders.forEach(nh => nh != nameHolder && nh.deactivate())
      this.borderWidth = 3;
      this.addMorph(this.validityIndicator);
      setTimeout(() => nameHolder.nameHolder.selectAll());
    } else {
      this.nameHolders.forEach(nh => nh != nameHolder && nh.activate());
      this.borderWidth = 0;
      this.validityIndicator.remove();
      this.halo.focus();
    }
    this.alignInHalo();
  }

  toggleNameValid([valid, name]) {
    this.validName = valid;
    if (valid) {
      this.conflictingMorph = null;
      this.borderColor = Color.green;
      this.validityIndicator.nativeCursor = "auto";
      this.validityIndicator.fontColor = Color.green;
      Icon.setIcon(this.validityIndicator, "check");
    } else {
      this.conflictingMorph = this.get(name);
      this.borderColor = Color.red;
      this.validityIndicator.fontColor = Color.red;
      this.validityIndicator.nativeCursor = "pointer";
      Icon.setIcon(this.validityIndicator, "exclamation-circle");
    }
  }

  alignInHalo() {
    arr.zip(this.targets(), this.nameHolders).map(([{target}, nh]) => {
      nh.target = target; 
      nh.update()
    });
    var {x, y} = this.halo.innerBounds().bottomCenter().addPt(pt(0, 2));
    this.topCenter = pt(Math.max(x, 30), Math.max(y, 80));
  }

  onMouseDown(evt) {
    const m = this.conflictingMorph;
    if (m) {
      this.halo.toggleMorphHighlighter(true, m);
      setTimeout(() => this.halo.toggleMorphHighlighter(false, m), 1000);
    }
  }

}


class CloseHaloItem extends HaloItem {

  static get morphName() { return "close"; }

  static get properties() {
    return {
      styleClasses: {defaultValue: ["fa", "fa-close"]},
      draggable: {defaultValue: false},
      tooltip: {defaultValue: "Remove this morph from the world"}
    };
  }

  update() {
    var {halo} = this, o = halo.target.owner;
    o.undoStart("close-halo");
    halo.target.selectedMorphs ?
      halo.target.selectedMorphs.forEach(m => m.remove()) :
      halo.target.remove();
    o.undoStop("close-halo");
    halo.remove();
  }

  onMouseDown(evt) { this.update(); }
}


class GrabHaloItem extends HaloItem {

  static get morphName() { return "grab"; }

  static get properties() {
    return {
      name: {defaultValue: "grab"},
      styleClasses: {defaultValue: ["fa", "fa-hand-rock-o"]},
      tooltip: {defaultValue: "Grab the morph"}
    }
  }

  valueForPropertyDisplay() {
    let {hand, halo, prevDropTarget} = this,
        world = hand.world(),
        dropTarget = hand.findDropTarget(
          hand.position,
          [halo.target],
          m => !m.isHaloItem && !m.ownerChain().some(m => m.isHaloItem));

    halo.toggleMorphHighlighter(dropTarget && dropTarget != world, dropTarget, true);
    if (prevDropTarget && prevDropTarget != dropTarget)
      halo.toggleMorphHighlighter(false, prevDropTarget);
    this.prevDropTarget = dropTarget;
    return dropTarget && dropTarget.name;
  }

  init(hand) {
    let {halo} = this;
    var undo = halo.target.undoStart("grab-halo");
    undo.addTarget(halo.target.owner);
    this.hand = hand;
    halo.target.onGrab({hand, isShiftDown: () => false});
    halo.state.activeButton = this;
    this.opacity = .3
  }

  update() {
    this.halo.alignWithTarget();
  }

  stop(hand) {
    let {halo, prevDropTarget} = this,
        undo = halo.target.undoInProgress,
        dropTarget = hand.findDropTarget(
          hand.position,
          [halo.target],
          m => !m.isHaloItem && !m.ownerChain().some(m => m.isHaloItem));
    MorphHighlighter.interceptDrop(halo, dropTarget, halo.target);
    undo.addTarget(dropTarget);
    dropTarget.onDrop({hand});
    halo.state.activeButton = null;
    halo.alignWithTarget();
    halo.toggleMorphHighlighter(false, prevDropTarget);
    MorphHighlighter.removeHighlighters(halo);
    halo.target.undoStop("grab-halo");
    this.opacity = 1;
  }

  onDragStart(evt) {
    this.init(evt.hand)
  }

  onDragEnd(evt) {
    this.stop(evt.hand)
  }

}


class DragHaloItem extends HaloItem {

  static get morphName() { return "drag"; }
  get tooltip() { return "Change the morph's position. Press (alt) while dragging to align the morph's position along a grid."; }
  get styleClasses() { return [...super.styleClasses, "fa", "fa-arrows"]; }

  valueForPropertyDisplay() { return this.halo.target.position; }

  updateAlignmentGuide(active) {
    var mesh = this.halo.getSubmorphNamed("mesh");
    if (!active) { mesh && mesh.remove(); return; }

    mesh = this.halo.getMesh(this.halo.target.worldPoint(pt(0,0)));

    this.focus();
    return mesh;
  }

  init() {
    const target = this.halo.target;
    target.undoStart("drag-halo");
    this.halo.state.activeButton = this;
    this.actualPos = target.position;
    this.targetTransform = target.owner.getGlobalTransform().inverse();
  }

  stop() {
    this.halo.target.undoStop("drag-halo");
    this.halo.state.activeButton = null;
    this.halo.alignWithTarget();
    this.updateAlignmentGuide(false);
    removeSnapToGuidesOf(this.halo.target);
  }

  update(delta, grid = false, snapToGuides = false) {
    var newPos = this.actualPos.addPt(this.targetTransform.transformDirection(delta));
    this.actualPos = newPos;
    if (grid) {
      newPos = newPos.griddedBy(pt(10,10));
    }
    this.halo.target.position = newPos;
    this.updateAlignmentGuide(grid);
    if (!grid)
      showAndSnapToGuides(
        this.halo.target, true /*showGuides*/, snapToGuides,
        5/*eps*/, 500/*maxDist*/);
  }

  onDragStart(evt) { this.init() }
  onDrag(evt) { this.update(evt.state.dragDelta, evt.isAltDown(), evt.isCtrlDown()); }
  onDragEnd(evt) { this.stop() }
  onKeyUp(evt) { this.updateAlignmentGuide(false); }
}


class InspectHaloItem extends HaloItem {

  static get morphName() { return "inspect"; }
  get styleClasses() { return [...super.styleClasses, "fa", "fa-gears"]; }
  get draggable() { return false; }
  get tooltip() { return "Inspect the morph's local state"; }

  onMouseDown(evt) {
    this.halo.remove();
    (async () => {
       var {default: Inspector} = await System.import("lively.morphic/ide/js/inspector.js");
       Inspector.openInWindow({targetObject: this.halo.target});
    })()
  }

}


class EditHaloItem extends HaloItem {

  static get morphName() { return "edit"; }
  get styleClasses() { return [...super.styleClasses, "fa", "fa-wrench"]; }
  get draggable() { return false; }
  get tooltip() { return "Edit the morph's definition"; }

  onMouseDown(evt) {
    this.halo.world().execCommand("open object editor", {target: this.halo.target});
    this.halo.remove();
  }
}

class RotateHaloItem extends HaloItem {

  static get morphName() { return "rotate"; }

  constructor(props) { super(props); this.adaptAppearance(false); }

  get angle() { return this.getProperty("angle") || 0; }
  set angle(val) { this.setProperty("angle", val); }
  get scaleGauge() { return this.getProperty("scaleGauge") || null; }
  set scaleGauge(val) { this.setProperty("scaleGauge", val); }
  get initRotation() { return this.getProperty("initRotation") || 0; }
  set initRotation(val) { this.setProperty("initRotation", val); }

  valueForPropertyDisplay() {
    var {scaleGauge, halo: {target: t}} = this;
    return scaleGauge ?
      t.scale.toFixed(4).toString() :
      num.toDegrees(t.rotation).toFixed(1) + "°";
  }

  init(angleToTarget) {
    this.detachFromLayout();
    this.halo.target.undoStart("rotate-halo");
    this.halo.state.activeButton = this;
    this.angle = angleToTarget;
    this.initRotation = this.halo.target.rotation;
    this.halo.toggleRotationIndicator(true, this);
  }

  initScale(gauge) {
    this.detachFromLayout();
    this.halo.state.activeButton = this;
    this.scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
    this.halo.toggleRotationIndicator(true, this);
  }

  update(angleToTarget) {
    this.scaleGauge = null;
    var newRotation = this.initRotation + (angleToTarget - this.angle);
    newRotation = num.toRadians(num.detent(num.toDegrees(newRotation), 10, 45))
    this.halo.target.rotation = newRotation;
    this.halo.toggleRotationIndicator(true, this);
  }

  updateScale(gauge) {
    var {scaleGauge: scaleG, halo} = this;
    if (!scaleG) scaleG = this.scaleGauge = gauge.scaleBy(1 / halo.target.scale);
    this.angle = gauge.theta();
    this.initRotation = halo.target.rotation;
    halo.target.scale = num.detent(gauge.dist(pt(0,0)) / scaleG.dist(pt(0,0)), 0.1, 0.5);
    halo.toggleRotationIndicator(true, this);
  }

  stop() {
    this.attachToLayout();
    this.scaleGauge = null;
    this.halo.state.activeButton = null;
    this.halo.alignWithTarget();
    this.halo.toggleRotationIndicator(false, this);
    this.halo.target.undoStop("rotate-halo");
    this.halo.ensureResizeHandles();
  }

  adaptAppearance(scaling) {
    this.styleClasses = ["fa", scaling ? "fa-search-plus" : "fa-repeat"];
    this.tooltip = scaling ? "Scale morph" : "Rotate morph";
  }

  detachFromLayout() {
    this.savedLayout = this.halo.layout;
    this.halo.layout = null;
  }

  attachToLayout() {
    this.halo.layout = this.savedLayout;
  }

  // events
  onDragStart(evt) {
    this.adaptAppearance(evt.isShiftDown());
    if (evt.isShiftDown()) {
      this.initScale(evt.position.subPt(this.halo.target.globalPosition));
    } else {
      this.init(evt.position.subPt(this.halo.target.globalPosition).theta());
    }
  }

  onDrag(evt) {
    this.globalPosition = evt.position.addPt(pt(-10,-10));
    this.adaptAppearance(evt.isShiftDown());
    if (evt.isShiftDown()) {
      this.updateScale(evt.position.subPt(this.halo.target.globalPosition));
    } else {
      this.update(evt.position.subPt(this.halo.target.globalPosition).theta());
    }
  }

  onDragEnd(evt) {
    this.adaptAppearance(evt.isShiftDown());
    this.stop();
  }

  onKeyDown(evt) { this.adaptAppearance(evt.isShiftDown()); }
  onKeyUp(evt) { this.adaptAppearance(evt.isShiftDown()); }
}


class CopyHaloItem extends HaloItem {

  static get morphName() { return "copy"; }
  get tooltip() { return "Copy morph"; }
  get styleClasses() { return [...super.styleClasses, "fa", "fa-clone"]; }

  init(hand) {
    let {halo} = this, {target} = halo, world = halo.world(),
        isMultiSelection = target instanceof MultiSelectionTarget;
    halo.remove();


    if (isMultiSelection) {
      // FIXME! haaaaack
      let copies = target.selectedMorphs.map(ea => world.addMorph(ea.copy())),
          positions = copies.map(ea => {ea.name += ' copy'; return ea.position});
      copies[0].undoStart("copy-halo");
      world.addMorph(halo);
      halo.refocus(copies);
      hand.grab(halo.target);
      halo.target.onGrab({hand, isShiftDown: () => false});
      positions.forEach((pos,i) => copies[i].globalPosition = pos);
      halo.alignWithTarget();

    } else {
      let pos = target.globalPosition,
          copy = world.addMorph(target.copy());
      copy.name += ' copy';
      copy.globalPosition = pos;
      copy.undoStart("copy-halo");
      hand.grab(copy);
      world.addMorph(halo);
      halo.refocus(copy);
    }
  }

  stop(hand) {
    var {halo} = this,
        dropTarget = hand.findDropTarget(
          hand.position, 
          [halo.target],
          m => !m.isHaloItem && !m.ownerChain().some(m => m.isHaloItem)),
        undo = halo.target.undoInProgress;
    undo.addTarget(dropTarget);
    hand.dropMorphsOn(dropTarget);
    halo.target.undoStop("copy-halo");
    halo.alignWithTarget();
  }

  onDragStart(evt) { this.init(evt.hand) }
  onDragEnd(evt) { this.stop(evt.hand); }

  async onMouseUp(evt) {
    evt.stop();
    let {halo} = this,
        t = halo.target,
        world = halo.world();

    halo.remove();

    let isMultiSelection = t instanceof MultiSelectionTarget,
        origin = t.globalBounds().topLeft(),
        morphsToCopy = isMultiSelection ? t.selectedMorphs : [t],
        snapshots = [],
        html = `<!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            ${document.querySelector("#lively-morphic-css").outerHTML}
          </head>
          <body>`;

    try {
      for (let m of morphsToCopy) {
        let snap = await createMorphSnapshot(m, {addPreview: false, testLoad: false});
        snap.copyMeta = {offset: m.worldPoint(pt(0,0)).subPt(origin)};
        snapshots.push(snap)
        html += m.renderPreview();
      }

      html += "</body></html>"

      let data = JSON.stringify(snapshots);

      await evt.dispatcher.doCopyWithMimeTypes([
        {type: 'text/html', data: html},
        {type: 'application/morphic', data}
      ]);

    } catch (e) { world.logError(e); return; }

    world.addMorph(halo);
    halo.refocus(morphsToCopy);
    halo.setStatusMessage("copied");
  }
}


class OriginHaloItem extends HaloItem {

  static get morphName() { return "origin"; }

  static get properties() {
    return {
      borderColor: {defaultValue: Color.black},
      borderWidth: {defaultValue: 1},
      nativeCursor: {defaultValue: '-webkit-grab'}
    };
  }

  get fill() { return Color.red; }
  get extent() { return pt(15, 15); }
  get tooltip() { return "Change the morph's origin"; }

  computePositionAtTarget() {
    if (!this.world()) 
      return this.halo.borderBox.position.addPt(this.halo.target.origin);
    else
      return this.halo.localizePointFrom(pt(0, 0), this.halo.target);
  }

  alignInHalo() {
    this.center = this.computePositionAtTarget();
  }

  valueForPropertyDisplay() { return this.halo.target.origin; }

  init() {
    this.halo.target.undoStart("origin-halo");
    this.halo.state.activeButton = this;
  }

  stop() {
    this.halo.target.undoStop("origin-halo");
    this.halo.state.activeButton = null;
    this.halo.alignWithTarget();
  }

  update(delta) {
    var {halo} = this,
        oldOrigin = halo.target.origin,
        globalOrigin = halo.target.worldPoint(oldOrigin),
        newOrigin = halo.target.localize(globalOrigin.addPt(delta)).subPt(halo.target.scroll);
    delta = newOrigin.subPt(oldOrigin);
    halo.target.adjustOrigin(halo.target.origin.addPt(delta));
  }

  onDragStart(evt) { this.init(); }
  onDragEnd(evt) { this.stop(); }
  onDrag(evt) { this.update(evt.state.dragDelta); }

}


// The white thingies at the corner and edges of a morph
class ResizeHandle extends HaloItem {

  static getResizeParts(rotation) {
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

  static resizersFor(halo) {
    var globalRot =  halo.target.getGlobalTransform().getRotation();
    return this.getResizeParts(globalRot)
      .map(([[corner, deltaMask, originDelta], [nativeCursor, location]]) =>
        this.for(halo, corner, location, nativeCursor).alignInHalo());
  }

  static for(halo, corner, location, nativeCursor) {
    var name = "Resize " + corner,
        resizer = halo.getSubmorphNamed(name) || new this({
          name, halo, corner,
          tooltip: "Resize " + corner,
          extent: pt(10, 10),
          borderWidth: 1,
          borderColor: Color.black,
          fill: Color.white
        });
    return Object.assign(resizer, {nativeCursor, location});
  }

  get isResizeHandle() { return true; }

  get corner() { return this.getProperty("corner"); }
  set corner(val) { this.setProperty("corner", val); }
  get location() { return this.getProperty("location"); }
  set location(val) { this.setProperty("location", val); }

  valueForPropertyDisplay() {
    var {x: width, y: height} = this.halo.target.extent;
    return `${width.toFixed(1)}x${height.toFixed(1)}`;
  }

  positionInHalo() { return this.halo.borderBox.bounds().partNamed(this.location); }

  alignInHalo() { this.center = this.positionInHalo(); return this; }

  onKeyUp(evt) {
    if (this.halo.state.activeButton == this)
      this.halo.toggleDiagonal(evt.isShiftDown(), this.corner);
  }

  onKeyDown(evt) {
    if (this.halo.state.activeButton == this)
      this.halo.toggleDiagonal(evt.isShiftDown(), this.corner);
  }

  onDragStart(evt) {
    this.init(evt.position, evt.isShiftDown());
  }

  onDragEnd(evt) {
    this.stop(evt.isShiftDown());
  }

  onDrag(evt) {
    this.update(evt.position, evt.isShiftDown(), evt.isAltDown(), evt.isCtrlDown());
    this.focus();
  }

  init(startPos, proportional = false) {
    const {position, extent} = this.halo.target;
    this.startPos = startPos;
    this.startBounds = position.extent(extent);
    this.startOrigin = this.halo.target.origin;
    this.savedLayout = this.halo.layout;
    this.halo.layout = null;
    this.halo.state.activeButton = this;
    this.tfm = this.halo.target.getGlobalTransform().inverse();
    var globalRot = this.halo.target.getGlobalTransform().getRotation();
    this.offsetRotation = num.toRadians(globalRot % 45);
    // add up rotations
    this.halo.toggleDiagonal(proportional, this.corner);
  }

  update(currentPos, shiftDown = false, altDown = false, ctrlDown = false) {
    var {corner, tfm, startPos, halo: {target}} = this,
        oldPosition = target.position,
        {x, y} = startPos.subPt(currentPos),
        delta = tfm.transformDirection(pt(x, y));
    if (altDown) {
      delta = delta.griddedBy(pt(10,10));
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


    let sides = [],
        cl = corner.toLowerCase();
    if (cl.includes("left")) sides.push("left");
    if (cl.includes("top")) sides.push("top");
    if (cl.includes("bottom")) sides.push("bottom");
    if (cl.includes("right")) sides.push("right");

    showAndSnapToResizeGuides(
      this.halo.target, sides,
      true/*showGuides*/, ctrlDown/*snap*/,
      5/*epsilon*/, 200/*maxDist*/);
  }

  stop(proportional) {
    let {halo: h} = this;
    h.layout = this.savedLayout;
    h.state.activeButton = null;
    h.alignWithTarget();
    h.toggleDiagonal(false);
    this.updateAlignmentGuide(false);
    removeSnapToGuidesOf(h.target);
  }

  updateAlignmentGuide(active) {
    var mesh = this.halo.getSubmorphNamed("mesh");
    if (!active) { mesh && mesh.remove(); return; };
    let {x,y} = this.halo.target.extent,
        offset = pt(x % 10, y % 10);
    mesh = this.halo.getMesh(this.globalPosition.addPt(this.extent.scaleBy(.5)), offset);

    this.focus();
    return mesh;
  }
}


class MenuHaloItem extends HaloItem {

  static get morphName() { return "menu"; }

  get styleClasses() { return [...super.styleClasses, "fa", "fa-navicon"]; }
  get draggable() { return false; }
  get tooltip() { return "Opens the morph menu"; }

  async onMouseDown(evt) {
    let target = this.halo.target;
    this.halo.remove();
    let menuItems = await target.menuItems();
    target.world().openMenu(menuItems);
  }

}

class ConnectionsHaloItem extends HaloItem {
  
  static get connectionHaloMap() {
    return this._connectionHaloMap || (this._connectionHaloMap = new WeakMap())
  }

  static removeHalosFor(morph) {
    if (!this._connectionHaloMap) return;
    let halo = this._connectionHaloMap.get(morph);
    if (halo) {
      halo.remove();
      this._connectionHaloMap.delete(morph);
    }
  }

  static openHalosFor(morph) {
    let halo = this.connectionHaloMap.get(morph);
    if (!halo) {
      halo = new ConnectionHalo({target: morph});
      this.connectionHaloMap.set(morph, halo);
    }
    halo.openInWorld(halo.position);
    return halo;
  }

  static get morphName() { return 'connections'; }

  static get properties() {
    return {
      styleClasses: {
        defaultValue: ['fa', 'fa-tencent-weibo']
      },
      tooltip: {defaultValue: "Manage this morph's connections"},
      draggable: {defaultValue: false}
    }
  }

  async onMouseDown(evt) {
    let halo = this.constructor.openHalosFor(this.halo.target);
    once(halo, "remove", this.constructor, "removeHalosFor", {
      converter: function() { return this.sourceObj.target; }
    });
    this.halo.remove();
  }
  
}



// The orange thing that indicates a drop target when a grabbed morph is
// hovered over another morph. For some reason it doubles as the container for
// the "layout halo" items

export class MorphHighlighter extends Morph {

  static get properties() {
    return {
      draggable: {defaultValue: false},
      name: {defaultValue: "morphHighlighter"},
      styleClasses: {defaultValue: ['inactive']},
      reactsToPointer: {defaultValue: false},
      halo: {},
      isHighlighter: {readOnly: true, defaultValue: true},
      highlightedSides: {
        defaultValue: [],
        set(sides) {
          this.setProperty('highlightedSides', sides);
          this.alignWithHalo();
          this.submorphs = sides.map(side => {
            return {type: 'ellipse', isHaloItem: true, 
                    fill: Color.orange, center: this.innerBounds()[side]()}
          })
        }
      },
      showLayout: {defaultValue: false},
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            '.inactive': {
               opacity: 0,
            },
            '.active': {
               fill: Color.orange.withA(0.3),
               opacity: 1,
               borderWidth: 2,
              borderColor: Color.orange
            }
          })
        }
      },
      targetId: {},
      target: {
        readOnly: true, derived: true,
        get() {
          return (this.world() || this.env.world).getMorphWithId(this.targetId);
        }
      }
    }
  }

  static removeHighlighters(halo=$world) {
    let store = halo._morphHighlighters;
    for (let id in store) { store[id].remove(); }
    delete halo._morphHighlighters;
  }

  static for(halo, morph, showLayout=false, highlightedSides=[]) {
    var store = (halo._morphHighlighters = halo._morphHighlighters || {});
    properties.forEachOwn(store, (_, h) => h.alignWithHalo());
    if (!morph || morph.ownerChain().find(owner => owner.isHaloItem)) return null;
    store[morph.id] =
      store[morph.id] ||
      halo.addMorph(new this({targetId: morph.id, halo, showLayout}));
    store[morph.id].highlightedSides = highlightedSides;
    return store[morph.id];
  }
  
  static interceptDrop(halo, target, morph) {
     var store = halo._morphHighlighters = halo._morphHighlighters || {};
     store && store[target.id].handleDrop(morph)
  }

  alignWithHalo() {
    if (this.target) {
      this.position = this.halo.localize(this.target.globalBounds().topLeft());
      this.extent = this.target.globalBounds().extent();
    }
  }

  show() {
    if (this.target && this.target.layout && this.showLayout) {
      this.layoutHalo =
        this.layoutHalo || this.world().showLayoutHaloFor(this.target, this.pointerId);
      if (this.layoutHalo.previewDrop) {
        this.styleClasses = ['inactive'];
        this.alignWithHalo();
        if (this.halo.get("grab").hand.grabbedMorphs)
          this.layoutHalo.previewDrop(this.halo.get("grab").hand.grabbedMorphs);
        return;
      }
    }

    this.styleClasses = ['active'];
    this.alignWithHalo();
  }
  
  handleDrop(morph) {
    this.layoutHalo && this.layoutHalo.handleDrop(morph);
  } 

  deactivate() {
    if (this.layoutHalo) {
      this.layoutHalo.remove();
      this.layoutHalo = null;
    }
    this.styleClasses = ['inactive'];
    this.alignWithHalo();
  }

}

export class InteractiveMorphSelector {

  static selectMorph(world, controllingMorph, filterFn) {
    let sel = new this(world, controllingMorph, filterFn);
    sel.selectNewTarget();
    return sel.whenDone;
  }

  constructor(world = $world, controllingMorph = null, filterFn) {
    this.controllingMorph = controllingMorph;
    this.selectorMorph = null;
    this.morphHighlighter = null;
    this.possibleTarget = null;
    this.world = world;
    this.filterFn = filterFn;
    this.whenDone = null;
  }

  selectNewTarget() {
    this.targetObject = null;
    let deferred = promise.deferred();
    deferred.promise.resolve = deferred.resolve;
    this.whenDone = deferred.promise;
    this.selectorMorph = Icon.makeLabel('crosshairs', {fontSize: 20}).openInWorld();
    connect(this.world.firstHand, 'position', this, 'scanForTargetAt');
    once(this.selectorMorph, 'onMouseDown', this, 'selectTarget');
    once(this.selectorMorph, 'onKeyDown', this, 'stopSelect');
    this.selectorMorph.focus();
    this.scanForTargetAt(this.world.firstHand.position);
  }

  scanForTargetAt(pos) {
    this.selectorMorph.center = pos;
    var target = this.selectorMorph.morphBeneath(pos);
    let {possibleTarget, controllingMorph, filterFn, world, morphHighlighter} = this;
    if (morphHighlighter == target) {
      target = morphHighlighter.morphBeneath(pos);
    } else if (target && target.isEpiMorph) {
      target = target.morphBeneath(pos);
    }
    if (target != possibleTarget
        && (!controllingMorph
         || !target.ownerChain().includes(controllingMorph.getWindow()))
        && (!filterFn || filterFn(target))) {
      if (morphHighlighter) morphHighlighter.deactivate();
      this.possibleTarget = possibleTarget = target;
      if (possibleTarget && !possibleTarget.isWorld) {
        let h = this.morphHighlighter = MorphHighlighter.for(world, target);
        h && h.show();
      }
    }
  }

  selectTarget() {
    this.targetObject = this.possibleTarget;
    this.stopSelect();
  }

  stopSelect() {
    MorphHighlighter.removeHighlighters(this.world);
    disconnect(this.world.firstHand, 'position', this, 'scanForTargetAt');
    this.selectorMorph.remove();
    this.whenDone && this.whenDone.resolve(this.targetObject);
  }

}
