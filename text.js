import { Morph } from "./morph.js";
import { FontMetric } from "./rendering/renderer.js";

export class Text extends Morph {

  static makeLabel(text, props) {
    return new this(Object.assign({
      textString: text, readOnly: true,
      fixedWidth: false, fixedHeight: false
    }, props));
  }

  constructor(props) {
    super(Object.assign({
      readOnly: false,
      clipMode: "hidden",
      textString: "",
      fixedWidth: false, fixedHeight: false
    }, props));
    this.fit();
    this._needsFit = false;
  }

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
        resize: "none",
       "white-space": "nowrap", padding: "0px",
       "font-family": this.fontFamily,
       "font-size": this.fontSize + "px"
     }
    }
  }

  fit() {
    if (this.fixedHeight && this.fixedWidth) return;

    var fontMetric = FontMetric.default(),
        {height: placeholderHeight, width: placeholderWidth} = fontMetric.sizeForStr(
          this.fontFamily, this.fontSize, this.placeholder || " "),
        {height, width} = fontMetric.sizeForStr(this.fontFamily, this.fontSize, this.textString);
    if (!this.fixedHeight)
      this.height = Math.max(placeholderHeight, height);
    if (!this.fixedWidth)
      this.width = Math.max(placeholderWidth, width);
  }

  fitIfNeeded() {
    if (this._needsFit) {
      this.fit();
      this._needsFit = false;
    }
  }

  onInput(evt) {
    this.textString = evt.domEvt.target.value;
  }

  onSelect(evt) {
    var {selectionStart: start, selectionEnd: end } = evt.domEvt.target,
        text = this.textString.substring(start, end)
    this.selection = { text: text, start: start, end: end };
  }

  onDeselect(evt) {
    this.selection = undefined;
  }

}
