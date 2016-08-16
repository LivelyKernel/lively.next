/*global System*/
import { string, obj } from "lively.lang";
import { Rectangle, Color, pt } from "lively.graphics";
import { Morph } from "../index.js";
import { Selection } from "./selection.js";
import DocumentRenderer from "./rendering.js";

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
    var fontMetric;
    if (props.fontMetric) {
      fontMetric = props.fontMetric
      props = obj.dissoc(props, ["fontMetric"]);
    }
    super({
      readOnly: false,
      clipMode: "hidden",
      textString: "",
      fixedWidth: false, fixedHeight: false,
      padding: 0,
      draggable: false,
      _selection: { start: 0, end: 0 },
      fontFamily: "Sans-Serif",
      fontSize: 12,
      ...props
    });
    this.renderer = new DocumentRenderer(fontMetric || this.env.fontMetric);
    this.fit();
    this._needsFit = false;
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

  rejectsInput() { return this.readOnly || !this.isFocused() }

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

  get padding() { return this.getProperty("padding") }

  set padding(value) {
    this.addValueChange("padding", typeof value === "number" ? Rectangle.inset(value) : value);
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
  set fontColor(value) { this.addValueChange("fontColor", value); }

  get placeholder() { return this.getProperty("placeholder") }
  set placeholder(value) {
    this.addValueChange("placeholder", value);
    this._needsFit = true;
  }

  get _selection() { return this.getProperty("_selection") }
  set _selection(value) { this.addValueChange("_selection", value); }

  get selection() { return new Selection(this) }

  get clipMode()  { return this.getProperty("clipMode"); }
  set clipMode(value)  {
    this.addValueChange("clipMode", value);
    this.fixedWidth = this.fixedHeight = this.isClip();
  }

  insertText(pos, str) {
    var str = String(str),
        oldText = this.textString,
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

  fitIfNeeded() {
    if (this._needsFit) { this.fit(); this._needsFit = false; }
  }

  indexFromPoint(point) {
    var pos = this.renderer.textPositionFor(this, point);
    var lines = this.textString.split("\n");
    var index = 0;
    for (var i = 0; i < Math.min(pos.row, lines.length); i++) index += lines[i].length;
    index += pos.column;
    return index;
  }

  pointFromIndex(index) {
    return this.renderer.pixelPositionForIndex(this, index);
  }

  paddingAndScrollOffset() {
    return this.padding.topLeft().subPt(this.scroll);
  }

  addPaddingAndScroll(point) {
    return point.addPt(this.paddingAndScrollOffset());
  }

  removePaddingAndScroll(point) {
    return point.subPt(this.paddingAndScrollOffset());
  }

  scrollToSelection() {
    var {scroll, selection, padding} = this,
        paddedBounds = this.innerBounds().insetByRect(padding),
        selPt = this.addPaddingAndScroll(this.pointFromIndex(selection.start));
    if (!paddedBounds.containsPoint(selPt)) {
      this.scroll = scroll.addPt(selPt.subPt(paddedBounds.bottomRight()));
    }
  }

  onMouseDown(evt) {
    this.onMouseMove(evt);
  }

  onMouseMove(evt) {
    var { clickedOnMorph, clickedOnPosition } = evt.state;
    if (clickedOnMorph === this) {
      var { selection } = this,
          { start: curStart, end: curEnd } = selection,
          start = this.indexFromPoint(this.removePaddingAndScroll(this.localize(clickedOnPosition))),
          end = this.indexFromPoint(this.removePaddingAndScroll(this.localize(evt.position)))
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

  onKeyDown(evt) {
    var keyString = evt.keyString(),
        key = evt.domEvt.key,
        sel = this.selection;

    switch (keyString) {
      case 'Command-C': case 'Command-X': case 'Command-V':
        break; // handled by onCut()/onPaste()

      case 'Command-A':
        evt.stop();
        sel.range = { start: 0, end: this.textString.length };
        break;

      case 'Command-D':
        evt.stop();
        (async () => {
          var result = await lively.vm.runEval(this.selectionOrLineString(), {System, targetModule: "lively://test-text/1"});
          this.world()[result.isError ? "logError" : "setStatusMessage"](result.value);
        })();
        break;

      case 'Command-P':
        evt.stop();
        (async () => {
          var result = await lively.vm.runEval(this.selectionOrLineString(), {System, targetModule: "lively://test-text/1"});
          this.textString = this.textString.slice(0, sel.end) + result.value + this.textString.slice(sel.end);
        })();
        break;

      case 'Command-S':
        evt.stop();
        this.doSave();
        break;

      case 'Backspace':
        if (this.rejectsInput()) break;
        evt.stop();
        sel.isCollapsed && sel.start && sel.start--;
        sel.text = "";
        sel.collapse();
        break;

      case 'Del': // forward-delete
        if (this.rejectsInput()) break;
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
        if (this.rejectsInput()) break;
        evt.stop();
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

    this.scrollToSelection();
  }

  doSave() { /*...*/ }

  onCut(evt) {
    if (this.rejectsInput()) return;
    this.onCopy(evt);
    var sel = this.selection;
    sel.text = "";
    sel.collapse();
  }

  onCopy(evt) {
    if (!this.isFocused()) return;
    evt.stop();
    evt.domEvt.clipboardData.setData("text", this.selection.text);
  }

  onPaste(evt) {
    if (this.rejectsInput()) return;
    evt.stop();
    var sel = this.selection;
    sel.text = evt.domEvt.clipboardData.getData("text");
    sel.collapse(sel.end);
  }

  onFocus(evt) {
    this.makeDirty();
  }

  onBlur(evt) { this.makeDirty(); }
}
