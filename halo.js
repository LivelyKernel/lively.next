import { Ellipse, Morph } from "./index.js"
import { Color, pt, rect, Line } from "lively.graphics";
import { string, obj, arr, num } from "lively.lang";

const itemExtent = pt(24,24);

class HaloItem extends Ellipse {

  constructor(props) {
    super(Object.assign({
      fill: Color.gray.withA(.7),
      grabbable: false,
      extent: itemExtent
    }, props));
  }

  get isHaloItem() { return true };

  alignInHalo() {
    const {x: width, y: height} = this.halo.extent,
          {row, col} = this.location,
          collWidth = (width + this.extent.x) / 3,
          rowHeight = height / 3,
          pos = pt(collWidth * col, rowHeight * row).subPt(itemExtent);
    this.setBounds(pos.extent(itemExtent));
  }

  init() {}
  update() {}
  stop() {}
  valueForPropertyDisplay() { return undefined; }

}

class HaloPropertyDisplay extends Morph {

  constructor() {
    super({
      name: "propertyDisplay",
      fill: Color.lightGray.withA(0.5),
      borderRadius: 15,
      extent: pt(100, 20),
      position: pt(0,-22),
      visible: false,
      reactsToPointer: false
    });

    this.addMorph({
      type: "text",
      name: "textField",
      readOnly: true,
      position: pt(6,3),
      extent: pt(90, 14),
      fixedWidth: true,
      fill: Color.red.withA(0),
      fontSize: 12,
      reactsToPointer: false
    });
  }

  get isHaloItem() { return true; }

  displayedValue() { return this.get("textField").textString; }

  displayProperty(val) {
    this.visible = true;
    this.get("textField").textString = String(val);
  }

  disable() { this.visible = false; }

}

export class Halo extends Morph {

  constructor(pointerId, target) {
    super({
      styleClasses: ["morph", "halo"],
      borderColor: Color.red,
      borderWidth: 2,
      fill: Color.transparent
    });
    this.state = {pointerId, target, draggedButton: null}
    this.initButtons();
  }

  get isHalo() { return true }

  get target() { return this.state.target; }

  morphsContainingPoint(list) { return list }

  get propertyDisplay() {
    return this.getSubmorphNamed("propertyDisplay") || this.addMorph(new HaloPropertyDisplay());
  }

  refocus(newTarget) {
    var owner = this.owner;
    this.remove();
    this.state.target = newTarget;
    owner.addMorphAt(this, 0);
    this.alignWithTarget();
  }

  resizeHalo() {
    return this.getSubmorphNamed("resize") || this.addMorph(new HaloItem({
      name: "resize",
      styleClasses: ["halo-item", "fa", "fa-arrows-alt"],
      location: {col: 3, row: 3},
      origin: pt(12, 12),
      property: 'extent',
      halo: this,
      valueForPropertyDisplay: () => {
        var {x: width, y: height} = this.target.extent;
        return `${width.toFixed(1)}w ${height.toFixed(1)}h`;
      },
      update(delta, proportional=false) {
        delta = this.proportionalMode(proportional, delta);
        this.halo.target.resizeBy(delta.scaleBy(1 / this.halo.target.scale));
        this.halo.alignWithTarget();
      },
      init(proportional=false) {
        this.proportionalMode(proportional);
        this.halo.activeButton = this;
      },
      stop(proportional=false) {
        this.proportionalMode(proportional);
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      onDragStart(evt) { this.init(evt.isShiftDown()) },
      onDrag(evt) { this.update(evt.state.dragDelta, evt.isShiftDown()) },
      onDragEnd(evt) { this.stop(evt.isShiftDown()) },
      // FIXME: keyboard events are not yet targeted to morphs
      onKeyDown(evt) {
        this.proportionalMode(evt.isShiftDown());
      },
      onKeyUp(evt) {
        this.proportionalMode(false);
      },
      proportionalMode(active, delta=null) {
        if (active) {
          const diagonal = this.halo.toggleDiagonal(true);
          this.styleClasses = ["halo-item", "fa", "fa-expand"];
          this.rotation = -Math.PI / 2;
          if (delta) {
            delta = diagonal.scaleBy(
                      diagonal.dotProduct(delta) /
                      diagonal.dotProduct(diagonal));
          }
          return delta;
        } else {
          this.styleClasses = ["halo-item", "fa", "fa-arrows-alt"];
          this.rotation = 0;
          this.halo.toggleDiagonal(false);
          return delta;
        }
      }
    }));
  }

  closeHalo() {
    return this.getSubmorphNamed("close") || this.addMorph(new HaloItem({
      name: "close",
      styleClasses: ["halo-item", "fa", "fa-close"],
      location: {col: 3, row: 0},
      draggable: false,
      halo: this,
      update: () => {
        this.remove();
        this.target.remove();
      },
      onMouseDown(evt) { this.update(); }
    }));
  }

  grabHalo() {
    return this.getSubmorphNamed("grab") || this.addMorph(new HaloItem({
      name: "grab",
      styleClasses: ["halo-item", "fa", "fa-hand-rock-o"],
      location: {col: 1, row: 0},
      halo: this,
      init: (hand) => {
        hand.grab(this.target);
      },
      update(hand) {
        hand.dropMorphsOn(this.morphBeneath(hand.position));
        this.halo.alignWithTarget();
      },
      onDragStart(evt) {
        this.init(evt.hand)
      },
      onDragEnd(evt) {
        this.update(evt.hand)
      }
    }));
  }

  dragHalo() {
    return this.getSubmorphNamed("drag") || this.addMorph(new HaloItem({
      name: "drag",
      styleClasses: ["halo-item", "fa", "fa-arrows"],
      property: 'position',
      location: {col: 2, row: 0},
      halo: this,
      valueForPropertyDisplay: () => this.target.position,
      init() {
        this.halo.activeButton = this;
      },
      stop() {
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      update: (delta) => {
        this.target.globalPosition = this.target.globalPosition.addPt(delta);
        this.alignWithTarget();
      },
      onDragStart(evt) { this.init() },
      onDrag(evt) { this.update(evt.state.dragDelta); },
      onDragEnd(evt) { this.stop() }
    }));
  }

  inspectHalo() {
    return this.getSubmorphNamed("inspect") || this.addMorph(new HaloItem({
      name: "inspect",
      styleClasses: ["halo-item", "fa", "fa-eye"],
      draggable: false,
      location: {col: 3, row: 2},
      halo: this,
      onMouseDown: (evt) => {
        this.target.inspect();
      }
    }));
  }

  editHalo() {
    return this.getSubmorphNamed("edit") || this.addMorph(new HaloItem({
      name: "edit",
      styleClasses: ["halo-item", "fa", "fa-pencil"],
      draggable: false,
      location: {col: 3, row: 1},
      halo: this,
      onMouseDown: (evt) => {
        this.target.edit();
      }
    }));
  }

  rotateHalo() {
    var angle = 0,
        scaleGauge = null;
    return this.getSubmorphNamed("rotate") || this.addMorph(new HaloItem({
      name: "rotate",
      property: "rotation",
      styleClasses: ["halo-item", "fa", "fa-repeat"],
      location: {col: 0, row: 3},
      halo: this,
      valueForPropertyDisplay: () => scaleGauge ?
                                       this.target.scale.toFixed(4).toString() :
                                       num.toDegrees(this.target.rotation).toFixed(1) + "°",
      init(angleToTarget) {
        this.halo.activeButton = this;
        angle = angleToTarget;
      },
      initScale(gauge) {
        this.halo.activeButton = this;
        scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
      },
      update: (angleToTarget) => {
        scaleGauge = null;
        this.target.rotateBy(angleToTarget - angle);
        angle = angleToTarget;
        this.alignWithTarget();
      },
      updateScale: (gauge) => {
        if (!scaleGauge) scaleGauge = gauge.scaleBy(1 / this.target.scale);
        this.target.scale = gauge.dist(pt(0,0)) / scaleGauge.dist(pt(0,0));
        this.alignWithTarget();
      },
      stop() {
        scaleGauge = null;
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      onDragStart(evt) {
        this.adaptAppearance(evt.isShiftDown());
        if (evt.isShiftDown()) {
          this.initScale(evt.position.subPt(this.halo.target.globalPosition)); 
        } else {
          this.init(evt.position.subPt(this.halo.target.globalPosition).theta()); 
        }
      },
      onDrag(evt) {
        this.adaptAppearance(evt.isShiftDown());
        if (evt.isShiftDown()) {
          this.updateScale(evt.position.subPt(this.halo.target.globalPosition)); 
        } else {
          this.update(evt.position.subPt(this.halo.target.globalPosition).theta()); 
        }
      },
      onDragEnd(evt) {
        this.adaptAppearance(evt.isShiftDown());
        this.stop();
      },
      adaptAppearance(scaling) {
        if (scaling) {
          this.styleClasses = ["halo-item", "fa", "fa-search-plus"];
        } else {
          this.styleClasses = ["halo-item", "fa", "fa-repeat"];
        }
      }
    }));
  }

  copyHalo() {
    return this.getSubmorphNamed("copy") || this.addMorph(new HaloItem({
      name: "copy",
      styleClasses: ["halo-item", "fa", "fa-clone"],
      location: {col: 0, row: 1},
      halo: this,
      init: (hand) => {
        var pos = this.target.globalPosition,
            copy = this.target.copy();
        hand.grab(copy);
        copy.globalPosition = pos;
        this.refocus(copy);
      },
      update(hand) {
        hand.dropMorphsOn(this.morphBeneath(hand.position));
        this.halo.alignWithTarget();
      },
      onDragStart(evt) {
        this.init(evt.hand)
      },
      onDragEnd(evt) {
        this.update(evt.hand);
      }
    }));
  }

  originHalo() {
    return this.getSubmorphNamed("origin") || this.addMorph(new HaloItem({
      name: "origin", fill: Color.red,
      opacity: 0.9, borderColor: Color.black,
      borderWidth: 2,
      position: this.target.origin.subPt(pt(7.5,7.5)),
      extent: pt(15,15),
      halo: this,
      computePositionAtTarget: () => {
          return this.localizePointFrom(pt(0,0),this.target)
                     .subPt(pt(7.5,7.5));
      },
      alignInHalo() {
        this.position = this.computePositionAtTarget();
      },
      valueForPropertyDisplay: () => this.target.origin,
      init() { this.halo.activeButton = this; },
      stop() {
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      update: (delta) => {
        var oldOrigin = this.target.origin,
            globalOrigin = this.target.worldPoint(oldOrigin),
            newOrigin = this.target.localize(globalOrigin.addPt(delta));
        delta = newOrigin.subPt(oldOrigin);
        this.target.adjustOrigin(this.target.origin.addPt(delta));
        this.alignWithTarget();
      },
      onDragStart(evt) { this.init(); },
      onDragEnd(evt) { this.stop(); },
      onDrag(evt) { this.update(evt.state.dragDelta); }
    }));;
  }

  stylizeHalo() {
    return this.getSubmorphNamed("style") || this.addMorph(new HaloItem({
      name: "style",
      styleClasses: ["halo-item", "fa", "fa-picture-o"],
      location: {col: 0, row: 2},
      halo: this,
      onMouseDown: (evt) => {
        // stylize
      }
    }));
  }

  initButtons() {
    this.addMorph(this.originHalo());
    this.buttonControls = [
      this.resizeHalo(),
      this.closeHalo(),
      this.dragHalo(),
      this.grabHalo(),
      this.inspectHalo(),
      this.editHalo(),
      this.copyHalo(),
      this.rotateHalo(),
      this.stylizeHalo()
    ];
  }

  updatePropertyDisplay(haloItem) {
    var val = haloItem.valueForPropertyDisplay();
    if (typeof val !== "undefined")
      this.propertyDisplay.displayProperty(val);
    else
      this.propertyDisplay.disable();
  }

  toggleDiagonal(active) {
    // FIXME: Implement svg paths
    // var diagonal = this.getSubmorphNamed("diagonal");
    // if (visible) {
    //   if (!diagonal) {
    //     diagonal = new Path(
    //       {name: "diagonal",
    //       style: "dashed",
    //       gradient: {0: Color.transparent,
    //                   0.1: Color.red,
    //                   0.9: Color.transparent},
    //       path: [this.bounds().topLeft(),
    //               this.bounds().bottomRight()]});
    //     this.add(diagonal);
    //   } else {
    //     if (diagonal) {
    //       diagonal.remove();
    //     }
    //   }
    // }
    if (active) {
      this.diagonal = this.diagonal || 
                      this.target.bounds().bottomRight()
                          .subPt(this.target.bounds().topLeft());
      return this.diagonal
    } else {
      this.diagonal = null;
    }
  }

  alignWithTarget() {
    const {x, y, width, height} = this.target.globalBounds(),
          origin = this.target.origin;
    this.setBounds(rect(x,y, width, height));
    if (this.activeButton) {
      this.buttonControls.forEach(ea => ea.visible = false);
      this.activeButton.visible = true;
      this.updatePropertyDisplay(this.activeButton);
      this.activeButton.alignInHalo();
    } else {
      this.buttonControls.forEach(b => { b.visible = true; b.alignInHalo(); });
      this.propertyDisplay.disable();
    }
    this.originHalo().alignInHalo();
    return this;
  }

}
