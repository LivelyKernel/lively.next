/*global System*/
import config from "../config.js";
import { string, obj, arr } from "lively.lang";
import { Rectangle, Color, pt } from "lively.graphics";
import { Morph, show } from "../index.js";
import { Selection } from "./selection.js";
import { Range } from "./range.js";
import DocumentRenderer from "./rendering.js";
import TextDocument from "./document.js";
import KeyHandler from "../events/KeyHandler.js";
import { ClickHandler } from "../events/clickhandler.js";
import { UndoManager } from "../undo.js";
import { Anchor } from "./anchors.js";
import { TextSearcher } from "./search.js";
import { signal } from "lively.bindings"; // for makeInputLine
import commands from "./commands.js";

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
    t.onChange = function(change) {
      if (change.selector === 'insertText' || change.selector === 'deleteText')
        signal(this, "inputChanged", this.textString);
      return this.constructor.prototype.onChange.call(this, change);
    }
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
      styleRanges: [{range: new Range({start: {row: 0, column: 0}, end: {row: 0, column: 1}}), style: {fontColor: Color.red}}],
      useSoftTabs: config.text.useSoftTabs || true,
      tabWidth: config.text.tabWidth || 2,
      savedMarks: [],
      ...props
    });
    this.document = new TextDocument();
    this.renderer = new DocumentRenderer(fontMetric || this.env.fontMetric);
    this.undoManager = new UndoManager();
    this.clickhandler = ClickHandler.withDefaultBindings(),
    this._selection = selection ? new Selection(this, selection) : null;
    this.selectable = typeof selectable !== "undefined" ? selectable : true;
    this.textString = textString || "";
    if (clipMode) this.clipMode = clipMode;
    this.fit();
    this._needsFit = false;
  }

  get isText() { return true }

  onChange(change) {
    var textChange = change.selector === "insertText"
                  || change.selector === "deleteText";
    if (textChange
     || change.prop === "fontFamily"
     || change.prop === "fontSize"
     || change.prop === "fontColor" // FIXME
     || change.prop === "fixedWidth"
     || change.prop === "fixedHeight"
     || change.prop === "fontKerning")
       this.renderer && (this.renderer.layoutComputed = false);

    super.onChange(change);
    textChange && signal(this, "textChange");
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // anchors – positions in text that move when text is changed
  get anchors() { return this._anchors || (this._anchors = []); }
  addAnchor(anchor) {
    if (!anchor) return;
    if (typeof anchor === "string") {
      anchor = {id: anchor, row: 0, column: 0};
    }

    if (!anchor.isAnchor) {
      let {id, column, row} = anchor;
      anchor = new Anchor(id, row || column ? {row, column} : undefined, anchor.insertBehavior || "move");
    }

    var existing = anchor.id && this.anchors.find(ea => ea.id === anchor.id);
    if (existing) {
      return Object.assign(existing, anchor);
    }

    this.anchors.push(anchor);
    return anchor;
  }
  removeAnchor(anchor) {
    this._anchors = this.anchors.filter(
      typeof anchor === "string" ?
        ea => ea.id !== anchor :
        ea => ea !== anchor);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // marks: text position that are saved and can be retrieved
  // the activeMark affects movement commands: when it's active movement will
  // select
  get savedMarks() { return this.getProperty("savedMarks") || []; }
  set savedMarks(val) {
    var savedMarks = this.savedMarks;
    val = val.map(ea => ea.isAnchor ? ea : this.addAnchor({...ea, id: "saved-mark-" + string.newUUID()}));
    var toRemove = this.savedMarks.filter(ea => !val.includes(ea))
    if (val > config.text.markStackSize)
      toRemove.push(...val.splice(0, val.length - config.text.markStackSize));
    toRemove.map(ea => this.removeAnchor(ea));
    return this.addValueChange("savedMarks", val);
  }

  get activeMark() { return this.getProperty("activeMark"); }
  get activeMarkPosition() { var m = this.activeMark; return m ? m.position : null; }
  set activeMark(val) {
    if (val) val = this.addAnchor(val.isAnchor ? val : {...val, id: "saved-mark-" + string.newUUID()});
    else {
      var m = this.activeMark;
      if (!this.savedMarks.includes(m))
        this.removeAnchor(m);
    }
    this.addValueChange("activeMark", val);
  }

  saveMark(p = this.cursorPosition, activate) {
    var prevMark = this.activeMark;
    if (prevMark && prevMark !== p && !prevMark.equalsPosition(p))
      this.savedMarks = this.savedMarks.concat(prevMark);
    if (activate) this.activeMark = p;
    else this.savedMarks = this.savedMarks.concat(p);
  }

  saveActiveMarkAndDeactivate() {
    var m = this.activeMark;
    if (m) {
      this.saveMark(m);
      this.activeMark = null;
    }
  }

  popSavedMark() {
    var mark = this.activeMark;
    if (mark) { this.activeMark = null; return mark; }
    var last = arr.last(this.savedMarks);
    this.savedMarks = this.savedMarks.slice(0, -1);
    return last;
  }

  get lastSavedMark() { return this.activeMark || arr.last(this.savedMarks); }

  savedMarkForSelection(replacement) {
    // find the mark in $emacsMarkRing corresponding to the current
    // selection
    var {selection: sel, savedMarks} = this,
        multiRangeLength = this.multiSelect ?
            this.multiSelect.getAllRanges().length : 1,
        selIndex = sel.index || 0,
        markIndex = savedMarks.length - (multiRangeLength - selIndex),
        lastMark = savedMarks[markIndex] || sel.anchor;
    if (replacement && "row" in replacement && "column" in replacement) {
      this.savedMarks = savedMarks.slice(0, markIndex)
                          .concat(replacement)
                          .concat(savedMarks.slice(markIndex+1))
    }
    return lastMark;
  }

  get clipMode()  { return this.getProperty("clipMode"); }
  set clipMode(value)  {
    this.addValueChange("clipMode", value);
    this.fixedWidth = this.fixedHeight = this.isClip();
  }

  textBounds() {
    return this.renderer ? this.renderer.textBounds(this) : new Rectangle(0,0,0,0);
  }
  paddedTextBounds() {
    let textBounds = this.textBounds(),
        { padding } = this;
    return new Rectangle(textBounds.x - padding.left(),
                         textBounds.y - padding.top(),
                         textBounds.width + padding.left() + padding.right(),
                         textBounds.height + padding.top() + padding.bottom());
  }
  get scrollExtent() {
    return this.paddedTextBounds().extent().maxPt(super.scrollExtent);
  }

  get useSoftTabs()  { return this.getProperty("useSoftTabs"); }
  set useSoftTabs(value)  { this.addValueChange("useSoftTabs", value); }
  get tabWidth()  { return this.getProperty("tabWidth"); }
  set tabWidth(value)  { this.addValueChange("tabWidth", value); }
  get tab() { return this.useSoftTabs ? " ".repeat(this.tabWidth) : "\t"; }

  get commands() { return commands.concat(this._commands || []); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // document changes

  get textString() { return this.document ? this.document.textString : "" }
  set textString(value) {
    this.deleteText({start: {column: 0, row: 0}, end: this.document.endPosition});
    this.insertText(value, {column: 0, row: 0});
  }

  textInRange(range) { return this.document.textInRange(range); }
  charRight({row, column} = this.cursorPosition) { return this.getLine(row).slice(column, column+1); }
  charLeft({row, column} = this.cursorPosition) { return this.getLine(row).slice(column-1, column); }

  getLine(row) {
    if (typeof row !== "number") this.cursorPosition.row;
    var doc = this.document;
    return doc.getLine(row);
  }
  isLineEmpty(row) { return !this.getLine(row).trim(); }

  wordsOfLine(row = this.cursorPosition.row) { return this.document.wordsOfLine(row); }
  wordAt(pos = this.cursorPosition) { return this.document.wordAt(pos); }
  wordLeft(pos = this.cursorPosition) { return this.document.wordLeft(pos); }
  wordRight(pos = this.cursorPosition) { return this.document.wordRight(pos); }

  lineRange(row = this.cursorPosition.row, ignoreLeadingWhitespace = true) {
    if (typeof row !== "number") this.cursorPosition.row;
    var line = this.getLine(row),
        range = {start: {column: 0, row}, end: {column: line.length, row}},
        leadingSpace = line.match(/^\s*/);
    if (leadingSpace[0].length && ignoreLeadingWhitespace)
      range.start.column += leadingSpace[0].length;
    return new Range(range);
  }

  insertTextAndSelect(text, pos = null) {
    text = String(text);
    if (pos) this.selection.range = this.insertText(text, pos);
    else this.selection.text = text;
  }

  insertText(text, pos = this.cursorPosition) {
    text = String(text);

    if (!text.length) return Range.fromPositions(pos, pos);

    var range = this.document.insert(text, pos);

    this.undoManager.undoStart(this, "insertText");

    this.addMethodCallChangeDoing({
      target: this,
      selector: "insertText",
      args: [text, pos],
      undo: {
        target: this,
        selector: "deleteText",
        args: [range],
      }
    }, () => {
      this._needsFit = true;
      this._anchors && this.anchors.forEach(ea => ea.onInsert(range));
      this._selection && this.selection.updateFromAnchors();
    });

    this.undoManager.undoStop();

    return new Range(range);
  }

  deleteText(range) {
    range = range.isRange ? range : new Range(range);

    if (range.isEmpty()) return;

    this.undoManager.undoStart(this, "insertText");
    var doc = this.document,
        text = doc.textInRange(range);
    doc.remove(range);
    this._needsFit = true;

    this.addMethodCallChangeDoing({
      target: this,
      selector: "deleteText",
      args: [range],
      undo: {
        target: this,
        selector: "insertText",
        args: [text, range.start],
      }
    }, () => {});

    this._anchors && this.anchors.forEach(ea => ea.onDelete(range));
    this._selection && this.selection.updateFromAnchors();

    this.undoManager.undoStop();
  }

  replace(range, text, undoGroup = true) {
    if (undoGroup) this.undoManager.group();
    this.deleteText(range);
    var range = this.insertText(text, range.start);
    if (undoGroup) this.undoManager.group();
    return range;
  }

  modifyLines(startRow, endRow, modifyFn) {
    var lines = arr.range(startRow, endRow).map(row => this.getLine(row)),
        modifiedText = lines.map(modifyFn).join("\n") + "\n";
    this.deleteText({start: {row: startRow, column: 0}, end: {row: endRow+1, column: 0}})
    this.insertText(modifiedText, {row: startRow, column: 0});
  }

  modifySelectedLines(modifyFn) {
    var range = this.selection.isEmpty() ?
      this.lineRange(undefined, false) :
      this.selection.range;
    return this.modifyLines(range.start.row, range.end.row, modifyFn);
  }

  withLinesDo(startRow, endRow, doFunc) {
    return arr.range(startRow, endRow).map(row => {
      var line = this.getLine(row),
          range = Range.create(row, 0, row, line.length);
      return doFunc(line, range);
    });
  }

  withSelectedLinesDo(doFunc) {
    var range = this.selection.isEmpty() ?
      this.lineRange(undefined, false) :
      this.selection.range;
    var {start: {row: startRow}, end: {row: endRow, column: endColumn}} = range;
    // if selection is only in the beginning of last line don't include it
    return this.withLinesDo(startRow, endColumn === 0 && endRow > startRow ? endRow-1 : endRow, doFunc);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  get selection() { return this._selection || (this._selection = new Selection(this)); }
  set selection(range) { return this.selection.range = range; }

  get cursorPosition() { return this.selection.lead; }
  set cursorPosition(p) { this.selection.range = {start: p, end: p}; }
  get documentEndPosition() { return this.document.endPosition; }

  cursorUp(n = 1) { return this.selection.goUp(n); }
  cursorDown(n = 1) { return this.selection.goDown(n); }
  cursorLeft(n = 1) { return this.selection.goLeft(n); }
  cursorRight(n = 1) { return this.selection.goRight(n); }

  collapseSelection() {
    this.selection.collapse(this.selection.lead);
    return this.selection;
  }

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
    let paddedTextBounds = this.paddedTextBounds();
    if (!fixedHeight) this.height = paddedTextBounds.height;
    if (!fixedWidth) this.width = paddedTextBounds.width;
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
    this.activeMark && (this.activeMark = null);
    this.clickhandler.handle(this, evt);
  }

  onMouseMove(evt) {
    if (!evt.leftMouseButtonPressed()) return;
    var {clickedOnMorph, clickedOnPosition} = evt.state;
    if (clickedOnMorph !== this || !this.selectable) return;

    var start = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(clickedOnPosition))),
        end = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(evt.position)))

    var from = this.selection.toString();
    this.selection.range = {start, end};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // keyboard events

  get keyhandlers() {
    return [KeyHandler.withBindings(config.text.defaultKeyBindings)].concat(this._keyhandlers || []);
  }

  onKeyDown(evt) {
    if (KeyHandler.invokeKeyHandlers(this, evt, true/*no input evts*/)) {
      this.selection.cursorBlinkStart();
      this.scrollCursorIntoView();
    }
  }

  onTextInput(evt) {
    if (KeyHandler.invokeKeyHandlers(this, evt, false/*allow input evts*/)) {
      this.selection.cursorBlinkStart();
      this.scrollCursorIntoView();
    }
  }

  doSave() { /*...*/ }

  onCut(evt) {
    if (this.rejectsInput() || !this.isFocused()) return;
    evt.stop();
    var sel = this.selection;
    this.env.eventDispatcher.killRing.add(sel.text);
    evt.domEvt.clipboardData.setData("text", sel.text);
    this.activeMark = null;
    var sel = this.selection;
    sel.text = "";
    sel.collapse();
  }

  onCopy(evt) {
    if (!this.isFocused()) return;
    evt.stop();
    var sel = this.selection;
    this.env.eventDispatcher.killRing.add(sel.text);
    evt.domEvt.clipboardData.setData("text", sel.text);
    if (!sel.isEmpty()) {
      this.activeMark = null;
      this.saveMark(sel.anchor);
      this.collapseSelection();
    }
  }

  onPaste(evt) {
    if (this.rejectsInput()) return;
    evt.stop();
    var sel = this.selection;
    sel.text = evt.domEvt.clipboardData.getData("text");
    this.saveMark(sel.start);
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
  // command helper

  pageUpOrDown(opts = {direction: "up", select: false}) {
    var {direction, select} = opts;
    this[direction === "down" ? "scrollPageDown" : "scrollPageUp"]();
    var offset = pt(0, (direction === "down" ? 1 : -1) * this.height),
        pos = this.renderer.pixelPositionFor(this, this.cursorPosition).addPt(offset),
        textPos = this.textPositionFromPoint(pos);
    if (!opts || !opts.select) this.cursorPosition = textPos;
    else this.selection.lead = textPos;
  }

  gotoStartOrEnd(opts = {direction: "start", select: false}) {
    var {direction, select} = opts || {},
        pos = direction === "start" ? {row: 0, column: 0} : this.documentEndPosition;
    this.selection.lead = pos;
    if (!select) this.selection.anchor = this.selection.lead;
    this.scrollCursorIntoView();
  }

  paragraphRangeAbove(row) {
    var startLineIsEmpty = this.isLineEmpty(row),
        rowInParagraph;
    if (startLineIsEmpty) { // we need to go above to find the paragraph start
      for (var i = row - 1; i >= 0; i--)
        if (!this.isLineEmpty(i)) { rowInParagraph = i; break; }
      if (rowInParagraph === undefined) return {start: {row, column: 0}, end: {row, column: 0}};
    } else rowInParagraph = row;
    return this.paragraphRange(rowInParagraph);
  }

  paragraphRangeBelow(row) {
    var startLineIsEmpty = this.isLineEmpty(row),
        rowInParagraph,
        endPos = this.documentEndPosition;

    if (startLineIsEmpty) { // we need to go above to find the paragraph start
      for (var i = row+1; i <= endPos.row; i++)
        if (!this.isLineEmpty(i)) { rowInParagraph = i; break; }
      if (rowInParagraph === undefined) return {start: {row, column: 0}, end: {row, column: 0}};
    } else rowInParagraph = row;

    return this.paragraphRange(rowInParagraph);
  }

  paragraphRange(row) {
    if (this.isLineEmpty(row)) return {start: {row, column: 0}, end: {row, column: 0}}

    var endPos = this.documentEndPosition,
        pragraphEnd;

    for (var i = row+1; i <= endPos.row; i++)
      if (this.isLineEmpty(i)) { pragraphEnd = {row: i-1, column: this.getLine(i-1).length}; break; }
    if (!pragraphEnd) pragraphEnd = endPos;

    var start;
    for (var i = pragraphEnd.row - 1; i >= 0; i--)
      if (this.isLineEmpty(i)) { start = {row: i+1, column: 0}; break; }
    if (!start) start = {row: 0, column: 0};

    return {start, end: pragraphEnd};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // text undo / redo

  computeTextRangeForChanges(changes) {
    if (!changes.length) return Range.at(this.cursorPosition);

    var change = changes[0],
        range = change.selector === "insertText" ?
          insertRange(change.args[0], change.args[1]) :
          change.selector === "deleteText" ?
            Range.at(change.args[0].start) :
            Range.at(this.cursorPosition);

    for (var i = 1; i < changes.length; i++) {
      var change = changes[i];
      range = change.selector === "deleteText" ?
        range.without(change.args[0]) :
        change.selector === "insertText" ?
          range.merge(insertRange(change.args[0], change.args[1])) :
          range;
    }

    return range;

    function insertRange(text, pos) {
      var lines = TextDocument.parseIntoLines(text), range;

      if (lines.length === 1)
        return Range.fromPositions(
          pos, {row: pos.row, column: pos.column+lines[0].length});

      if (lines.length > 1)
        return Range.fromPositions(
          pos, {row: pos.row+lines.length-1, column: arr.last(lines).length});

      return Range.at(pos);
    }
  }

  textUndo() {
    var undo = this.undoManager.undo();
    if (!undo) return; // no undo left
    var changes = undo.changes.slice().reverse().map(ea => ea.undo);
    this.selection = this.computeTextRangeForChanges(changes);
  }

  textRedo() {
    var redo = this.undoManager.redo();
    if (!redo) return; // nothing to redo
    var changes = redo.changes.slice();
    this.selection = this.computeTextRangeForChanges(changes);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search

  findMatchingForward(pos, side = "right", pairs = {}) {
    // searching for closing char, counting open and closing
    // side is the char we want to match "right" or "left" of pos?
    // pairs can be a JS object like {"[": "]", "<": ">"}
    var openChar = this[side === "right" ? "charRight" : "charLeft"](pos),
        closeChar = pairs[openChar];
    if (!closeChar) return null;

    var counter = side === "right" ? -1 : 0;
    return this.document.scanForward(pos, (char, pos) => {
      if (char === closeChar) {
        if (counter === 0) return side === "right" ? {row: pos.row, column: pos.column+1} : pos;
        else counter--;
      }
      else if (char === openChar) counter++;
      return null;
    });
  }

  findMatchingBackward(pos, side = "right", pairs = {}) {
    // see findMatchingForward
    var openChar = this[side === "right" ? "charRight" : "charLeft"](pos),
        closeChar = pairs[openChar];
    if (!closeChar) return null;

    var counter = side === "left" ? -1 : 0;
    return this.document.scanBackward(pos, (char, pos) => {
      if (char === closeChar) {
        if (counter === 0) return side === "right" ? {row: pos.row, column: pos.column+1} : pos;
        else counter--;
      }
      else if (char === openChar) counter++;
      return null;
    });
  }

  search(needle, options = {start: this.cursorPosition, backwards: false, caseSensitive: false}) {
    return new TextSearcher(this).search({needle, ...options});
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
    exportToJSON(options) {
      return Object.assign(super.exportToJSON(options), {
        textString: this.textString
      });
    }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging

  inspect() {
    return `<${this.name}>`
         + `\n  ${this.selection}`
         + "\n  " + this.renderer.chunks.map(({height, width, text}, i) => {
              return `[${i}] ${width.toFixed(0)}x${height.toFixed(0)} ${obj.inspect(text)}`
            }).join("\n  ")
         + `\n</${this.name}>`;
  }

}
