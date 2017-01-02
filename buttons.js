import { obj } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { Morph } from "./index.js";
import { signal, connect } from "lively.bindings";

// var b = new Button({label: "test", extent: pt(22,18)}).openInWorld()
// b.scale = 10
// import { Icon } from "./icons.js";
// b.label = [Icon.textAttribute("plus")]
// b.padding = Rectangle.inset(2,4,2,5); b.fit()
// b.relayout()
// b.fit()

export class Button extends Morph {

  constructor(props) {
    var {label, fontFamily, fontSize, fontColor} = props;
    if (!label) label = "no label";
    if (label.isMorph) {
      label.name = "label";
    } else {
      label = {
        type: "label", name: "label",
        value: label, fill: Color.white.withA(0),
        padding: Rectangle.inset(0),
      }
    }

    super({
      draggable: false,
      borderRadius: 15,
      extent: pt(100,24),
      borderWidth: 1,
      active: true,
      padding: Rectangle.inset(0),
      submorphs: [label],
      ...obj.dissoc(props, ["label", "fontFamily", "fontSize", "fontColor"])
    });

    this.active = this.active; // style
    this.relayout();

    if (fontFamily !== undefined) this.fontFamily = fontFamily;
    if (fontSize !== undefined) this.fontSize = fontSize;
    if (fontColor !== undefined) this.fontColor = fontColor;

    connect(this, "change", this, "relayout",
      {updater: ($upd, {prop}) => ["extent", "padding"].includes(prop) && $upd()})
    connect(this.submorphs[0], "change", this, "relayout",
      {updater: ($upd, {prop}) => ["extent"].includes(prop) && $upd()})
  }

  get isButton() { return true }

  get defaultActiveStyle() {
    return {
      borderColor: Color.gray,
      fill: Color.rgb(240,240,240),
      fontColor: Color.almostBlack,
      nativeCursor: "pointer"
    }
  }
  get activeStyle() { return this.getProperty("activeStyle") || this.defaultActiveStyle; }
  set activeStyle(value) {
    this.addValueChange("activeStyle", {...this.defaultActiveStyle, ...value});
    this.active = this.active; /*update*/
  }

  get defaultInactiveStyle() {
    return {
      borderColor: Color.gray.withA(0.5),
      fill: Color.rgba(240,240,240, 0.5),
      fontColor: Color.almostBlack.withA(0.5),
      nativeCursor: "not-allowed"
    }
  }
  get inactiveStyle() { return this.getProperty("inactiveStyle") || this.defaultInactiveStyle; }
  set inactiveStyle(value) {
    this.addValueChange("inactiveStyle", {...this.defaultInactiveStyle, ...value});
    this.active = this.active; /*update*/
  }

  get defaultTriggerStyle() {
    return {
      fill: Color.rgb(161,161,161)
    }
  }
  get triggerStyle() { return this.getProperty("triggerStyle") || this.defaultTriggerStyle; }
  set triggerStyle(value) {
    this.addValueChange("triggerStyle", {...this.defaultTriggerStyle, ...value});
  }

  relayout() {
    var padding = this.padding,
        label = this.submorphs[0],
        padT = padding.top(),
        padB = padding.bottom(),
        padL = padding.left(),
        padR = padding.right(),
        minHeight = label.height + padT + padB,
        minWidth = label.width + padL + padR;
    if (minHeight > this.height) this.height = minHeight;
    if (minWidth > this.width) this.width = minWidth;
    // label.center = pt(padL + label.width/2, padT + label.height/2);
    label.center = this.innerBounds().insetByRect(padding).center();
    return this;
  }

  get label() { return this.get("label").textString; }
  set label(stringOrAttributesOrMorph) {
    if (stringOrAttributesOrMorph.isMorph) {
      this.get("label").remove();
      stringOrAttributesOrMorph.name = "label";
      this.addMorph(stringOrAttributesOrMorph);
    } else {
      this.get("label").value = stringOrAttributesOrMorph;
    }
    this.relayout();
  }

  get labelWithTextAttributes() { return this.get("label").textAndAttributes; }
  set labelWithTextAttributes(textAndAttributes) { this.get("label").textAndAttributes = textAndAttributes; this.relayout(); }

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
    this.submorphs[0].nativeCursor = this.nativeCursor;
    this.addValueChange("active", value);
  }

  fit() {
    var padding = this.padding,
        label = this.submorphs[0];
    label.fit();
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
    if (this.active)
      Object.assign(this, this.triggerStyle);
  }

  onMouseUp(evt) {
    if (evt.isClickTarget(this) && this.active) {
      Object.assign(this, this.activeStyle);
      this.trigger();
    }
  }

  onHoverOut(evt) {
    // When leaving the button without mouse up, reset appearance
    if (this.active && evt.isClickTarget(this))
      Object.assign(this, this.activeStyle);
  }

  onHoverIn(evt) {
    if (this.active && evt.isClickTarget(this))
      Object.assign(this, this.triggerStyle);
  }

}
