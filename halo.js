import { Ellipse, Morph, Text } from "./index.js"
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
    this.initPropertyDisplay();
    this.initButtons();
  }

  get isHalo() { return true }

  get target() { return this.state.target; }

  morphsContainingPoint(list) { return list }

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
      init() {
        this.halo.activeButton = this;
      },
      stop() {
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      onDragStart(evt) { this.init() },
      onDrag(evt) { this.update(evt.state.dragDelta) },
      onDragEnd(evt) { this.stop() }
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
      property: "rotation",
      styleClasses: ["halo-item", "fa", "fa-repeat"],
      location: {col: 0, row: 3},
      halo: this,
      init(angleToTarget) {
        this.halo.activeButton = this;
        angle = angleToTarget;
      },
      update: (angleToTarget) => {
        this.target.rotateBy(angleToTarget - angle);
        angle = angleToTarget;
        this.alignWithTarget();
      },
      stop() {
        this.halo.activeButton = null;
        this.halo.alignWithTarget();
      },
      onDragStart(evt) {
        this.init(evt.position.subPt(this.halo.target.globalPosition).theta());
      },
      onDrag(evt) {
        this.update(evt.position.subPt(this.halo.target.globalPosition).theta());
      },
      onDragEnd(evt) {
        this.stop();
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
          return this.localizePointFrom(
                      this.target.origin,
                      this.target
                    ).subPt(pt(7.5,7.5));
      },
      alignInHalo() {
        this.position = this.computePositionAtTarget();
      },
      update: (delta) => {
        var oldOrigin = this.target.origin,
            globalOrigin = this.target.worldPoint(oldOrigin),
            newOrigin = this.target.localize(globalOrigin.addPt(delta));
        delta = newOrigin.subPt(oldOrigin);
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

  initPropertyDisplay() {
    const textField = new Text({
      readOnly: true,
      position: pt(6,3),
      extent: pt(90, 14),
      fixedWidth: true,
      fill: Color.red.withA(0),
      fontSize: 12,
      isHaloItem: true
    });
    this.propertyDisplay = this.propertyDisplay || this.addMorph(
      new Morph({
        fill: Color.lightGray.withA(0.5),
        borderRadius: 15,
        extent: pt(100, 20),
        position: pt(0,-22),
        visible: false,
        halo: this,
        isHaloItem: true,
        displayedValue() { return textField.textString },
        displayProperty(property) {
          this.visible = true;
          textField.visible = true;
          textField.textString = this.halo.target.getProperty(property).toString();
        },
        disable() {
          this.visible = false;
          textField.visible = false;
        },
        submorphs: [textField]
      }));
  }

  alignWithTarget() {
    const {x, y, width, height} = this.target.globalBounds();
    const origin = this.target.origin;
    this.position = pt(x,y);
    this.extent = pt(width, height);
    this.propertyDisplay.disable();
    this.buttonControls.forEach((button) => {
      if (this.activeButton) {
        if (this.activeButton == button){
          button.visible = true;
          this.propertyDisplay.displayProperty(button.property);
        } else {
          button.visible = false;
        }
      } else {
        button.visible = true;
      }
        button.alignInHalo()});
    this.originHalo().alignInHalo();
    return this;
  }

}
