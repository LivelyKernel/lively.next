import { promise } from "lively.lang";
import { Morph, Label } from "lively.morphic";
import { Icon } from "./icons.js";
import { pt, Rectangle, Color } from "lively.graphics";
import { connect } from "lively.bindings";


export default class LoadingIndicator extends Morph {

  static open(label, props) {
    return new this({...props, label}).openInWorld();
  }

  static forPromise(p, label, props) {
    var i = this.open(label, props);
    promise.finally(Promise.resolve(p), () => i.remove());
    return i;
  }

  static async runFn(fn, label, props) {
    var i = this.open(label, props);
    await i.whenRendered();
    try { return await fn(); } finally { i.remove(); }
  }

  constructor(props = {}) {
    super(props);
    this.build();
    this.relayout();
  }

  get isEpiMorph() { return true }

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      fill: Color.rgbHex("#666"),
      fontSize: 16,
      fontFamily: "Arial",
      name: "LoadingIndicator",
      epiMorph: true,
    }
  }

  get label() { return this.getProperty("label") || ""; }
  set label(label) { this.addValueChange("label", label); this.updateLabel(); }
  get fontFamily() { return this.getProperty("fontFamily"); }
  set fontFamily(fontFamily) { this.addValueChange("fontFamily", fontFamily); this.updateLabel(); }
  get fontSize() { return this.getProperty("fontSize"); }
  set fontSize(fontSize) {  this.addValueChange("fontSize", fontSize); this.updateLabel(); }

  build() {
    var {fontSize, fontFamily, label} = this;
    this.submorphs = [

      Icon.makeLabel("spinner", {
        name: "spinner",
        fontColor: Color.white,
        value: [["", {
          fontFamily: "FontAwesome",
          textStyleClasses: ["fa", "fa-5x", "fa-pulse"]
        }]],
        autofit: false,
        origin: pt(30,30),
        extent: pt(60,60),
        topLeft: pt(0,0),
        halosEnabled: false
      }),

      {
        type: "label",
        name: "label",
        value: label,
        fontSize, fontFamily,
        fontColor: Color.white,
        styleClasses: ["center-text"],
        halosEnabled: false
      },

      {
        type: "button",
        name: "closeButton",
        label: "X",
        fontColor: Color.white,
        activeStyle: {fill: null, borderWidth: 0},
        extent: pt(20,20),
        visible: false
      }
    ];

    connect(this, 'extent', this, 'relayout');
    connect(this.get("label"), 'extent', this, "relayout");
    connect(this.get("closeButton"), 'fire', this, "remove");
  }

  updateLabel() {
    var labelMorph = this.getSubmorphNamed("label");
    if (!labelMorph) return
    var {center, label, fontSize, fontFamily} = this;
    labelMorph.value = label;
    labelMorph.fontFamily = fontFamily;
    labelMorph.fontSize = fontSize;
    this.relayout();
    setTimeout(() => this.center = center, 0);
  }

  relayout() {
    var padding = Rectangle.inset(8, 4),
        [spinner, label, closeButton] = this.submorphs,
        w = Math.max(spinner.width, label.width) + padding.left() + padding.right(),
        h = spinner.height + label.height + padding.top() + padding.bottom();
    this.extent = pt(w,h);
    closeButton.topRight = this.innerBounds().topRight();
    spinner.topCenter = this.innerBounds().topCenter().addXY(0, padding.top());
    label.topCenter = spinner.bottomCenter.addXY(0, 4);
  }

  onHoverIn(evt) { this.get("closeButton").visible = true; }
  onHoverOut(evt) { this.get("closeButton").visible = false; }
}
