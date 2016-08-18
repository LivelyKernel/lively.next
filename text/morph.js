/*global System*/
import { string, obj } from "lively.lang";
import { Rectangle, Color, pt } from "lively.graphics";
import { Morph } from "../index.js";
import { Selection } from "./selection.js";
import DocumentRenderer from "./rendering.js";
import TextDocument from "./document.js";

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

  constructor(props = {}) {
    var {fontMetric, textString} = props;
    if (fontMetric) props = obj.dissoc(props, ["fontMetric"]);
    if (typeof textString !== "undefined") props = obj.dissoc(props, ["textString"])
    super({
      readOnly: false,
      clipMode: "hidden",
      fixedWidth: false, fixedHeight: false,
      padding: 0,
      draggable: false,
      _selection: { start: 0, end: 0 },
      fontFamily: "Sans-Serif",
      fontSize: 12,
      ...props
    });
    this.document = new TextDocument();
    this.textString = textString || "";
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

  get fixedHeight() { return this.getProperty("fixedHeight"); }
  set fixedHeight(value) {
    this.addValueChange("fixedHeight", value);
    this._needsFit = true;
  }

  get padding() { return this.getProperty("padding"); }
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

  get clipMode()  { return this.getProperty("clipMode"); }
  set clipMode(value)  {
    this.addValueChange("clipMode", value);
    this.fixedWidth = this.fixedHeight = this.isClip();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // document changes

  get textString() { return this.document ? this.document.textString : "" }
  set textString(value) {
    let oldText = this.textString;
    oldText && this.deleteText(0, oldText.length);
    this.insertText(0, value);
  }

  insertText(index, string) {
    var doc = this.document,
        pos = doc.indexToPosition(index);
    doc.insert(string, pos);

    this._needsFit = true;
    this.addValueChange(
      "textString", doc.textString,
      {action: "insert", index, string});
  }

  deleteText(start, end) {
    var doc = this.document,
        startPos = doc.indexToPosition(start),
        endPos = doc.indexToPosition(end);
    doc.remove(startPos, endPos);

    this._needsFit = true;
    this.addValueChange(
      "textString", doc.textString,
      {action: "delete", start, end});
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  get _selection() { return this.getProperty("_selection") }
  set _selection(value) { this.addValueChange("_selection", value); }
  get selection() { return new Selection(this) }

  selectionOrLineString() {
    var sel = this.selection;
    if (sel.text) return sel.text;
    var doc = this.document;
    return doc.getLine(doc.indexToPosition(sel.start).row);
  }

  // FIXME!
  scrollToSelection() {
    var {scroll, selection, padding} = this,
        paddedBounds = this.innerBounds().insetByRect(padding),
        selPt = this.addPaddingAndScroll(this.pointFromIndex(selection.start));
    if (!paddedBounds.containsPoint(selPt)) {
      this.scroll = scroll.addPt(selPt.subPt(paddedBounds.bottomRight()));
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // text layout related

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
    return this.renderer.textIndexFor(this, point);
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  aboutToRender(renderer) {
    super.aboutToRender(renderer);
    this.fitIfNeeded();
  }

  render(renderer) {
    return this.renderer.renderMorph(renderer, this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // mouse events

  onMouseDown(evt) {
    this.onMouseMove(evt);
  }

  onMouseMove(evt) {
    var {clickedOnMorph, clickedOnPosition} = evt.state;
    if (clickedOnMorph !== this) return;

    var {selection, scroll} = this,
        {start: curStart, end: curEnd} = selection,
        start = this.indexFromPoint(this.removePaddingAndScroll(this.localize(clickedOnPosition))),
        end = this.indexFromPoint(this.removePaddingAndScroll(this.localize(evt.position)))

    if (start > end)
      [start, end] = [end, start];
    if (end !== curEnd || start !== curStart)
      selection.range = {start: start, end: end};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // keyboard events

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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging

  inspect() {
    var inspected = `<${this.name}>`,
        {range: {start,end}, text} = this.selection
    inspected += `\n  selection: ${start} -> ${end} ${text}`
    inspected += "\n  " + this.renderer.lines.map(({height, width, text}, i) => {
      return `[${i}] ${width.toFixed(0)}x${height.toFixed(0)} ${obj.inspect(text)}`
    }).join("\n  ");
    return inspected += `\n</${this.name}>`
  }

}
