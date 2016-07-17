import { Morph } from "./morph.js";
import { FontMetric } from "./rendering/renderer.js";

export class Text extends Morph {

  constructor(props, submorphs) {
    super(Object.assign({ allowsInput: true, textString: "", draggable: false },
                        props),
          submorphs);
  }

  get isText() { return true }

  get _nodeType() { return 'textarea'; }

  get textString() { return this.getProperty("textString") }
  set textString(value) {
    this.recordChange({prop: "textString", value});
    this.autoFitFlagged = true;
  }

  get allowsInput() { return this.getProperty("allowsInput") }
  set allowsInput(value) { this.recordChange({prop: "allowsInput", value}) }

  get autoFits() { return this.getProperty("autoFits") }
  set autoFits(value) {
    this.recordChange({prop: "autoFits", value});
    this.autoFitFlagged = true;
  }

  get fontFamily() { return this.getProperty("fontFamily") }
  set fontFamily(value) {
    this.recordChange({prop: "fontFamily", value});
    this.autoFitFlagged = true;
  }

  get fontSize() { return this.getProperty("fontSize") }
  set fontSize(value) {
    this.recordChange({prop: "fontSize", value});
    this.autoFitFlagged = true;
  }

  get placeholder() { return this.getProperty("placeholder") }
  set placeholder(value) {
    this.recordChange({prop: "placeholder", value});
    this.autoFitFlagged = true;
  }

  get selection() { return this.getProperty("selection") }
  set selection(value) { this.recordChange({prop: "selection", value}) }

  aboutToRender() {
    super.aboutToRender();
    this.autoFitIfNeeded();
  }

  shape() {
    return {
      value: this.textString,
      readOnly: !this.allowsInput,
      placeholder: this.placeholder,
      style: { resize: "none", border: "none", overflow: "hidden",
               "white-space": "nowrap", padding: "0px",
               "font-family": this.fontFamily, "font-size": this.fontSize }
    }
  }

  fit() {
    var fontMetric = FontMetric.default(),
        {height: placeholderHeight, width: placeholderWidth} = fontMetric.sizeForStr(
          this.fontFamily, this.fontSize, this.placeholder || " "),
        {height, width} = fontMetric.sizeForStr(this.fontFamily, this.fontSize, this.textString);
    this.height = Math.max(placeholderHeight, height);
    this.width = Math.max(placeholderWidth, width);
  }

  autoFitIfNeeded() {
    if (this.autoFits && this.autoFitFlagged) {
      this.fit();
      this.autoFitFlagged = false;
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
