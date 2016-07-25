import { Ellipse, Morph, Path } from "./index.js"
import { Color, pt, rect, Line, Rectangle } from "lively.graphics";
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
      fontColor: Color.darkGray,
      readOnly: true,
      position: pt(6,3),
      extent: pt(90, 14),
      fixedWidth: false,
      fill: Color.red.withA(0),
      fontSize: 12,
      reactsToPointer: false
    });
  }

  get isHaloItem() { return true; }

  displayedValue() { return this.get("textField").textString; }

  displayProperty(val) {
    val = String(val);
    this.visible = true;
    this.get("textField").textString = val;
    this.width = 12 + this.get("textField").width;
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
        this.proportionalMode(false);
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      onDragStart(evt) { this.init(evt.isShiftDown()) },
      onDrag(evt) { this.update(evt.state.dragDelta, evt.isShiftDown()) },
      onDragEnd(evt) { this.stop(evt.isShiftDown()) },
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
        this.halo.toggleMesh(false);
      },
      update: (delta, grid=false) => {
        var newPos = this.target.globalPosition.addPt(delta);
        if (grid) {
          newPos = newPos.griddedBy(pt(10,10));
        }
        this.target.globalPosition = newPos;
        this.alignWithTarget();
        this.toggleMesh(grid);
      },
      onDragStart(evt) { this.init() },
      onDrag(evt) { this.update(
                    this.halo.tranformMoveDeltaDependingOnHaloPosition(
                        evt, evt.state.dragDelta, "topRight"
                      ),
                    evt.isAltDown()); },
      onDragEnd(evt) { this.stop() },
      onKeyUp(evt) { this.halo.toggleMesh(false) }
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
        this.halo.toggleRotationIndicator(true, this);
      },
      initScale(gauge) {
        this.halo.activeButton = this;
        scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
        this.halo.toggleRotationIndicator(true, this);
      },
      update(angleToTarget) {
        scaleGauge = null;
        var newRotation = angleToTarget - angle;
        newRotation = newRotation.toDegrees().detent(10,45).toRadians();
        this.halo.target.rotation = newRotation;
        this.halo.toggleRotationIndicator(true, this);
      },
      updateScale(gauge) {
        if (!scaleGauge) scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
        angle = gauge.theta();
        this.halo.target.scale = (gauge.dist(pt(0,0)) / scaleGauge.dist(pt(0,0))).detent(0.1, 0.5);
        this.halo.toggleRotationIndicator(true, this);
      },
      stop() {
        scaleGauge = null;
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleRotationIndicator(false, this);
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
        this.globalPosition = evt.position.addPt(pt(-10,-10));
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
      },
      onKeyDown(evt) {
          this.adaptAppearance(evt.isShiftDown());
      },
      onKeyUp(evt) {
          this.adaptAppearance(evt.isShiftDown());
      },
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
    this.buttonControls = [
      this.originHalo(),
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

  onKeyUp(evt) {
    this.toggleDiagonal(false);
    this.toggleMesh(false);
  }

  tranformMoveDeltaDependingOnHaloPosition(evt, moveDelta, cornerName) {
    // Griding and rounding might move the morph differently
    // so we have to recalculate the delta...
    if(!evt.isAltDown())
        return moveDelta

    var pos = this.target.bounds()[cornerName]()
    var newOffset = evt.position.subPt(this.target.owner.worldPoint(pos))
    this.startOffset = this.startOffset || newOffset;

    var deltaOffset = newOffset.subPt(this.startOffset)

    moveDelta = moveDelta.addPt(deltaOffset);
    return moveDelta
 }

  toggleMesh(active) {
    var mesh = this.getSubmorphNamed("mesh");
    if (active) {
      if (mesh) {
        mesh.position = this.localizePointFrom(pt(2,2), this.world());
      } else {
        this.addMorphBack(
          new Morph({name: "mesh",
                     onKeyUp: (evt) => this.toggleMesh(false),
                     extent: this.world().extent,
                     position: this.localizePointFrom(pt(2,2), this.world()),
                     opacity: 0.1,
                     styleClasses: ["morph", "halo-mesh"], fill: Color.transparent}))
      }
    } else {
      mesh && mesh.remove();
    }
  }

  toggleDiagonal(active) {
    var diagonal = this.getSubmorphNamed("diagonal");
    if (active) {
      if (diagonal) {
        diagonal.extent = this.extent.addPt(diagonal.position.negated().scaleBy(2));
        return diagonal.vertices[1];
      } else {
        var offset = this.extent.scaleBy(0.5);
        diagonal = this.extent;
        this.addMorphBack(new Path({
          name: "diagonal",
          styleClasses: ["morph", "halo-guide"],
          borderStyle: "dashed",
          position: offset.negated(),
          extent: this.extent.addPt(offset.scaleBy(2)),
          borderColor: Color.red,
          borderWidth: 2,
          gradient:[[0, Color.red.withA(0)],
                    [0.1, Color.red],
                    [0.9, Color.red],
                    [1.0, Color.red.withA(0)]],
          vertices: [pt(0,0), diagonal.addPt(offset.scaleBy(2))]}));
        return diagonal;
      }
    } else {
      if (diagonal) {
        diagonal.remove()
      }
    }
  }

  toggleRotationIndicator(active, haloItem) {
    var rotationIndicator = this.getSubmorphNamed("rotationIndicator");
    if (active) {
      var originPos = this.getSubmorphNamed("origin").bounds().center();
      const localize = (p) => rotationIndicator.localizePointFrom(p, this);
      if (!rotationIndicator) {
        this.addMorphBack(new Path({
            styleClasses: ["morph", "halo-guide"],
            name: "rotationIndicator",
            borderColor: Color.red,
            bounds: haloItem.bounds().union(this.innerBounds()),
            vertices: []
          }));
      } else {
        rotationIndicator.setBounds(haloItem.bounds().union(this.innerBounds()));
        rotationIndicator.vertices = [localize(originPos), localize(haloItem.bounds().center())];
      }
    } else {
      if (rotationIndicator) {
        rotationIndicator.remove();
      }
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
