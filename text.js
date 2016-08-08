import { string } from "lively.lang";
import { Color, pr } from "lively.graphics";
import { Morph, show } from "./index.js";
import { defaultAttributes } from "./rendering/morphic-default.js";
import { h } from "virtual-dom";

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

    // Note: clipboardHelper may already exist if this Text morph was copied
    this.clipboardHelper || this.addMorph(new ClipboardHelper());
  }

  get fontMetric() { return this.env.fontMetric; }

  get clipboardHelper() { return this.submorphs.filter(m => m.isClipboardHelper)[0]; }

  get isText() { return true }

  get textString() { return this.getProperty("textString") }
  set textString(value) {
    let oldText = this.textString;
    oldText && this.deleteText(0, oldText.length);
    this.insertText(0, value);
  }

  get readOnly() { return this.getProperty("readOnly"); }
  set readOnly(value) {
    this.nativeCursor = value ? "default" : "auto";
    this.addValueChange("readOnly", value);
  }

  get fixedWidth() { return this.getProperty("fixedWidth") }
  set fixedWidth(value) {
    this.addValueChange("fixedWidth", value);
    this._needsFit = true;
  }

  get fixedHeight() { return this.getProperty("fixedHeight") }
  set fixedHeight(value) {
    this.addValueChange("fixedHeight", value);
    this._needsFit = true;
  }

  get fontFamily() { return this.getProperty("fontFamily") }
  set fontFamily(value) {
    this.addValueChange("fontFamily", value);
    this._needsFit = true;
  }

  get fontSize() { return this.getProperty("fontSize") }
  set fontSize(value) {
    this.addValueChange("fontSize", value);
    this._needsFit = true;
  }

  get fontColor() { return this.getProperty("fontColor") }
  set fontColor(value) {
    this.addValueChange("fontColor", value);
  }

  get placeholder() { return this.getProperty("placeholder") }
  set placeholder(value) {
    this.addValueChange("placeholder", value);
    this._needsFit = true;
  }

  get _selection() { return this.getProperty("_selection") }
  set _selection(value) { this.addValueChange("_selection", value); }

  get selection() { return new TextSelection(this) }

  insertText(pos, str) {
    var oldText = this.textString,
        newText = oldText ? oldText.substr(0, pos) + str + oldText.substr(pos) : str;
    this._needsFit = true;

    this.addValueChange(
      "textString", newText,
      {action: "insert", pos: pos, str: str});
  }

  deleteText(start, end) {
    var oldText = this.textString,
        newText = oldText.substr(0, start) + oldText.substr(end);
    this._needsFit = true;

    this.addValueChange(
      "textString", newText,
      {action: "delete", start: start, end: end});
  }

  selectionOrLineString() {
    var sel = this.selection;
    if (sel.text) return sel.text;
    var line = string.lineIndexComputer(this.textString)(sel.start),
        [start, end] = string.lineNumberToIndexesComputer(this.textString)(line);
    return this.textString.slice(start, end).trim();
  }

  aboutToRender(renderer) {
    super.aboutToRender(renderer);
    this.fitIfNeeded();
  }

  render(renderer) {
    return renderer.renderText(this);
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

  onMouseDown(evt) { this.onMouseMove(evt); }

  onMouseMove(evt) {
    var { clickedOnMorph, clickedOnPosition } = evt.state;
    if (clickedOnMorph === this) {
      var startPos = this.localize(clickedOnPosition),
          endPos = this.localize(evt.position),
          { fontFamily, fontSize, textString, fontMetric, selection } = this,
          { start: curStart, end: curEnd } = selection,
          start = fontMetric.indexFromPoint(fontFamily, fontSize, textString, startPos),
          end = fontMetric.indexFromPoint(fontFamily, fontSize, textString, endPos);
      if (start > end)
        [start, end] = [end, start];
      if (end !== curEnd || start !== curStart)
        selection.range = { start: start, end: end };
    }
  }

  onKeyUp(evt) {
    switch (evt.keyString()) {
      case 'Command-D': case 'Command-P': evt.stop(); break;
    }
  }

  async onKeyDown(evt) {
    var keyString = evt.keyString(),
        key = evt.domEvt.key,
        sel = this.selection;
    switch (keyString) {
      case 'Command-C': case 'Command-X': case 'Command-V':
        break; // handled by onCut()/onPaste()

      case 'Command-D':
        evt.stop();
        var result = await lively.vm.runEval(this.selectionOrLineString(), {System, targetModule: "lively://test-text/1"});
        this.world()[result.isError ? "logError" : "setStatusMessage"](result.value);
        break;

      case 'Command-P':
        evt.stop();
        var result = await lively.vm.runEval(this.selectionOrLineString(), {System, targetModule: "lively://test-text/1"});
        this.textString = this.textString.slice(0, sel.end) + result.value + this.textString.slice(sel.end);
        break;

      case 'Backspace':
        if (this.readOnly) break;
        evt.stop();
        sel.isCollapsed && sel.start && sel.start--;
        sel.text = "";
        sel.collapse();
        break;

      case 'Del': // forward-delete
        if (this.readOnly) break;
        evt.stop();
        sel.isCollapsed && sel.end++;
        sel.text = "";
        sel.collapse();
        break;

      case 'Left': case 'Right':
        evt.stop();
        sel.start += (keyString === 'Right' ? 1 : (sel.start > 0 ? -1 : 0));
        sel.collapse();
        break;

      case 'Up': case 'Down':
        evt.stop();
        var text = this.textString,
            line = string.lineIndexComputer(text)(sel.start),
            otherLine = line + (keyString === "Down" ? 1 : -1),
            rangeComp = string.lineNumberToIndexesComputer(text),
            [lineStart, lineEnd] = rangeComp(line),
            otherLineRange = rangeComp(otherLine),
            [otherLineStart, otherLineEnd] = otherLineRange || [lineStart, lineEnd];
        sel.start = Math.min(otherLineStart + (sel.start - lineStart), otherLineEnd-1);
        sel.collapse();
        break;

      default:
        evt.stop();
        if (this.readOnly) return;
        switch (key) {
          case 'Enter':
            sel.text = "\n"; break;
          case 'Space':
            sel.text = " "; break;
          case 'Tab':
            sel.text = "\t"; break;
          default:
            if (key.length === 1) sel.text = key;
            else return; // ignored key
        }
        sel.collapse(sel.start + 1);
    }
  }

  onCut(evt) {
    this.onCopy(evt);
    var sel = this.selection;
    sel.text = "";
    sel.collapse();
  }

  onCopy(evt) {
    evt.stop();
    evt.domEvt.clipboardData.setData("text", this.selection.text);
  }

  onPaste(evt) {
    var sel = this.selection;
    sel.text = evt.domEvt.clipboardData.getData("text");
    sel.collapse(sel.end);
  }

  onFocus(evt) {
    this.clipboardHelper.focus();
    this.makeDirty();
  }

  onBlur(evt) { this.makeDirty(); }
}


export class ClipboardHelper extends Morph {

  get isClipboardHelper() { return true; }

  render(renderer) {
    return h('textarea',
         {  ...defaultAttributes(this),
            resize: "none",
            value: " ",
            style: {  width: "0px",
                      height: "0px",
                      overflow: "hidden",
                      padding: "0px",
                      border: "0px" }});
  }

  onFocus(evt) { this._hasFocus = true; }

  onBlur(evt) {
    this._hasFocus = false;
    this.makeDirty();
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
    let { start, end } = this.range,
        morph = this.textMorph;
    if (!this.isCollapsed) {
      morph.deleteText(start, end);
    }
    if (val.length) {
      morph.insertText(start, val);
    }
    this.range = { start: this.start, end: this.start + val.length };
  }

  get isCollapsed() { return this.start === this.end; }
  collapse(index = this.start) { this.range = { start: index, end: index }; }
}
