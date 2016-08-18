import { obj } from "lively.lang";
import { Morph } from "../index.js";
import DocumentRenderer from "./rendering.js";

export class Text2 extends Morph {

  constructor(props = {}) {
    var fontMetric;
    if (props.fontMetric) {
      fontMetric = props.fontMetric
      props = obj.dissoc(props, ["fontMetric"]);
    }
    super({
      textString: "",
      fontFamily: "Arial",
      fontSize: 11,
      fixedWidth: false,
      fixedHeight: false,
      ...props
    });
    this.renderer = new DocumentRenderer(fontMetric || this.env.fontMetric);
    this.fit();
  }

  get isText() { return true }

  onChange(change) {
    super.onChange(change);
    if (change.prop === "textString"
     || change.prop === "fontFamily"
     || change.prop === "fontSize"
     || change.prop === "fixedWidth"
     || change.prop === "fixedHeight")
       this.renderer && (this.renderer.layoutComputed = false);
  }

  get textString() { return this.getProperty("textString"); }
  set textString(value) {
    this.addValueChange("textString", value);
    this.fit();
  }

  get fontFamily() { return this.getProperty("fontFamily"); }
  set fontFamily(value) {
    this.addValueChange("fontFamily", value);
    this.fit();
  }

  get fontSize() { return this.getProperty("fontSize"); }
  set fontSize(value) {
    this.addValueChange("fontSize", value);
    this.fit();
  }

  get clipMode()  { return this.getProperty("clipMode"); }
  set clipMode(value)  {
    this.addValueChange("clipMode", value);
    this.fixedWidth = this.fixedHeight = this.isClip();
  }

  render(renderer) {
    return this.renderer.renderMorph(renderer, this);
  }

  fit() {
    let {fixedWidth, fixedHeight} = this;
    if ((fixedHeight && fixedWidth) || !this.renderer/*not init'ed yet*/) return;
    let textBounds = this.renderer.textBounds(this);
    if (!fixedHeight && !fixedWidth) this.extent = textBounds.extent();
    else if (!fixedHeight) this.height = textBounds.height;
    else if (!fixedWidth) this.width = textBounds.width;
  }

  onMouseDown(evt) {
    
  }
}
