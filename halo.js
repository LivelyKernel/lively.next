import { Ellipse, Morph, Path } from "./index.js"
import { Color, pt, rect, Line, Rectangle } from "lively.graphics";
import { string, obj, arr, num } from "lively.lang";

const itemExtent = pt(24,24);

const guideGradient = [[0, Color.red.withA(0)],
                       [0.1, Color.red],
                       [0.9, Color.red],
                       [1.0, Color.red.withA(0)]]

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

  get defaultPosition() { return pt(0,-22); }

  constructor(halo) {
    super({
      name: "propertyDisplay",
      fill: Color.lightGray.withA(0.5),
      borderRadius: 15,
      extent: pt(100, 20),
      position: this.defaultPosition,
      visible: false,
      reactsToPointer: false,
      halo
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
    // FIXME: What we actually want is morph layouting
    this.width = 12 + this.get("textField").width;
    var activeButton = this.halo.activeButton;
    if (activeButton && 
        activeButton.topLeft.x < (this.width + 10) && 
        activeButton.topLeft.y < 0) {
      this.position = pt(activeButton.topRight.x + 10,-22);
    } else {
      this.position = this.defaultPosition;
    }
  }

  disable() { 
    this.position = this.defaultPosition;
    this.visible = false; 
  }
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
    this.focus();
  }

  get isHalo() { return true }

  get target() { return this.state.target; }

  morphsContainingPoint(list) { return list }

  get propertyDisplay() {
    return this.getSubmorphNamed("propertyDisplay") || this.addMorph(new HaloPropertyDisplay(this));
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
      styleClasses: ["halo-item", "fa", "fa-crop"],
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
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      onDragStart(evt) { this.init(evt.isShiftDown()) },
      onDrag(evt) { this.update(evt.state.dragDelta, evt.isShiftDown()) },
      onDragEnd(evt) { this.stop(evt.isShiftDown()) },
      onKeyDown(evt) {
        this.styleClasses = ["halo-item", "fa", "fa-expand"];
        this.rotation = -Math.PI / 2;
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
          this.styleClasses = ["halo-item", "fa", "fa-crop"];
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
    var dropTarget;
    return this.getSubmorphNamed("grab") || this.addMorph(new HaloItem({
      name: "grab",
      styleClasses: ["halo-item", "fa", "fa-hand-rock-o"],
      location: {col: 1, row: 0},
      halo: this,
      valueForPropertyDisplay() {
        dropTarget = this.morphBeneath(this.hand.position);
        this.halo.toggleDropIndicator(dropTarget && dropTarget != this.world(), dropTarget);
        return dropTarget && dropTarget.name;
      },
      init(hand) {
        this.hand = hand;
        hand.grab(this.halo.target);
        this.halo.activeButton = this;
      },
      update(hand) {
        this.halo.activeButton = null;
        hand.dropMorphsOn(this.morphBeneath(hand.position));
        this.halo.alignWithTarget();
        this.halo.toggleDropIndicator(false, dropTarget);
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
        scaleGauge = null,
        initRotation = 0;
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
        initRotation = this.halo.target.rotation;
        this.halo.toggleRotationIndicator(true, this);
      },
      initScale(gauge) {
        this.halo.activeButton = this;
        scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
        this.halo.toggleRotationIndicator(true, this);
      },
      update(angleToTarget) {
        scaleGauge = null;
        var newRotation = initRotation + (angleToTarget - angle);
        newRotation = num.toRadians(num.detent(num.toDegrees(newRotation), 10, 45))
        this.halo.target.rotation = newRotation;
        this.halo.toggleRotationIndicator(true, this);
      },
      updateScale(gauge) {
        if (!scaleGauge) scaleGauge = gauge.scaleBy(1 / this.halo.target.scale);
        angle = gauge.theta();
        this.halo.target.scale = num.detent(gauge.dist(pt(0,0)) / scaleGauge.dist(pt(0,0)), 0.1, 0.5);
        this.halo.toggleRotationIndicator(true, this);
      },
      stop() {
        scaleGauge = null;
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleRotationIndicator(false, this);
      },
      adaptAppearance(scaling) {
        if (scaling) {
          this.styleClasses = ["halo-item", "fa", "fa-search-plus"];
        } else {
          this.styleClasses = ["halo-item", "fa", "fa-repeat"];
        }
      },
      // events
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
      opacity: 0.5, borderColor: Color.black,
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
    this.buttonControls.map(b => b.onKeyUp(evt));
  }
  
  onKeyDown(evt) {
    this.buttonControls.map(b => b.onKeyDown(evt));
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
    var mesh = this.getSubmorphNamed("mesh"),
        horizontal = this.getSubmorphNamed("horizontal"),
        vertical = this.getSubmorphNamed("vertical");
    if (active) {
        const position = this.localize(pt(0,0)),
              {width, height, extent} = this.world(),
              defaultGuideProps = {
                     styleClasses: ["morph", "halo-guide"],
                     borderStyle: "dashed",
                     position, extent,
                     borderWidth: 2,
                     gradient: guideGradient},
               {x, y} = this.target.worldPoint(pt(0,0));
        // init
         vertical = vertical || this.addMorphBack(
           new Path({
             ...defaultGuideProps,
             name: "vertical",
             vertices: [pt(x,0), pt(x, height)]
           }));
         horizontal = horizontal || this.addMorphBack(
           new Path({
             ...defaultGuideProps,
             name: "horizontal",
             vertices: [pt(0,y), pt(width, y)]
           }));
         mesh = mesh || this.addMorphBack(
           new Morph({name: "mesh",
                      onKeyUp: (evt) => this.toggleMesh(false),
                      extent, position: this.localize(pt(2,2)),
                      styleClasses: ["morph", "halo-mesh"], fill: Color.transparent}));
        // update
        horizontal.position = position;
        vertical.position = position;
        mesh.position = this.localize(pt(2,2));
        horizontal.vertices = [pt(0,y), pt(this.world().width, y)];
        vertical.vertices = [pt(x,0), pt(x, this.world().height)];
    } else {
      vertical && vertical.remove();
      horizontal && horizontal.remove();
      mesh && mesh.remove();
    }
    this.focus();
  }

  toggleDiagonal(active) {
    var diagonal = this.getSubmorphNamed("diagonal");
    if (active) {
      var offset = pt(100,100);
      diagonal = diagonal || this.addMorphBack(new Path({
          name: "diagonal",
          styleClasses: ["morph", "halo-guide"],
          borderStyle: "dashed",
          borderWidth: 2,
          gradient: guideGradient,
          position: offset.negated(),
          extent: this.extent.addPt(offset.scaleBy(2)),
          vertices: [pt(0,0), this.extent.addPt(offset.scaleBy(2))]}));
        diagonal.setBounds(diagonal.position.extent(this.extent.addPt(diagonal.position.scaleBy(-2))))
        return diagonal.vertices[1];
    } else {
      diagonal && diagonal.remove();
    }
  }

  toggleRotationIndicator(active, haloItem) {
    var rotationIndicator = this.getSubmorphNamed("rotationIndicator");
    if (active && haloItem) {
      const originPos = this.getSubmorphNamed("origin").center,
            localize = (p) => rotationIndicator.localizePointFrom(p, this);
      rotationIndicator = rotationIndicator || this.addMorphBack(new Path({
          styleClasses: ["morph", "halo-guide"],
          name: "rotationIndicator",
          borderColor: Color.red,
          vertices: []
        }));
      rotationIndicator.setBounds(haloItem.bounds().union(this.innerBounds()));
      rotationIndicator.vertices = [localize(originPos), localize(haloItem.center)];
    } else {
      rotationIndicator && rotationIndicator.remove();
    }
  }
  
  toggleDropIndicator(active, target) {
    var dropIndicator = this.getSubmorphNamed("dropTargetIndicator");
    if (active && target && target != this.world()) {
        dropIndicator = dropIndicator || this.addMorphBack(new Morph({
                        styleClasses: ["morph", "halo-guide"],
                        name: "dropTargetIndicator",
                        fill: Color.orange.withA(0.5)}));
        dropIndicator.position = this.localize(target.globalBounds().topLeft());
        dropIndicator.extent = target.globalBounds().extent();
    } else {
      dropIndicator && dropIndicator.remove();
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
