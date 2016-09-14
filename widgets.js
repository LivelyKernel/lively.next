import { arr, num, obj } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { morph, Morph, Ellipse, Text } from "./index.js";
import { signal, connect } from "lively.bindings";

export class Window extends Morph {

  constructor(props = {}) {
    super({
      fill: Color.lightGray,
      borderRadius: 7,
      dropShadow: true,
      borderColor: Color.gray,
      borderWidth: 1,
      clipMode: "hidden",
      ...obj.dissoc(props, ["title", "targetMorph"])
    });
    this.submorphs = this.submorphs.concat(this.controls());
    this.title = props.title || this.name || "";
    if (props.targetMorph) this.targetMorph = props.targetMorph;
  }

  get isWindow() { return true }

  relayout() {
    this.titleLabel().center = pt(Math.max(this.extent.x / 2, 100), 10);
  }

  resizeBy(delta) {
    this.styleClasses = ["morph"];
    super.resizeBy(delta);
    this.relayout();
    var t = this.targetMorph;
    if (t) t.resizeBy(delta);
  }

  controls() {
    return this.buttons()
           .concat(this.titleLabel())
           .concat(this.resizer());
  }

  buttons() {

    const extent = pt(13,13);

    return [

      this.getSubmorphNamed("close") || {
        type: "ellipse",
        extent,
        center: pt(15,13),
        name: "close",
        borderWith: 1,
        borderColor: Color.darkRed,
        fill: Color.rgb(255,96,82),
        onMouseDown(evt) { this.owner.close(); },
        onHoverIn() { this.submorphs[0].visible = true; },
        onHoverOut() { this.submorphs[0].visible = false; },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-times"],
          center: pt(5.5, 5), opacity: 0.5
        }]
      },

      this.getSubmorphNamed("minimize") || {
        type: "ellipse",
        extent,
        center: pt(35,13),
        name: "minimize",
        borderWith: 1,
        borderColor: Color.brown,
        fill: Color.rgb(255,190,6),
        onHoverIn() { this.submorphs[0].visible = true; },
        onHoverOut() { this.submorphs[0].visible = false; },
        onMouseDown(evt) { this.owner.toggleMinimize(); },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-minus"], center: pt(5.5,5), opacity: 0.5
        }]
      },

      this.getSubmorphNamed("maximize") || {
        type: "ellipse",
        extent,
        name: "maximize",
        center: pt(55,13),
        borderWith: 1,
        borderColor: Color.darkGreen,
        fill: Color.green,
        onMouseDown(evt) { this.owner.toggleMaximize(); },
        onHoverIn() { this.submorphs[0].visible = true; },
        onHoverOut() { this.submorphs[0].visible = false; },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-plus"], center: pt(5.5,5), opacity: 0.5
        }]
     }

   ]
  }

  titleLabel() {
    return this.getSubmorphNamed("titleLabel") || {
      type: "text",
      name: "titleLabel",
      readOnly: true,
      draggable: false,
      grabbable: false,
      fill: Color.gray.withA(0),
      fontColor: Color.darkGray,
      center: pt(this.extent.x / 2, 10),
      reactsToPointer: false
    };
  }

  resizer() {
    return this.getSubmorphNamed("resizer") || {
      name: "resizer",
      nativeCursor: "nwse-resize",
      extent: pt(20,20),
      opacity: 0.5,
      fill: Color.transparent,
      bottomRight: this.extent,
      onDrag(evt) {
        this.owner.resizeBy(evt.state.dragDelta);
        this.bottomRight = this.owner.extent;
      }
    };
  }

  get title() { return this.titleLabel().textString; }
  set title(title) { this.titleLabel().textString = title; this.relayout(); }

  get targetMorph() { return arr.last(arr.withoutAll(this.submorphs, this.controls())); }
  set targetMorph(targetMorph) {
    if (!targetMorph) {
      var existing = this.targetMorph;
      existing && existing.remove();
      return;
    }

    if (!targetMorph.isMorph) targetMorph = morph(targetMorph); // spec

    this.addMorph(targetMorph, this.resizer());
    targetMorph.setBounds(this.innerBounds().withTopLeft(pt(0,25)));
  }

  toggleMinimize() {
    this.styleClasses = ["morph", "smooth-extent"]
    if (this.minimized) {
      this.extent = this.cachedExtent;
      this.resizer().visible = true
      this.minimized = false;
    } else {
      this.cachedExtent =  this.extent;
      this.extent = pt(this.extent.x, 25);
      this.resizer().visible = false;
      this.minimized = true;
    }
  }

  toggleMaximize() {
    // FIXME: if the corresponding dom now is going to be
    // respawned in the next render cycle by teh virtual-dom
    // the animation will not be triggered, since a completely new
    // node with the already changed values will appear. CSS animations
    // will not trigger. Maybe move away from CSS animations to something
    // more explicit, i.e. velocity.js?
    this.styleClasses = ["morph", "smooth-extent"]
    if (this.maximized) {
      this.setBounds(this.cachedBounds);
      this.resizer().bottomRight = this.extent;
      this.maximized = false;
    } else {
      this.cachedBounds = this.bounds();
      this.setBounds(this.world().bounds());
      this.resizer().bottomRight = this.extent;
      this.resizer().visible = true;
      this.maximized = true;
      this.minimized = false;
    }
  }

  close() {
    this.remove()
  }

  onMouseDown(evt) {
    this.bringToFront();
    this.styleClasses = ["morph"];
  }


}

export class Button extends Morph {

  constructor(props) {
    super({
      draggable: false,
      borderRadius: 15,
      extent: pt(100,24),
      borderWidth: 1,
      active: true,
      padding: Rectangle.inset(2),
      submorphs: [{
        type: "text",
        name: "label",
        readOnly: true,
        selectable: false,
        fill: Color.white.withA(0),
      }],
      ...props,
    });
    this.relayout();

    connect(this, "change", this, "relayout", {updater: ($upd, {prop}) => ["extent", "padding"].includes(prop) && $upd()})
    connect(this.submorphs[0], "change", this, "relayout", {updater: ($upd, {prop}) => ["extent"].includes(prop) && $upd()})
  }

  get activeStyle() {
    return {
      borderColor: Color.gray,
      fill: Color.rgb(240,240,240),
      fontColor: Color.almostBlack
    }
  }

  get inactiveStyle() {
    return {
      borderColor: Color.darkGray,
      fill: Color.gray,
      fontColor: Color.darkGray
    }
  }

  get triggerStyle() {
    return {
      fill: Color.rgb(161,161,161)
    }
  }

  relayout() {
    var padding = this.padding,
        label = this.submorphs[0],
        minHeight = label.height + padding.top() + padding.bottom(),
        minWidth = label.width + padding.left() + padding.right();
    if (minHeight > this.height) this.height = minHeight;
    if (minWidth > this.width) this.width = minWidth;
    label.center = this.innerBounds().center();
    return this;
  }

  get label() { return this.get("label").textString; }
  set label(label) { this.get("label").textString = label; this.relayout(); }
  get fontFamily() { return this.submorphs[0].fontFamily; }
  set fontFamily(fontFamily) { this.submorphs[0].fontFamily = fontFamily; this.relayout(); }
  get fontSize() { return this.submorphs[0].fontSize; }
  set fontSize(fontSize) { this.submorphs[0].fontSize = fontSize; this.relayout(); }
  get fontColor() { return this.submorphs[0].fontColor; }
  set fontColor(color) { this.submorphs[0].fontColor = color; }
  set padding(value) { this.addValueChange("padding", value); this.relayout(); }
  get padding() { return this.getProperty("padding"); }

  get action() { return this.getProperty("action"); }
  set action(value) { this.addValueChange("action", value); }
  get active() { return this.getProperty("active"); }
  set active(value) {
    Object.assign(this, value ? this.activeStyle : this.inactiveStyle);
    this.addValueChange("active", value);
  }

  fit() {
    var padding = this.padding,
        label = this.submorphs[0];
    this.extent = padding.bottomLeft().addPt(padding.bottomRight()).addPt(label.extent);
    return this.relayout();
  }

  trigger() {
    try {
      signal(this, "fire");
      typeof this.action == "function" && this.action();
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  onMouseDown(evt) {
    if (this.active) {
      Object.assign(this, this.triggerStyle);
      this.trigger();
    }
  }

  onMouseUp(evt) {
    if (this.active) Object.assign(this, this.activeStyle);
  }
}

export class CheckBox extends Morph {

  constructor(props) {
    super({
      draggable: false,
      extent: pt(18, 18),
      borderWidth: 0,
      active: true,
      checked: false,
      ...props,
    });
  }

  get checked() { return this.getProperty("checked"); }
  set checked(value) { this.addValueChange("checked", value); }
  get active() { return this.getProperty("active"); }
  set active(value) { this.addValueChange("active", value); }

  trigger() {
    try {
      signal(this, "checked", !this.checked);
      this.checked = !this.checked;
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }
  
  onMouseDown(evt) {
    if (this.active) this.trigger();
  }
  
  render(renderer) {
    return renderer.renderCheckBox(this);
  }

}
