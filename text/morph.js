/*global System*/
import { string, obj, arr } from "lively.lang";
import { Rectangle, Color, pt } from "lively.graphics";
import { Morph, show } from "../index.js";
import { Selection, Range } from "./selection.js";
import DocumentRenderer from "./rendering.js";
import TextDocument from "./document.js";
import { KeyHandler, simulateKeys, invokeKeyHandlers } from "../events/keyhandler.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME for makeInputLine
import { signal } from "lively.bindings";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import { eqPosition, lessPosition, lessEqPosition } from "./position.js";

class Anchor {
  constructor(id = string.newUUID(), pos = {column: 0, row: 0}) {
    this.id = id;
    this.position = pos;
  }

  get isAnchor() { return true; }

  onDelete(range) {
    if (lessPosition(this.position, range.start)) return;

    if (lessEqPosition(range.start, this.position)
     && lessEqPosition(this.position, range.end)) { this.position = range.start; return; }

    let {row, column} = this.position,
        {start: {row: startRow, column: startColumn}, end: {row: endRow, column: endColumn}} = range,
        deltaRows = endRow - startRow,
        deltaColumns = endRow !== this.position.row ?
          0 : startRow === endRow ?
            endColumn - startColumn : endColumn;
    this.position = {column: column - deltaColumns, row: row - deltaRows}
  }

  onInsert(range) {
    if (lessPosition(this.position, range.start)) return;
    let {row, column} = this.position,
        {start: {row: startRow, column: startColumn}, end: {row: endRow, column: endColumn}} = range,
        deltaRows = endRow - startRow,
        deltaColumns = startRow !== this.position.row ?
          0 : startRow === endRow ?
            endColumn - startColumn : endColumn;
    this.position = {column: column + deltaColumns, row: row + deltaRows}
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
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

  static makeInputLine(props) {
    var t = new Text({type: "text", extent: pt(100, 20), clipMode: "auto", ...props})
    t.onInput = function(input) {
      signal(this, "input", input);
    }
    t.onKeyDown = function(evt) {
      switch (evt.keyCombo) {
        case 'Enter': this.onInput(this.textString); evt.stop(); return;
        default: return this.constructor.prototype.onKeyDown.call(this, evt);
      }
    }
    return t;
  }

  constructor(props = {}) {
    var {fontMetric, textString, selectable, selection, clipMode} = props;
    props = obj.dissoc(props, ["textString","fontMetric", "selectable", "selection", "clipMode"])
    super({
      readOnly: false,
      draggable: false,
      fixedWidth: false, fixedHeight: false,
      padding: 0,
      fontFamily: "Sans-Serif",
      fontSize: 12,
      fontColor: Color.black,
      fontKerning: true,
      ...props
    });
    this.document = new TextDocument();
    this.renderer = new DocumentRenderer(fontMetric || this.env.fontMetric);
    this._keyhandlers = []; // defaultKeyHandler is fallback
    // this.commands = new CommandHandler();
    this._selection = new Selection(this, selection);
    this.selectable = typeof selectable !== "undefined" ? selectable : true;
    this.textString = textString || "";
    if (clipMode) this.clipMode = clipMode;
    this.fit();
    this._needsFit = false;
  }

  get isText() { return true }

  onChange(change) {
    if (change.prop === "textString"
     || change.prop === "fontFamily"
     || change.prop === "fontSize"
     || change.prop === "fontColor" // FIXME
     || change.prop === "fixedWidth"
     || change.prop === "fixedHeight"
     || change.prop === "fontKerning")
       this.renderer && (this.renderer.layoutComputed = false);
    super.onChange(change);
  }

  get readOnly() { return this.getProperty("readOnly"); }
  set readOnly(value) {
    this.nativeCursor = value ? "default" : "auto";
    this.addValueChange("readOnly", value);
  }

  rejectsInput() { return this.readOnly /*|| !this.isFocused()*/ }

  get selectable() { return this.getProperty("selectable"); }
  set selectable(value) {
    this.addValueChange("selectable", value);
    if (!value) this.selection.collapse();
  }

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

  get fontKerning() { return this.getProperty("fontKerning") }
  set fontKerning(value) { this.addValueChange("fontKerning", value); }

  get anchors() { return this._anchors || (this._anchors = []); }
  addAnchor(a) {
    if (!a) return;
    if (a.isAnchor) {/*...*/}
    else {
      if (typeof a === "string")
        a = {id: a, row: 0, column: 0};
      let {id, column, row} = a;
      a = this.anchors.find(ea => ea.id === a.id)
       || new Anchor(id, row || column ? {row, column} : null);
    }
    arr.pushIfNotIncluded(this.anchors, a);
    return a;
  }
  removeAnchor(anchor) {
    this._anchors = this.anchors.filter(
      typeof anchor === "string" ?
        ea => ea.id !== anchor :
        ea => ea !== anchor);
  }

  get clipMode()  { return this.getProperty("clipMode"); }
  set clipMode(value)  {
    this.addValueChange("clipMode", value);
    this.fixedWidth = this.fixedHeight = this.isClip();
  }

  textBounds() {
    return this.renderer ? this.renderer.textBounds(this) : new Rectangle(0,0,0,0);
  }
  get scrollExtent() {
    return this.textBounds().extent().maxPt(super.scrollExtent);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // document changes

  get textString() { return this.document ? this.document.textString : "" }
  set textString(value) {
    this.document.textString = String(value);
    this.selection = {start: 0, end: 0};
    this.addValueChange("textString", value);
    this._needsFit = true;
  }

  getLine(row) {
    if (typeof row !== "number") this.cursorPosition.row;
    var doc = this.document;
    return doc.getLine(row);
  }

  lineRange(row, ignoreLeadingWhitespace = true) {
    if (typeof row !== "number") this.cursorPosition.row;
    var line = this.getLine(row),
        range = {start: {column: 0, row}, end: {column: line.length, row}},
        leadingSpace = line.match(/^\s*/);
    if (leadingSpace[0].length && ignoreLeadingWhitespace)
      range.start.column += leadingSpace[0].length;
    return range;
  }

  insertTextAndSelect(text, pos = null) {
    text = String(text);
    if (pos) this.selection.range = this.insertText(text, pos);
    else this.selection.text = text;
  }

  insertText(text, pos = null) {
    text = String(text);
    var range = this.document.insert(text, pos || this.selection.end);
    this._needsFit = true;
    this.addValueChange(
      "textString", this.document.textString,
      {action: "insertText", text, pos});
    return range;
  }

  deleteText(range) {
    this.document.remove(range);
    this._needsFit = true;
    this.addValueChange(
      "textString", this.document.textString,
      {action: "deleteText", range});
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  get selection() { return this._selection; }
  set selection(range) { return this._selection.range = range; }

  get cursorPosition() { return this.selection.lead; }
  set cursorPosition(p) { this.selection.range = {start: p, end: p}; }

  selectAll() {
    this.selection.selectAll();
    return this.selection;
  }

  selectLine(row) {
    this.selection.selectLine(row);
    return this.selection;
  }

  selectionOrLineString() {
    var {text, start} = this.selection;
    return text ? text : this.getLine(start.row);
  }

  scrollCursorIntoView() {
    this.scrollPositionIntoView(this.cursorPosition);
  }

  scrollPositionIntoView(pos, offset = pt(0,0)) {
    if (!this.isClip()) return;
    var { scroll, padding } = this,
        paddedBounds = this.innerBounds().insetByRect(padding).translatedBy(scroll),
        charBounds =   this.charBoundsFromTextPosition(pos),
        delta = charBounds.topLeft().subPt(paddedBounds.translateForInclusion(charBounds).topLeft());
    this.scroll = this.scroll.addPt(delta).addPt(offset);
  }

  alignRow(row, how = "center") {
    // how = "center", "bottom", "top";
    if (!this.isClip()) return;
    var { scroll, padding } = this,
        paddedBounds = this.innerBounds().insetByRect(padding).translatedBy(scroll),
        charBounds =   this.charBoundsFromTextPosition({row, column: 0}),
        deltaY = how === "top" || how === "bottom" ?
          paddedBounds[how]() - charBounds[how]() :
          how === "center" ?
            paddedBounds[how]().y - charBounds[how]().y : 0;
    if (deltaY)
      this.scroll = this.scroll.addXY(0, -deltaY)
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // text layout related

  fit() {
    let {fixedWidth, fixedHeight} = this;
    if ((fixedHeight && fixedWidth) || !this.renderer/*not init'ed yet*/) return;
    let textBounds = this.textBounds(),
        padding = this.padding;
    if (!fixedHeight) this.height = textBounds.height + padding.top() + padding.bottom();
    if (!fixedWidth) this.width = textBounds.width + padding.left() + padding.right();
  }

  fitIfNeeded() {
    if (this._needsFit) { this.fit(); this._needsFit = false; }
  }

  textPositionFromPoint(point) {
    return this.renderer.textPositionFor(this, point);
  }

  charBoundsFromTextPosition(pos) {
    return this.renderer.boundsFor(this, pos);
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
    if (!evt.leftMouseButtonPressed()) return;
    var {clickedOnMorph, clickedOnPosition} = evt.state;
    if (clickedOnMorph !== this || !this.selectable) return;

    var start = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(clickedOnPosition))),
        end = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(evt.position)))

// console.log("%s => %s\n%s => %s",
//   this.localize(clickedOnPosition), JSON.stringify(start),
//   this.localize(evt.position), JSON.stringify(end));

    var from =this.selection.toString();
    this.selection.range = {start, end};

// show(`[mouse selection] ${from} -> ${this.selection}`)
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // keyboard events

  get keyhandlers() {
    return [KeyHandler.withDefaultBindings()].concat(this._keyhandlers)
  }

  simulateKeys(keyString) {
    simulateKeys(this, keyString);
  }

  onKeyUp(evt) {
    switch (evt.keyCombo) {
      case 'Command-D': case 'Command-P': evt.stop(); break;
    }
  }

  onKeyDown(evt) {
    if (invokeKeyHandlers(this, evt, true/*no input evts*/)) {
      this.selection.cursorBlinkStart();
      this.scrollCursorIntoView();
    }
  }

  onTextInput(evt) {
    if (invokeKeyHandlers(this, evt, false/*no input evts*/)) {
      this.selection.cursorBlinkStart();
      this.scrollCursorIntoView();
    }
  }

  invokeKeyHandlers(evt, noInputEvents = false) {
    return invokeKeyHandlers(this, evt, noInputEvents);
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
    sel.collapseToEnd();
  }

  onFocus(evt) {
    this.makeDirty();
    this.selection.cursorBlinkStart();
  }
  onBlur(evt) {
    this.makeDirty();
    this.selection.cursorBlinkStop();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging

  inspect() {
    return `<${this.name}>`
         + `\n  ${this.selection}`
         + "\n  " + this.renderer.lines.map(({height, width, text}, i) => {
              return `[${i}] ${width.toFixed(0)}x${height.toFixed(0)} ${obj.inspect(text)}`
            }).join("\n  ")
         + `\n</${this.name}>`;
  }

}
