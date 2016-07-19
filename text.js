import { Morph } from "./morph.js";
import { FontMetric } from "./rendering/renderer.js";

export class Text extends Morph {

  static makeLabel(string, props) {
    return new Text({
      textString: string,
      fontFamily: "Helvetica Neue, Arial",
      fontSize: 11,
      readOnly: true,
      ...props
    });
  }

  constructor(props) {
    super({
      readOnly: false,
      clipMode: "hidden",
      textString: "",
      fixedWidth: false, fixedHeight: false,
      ...props
    });
    this.fit();
    this._needsFit = false;
  }

  get fontMetric() { return FontMetric.default(); }

  get isText() { return true }

  get _nodeType() { return 'textarea'; }

  get textString() { return this.getProperty("textString") }
  set textString(value) {
    this.recordChange({prop: "textString", value});
    this._needsFit = true;
  }

  get readOnly() { return this.getProperty("readOnly"); }
  set readOnly(value) {
    this.nativeCursor = value ? "default" : "auto";
    this.recordChange({prop: "readOnly", value});
  }

  get fixedWidth() { return this.getProperty("fixedWidth") }
  set fixedWidth(value) {
    this.recordChange({prop: "fixedWidth", value});
    this._needsFit = true;
  }

  get fixedHeight() { return this.getProperty("fixedHeight") }
  set fixedHeight(value) {
    this.recordChange({prop: "fixedHeight", value});
    this._needsFit = true;
  }

  get fontFamily() { return this.getProperty("fontFamily") }
  set fontFamily(value) {
    this.recordChange({prop: "fontFamily", value});
    this._needsFit = true;
  }

  get fontSize() { return this.getProperty("fontSize") }
  set fontSize(value) {
    this.recordChange({prop: "fontSize", value});
    this._needsFit = true;
  }

  get placeholder() { return this.getProperty("placeholder") }
  set placeholder(value) {
    this.recordChange({prop: "placeholder", value});
    this._needsFit = true;
  }

  get selection() { return this.getProperty("selection") }
  set selection(value) { this.recordChange({prop: "selection", value}) }

  aboutToRender() {
    super.aboutToRender();
    this.fitIfNeeded();
  }

  shape() {
    return {
      value: this.textString,
      readOnly: this.readOnly,
      placeholder: this.placeholder,
      style: {
        resize: "none", border: 0,
       "white-space": "nowrap", padding: "0px",
       "font-family": this.fontFamily,
       "font-size": this.fontSize + "px"
     }
    }
  }

  fit() {
    var {fixedHeight, fixedWidth} = this;
    if (fixedHeight && fixedWidth) return;

    var {fontMetric, fontFamily, fontSize, placeholder, textString} = this,
        {height: placeholderHeight, width: placeholderWidth} = fontMetric.sizeForStr(fontFamily, fontSize, placeholder || " "),
        {height, width} = fontMetric.sizeForStr(fontFamily, fontSize, textString);
    if (!fixedHeight)
      this.height = Math.max(placeholderHeight, height);
    if (!fixedWidth)
      this.width = Math.max(placeholderWidth, width);
  }

  fitIfNeeded() {
    if (this._needsFit) { this.fit(); this._needsFit = false; }
  }

  onInput(evt) {
    this.textString = evt.domEvt.target.value;
  }

  onSelect(evt) {
    var {selectionStart: start, selectionEnd: end} = evt.domEvt.target,
        text = this.textString.substring(start, end)
    this.selection = {text, start, end};
  }

  onDeselect(evt) {
    this.selection = undefined;
  }

}
