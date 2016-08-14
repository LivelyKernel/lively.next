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
    this.state = {
      renderer: new DocumentRenderer(fontMetric || this.env.fontMetric),
      layout: null
    }
    this.fit();
  }

  get isText() { return true }

  get textString() { return this.getProperty("textString") }
  set textString(value) {
    this.addValueChange("textString", value);
    this.fit();
  }

  get fontFamily() { return this.getProperty("fontFamily") }
  set fontFamily(value) {
    this.addValueChange("fontFamily", value);
    this.fit();
  }

  get fontSize() { return this.getProperty("fontSize"); }
  set fontSize(value) {
    this.addValueChange("fontSize", value);
    this.fit();
  }

  render(renderer) {
    return this.state.renderer.renderMorph(this);
  }

  fit() {
    let {fixedWidth, fixedHeight} = this;
    if ((fixedHeight && fixedWidth) || !this.state/*not init'ed yet*/) return;
    let {width, height} = this.state.renderer.fontMetric.sizeForStr(this.fontFamily, this.fontSize, this.textString);
    if (!fixedHeight && !fixedWidth) this.extent = pt(width, height);
    else if (!fixedHeight) this.height = height;
    else if (!fixedWidth) this.width = width;
  }

}
