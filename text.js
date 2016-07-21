import { string } from "lively.lang";
import { Color, pr } from "lively.graphics";
import { Morph, show } from "./index.js";
import { FontMetric } from "./rendering/renderer.js";

export class Text extends Morph {

  static makeLabel(string, props) {
    return new Text({
      textString: string,
      fontFamily: "Helvetica Neue, Arial",
      fontColor: Color.black,
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
      draggable: false,
      _selection: { start: 0, end: 0 },
      fontFamily: "Sans-Serif",
      fontSize: 12,
      ...props
    });
    this.fit();
    this._needsFit = false;
    this._needsSelect = false;
  }

  get fontMetric() { return FontMetric.default(); }

  get isText() { return true }

  get _nodeType() { return 'textarea'; }

  get textString() { return this.getProperty("textString") }
  set textString(value) {
    let oldText = this.textString;
    oldText && this.deleteText(0, oldText.length);
    this.insertText(0, value);
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

  get fontColor() { return this.getProperty("fontColor") }
  set fontColor(value) {
    this.recordChange({prop: "fontColor", value});
  }

  get placeholder() { return this.getProperty("placeholder") }
  set placeholder(value) {
    this.recordChange({prop: "placeholder", value});
    this._needsFit = true;
  }

  get _selection() { return this.getProperty("_selection") }
  set _selection(value) { this.recordChange({prop: "_selection", value}); }

  get selection() { return new TextSelection(this) }

  insertText(pos, str) {
    var oldText = this.textString,
        newText = oldText ? oldText.substr(0, pos) + str + oldText.substr(pos) : str;
    this._needsFit = true;

    this.recordChange({
      prop: "textString", value: newText,
      type: "insert",
      pos: pos,
      str: str
    });
  }

  deleteText(start, end) {
    var oldText = this.textString,
        newText = oldText.substr(0, start) + oldText.substr(end);
    this._needsFit = true;

    this.recordChange({
      prop: "textString", value: newText,
      type: "delete",
      start: start,
      end: end
    });
  }

  selectionOrLineString() {
    var sel = this.selection;
    if (sel.text) return sel.text;
    var line = string.lineIndexComputer(this.textString)(sel.start),
        [start, end] = string.lineNumberToIndexesComputer(this.textString)(line);
    return this.textString.slice(start, end).trim();
  }

  aboutToRender() {
    super.aboutToRender();
    this.fitIfNeeded();
  }

  render(renderer) {
    this.selectIfNeeded(renderer);
    return super.render(renderer);
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
       "font-size": this.fontSize + "px",
       "color": String(this.fontColor)
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

  select(renderer) {
    var domNode = renderer.getNodeForMorph(this);
    domNode && ({ start: domNode.selectionStart, end: domNode.selectionEnd } = this._selection);
  }

  selectIfNeeded(renderer) {
    if (this._needsSelect) {
      this.select(renderer);
      this._needsSelect = false;
    }
  }

  onInput(evt) {
    this.textString = evt.domEvt.target.value;
  }

  onMouseUp(evt) { this.onSelect(evt); }

  onMouseDown(evt) { this.onSelect(evt); }

  onDeselect(evt) { this.onSelect(evt) }

  onSelect(evt) {
    var { selectionStart: start, selectionEnd: end } = evt.domEvt.target;
    this._selection = { start: start, end: end };
  }

  onDeselect(evt) {
    this._selection = { start: 0, end: 0 };
  }

  onKeyUp(evt) {
    switch (evt.keyString()) {
      case 'Command-D': case 'Command-P': evt.stop(); break;
    }
  }

  async onKeyDown(evt) {
    switch (evt.keyString()) {
      case 'Command-D':
        evt.stop();
        var result = await lively.vm.runEval(this.selectionOrLineString(), {System, targetModule: "lively://test-text/1"});
        this.world()[result.isError ? "logError" : "setStatusMessage"](result.value);
        break;

      case 'Command-P':
        var sel = this.selection;
        evt.stop();
        var result = await lively.vm.runEval(this.selectionOrLineString(), {System, targetModule: "lively://test-text/1"});
        this.textString = this.textString.slice(0, sel.end) + result.value + this.textString.slice(sel.end);
        break;
    }
  }

}


class TextSelection {

  constructor(textMorph) {
    this.textMorph = textMorph;
  }

  get range() { return this.textMorph._selection; }
  set range(rangeObj) {
    let morph = this.textMorph;
    morph._selection = rangeObj;
    morph._needsSelect = true;
  }

  get start() { return this.range.start; }
  set start(val) { this.range = { start: val, end: this.end }; }

  get end() { return this.range.end }
  set end(val) { this.range = { start: this.start, end: val }; }

  get text() { return this.textMorph.textString.substring(this.start, this.end) }
  set text(val) {
    var oldText = this.textMorph.textString,
        newText = oldText.substr(0, this.start) + val + oldText.substr(this.end);
    this.textMorph.textString = newText;
  }
}
