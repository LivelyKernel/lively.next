import {
  Morph,
  Path,
  Text,
  HorizontalLayout
} from "../index.js";
import { Color, pt, rect } from "lively.graphics";
import { arr, properties, num, grid } from "lively.lang";
import { connect, signal } from "lively.bindings";
import Inspector from "../ide/js/inspector.js";
import { styleHaloFor } from './stylization.js';
import { Icon } from '../icons.js';

const itemExtent = pt(24,24);

export class HaloItem extends Morph {

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


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// name halo item
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


class NameHolder extends Morph {

   constructor(props) {
      super({
        tooltip: "Click to edit the morph's name",
        draggable: false,
        fill: Color.transparent,
        layout: new HorizontalLayout({spacing: 7}),
        ...props
       });
       this.nameHolder = new Text({
            fill:Color.transparent,
            fontColor: Color.darkgray,
            active: true})
       this.submorphs = [this.nameHolder];
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

   onKeyDown(evt) {
    if ("Enter" == evt.keyCombo) {
      this.updateName(this.nameHolder.textString);
      evt.stop();
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
    const newName = this.nameHolder.textString,
          owner = this.target.owner;
    this.validName = (!owner || !owner.getSubmorphNamed(newName) ||
                          this.target.name == newName);
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
     this.nameHolder.animate({opacity: .3});
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
      padding: rect(4,2,4,0),
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
          extent: pt(1,28), fill: Color.black.withA(.4)
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


function nameHalo(halo) {
  return new NameHalo({halo, name: "name"});
}

function closeHalo(halo) {
  return new HaloItem({
    name: "close",
    styleClasses: ["fa", "fa-close"],
    draggable: false,
    halo: halo,
    tooltip: "Remove this morph from the world",
    update: () => {
      var o = halo.target.owner
      o.undoStart("close-halo");
      halo.target.selectedMorphs ?
                   halo.target.selectedMorphs.forEach(m => m.remove()) :
                   halo.target.remove();
      o.undoStop("close-halo");
      halo.remove();
    },
    onMouseDown(evt) { this.update(); }
  })
}

function grabHalo(halo) {

  return new HaloItem({
    name: "grab",
    styleClasses: ["fa", "fa-hand-rock-o"],
    halo,
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
      this.halo.clearMorphHighlighters();
      this.halo.target.undoStop("grab-halo");
    },

    onDragStart(evt) {
      this.init(evt.hand)
    },

    onDragEnd(evt) {
      this.stop(evt.hand)
    }
  })
}

function dragHalo(halo) {
  return new HaloItem({
    name: "drag",
    styleClasses: ["fa", "fa-arrows"],
    property: 'position',
    halo,
    tooltip: "Change the morph's position. Press (alt) while dragging to align the morph's position along a grid.",
    valueForPropertyDisplay: () => halo.target.position,

    updateAlignmentGuide(active) {
      var mesh = this.halo.getSubmorphNamed("mesh");

      if (!active) { mesh && mesh.remove(); return; }

      var {height, width} = this.world().visibleBounds();

      if (!mesh) {
        var defaultGuideProps = {
          borderStyle: "dotted",
          borderWidth: 2,
          borderColor: Color.orange
        }
        mesh = this.halo.addMorph(new Morph({
          name: "mesh",
          styleClasses: ["halo-mesh"],
          extent: pt(width, height),
          fill: null,
          submorphs: [
            new Path({name: "vertical", ...defaultGuideProps}),
            new Path({name: "horizontal", ...defaultGuideProps})
          ]
        }));
      }
      mesh.moveBy(mesh.globalPosition.negated())
      var {x, y} = this.halo.target.worldPoint(pt(0,0));
      mesh.getSubmorphNamed("vertical").vertices = [pt(x,0), pt(x, height)];
      mesh.getSubmorphNamed("horizontal").vertices = [pt(0,y), pt(width, y)];
      
      this.focus();
      return mesh;
    },

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
      this.updateAlignmentGuide(false);
    },

    update(delta, grid = false) {
      var newPos = this.actualPos.addPt(this.targetTransform.transformDirection(delta));
      this.actualPos = newPos;
      if (grid) {
        newPos = newPos.griddedBy(pt(10,10));
      }
      this.halo.target.position = newPos;
      this.updateAlignmentGuide(grid);
    },

    onDragStart(evt) { this.init() },
    onDrag(evt) { this.update(evt.state.dragDelta, evt.isAltDown()); },
    onDragEnd(evt) { this.stop() },
    onKeyUp(evt) { this.updateAlignmentGuide(false) }
  })
}


function inspectHalo(halo) {
  return new HaloItem({
    name: "inspect",
    styleClasses: ["fa", "fa-gears"],
    draggable: false,
    halo,
    tooltip: "Inspect the morph's local state",
    onMouseDown: (evt) => {
      var {target: targetObject} = halo;
      halo.remove();
      Inspector.openInWindow({targetObject});
    }
  })
}

function editHalo(halo) {
  return new HaloItem({
    name: "edit",
    styleClasses: ["fa", "fa-wrench"],
    draggable: false,
    halo,
    tooltip: "Edit the morph's definition",
    onMouseDown: (evt) => {
      halo.world().execCommand("open object editor", {target: halo.target});
      halo.remove();
    }
  });
}

function rotateHalo(halo) {
  var angle = 0,
      scaleGauge = null,
      initRotation = 0;

  return new HaloItem({
    name: "rotate",
    property: "rotation",
    tooltip: "Rotate morph",
    styleClasses: ["fa", "fa-repeat"],
    halo,
    valueForPropertyDisplay: () => scaleGauge ?
                                     halo.target.scale.toFixed(4).toString() :
                                     num.toDegrees(halo.target.rotation).toFixed(1) + "°",

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
      this.styleClasses = ["fa", scaling ? "fa-search-plus" : "fa-repeat"];
      this.tooltip = scaling ? "Scale morph" : "Rotate morph";
    },

    detachFromLayout() {
      this.savedLayout = this.halo.layout;
      this.halo.layout = null;
    },

    attachToLayout() {
      this.halo.layout = this.savedLayout;
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

  });
}


function copyHalo(halo) {

  return new HaloItem({
    name: "copy",
    styleClasses: ["fa", "fa-clone"],
    halo,
    tooltip: "Copy morph",

    init: (hand) => {
      var {target} = halo, world = halo.world();
      halo.remove();
      var pos = target.globalPosition,
          copy = world.addMorph(target.copy());
      copy.undoStart("copy-halo");
      hand.grab(copy);
      copy.globalPosition = pos;
      world.addMorph(halo);
      halo.refocus(copy);
    },

    stop(hand) {
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
      this.stop(evt.hand);
    }
  });
}

function originHalo(halo) {
  return new HaloItem({
    name: "origin", fill: Color.red,
    opacity: 0.5, borderColor: Color.black,
    borderWidth: 2,
    position: halo.target.origin.subPt(pt(7.5,7.5)),
    extent: pt(15,15),
    halo: halo,
    tooltip: "Change the morph's origin",
    computePositionAtTarget: () => {
        return halo.localizePointFrom(pt(0,0),halo.target)
                   .subPt(pt(7.5,7.5));
    },
    alignInHalo() {
      this.position = this.computePositionAtTarget();
    },
    valueForPropertyDisplay: () => halo.target.origin,
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
      var oldOrigin = halo.target.origin,
          globalOrigin = halo.target.worldPoint(oldOrigin),
          newOrigin = halo.target.localize(globalOrigin.addPt(delta));
      delta = newOrigin.subPt(oldOrigin);
      halo.target.adjustOrigin(halo.target.origin.addPt(delta));
    },
    onDragStart(evt) { this.init(); },
    onDragEnd(evt) { this.stop(); },
    onDrag(evt) { this.update(evt.state.dragDelta); }
  });
}

function stylizeHalo(halo) {
  return new HaloItem({
    name: "style",
    styleClasses: ["fa", "fa-picture-o"],
    halo: halo,
    tooltip: "Open stylize editor",
    onMouseDown: (evt) => {
      const styleHalo = styleHaloFor(halo.target, halo.state.pointerId);
      halo.world().addMorph(styleHalo);
      // connect(halo.world(), 'onMouseDown', styleHalo, 'remove');
      halo.remove();
    }
  })
}


function resizeHandle(halo, corner, deltaMask, originDelta, nativeCursor, location) {
  const target = halo.target,
        positionInHalo = () => halo.borderBox.bounds().partNamed(location);

  return new Morph({
     nativeCursor,
     halo: halo,
     corner, tooltip: "Resize " + corner,
     property: 'extent',
     valueForPropertyDisplay: () => {
       var {x: width, y: height} = halo.target.extent;
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
       const {globalPosition, extent} = this.halo.target;
       this.startPos = startPos; this.startBounds = globalPosition.extent(extent);
       this.startOrigin = this.halo.target.origin;
       this.savedLayout = this.halo.layout;
       this.halo.layout = null;
       this.halo.activeButton = this;
       this.tfm = this.halo.target.getGlobalTransform().inverse();
       this.offsetRotation = num.toRadians(this.halo.getGlobalRotation() % 45); // add up rotations
       this.halo.toggleDiagonal(proportional, corner);
     },
     update(currentPos, shiftDown=false) {
       var target = this.halo.target,
           oldPosition = target.position,
           {x,y} = this.startPos.subPt(currentPos),
           delta = this.tfm.transformDirection(pt(x,y));
        this.halo.updateBoundsFor(corner, shiftDown, delta, this.startBounds, this.startOrigin);
        this.halo.toggleDiagonal(shiftDown, corner);
     },
     stop(proportional) {
        this.halo.layout = this.savedLayout;
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
        this.halo.toggleDiagonal(false);
     }
   });
}

function morphHighlighter(halo, morph, showLayout) {
  halo.morphHighlighters = halo.morphHighlighters || {};
  properties.forEachOwn(halo.morphHighlighters, (_, h) => h.alignWithHalo());
  if (!morph || morph.ownerChain().find(owner => owner.isHaloItem)) return null;
  halo.morphHighlighters[morph.id] = halo.morphHighlighters[morph.id] || halo.addMorphBack({
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
  return halo.morphHighlighters[morph.id];
}

export {
  nameHalo,
  stylizeHalo,
  originHalo,
  copyHalo,
  rotateHalo,
  editHalo,
  inspectHalo,
  dragHalo,
  grabHalo,
  closeHalo,
  resizeHandle,
  morphHighlighter
}
