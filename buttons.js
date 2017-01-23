import { obj } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { Morph, morph } from "./index.js";
import { signal, disconnect, connect } from "lively.bindings";

// var b = new Button({label: "test", extent: pt(22,18)}).openInWorld()
// b.scale = 10
// import { Icon } from "./icons.js";
// b.label = [Icon.textAttribute("plus")]
// b.padding = Rectangle.inset(2,4,2,5); b.fit()
// b.relayout()
// b.fit()

export class Button extends Morph {

  static get properties() {
    return {
      padding:      {defaultValue: Rectangle.inset(4,2)},
      active:       {after: ["labelMorph"], defaultValue: true},
      borderWidth:  {defaultValue: 1},
      extent:       {defaultValue: pt(100,24)},
      borderRadius: {defaultValue: 15},
      draggable:    {defaultValue: false},
      labelMorph:   {
        after: ["submorphs"],
        initialize() {
          this.labelMorph = this.addMorph({
            type: "label", name: "label",
            value: "no label yet", fill: Color.white.withA(0),
            padding: Rectangle.inset(0)
          });
        }
      },
      label:        {after: ["labelMorph"]},
      fontFamily:   {after: ["labelMorph"]},
      fontSize:     {after: ["labelMorph"]},
      fontColor:    {after: ["labelMorph"]}
    }
  }

  constructor(props) {
    super(props);

    this.active = this.active; // style
    this.relayout();

    connect(this, "change", this, "relayout",
      {updater: ($upd, {prop}) => ["extent", "padding"].includes(prop) && $upd()})
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
    var label = this.labelMorph;
    if (!label) return;
    var padding = this.padding,
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

  get label() { return this.labelMorph.textString; }
  set label(stringOrAttributesOrMorph) {
    if (stringOrAttributesOrMorph.isMorph) {
      this.labelMorph = stringOrAttributesOrMorph;
    } else {
      this.labelMorph.value = stringOrAttributesOrMorph;
      this.relayout();
    }
  }

  get labelMorph() { return this.getSubmorphNamed("label"); }
  set labelMorph(labelMorph) {
    var existing = this.labelMorph;
    if (existing) {
      disconnect(this.labelMorph, "change", this, "relayout");
      existing.remove();
    }

    labelMorph.name = "label";
    this.addMorphAt(labelMorph, 0);
    this.relayout();
    connect(labelMorph, "change", this, "relayout",
      {updater: ($upd, {prop}) => ["extent"].includes(prop) && $upd()});
  }

  get labelWithTextAttributes() { return this.labelMorph.textAndAttributes; }
  set labelWithTextAttributes(textAndAttributes) {
    this.labelMorph.textAndAttributes = textAndAttributes;
    this.relayout();
  }

  get fontFamily() { return this.labelMorph.fontFamily; }
  set fontFamily(fontFamily) { this.labelMorph.fontFamily = fontFamily; this.relayout(); }
  get fontSize() { return this.labelMorph.fontSize; }
  set fontSize(fontSize) { this.labelMorph.fontSize = fontSize; this.relayout(); }
  get fontColor() { return this.labelMorph.fontColor; }
  set fontColor(color) { this.labelMorph.fontColor = color; }
  set padding(value) { this.addValueChange("padding", value); this.relayout(); }
  get padding() { return this.getProperty("padding"); }

  get active() { return this.getProperty("active"); }
  set active(value) {
    Object.assign(this, value ? this.activeStyle : this.inactiveStyle);
    this.labelMorph.nativeCursor = this.nativeCursor;
    this.addValueChange("active", value);
  }

  fit() {
    var padding = this.padding, label = this.labelMorph;
    label.fit();
    this.extent = padding.bottomLeft().addPt(padding.bottomRight()).addPt(label.extent);
    this.relayout();
    return this;
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
