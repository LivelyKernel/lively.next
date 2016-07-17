import { Ellipse, Morph } from "./index.js"
import { Color, pt, rect } from "lively.graphics";
import { string, obj, arr, num } from "lively.lang";

export class HaloItem extends Ellipse {

  constructor(props) {
    super(Object.assign({
      fill: Color.gray.withA(.7),
      grabbable: false,
      extent: pt(24, 24)
    }, props));
  }

  get isHaloItem() { return true };

  alignInHalo() {
    const {x: width, y: height} = this.halo.extent,
          {row, col} = this.location,
          collWidth = (width + this.extent.x) / 3,
          rowHeight = height / 3;
    this.position = pt(collWidth * col, rowHeight * row).subPt(pt(26,26));
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
  }

  get isHalo() { return true }

  get target() { return this.state.target; }

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
      styleClasses: ["halo-item", "fa", "fa-expand"],
      location: {col: 3, row: 3},
      rotation: -Math.PI / 2,
      origin: pt(12, 12),
      property: 'extent',
      halo: this,
      update: (delta) => {
        this.target.resizeBy(delta);
        this.alignWithTarget();
      },
      onDrag(evt) { this.update(evt.state.dragDelta) }
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
      update: (delta) => {
        this.target.globalPosition = this.target.globalPosition.addPt(delta);
        this.alignWithTarget();
      },
      onDrag(evt) { this.update(evt.state.dragDelta); },
    }));
  }

  inspectHalo() {
    return this.getSubmorphNamed("inspect") || this.addMorph(new HaloItem({
      name: "inspect",
      styleClasses: ["halo-item", "fa", "fa-search"],
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
    var angle = 0;
    return this.getSubmorphNamed("rotate") || this.addMorph(new HaloItem({
      name: "rotate",
      styleClasses: ["halo-item", "fa", "fa-repeat"],
      location: {col: 0, row: 3},
      halo: this,
      init: (angleToTarget) => { angle = angleToTarget; },
      update: (angleToTarget) => {
        this.target.rotateBy(angleToTarget - angle);
        angle = angleToTarget;
        this.alignWithTarget();
      },
      onDragStart(evt) {
        this.init(evt.position.subPt(this.halo.target.globalPosition).theta());
      },
      onDrag(evt) {
        this.update(evt.position.subPt(this.halo.target.globalPosition).theta());
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
        var pos = this.globalPosition,
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
          var world = this.target.world(),
              origin = world.localizePointFrom(
                                this.target.position,
                                this.target.owner)
                            .addPt(this.target.origin);
          const {x,y} = this.target.globalBounds();
          return origin.subPt(pt(x,y)).subPt(pt(7.5,7.5));
      },
      alignInHalo() {
        this.position = this.computePositionAtTarget();
      },
      update: (delta) => {
        this.target.adjustOrigin(this.target.origin.addPt(delta));
        this.alignWithTarget();
      },
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
      // this.inspectHalo(),
      // this.editHalo(),
      this.copyHalo(),
      this.rotateHalo(),
      // this.stylizeHalo()
    ];
  }

  alignWithTarget() {
    const {x, y, width, height} = this.target.globalBounds();
    const origin = this.target.origin;
    // take into account the rotation and position of the origin
    this.position = pt(x,y);
    this.extent = pt(width, height);
    this.buttonControls.forEach((button) => button.alignInHalo());
    this.originHalo().alignInHalo();
    return this;
  }

}
