/*global System*/
import config from "../config.js";
import { string, obj, arr, fun, promise } from "lively.lang";
import { Rectangle, Color, pt } from "lively.graphics";
import { Morph, show } from "../index.js";
import { Selection, MultiSelection } from "./selection.js";
import { Range } from "./range.js";
import { TextAttribute } from "./style.js";
import TextLayout from "./layout.js";
import TextDocument from "./document.js";
import KeyHandler from "../events/KeyHandler.js";
import { UndoManager } from "../undo.js";
import { Anchor } from "./anchors.js";
import { TextSearcher } from "./search.js";
import { signal } from "lively.bindings"; // for makeInputLine
import commands from "./commands.js";
import { renderMorph } from "./rendering.js"

export class Text extends Morph {

  static makeLabel(string, props) {
    return new Text({
      textString: string,
      fontFamily: "Helvetica Neue, Arial, sans-serif",
      fontColor: Color.black,
      fontSize: 11,
      readOnly: true,
      ...props
    });
  }

  static makeInputLine(props) {
    var t = new Text({type: "text", extent: pt(100, 20), clipMode: "auto", ...props});
    t.height = t.defaultLineHeight;
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
    var {
      fontMetric, textString, selectable, selection, clipMode, textAttributes,
      fontFamily, fontSize, fontColor, fontWeight, fontStyle, textDecoration, fixedCharacterSpacing
    } = props;
    props = obj.dissoc(props, [
      "textString","fontMetric", "selectable", "selection", "clipMode", "textAttributes",
      // default style attrs: need document to be installed first
      "fontFamily", "fontSize", "fontColor", "fontWeight", "fontStyle", "textDecoration", "fixedCharacterSpacing"
    ]);
    super({
      readOnly: false,
      draggable: false,
      fixedWidth: false, fixedHeight: false,
      padding: 0,
      useSoftTabs: config.text.useSoftTabs || true,
      tabWidth: config.text.tabWidth || 2,
      savedMarks: [],
      ...props
    });
    this.textLayout = new TextLayout(fontMetric || this.env.fontMetric);
    this.changeDocument(TextDocument.fromString(textString || ""), true);
    this.undoManager = new UndoManager();
    this._selection = selection ? new (config.text.useMultiSelect ? MultiSelection : Selection)(this, selection) : null;
    this._anchors = null;
    this._markers = null;
    this.selectable = typeof selectable !== "undefined" ? selectable : true;
    if (clipMode) this.clipMode = clipMode;
    
    this.fontFamily = fontFamily || "Sans-Serif";
    this.fontSize = fontSize || 12;
    this.fontColor = fontColor || Color.black;
    this.fontWeight = fontWeight || "normal";
    this.fontStyle = fontStyle || "normal";
    this.textDecoration = textDecoration || "none";
    this.fixedCharacterSpacing = fixedCharacterSpacing || false;

    if (textAttributes) textAttributes.map(range => this.addTextAttribute(range));
    this.fit();
    this._needsFit = false;
  }

  get isText() { return true }

  onChange(change) {
    var textChange = change.selector === "insertText"
                  || change.selector === "deleteText";
    if (textChange
     || change.prop === "fixedWidth"
     || change.prop === "fixedHeight"
     || change.prop === "fontFamily"
     || change.prop === "fontSize"
     || change.prop === "fontColor" // FIXME
     || change.prop === "fontWeight"
     || change.prop === "fontStyle"
     || change.prop === "textDecoration"
     || change.prop === "fixedCharacterSpacing")
       this.textLayout && (this.textLayout.layoutComputed = false);

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
  set fontFamily(fontFamily) {
    this.addValueChange("fontFamily", fontFamily);
    this.setDefaultStyle({fontFamily});
  }

  get fontSize() { return this.getProperty("fontSize") }
  set fontSize(fontSize) {
    this.addValueChange("fontSize", fontSize);
    this.setDefaultStyle({fontSize});
  }

  get fontColor() { return this.getProperty("fontColor") }
  set fontColor(fontColor) {
    this.addValueChange("fontColor", fontColor);
    this.setDefaultStyle({fontColor});
  }

  get fontWeight() { return this.getProperty("fontWeight") }
  set fontWeight(fontWeight) {
    this.addValueChange("fontWeight", fontWeight);
    this.setDefaultStyle({fontWeight});
  }

  get fontStyle() { return this.getProperty("fontStyle") }
  set fontStyle(fontStyle) {
    this.addValueChange("fontStyle", fontStyle);
    this.setDefaultStyle({fontStyle});
  }

  get textDecoration() { return this.getProperty("textDecoration") }
  set textDecoration(textDecoration) {
    this.addValueChange("textDecoration", textDecoration);
    this.setDefaultStyle({textDecoration});
  }

  get fixedCharacterSpacing() { return this.getProperty("fixedCharacterSpacing") }
  set fixedCharacterSpacing(fixedCharacterSpacing) {
    this.addValueChange("fixedCharacterSpacing", fixedCharacterSpacing);
    this.setDefaultStyle({fixedCharacterSpacing});
  }

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
  // markers, text ranges with styles that are rendered
  get markers() { return this._markers; }
  addMarker(marker) {
    // id, range, style
    if (!this._markers) this._markers = [];
    this.removeMarker(marker.id);
    this._markers.push(marker);
    this.makeDirty();
    return marker;
  }
  removeMarker(marker) {
    if (!this._markers) return;
    var id = typeof marker === "string" ? marker : marker.id;
    this._markers = this.markers.filter(ea => ea.id !== id);
    this.makeDirty();
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
    return this.textLayout ? this.textLayout.textBounds(this) : new Rectangle(0,0,0,0);
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

  get commands() { return (this._commands || []).concat(commands); }
  

  execCommand(commandOrName, args, count, evt) {
    var {name, command} = this.lookupCommand(commandOrName);
    if (!command) return undefined;

    var multiSelect = this.inMultiSelectMode(),
        multiSelectAction = command.hasOwnProperty("multiSelectAction") ?
          command.multiSelectAction : "forEach";

    // first we deal with multi select, if the command doesn't handle it
    // itsself. From inside here we just set the selection to each range in the
    // multi selection and then let the comand run normally
    if (multiSelect && multiSelectAction === "forEach") {
      var origSelection = this._selection,
          selections = this.selection.selections.slice().reverse();
      this._selection = selections[0];
      this._multiSelection = origSelection;

      try {
        var result = this.execCommand(commandOrName, args, count, evt);
      } catch(err) {
        this._selection = origSelection;
        this._multiSelection = null;
        this.selection.mergeSelections();
        throw err;
      }

      if (!result) return result;
      var results = [result];

      if (typeof result.then === "function" && typeof result.catch === "function") {
        return promise.finally(promise.chain([() => result].concat(
            selections.slice(1).map(sel => () => {
              this._selection = sel;
              return Promise.resolve(this.execCommand(commandOrName, args, count, evt))
                .then(result => results.push(result))
            }))).then(() => results),
            () => { this._selection = origSelection; this._multiSelection = null; this.selection.mergeSelections(); });

      } else {
        try {
          for (var sel of selections.slice(1)) {
            this._selection = sel;
            results.push(this.execCommand(commandOrName, args, count, evt))
          }
        } finally { this._selection = origSelection; this._multiSelection = null; this.selection.mergeSelections(); }
        return results;
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Here we know that we don't have to deal with multi select and directly
    // call the command handler

    var result = this.commandHandler.exec(commandOrName, this, args, count, evt);

    if (result) {
      if (typeof result.then === "function" && typeof result.catch === "function")
        result.then(() => cleanupScroll(this))
      else
        cleanupScroll(this);
    }

    return result;

    function cleanupScroll(morph) {
      var scrollCursorIntoView = command.hasOwnProperty("scrollCursorIntoView") ?
        command.scrollCursorIntoView : true;
      if (scrollCursorIntoView)
        fun.throttleNamed("execCommand-scrollCursorIntoView-" + morph.id, 100, () => morph.scrollCursorIntoView())();
    }

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // document changes

  changeDocument(doc, resetStyle = false) {
    this.document = doc;
    this.textLayout.reset();
    if (resetStyle)
      this.setDefaultStyle();
    this.makeDirty();
  }

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

  insertTextWithTextAttributes(text, attributes = [], pos) {
    if (!Array.isArray(attributes)) attributes = [attributes];
    var range = this.insertText(text, pos);
    attributes.forEach(attr => {
      if (!attr.isTextAttribute) attr = new TextAttribute(attr);
      attr.range = range;
      this.addTextAttribute(attr);
    });
    return range;
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
    this.textLayout.shiftLinesIfNeeded(this, range, "insertText");

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
      // When auto multi select commands run, we replace the actual selection
      // with individual normal selections
      if (this._multiSelection) this._multiSelection.updateFromAnchors();
      else if (this._selection) this.selection.updateFromAnchors();
    });

    this.undoManager.undoStop();

    return new Range(range);
  }

  deleteText(range) {
    range = range.isRange ? range : new Range(range);

    if (range.isEmpty()) return;

    this.undoManager.undoStart(this, "deleteText");
    var {document: doc, textLayout} = this,
        text = doc.textInRange(range);
    doc.remove(range);
    textLayout.shiftLinesIfNeeded(this, range, "deleteText");
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
    }, () => {
      this._anchors && this.anchors.forEach(ea => ea.onDelete(range));
      // When auto multi select commands run, we replace the actual selection
      // with individual normal selections
      if (this._multiSelection) this._multiSelection.updateFromAnchors();
      else if (this._selection) this.selection.updateFromAnchors();
    });
    this.undoManager.undoStop();
    return text;
  }

  replace(range, text, undoGroup = false) {
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

  joinLine(row = this.cursorPosition.row) {
    // joins line identified by row with following line
    // returns the position inside the joined line where the join happened
    var firstLine = this.getLine(row),
        otherLine = this.getLine(row+1),
        joined = firstLine + otherLine.replace(/^\s+/, "") + this.document.constructor.newline;
    this.replace({start: {column: 0, row}, end: {column: 0, row: row+2}}, joined, true);
    return {row, column: firstLine.length};
  }

  get whatsVisible() {
    var startRow = this.textLayout.firstVisibleLine,
        endRow = this.textLayout.lastVisibleLine,
        lines = this.document.lines;
    return {
      lines: startRow === undefined || endRow === undefined ?
              lines : lines.slice(startRow, endRow),
      startRow, endRow
    }
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // TextAttributes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get styleProps() {
    return obj.select(this, [
      "fontFamily", "fontSize", "fontColor", "fontWeight",
      "fontStyle", "textDecoration", "fixedCharacterSpacing"]);
  }

  get textAttributes() { return this.document.textAttributes; }
  set textAttributes(attrs) {
    this.document.textAttributes = attrs;
    this._needsFit = true; 
    this.textLayout && (this.textLayout.layoutComputed = false);
    this.makeDirty();
  }

  setSortedTextAttributes(attrs) {
    // see comment in document
    this.document.setSortedTextAttributes(attrs);
    this._needsFit = true; 
    this.textLayout && (this.textLayout.layoutComputed = false);
    this.makeDirty();
  }

  addTextAttribute(range) {
    this.document.addTextAttribute(range);
    this._needsFit = true; 
    this.textLayout && (this.textLayout.layoutComputed = false);
    this.makeDirty();
  }

  removeTextAttribute(attr) {
    this.document.removeTextAttribute(attr);
    this._needsFit = true; 
    this.textLayout && (this.textLayout.layoutComputed = false);
    this.makeDirty();
  }

  setDefaultStyle(style = this.styleProps) {
    var attr = this.textAttributes.find(ea =>
      ea.start.row < 0 || ea.start.row === 0 && ea.start.column < 0);
    if (attr) {
      Object.assign(attr.data, style);
      this._needsFit = true; 
      this.textLayout && (this.textLayout.layoutComputed = false);
      this.makeDirty();
    } else {
      this.addTextAttribute(
        TextAttribute.fromPositions(
          style, { row: 0, column: -1 },
          this.documentEndPosition));
    }
  }

  resetTextAttributes() {
    this.document.resetTextAttributes();
    this.setDefaultStyle();
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  inMultiSelectMode() {
    return this.selection.selections && this.selection.selections.length > 1;
  }

  get selection() { return this._selection || (this._selection = new (config.text.useMultiSelect ? MultiSelection : Selection)(this)); }
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

  selectLine(row = this.cursorPosition.row, includingLineEnd = false) {
    this.selection.selectLine(row, includingLineEnd);
    return this.selection;
  }

  selectionOrLineString() {
    var {text, start} = this.selection;
    return text ? text : this.getLine(start.row);
  }

  scrollCursorIntoView() {
    this.scrollPositionIntoView(this.cursorPosition);
  }

  centerRow(row = this.cursorPosition.row, offset = pt(0,0)) {
    var charBounds = this.charBoundsFromTextPosition({row, column: 0}),
        pos = charBounds.leftCenter();
    this.scroll = pos.addXY(0, -this.height/2).addPt(offset);
  }

  scrollPositionIntoView(pos, offset = pt(0,0)) {
    if (!this.isClip()) return;
    var { scroll, padding } = this,
        paddedBounds = this.innerBounds().insetByRect(padding).translatedBy(scroll),
        charBounds =   this.charBoundsFromTextPosition(pos),
        delta = charBounds.topLeft().subPt(paddedBounds.translateForInclusion(charBounds).topLeft());
    this.scroll = this.scroll.addPt(delta).addPt(offset);
  }

  keepPosAtSameScrollOffsetWhile(doFn, pos = this.cursorPosition) {
    // doFn has some effect on the text that might change the scrolled
    // position, like changing the font size. This function ensures that the
    // text position given will be at the same scroll offset after running the doFn
    var {scroll, selection: {lead: pos}} = this,
        offset = this.charBoundsFromTextPosition(pos).y - scroll.y;
    try { doFn(); } finally {
      this.scroll = this.scroll.withY(this.charBoundsFromTextPosition(pos).y - offset);
    }
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
    if ((fixedHeight && fixedWidth) || !this.textLayout/*not init'ed yet*/) return;
    let paddedTextBounds = this.paddedTextBounds();
    if (!fixedHeight) this.height = paddedTextBounds.height;
    if (!fixedWidth) this.width = paddedTextBounds.width;
  }

  fitIfNeeded() {
    if (this._needsFit) { this.fit(); this._needsFit = false; }
  }

  get defaultLineHeight() {
    var p = this.padding;
    return p.top() + p.bottom() + this.textLayout.fontMetric.defaultLineHeight({fontSize: this.fontSize, fontFamily: this.fontFamily})
  }

  textPositionFromPoint(point) {
    return this.textLayout.textPositionFor(this, point);
  }

  charBoundsFromTextPosition(pos) {
    return this.textLayout.boundsFor(this, pos);
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

  render(renderer) { return renderMorph(renderer, this); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // mouse events

  onMouseDown(evt) {
    this.activeMark && (this.activeMark = null);
    var {position, state: {clickedOnMorph, clickedOnPosition, clickCount}} = evt;

    if (clickedOnMorph !== this) return;
    var maxClicks = 3, normedClickCount = ((clickCount - 1) % maxClicks) + 1;

    if (evt.isShiftDown() && this.selectable) {
      this.selection.lead = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(position)));
      return true;
    }

    if (normedClickCount === 1) return this.onMouseMove(evt);

    if (normedClickCount === 2) return this.execCommand("select word", null, 1, evt);

    if (normedClickCount === 3) return this.execCommand("select line", null, 1, evt);
  }

  onMouseMove(evt) {
    if (!evt.leftMouseButtonPressed()) return;
    var {clickedOnMorph, clickedOnPosition} = evt.state;
    if (clickedOnMorph !== this || !this.selectable) return;

    var textPosClicked = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(evt.position)));

    this.selection.lead = textPosClicked;
    if (!evt.isShiftDown()) {
      var start = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(clickedOnPosition)));
      this.selection.anchor = start;
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // keyboard events

  get keybindings() { return super.keybindings.concat(config.text.defaultKeyBindings); }
  set keybindings(x) { super.keybindings = x }
  get keyhandlers() { return super.keyhandlers.concat(this._keyhandlers || []); }

  onKeyDown(evt) {
    this.selection.cursorBlinkStart();
    KeyHandler.invokeKeyHandlers(this, evt, true/*no input evts*/);
  }

  onTextInput(evt) {
    KeyHandler.invokeKeyHandlers(this, evt, false/*allow input evts*/);
  }

  doSave() { /*...*/ }

  onCut(evt) {
    if (this.rejectsInput() || !this.isFocused()) return;
    this.onCopy(evt, !this.rejectsInput())
  }

  onCopy(evt, deleteCopiedText = false) {
    if (!this.isFocused()) return;
    evt.stop();
    var sel = this.selection;
    evt.domEvt.clipboardData.setData("text", sel.text);
    this.execCommand("manual clipboard copy", {delete: deleteCopiedText, dontTryNativeClipboard: true})
  }

  onPaste(evt) {
    if (this.rejectsInput()) return;
    evt.stop();
    var data = evt.domEvt.clipboardData.getData("text");
    this.undoManager.group();
    var sel = this.selection,
        sels = sel.isMultiSelection ? sel.selections : [sel];
    sels.forEach(sel => {
      sel.text = data;
      this.saveMark(sel.start);
      sel.collapseToEnd();
    });
    this.undoManager.group();
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
        pos = this.textLayout.pixelPositionFor(this, this.cursorPosition).addPt(offset),
        textPos = this.textPositionFromPoint(pos);
    if (!opts || !opts.select) this.cursorPosition = textPos;
    else this.selection.lead = textPos;
  }

  gotoDocumentStart(opts = {select: false}) {
    this.selection.lead = {row: 0, column: 0};
    if (!opts || !opts.select) this.selection.anchor = this.selection.lead;
  }

  gotoDocumentEnd(opts = {select: false}) {
    this.selection.lead = this.documentEndPosition;
    if (!opts || !opts.select) this.selection.anchor = this.selection.lead;
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

  astNodeRange(node) {
    // node is expected to be in mozilla AST format, ie {type, start: INDEX, end: INDEX}
    return {
      start: this.document.indexToPosition(node.start),
      end: this.document.indexToPosition(node.end)
    };
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

  searchForAll(needle, options = {caseSensitive: false}) {
    return new TextSearcher(this).searchForAll({needle, ...options});
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
    return `Text("${this.name}" <${this.selection}>)`
  }

}
