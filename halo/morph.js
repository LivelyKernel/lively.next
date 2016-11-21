import { Ellipse, Morph, Path, Text, 
         HorizontalLayout, GridLayout, 
         VerticalLayout, morph, Menu } from "../index.js";
import { Color, pt, rect, Line, Rectangle } from "lively.graphics";
import { string, obj, arr, num, grid, properties } from "lively.lang";
import { connect, disconnect, disconnectAll, signal, once } from "lively.bindings";
import { ColorPicker } from "../ide/style-editor.js";
import Inspector from "../ide/js/inspector.js";
import { styleHaloFor } from './stylization.js';
import { Icon } from '../icons.js';

const itemExtent = pt(24,24);

const guideGradient = [[0, Color.orange.withA(0)],
                       [0.2, Color.orange],
                       [0.8, Color.orange],
                       [1.0, Color.orange.withA(0)]]

class HaloItem extends Morph {

  get isEpiMorph() { return true; }

  constructor(props) {
    super({
      borderRadius: 15,
      fill: Color.gray.withA(.7),
      grabbable: false,
      property: null, // what property of target to represent + modify
      extent: itemExtent,
      ...props
    });

  }

  get isHaloItem() { return true };

  init() {}
  update() {}
  stop() {}
  valueForPropertyDisplay() { return undefined; }

}

class NameHolder extends Text {

   constructor(props) {
      super({
        padding: 6,
        tooltip: "Click to edit the morph's name",
        draggable: false,
        fill: Color.transparent,
        fontColor: Color.darkgray,
        active: true,
        ...props});
   }

   onHoverIn(evt) {
     if (this.highlightOnHover && this.active) {
           this.halo.toggleMorphHighlighter(true, this.target);
           this.fontColor = Color.orange;
        }
   }

   onHoverOut(evt) {
      if (this.highlightOnHover) {
         this.halo.toggleMorphHighlighter(false, this.target);
         this.fontColor = Color.darkgray;
      }
   }

   onKeyDown(evt) {
    if ("Enter" == evt.keyCombo) {
      this.updateName(this.textString);
      evt.stop();
    } else {
      super.onKeyDown(evt);
    }
  }

  onMouseUp() {
    signal(this, "active", [true, this]);
  }

  onMouseDown(evt) {
    super.onMouseDown(evt);
    this.fontColor = Color.darkgray;
    this.halo.toggleMorphHighlighter(false, this.target);
  }

  onKeyUp(evt) {
    super.onKeyUp(evt);
    const newName = this.textString,
          owner = this.target.owner;
    this.validName = (!owner || !owner.getSubmorphNamed(newName) ||
                          this.target.name == newName);
    signal(this, "valid", [this.validName, newName]);
  }

  update() {
     this.textString = this.target.name;
     this.fit();
  }

  activate() {
     this.readOnly = false;
     this.active = true;
     this.animate({opacity: 1});
  }

  deactivate() {
     this.readOnly = true;
     this.active = false;
     this.animate({opacity: .3});
  }

  updateName(newName) {
    if (this.validName) {
      this.target.name = newName;
      signal(this, "active", [false, this]);
    }
  }

}

class NameHalo extends HaloItem {

  constructor(props) {

    super({
        borderRadius: 15,
        fill: Color.gray.withA(.7),
        borderColor: Color.green,
        layout: new HorizontalLayout({spacing: 0}),
        ...props
      });

    this.initNameHolders();

    this.validityIndicator = Icon.makeLabel("check", {
      fontColor: Color.green,
      fontSize: 15,
      padding: rect(4,4,4,0),
      onMouseDown: (evt) => {
        const m = this.conflictingMorph;
        if (this.conflictingMorph) {
          this.halo.toggleMorphHighlighter(true, m);
          setTimeout(() => this.halo.toggleMorphHighlighter(false, m), 1000);
        }
      }
      });

    this.alignInHalo();
  }

  targets() {
     return this.halo.target.isMorphSelection ? this.halo.target.selectedMorphs.map(target => {
           return {target, highlightOnHover: true}
         }) : [{target: this.halo.target, highlightOnHover: false}];
  }

  initNameHolders() {
    this.nameHolders = this.targets().map(
          ({target, highlightOnHover}) => {
               const nh = new NameHolder({halo: this.halo, highlightOnHover, target});
               connect(nh, "active", this, "toggleActive");
               connect(nh, "valid", this, "toggleNameValid");
               return nh;
            });
    this.submorphs = arr.interpose(this.nameHolders, {
          extent: pt(1,25), fill: Color.black.withA(.4)
      });
  }

  toggleActive([active, nameHolder]) {
    if (this.halo.changingName === active) return;
    this.halo.changingName = active;
    if (active) {
      this.nameHolders.forEach(nh => {
         if (nh != nameHolder) nh.deactivate();
      });
      this.borderWidth = 3;
      this.addMorph(this.validityIndicator);
      setTimeout(() => this.nameHolder.selectAll());
      
    } else {
      this.nameHolders.forEach(nh => {
         if (nh != nameHolder) nh.activate();
      });
      this.borderWidth = 0;
      this.validityIndicator.remove();
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
      Icon.setIcon(this.validityIndicator, "check")
    } else {
      this.conflictingMorph = this.get(name);
      this.borderColor = Color.red;
      this.validityIndicator.fontColor = Color.red;
      this.validityIndicator.nativeCursor = "pointer";
      Icon.setIcon(this.validityIndicator, "exclamation-circle")
    }
  }

  alignInHalo() {
    this.nameHolders.forEach(nh => nh.update())
    var {x, y} = this.halo.innerBounds().bottomCenter().addPt(pt(0, 2));
    this.topCenter = pt(Math.max(x, 30), Math.max(y, 80));
  }
}

class HaloPropertyDisplay extends Text {

  get defaultPosition() { return pt(25,0); }

  constructor(halo) {
    super({
      name: "propertyDisplay",
      fill: Color.black.withA(.5),
      borderRadius: 15,
      padding: 5,
      position: this.defaultPosition,
      visible: false,
      readOnly: true,
      fontSize: 12,
      fontColor: Color.white,
      halo
    });
  }

  get isHaloItem() { return false; }

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

class SelectionTarget extends Morph {

   constructor(selectedMorphs) {
      super({visible: false});
      this.selectedMorphs = selectedMorphs;
      this.alignWithSelection();
      this.initialized = true;
   }

   get isHaloItem() { return true }

   get isMorphSelection() { return true }

   alignWithSelection() {
      const bounds = this.selectedMorphs
                         .map(m => m.globalBounds())
                         .reduce((a,b) => a.union(b));
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
      this.selectedMorphs.forEach(m => {
         m.resizeBy(delta);
      })
   }

   updatePosition({prevValue, value}) {
      const delta = value.subPt(prevValue);
      this.selectedMorphs.forEach(m => {
         m.moveBy(delta);
      })
   }

   updateRotation({prevValue, value}) {
      const delta = value - prevValue;
      this.selectedMorphs.forEach(m => {
         const oldOrigin = m.origin;
         m.adjustOrigin(m.localize(this.worldPoint(pt(0,0))))
         m.rotation += delta;
         m.adjustOrigin(oldOrigin);
      })
   }

   updateScale({prevValue, value}) {
      const delta = value - prevValue;
      this.selectedMorphs.forEach(m => {
         const oldOrigin = m.origin;
         m.adjustOrigin(m.localize(this.worldPoint(pt(0,0))))
         m.scale += delta;
         m.adjustOrigin(oldOrigin);
      })
   }
 
   onChange(change) {
       super.onChange(change);
       if (!this.initialized || this.selectionGrabbed) return;
       switch (change.prop) {
            case "extent": 
               this.updateExtent(change);
               break;
            case "scale": 
               this.updateScale(change);
               break;
            case "position": 
               this.updatePosition(change);
               break;
            case "rotation": 
               this.updateRotation(change);
       }
       return change;
   }

}

export class Halo extends Morph {

  get isEpiMorph() { return true; }

  constructor(pointerId, target) {
    super({
      styleClasses: ["morph", "halo"],
      fill: Color.transparent,
    });
    this.borderBox = this.addMorph({
      isHalo: true,
      name: "border-box", fill: Color.transparent, 
      borderColor: Color.red, borderWidth: 2
    });
    target = this.prepareTarget(target);
    this.state = {pointerId, target, draggedButton: null}
    this.initButtons();
    this.focus();
    this.alignWithTarget();
    this.initLayout();
    connect(this.target, "onChange", this, "alignWithTarget")
  }

  prepareTarget(target) {
     if (obj.isArray(target)) {
         const [firstSelected] = target;
         if (target.length > 1) {
             this.targetProxy = firstSelected.world().addMorph(new SelectionTarget(target));
             return this.targetProxy;
         }
         return firstSelected
     }
     return target;
  }
  
  remove() {
    disconnect(this.target, "onChange", this, "alignWithTarget");
    this.targetProxy && this.targetProxy.remove();
    super.remove();
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

  nameHalo() {
    return this.getSubmorphNamed("name") || this.addMorph(new NameHalo({halo: this, name: "name"}));
  }

  // resizing

  getGlobalRotation() {
     return this.target.getGlobalTransform().getRotation()
  }

  getGlobalScale() {
     return this.target.getGlobalTransform().getScale();
  }

  getResizeParts(rotation) {
      if (rotation > 0) rotation = rotation - 360;
      var offset = - 8 - (rotation / 45).toFixed();
      if (offset == 0) offset = 8;

      return arr.zip(
         arr.rotate(
      [["topLeft", delta => delta.negated()],
        ["topCenter", delta => delta.withX(0).negated()],
        ["topRight", delta => delta.withX(0).negated()],
        ["rightCenter", delta => pt(0,0)],
        ["bottomRight", delta => pt(0,0)],
        ["bottomCenter", delta => pt(0,0)],
        ["bottomLeft", delta => delta.withY(0).negated()],
        ["leftCenter", delta => delta.withY(0).negated()]], 
       offset),
      [["nwse-resize", "topLeft"],
        ["ns-resize", "topCenter"],
        ["nesw-resize", "topRight"],
        ["ew-resize", "rightCenter"],
        ["nwse-resize", "bottomRight"],
        ["ns-resize", "bottomCenter"],
        ["nesw-resize", "bottomLeft"],
        ["ew-resize", "leftCenter"]])
   }

   resizeHandles() { return this.submorphs.filter(h => h.isHandle) }

   updateResizeHandles() {
       this.borderBox.remove();
       this.resizeHandles().forEach(h => h.remove());
       this.submorphs = [this.borderBox, ...this.resizeHalos(), ...this.submorphs];
   }

   resizeHalos() {
       return this.getResizeParts(this.getGlobalRotation()).map(([c, l]) =>
           this.placeHandleFor(c, l)
       );
   }

   proportionalDelta(corner, delta, bounds) {
    const {width, height} = bounds,
    diagonals  = {
       topLeft: pt(-1,-1), topCenter: pt(0,-1), topRight: pt(1,-1),
       leftCenter: pt(-1, 0),                   rightCenter: pt(1,0),
       bottomLeft: pt(-1, 1), bottomCenter: pt(0,1), bottomRight: pt(1,1)
    
    }, w = width / Math.max(width, height), h = height / Math.max(height, width), 
    gradients = {
       topLeft: pt(-w,-h), topCenter: pt(1/(2 * height/width),-1), topRight: pt(w,-h),
       leftCenter: pt(-1,height/(2 * width)),   rightCenter: pt(1,height/(3 * width)),
       bottomLeft: pt(-w,h), bottomCenter: pt(1/(2 * height/width),1), bottomRight: pt(w,h)
    },
    diagonal = diagonals[corner], gradient = gradients[corner];
    return gradient.scaleBy(diagonal.dotProduct(delta)/diagonal.dotProduct(diagonal));
  }

   updateBoundsFor(corner, proportional, delta, bounds, origin) {
      var proportionalMask = {
         topLeft: rect(-1,-1,1,1),
         topCenter: proportional ? rect(1,-1,0,1) : rect(0,-1,0,1),
         topRight: rect(0,-1,1,1),
         rightCenter: proportional ? rect(0,1,1,1) : rect(0,0,1,0),
         bottomRight: rect(0,0,1,1),
         bottomCenter: proportional ? rect(1,0,0,1) : rect(0,0,0,1),
         bottomLeft: rect(-1,0,1,1),
         leftCenter: proportional ? rect(-1,1,1,0) : rect(-1,0,1,0)
        },
        {x,y,width,height} = proportionalMask[corner],
        delta = proportional ? this.proportionalDelta(corner, delta, bounds) : delta,
        offsetRect = rect(delta.x * x, delta.y * y, delta.x * width, delta.y * height),
        oldPosition = this.target.position;
       this.target.setBounds(bounds.insetByRect(offsetRect));
       this.target.origin = origin.addPt({x: -offsetRect.x, y: -offsetRect.y});
       this.target.position = oldPosition;
   }

   placeHandleFor([corner, deltaMask, originDelta], [nativeCursor, location]) {
       const target = this.target,
             positionInHalo = () => this.borderBox
                                        .bounds()
                                        .partNamed(location); 

       return new Morph({
           nativeCursor,
           halo: this,
           corner,
           property: 'extent',
           valueForPropertyDisplay: () => {
              var {x: width, y: height} = this.target.extent;
              return `${width.toFixed(1)}w ${height.toFixed(1)}h`;
           },
           center: positionInHalo(),
           extent: pt(10,10),
           isHandle: true,
           isHaloItem: true,
           borderWidth: 1,
           borderColor: Color.black,
           alignInHalo() { this.center = positionInHalo() },
           onKeyUp(evt) { if (this.halo.activeButton == this) this.halo.toggleDiagonal(evt.isShiftDown(), corner) },
           onKeyDown(evt) { if (this.halo.activeButton == this) this.halo.toggleDiagonal(evt.isShiftDown(), corner) },
           onDragStart(evt) {
               this.init(evt.position, evt.isShiftDown());
           },
           onDragEnd(evt) { 
               this.stop(evt.isShiftDown());
           },
           onDrag(evt) {
              this.update(evt.position, evt.isShiftDown());
              this.focus();
           },
           init(startPos, proportional=false) {
             this.startPos = startPos; this.startBounds = this.halo.target.bounds();
             this.startOrigin = this.halo.target.origin;
             this.savedLayout = this.halo.layout;
             this.halo.activeButton = this; 
             this.tfm = this.halo.target.getGlobalTransform().inverse();
             this.offsetRotation = num.toRadians(this.halo.getGlobalRotation() % 45); // add up rotations
             this.halo.toggleDiagonal(proportional, corner);
           },
           update(currentPos, shiftDown=false) {
             var target = this.halo.target,
                 oldPosition = target.position,
                 {x,y} = this.startPos.subPt(currentPos),
                 delta = this.tfm.transformDirection(
                           pt(x * Math.cos(this.offsetRotation),
                              y * Math.cos(this.offsetRotation)));
              this.halo.updateBoundsFor(corner, shiftDown, delta, this.startBounds, this.startOrigin);
              this.halo.toggleDiagonal(shiftDown, corner);
           },
           stop(proportional) {
              this.halo.activeButton = null; 
              this.halo.alignWithTarget();
              this.halo.toggleDiagonal(false);
           }
       });
   }

  closeHalo() {
    return this.getSubmorphNamed("close") || this.addMorph(new HaloItem({
      name: "close",
      styleClasses: ["halo-item", "fa", "fa-close"],
      draggable: false,
      halo: this,
      tooltip: "Remove this morph from the world",
      update: () => {
        var o = this.target.owner
        o.undoStart("close-halo");
        this.target.selectedMorphs ? 
                     this.target.selectedMorphs.forEach(m => m.remove()) :
                     this.target.remove();
        o.undoStop("close-halo");
        this.remove();
      },
      onMouseDown(evt) { this.update(); }
    }));
  }

  grabHalo() {
    var dropTarget;
    return this.getSubmorphNamed("grab") || this.addMorph(new HaloItem({
      name: "grab",
      styleClasses: ["halo-item", "fa", "fa-hand-rock-o"],
      halo: this,
      tooltip: "Grab the morph",
      valueForPropertyDisplay() {
        var dropTarget = this.morphBeneath(this.hand.position),
            belongsToHalo = dropTarget.isHaloItem || dropTarget.ownerChain().find(m => m.isHaloItem);
        if (!belongsToHalo) {
            this.halo.toggleMorphHighlighter(dropTarget && dropTarget != this.world(), dropTarget, true);
            this.prevDropTarget 
                && this.prevDropTarget != dropTarget 
                && this.halo.toggleMorphHighlighter(false, this.prevDropTarget);
            this.prevDropTarget = dropTarget;
        }
        return dropTarget && dropTarget.name;
      },

      init(hand) {
        var undo = this.halo.target.undoStart("grab-halo");
        undo.addTarget(this.halo.target.owner);
        this.hand = hand;
        this.halo.target.onGrab({hand});
        this.halo.activeButton = this;
      },

      update() {
        this.halo.alignWithTarget();
      },

      stop(hand) {
        var undo = this.halo.target.undoInProgress,
            dropTarget = this.morphBeneath(hand.position);
        undo.addTarget(dropTarget);
        dropTarget.onDrop({hand});
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleMorphHighlighter(false, this.prevDropTarget);
        this.halo.target.undoStop("grab-halo");
      },

      onDragStart(evt) {
        this.init(evt.hand)
      },

      onDragEnd(evt) {
        this.stop(evt.hand)
      }
    }));
  }

  dragHalo() {
    return this.getSubmorphNamed("drag") || this.addMorph(new HaloItem({
      name: "drag",
      styleClasses: ["halo-item", "fa", "fa-arrows"],
      property: 'position',
      halo: this,
      tooltip: "Change the morph's position. Press (alt) while dragging to align the morph's position along a grid.",
      valueForPropertyDisplay: () => this.target.position,
      init() {
        const target = this.halo.target;
        target.undoStart("drag-halo");
        this.halo.activeButton = this;
        this.actualPos = target.position;
        this.targetTransform = target.owner.getGlobalTransform().inverse();
      },
      stop() {
        this.halo.target.undoStop("drag-halo");
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleMesh(false);
      },
      update(delta, grid=false) {
        var newPos = this.actualPos.addPt(this.targetTransform.transformDirection(delta));
        this.actualPos = newPos;
        if (grid) {
          newPos = newPos.griddedBy(pt(10,10));
        }
        this.halo.target.position = newPos;
        this.halo.toggleMesh(grid);
      },
      onDragStart(evt) { this.init() },
      onDrag(evt) { this.update(evt.state.dragDelta, evt.isAltDown()); },
      onDragEnd(evt) { this.stop() },
      onKeyUp(evt) { this.halo.toggleMesh(false) }
    }));
  }

  inspectHalo() {
    return this.getSubmorphNamed("inspect") || this.addMorph(new HaloItem({
      name: "inspect",
      styleClasses: ["halo-item", "fa", "fa-eye"],
      draggable: false,
      halo: this,
      tooltip: "Inspect the morph's local state",
      onMouseDown: (evt) => {
        Inspector.openInWindow({targetObject: this.target})
        this.remove();
      }
    }));
  }

  editHalo() {
    return this.getSubmorphNamed("edit") || this.addMorph(new HaloItem({
      name: "edit",
      styleClasses: ["halo-item", "fa", "fa-pencil"],
      draggable: false,
      halo: this,
      tooltip: "Edit the morph's definition",
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
      tooltip: "Rotate morph",
      styleClasses: ["halo-item", "fa", "fa-repeat"],
      halo: this,
      valueForPropertyDisplay: () => scaleGauge ?
                                       this.target.scale.toFixed(4).toString() :
                                       num.toDegrees(this.target.rotation).toFixed(1) + "°",

      init(angleToTarget) {
        this.detachFromLayout();
        this.halo.target.undoStart("rotate-halo");
        this.halo.activeButton = this;
        angle = angleToTarget;
        initRotation = this.halo.target.rotation;
        this.halo.toggleRotationIndicator(true, this);
      },

      initScale(gauge) {
        this.detachFromLayout();
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
        initRotation = this.halo.target.rotation;
        this.halo.target.scale = num.detent(gauge.dist(pt(0,0)) / scaleGauge.dist(pt(0,0)), 0.1, 0.5);
        this.halo.toggleRotationIndicator(true, this);
      },

      stop() {
        this.attachToLayout();
        scaleGauge = null;
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleRotationIndicator(false, this);
        this.halo.target.undoStop("rotate-halo");
        this.halo.updateResizeHandles();
      },

      adaptAppearance(scaling) {
        this.styleClasses = ["halo-item", "fa", scaling ? "fa-search-plus" : "fa-repeat"];
        this.tooltip = scaling ? "Scale morph" : "Rotate morph";
      },

      detachFromLayout() {
        this.savedLayout = this.halo.layout;
        this.halo.layout.col(0).row(6).group.morph = null;
      },
      
      attachToLayout() {
        this.halo.layout.col(0).row(6).group.morph = this;
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
      }

    }));
  }

  copyHalo() {
    return this.getSubmorphNamed("copy") || this.addMorph(new HaloItem({
      name: "copy",
      styleClasses: ["halo-item", "fa", "fa-clone"],
      halo: this,
      tooltip: "Copy morph",
      init: (hand) => {
        var pos = this.target.globalPosition,
            copy = this.target.copy();
        copy.undoStart("copy-halo");
        hand.grab(copy);
        copy.globalPosition = pos;
        this.refocus(copy);
      },
      update(hand) {
        var dropTarget = this.morphBeneath(hand.position),
            undo = this.halo.target.undoInProgress;
        undo.addTarget(dropTarget);
        hand.dropMorphsOn(dropTarget);
        this.halo.target.undoStop("copy-halo");
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
      tooltip: "Change the morph's origin",
      computePositionAtTarget: () => {
          return this.localizePointFrom(pt(0,0),this.target)
                     .subPt(pt(7.5,7.5));
      },
      alignInHalo() {
        this.position = this.computePositionAtTarget();
      },
      valueForPropertyDisplay: () => this.target.origin,
      init() {
        this.halo.target.undoStart("origin-halo");
        this.halo.activeButton = this;
      },
      stop() {
        this.halo.target.undoStop("origin-halo");
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      update: (delta) => {
        var oldOrigin = this.target.origin,
            globalOrigin = this.target.worldPoint(oldOrigin),
            newOrigin = this.target.localize(globalOrigin.addPt(delta));
        delta = newOrigin.subPt(oldOrigin);
        this.target.adjustOrigin(this.target.origin.addPt(delta));
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
      halo: this,
      tooltip: "Open stylize editor",
      onMouseDown: (evt) => {
        this.world().addMorph(styleHaloFor(this.target, this.state.pointerId));
        this.remove();
      }
    }));
  }

  get buttonControls() { return this.submorphs.filter(m => m.isHaloItem); }

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

  updatePropertyDisplay(haloItem) {
    var val = haloItem.valueForPropertyDisplay();
    if (typeof val !== "undefined")
      this.propertyDisplay.displayProperty(val);
    else
      this.propertyDisplay.disable();
  }

  onKeyUp(evt) {
    if (this.changingName) return;
    this.buttonControls.map(b => b.onKeyUp(evt));
  }

  toggleMesh(active) {
    var mesh = this.getSubmorphNamed("mesh"), 
        horizontal, vertical;
    mesh && mesh.alignWithHalo();
    if (active) {
        const {width, height, extent} = this.world(),
              defaultGuideProps = {
                     opacity: 1,
                     borderStyle: "dotted",
                     position: pt(0,0), 
                     extent,
                     borderWidth: 2,
                     borderColor: Color.orange},
               {x, y} = this.target.worldPoint(pt(0,0));
        // init
         vertical = this.getSubmorphNamed("vertical") || new Path({
             ...defaultGuideProps,
             name: "vertical",
             vertices: [pt(x,0), pt(x, height)]
           });
         horizontal = this.getSubmorphNamed("horizontal") || new Path({
             ...defaultGuideProps,
             name: "horizontal",
             vertices: [pt(0,y), pt(width, y)]
           });
         mesh = mesh || this.addMorphBack(new Morph({
            name: "mesh", opacity: 0,
            onKeyUp: (evt) => this.toggleMesh(false),
            extent, position: this.localize(pt(2,2)),
            styleClasses: ["morph", "halo-mesh"], fill: null,
            submorphs: [horizontal, vertical],
            alignWithHalo: () => {
              var {x, y} = this.target.worldPoint(pt(-3,-3)),
                  {height, width} = this.world();
              horizontal.vertices = [pt(0,y), pt(width, y)];
              vertical.vertices = [pt(x,0), pt(x, height)];
              mesh.position = this.localize(pt(2,2));
            },
            show() {
               mesh.animate({opacity: 1, duration: 300});
            },
            hide: () => {
              mesh.animate({opacity: 0, duration: 700});
            }
          }));
        mesh.show();
    } else {
      mesh && mesh.hide();
    }
    this.focus();
  }

  toggleDiagonal(active, corner) {
    if (rect(0).sides.includes(corner)) return;
    var diagonal = this.getSubmorphNamed("diagonal"),
        {x,y,width, height } = this.target.globalBounds(),
        bounds = this.localize(pt(x,y))
                     .extent(pt(width, height))
                     .scaleRectTo(this.innerBounds()),
        vertices = {topLeft: [pt(width, height), pt(0,0)],
                    topRight: [pt(0, height), pt(width, 0)],
                    bottomRight: [pt(0,0), pt(width, height)],
                    bottomLeft: [pt(width, 0), pt(0, height)]};
    if (active) {
      if (diagonal) {
        diagonal.setBounds(bounds);
      } else {
        const [v1, v2] = vertices[corner];
        diagonal = this.addMorphBack(new Path({
          opacity: 0,
          name: "diagonal",
          borderStyle: "dotted",
          borderWidth: 5,
          bounds,
          gradient: guideGradient,
          vertices: [v1, v2]}));
        diagonal.setBounds(bounds);
        diagonal.animate({opacity: 1, duration: 500});
      }
    } else {
      diagonal && diagonal.fadeOut(500);
    }
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

  morphHighlighter(morph, showLayout) {
    var halo = this;
    this.morphHighlighters = this.morphHighlighters || {};
    properties.forEachOwn(this.morphHighlighters, (_, h) => h.alignWithHalo());
    if (morph.ownerChain().find(owner => owner.isHaloItem)) return null;
    this.morphHighlighters[morph.id] = this.morphHighlighters[morph.id] || this.addMorphBack({
      opacity: 0,
      target: morph,
      name: "morphHighlighter",
      fill: Color.orange.withA(0.5),
      alignWithHalo() {
        if (this.target) {
          this.position = halo.localize(this.target.globalBounds().topLeft());
          this.extent = this.target.globalBounds().extent();
        }
      },
      show() {
        if (this.target.layout && showLayout) {
           this.layoutHalo = this.layoutHalo || this.world().showLayoutHaloFor(this.target, this.pointerId);
        } else {
           this.animate({opacity: 1, duration: 500});
           this.alignWithHalo();
        } 
      },
      deactivate() {
        if (this.layoutHalo) {
            this.layoutHalo.remove();
            this.layoutHalo = null;
        }
        this.animate({opacity: 0, duration: 500});
        this.alignWithHalo();
      }
    });
    return this.morphHighlighters[morph.id];
  }

  toggleMorphHighlighter(active, target, showLayout = false) {
    const morphHighlighter = this.morphHighlighter(target, showLayout);
    if (active && target && target != this.world()) {
      morphHighlighter && morphHighlighter.show(target);
    } else {
      morphHighlighter && morphHighlighter.deactivate(target);
    }
  }

  alignWithTarget() {
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

}
