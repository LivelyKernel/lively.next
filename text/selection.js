import { lessPosition, eqPosition, minPosition, maxPosition } from "./position.js"
import { Range, defaultRange } from "./range.js";
import { StyleRange } from "./style.js";
import config from "../config.js";
import { signal } from "lively.bindings";

var newline = "\n";


export class Selection {

  constructor(textMorph, range) {
    this.textMorph = textMorph;
    this._goalColumn = undefined;
    this._isReverse = false;

    this.startAnchor = textMorph.addAnchor("selection-start");
    this.endAnchor = textMorph.addAnchor("selection-end");

    this.range = Range.isValidLiteral(range) ? range : defaultRange;
    this._cursorVisible = true;
    this.cursorBlinkProcess = null;
  }

  get range() { return this._range; }
  set range(range) {
    if (!range) return;
    let {start, end} = range;
    if (start === undefined || end === undefined) return;

    var d = this.textMorph.document;
    if (typeof start === "number") range.start = start = d.indexToPosition(start);
    if (typeof end === "number") range.end = end = d.indexToPosition(end);
    if (!Range.isValidLiteral(range)) return;

    start = d.clipPositionToLines(start);
    end = d.clipPositionToLines(end);

    var isReverse = this._isReverse = lessPosition(end, start);
    if (isReverse) [start, end] = [end, start];

    range.start = start;
    range.end = end;
    if (!range.isRange) range = new Range(range);

    if (range.equals(this._range)) return;

    this._range = range;
    this._goalColumn = this.lead.column;

    this.startAnchor.position = range.start;
    this.endAnchor.position = range.end;

    this.textMorph.makeDirty();
    signal(this.textMorph, "selectionChange");
  }

  updateFromAnchors() {
    this.range = {start: this.startAnchor.position, end: this.endAnchor.position};
  }

  get start() { return this.range.start; }
  set start(val) { this.range = Range.fromPositions(val, this.end); }

  get end() { return this.range.end }
  set end(val) { this.range = Range.fromPositions(this.start, val); }

  get anchor() { return this.isReverse() ? this.range.end : this.range.start }
  set anchor(pos) {
    this.range = {start: pos, end: this.lead};
  }
  get lead() { return this.isReverse() ? this.range.start : this.range.end }
  set lead(pos) {
    this.range = {start: this.anchor, end: pos}
  }

  get text() { return this.textMorph.document.textInRange(this.range); }

  get selectedRows() {
    return {first: this.start.row, last: this.end.row}
  }

  set text(val) {
    let {range, textMorph} = this,
        reversed = this.isReverse();
    this.range = textMorph.replace(range, val);
    if (reversed) this.reverse();
  }

  reverse() { this._isReverse = !this.isEmpty() && !this._isReverse; return this; }
  isReverse() { return this._isReverse && !this.isEmpty(); }
  isEmpty() { return this.range.isEmpty(); }

  collapse(pos = this.start) { this.range = {start: pos, end: pos}; return this; }
  collapseToEnd() { this.collapse(this.end); return this; }

  growLeft(n) {
    let {textMorph: {document: d}} = this,
        endIndex = d.positionToIndex(this.end),
        startIndex = Math.min(endIndex, d.positionToIndex(this.start) - n),
        r = this.isReverse();
    this.start = d.indexToPosition(startIndex);
    this._isReverse = r;
    return this;
  }

  growRight(n) {
    let {textMorph: {document: d}} = this,
        startIndex = d.positionToIndex(this.start),
        endIndex = Math.max(startIndex, d.positionToIndex(this.end) + n),
        r = this.isReverse();
    this.end = d.indexToPosition(endIndex);
    this._isReverse = r;
    return this;
  }

  selectAll() {
    this.range = {start: {row: 0, column: 0}, end: this.textMorph.document.endPosition};
    return this;
  }

  selectLine(row = this.lead.row) {
    this.range = {start: {row, column: 0}, end: {row, column: this.textMorph.getLine(row).length}};
    return this;
  }

  gotoLineEnd(row = this.lead.row) {
    var pos = {row, column: this.textMorph.getLine(row).length};
    this.range = {start: pos, end: pos};
  }

  selectLeft(n = 1) {
    if (this.isEmpty()) { this.growLeft(n); this.reverse(); }
    else this.isReverse() ? this.growLeft(n) : this.growRight(-n);
    return this;
  }
  selectRight(n = 1) { this.isReverse() ? this.growLeft(-n) : this.growRight(n); return this; }
  selectUp(n = 1) {
    var goalColumn = this._goalColumn;
    this.lead = {row: this.lead.row-n, column: goalColumn};
    this._goalColumn = goalColumn;
    return this;
  }
  selectDown(n = 1) { return this.selectUp(-n); }

  goUp(n = 1) {
    var goalColumn = this._goalColumn;
    this.lead = {row: this.lead.row-n, column: goalColumn};
    this.anchor = this.lead;
    this._goalColumn = goalColumn;
    return this;
  }
  goDown(n = 1) { return this.goUp(-n); }

  goLeft(n = 1) {
    this.isEmpty() && this.growLeft(n);
    this.collapse();
    return this;
  }

  goRight(n = 1) {
    this.isEmpty() && this.growRight(n);
    this.collapseToEnd();
    return this;
  }

  get cursorVisible() {
    return this._cursorVisible
        && this.textMorph.isFocused()
        && !this.textMorph.rejectsInput()
  }

  cursorBlinkStart() {
    this.cursorBlinkStop();
    let timeout = config.text.cursorBlinkPeriod;
    if (timeout)
      this.cursorBlinkProcess = setInterval(() => {
        this._cursorVisible = !this._cursorVisible;
        this.textMorph.makeDirty();
      }, timeout*1000);
  }

  cursorBlinkStop() {
    if (this.cursorBlinkProcess)
      clearInterval(this.cursorBlinkProcess);
    this.cursorBlinkProcess = null;
    this._cursorVisible = true;
  }

  set style(style) {
    let {textMorph} = this,
        styleRange = new StyleRange(style, this);
    this.textMorph.addStyleRange(styleRange);
  }

  getStyleRanges() {
    let {styleRanges} = this.textMorph.document,
        result = [];
    styleRanges.map(ea => {
      let intersection = this.range.intersect(ea);
      if (!intersection.isEmpty()) {
        let styleRange = new StyleRange(ea.style, intersection);
        result.push(styleRange);
      }
    });
    return result;
  }

  toString() {
    let {row, column} = this.anchor,
        {row: endRow, column: endColumn} = this.lead;
    return `Selection(${row}/${column} -> ${endRow}/${endColumn})`;
  }
}
