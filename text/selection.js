import { lessPosition, eqPosition } from "./position.js"
import { string } from "lively.lang";
import config from "../config.js";

export class Range {

  static fromPositions(start, end) { return new this({start, end}); }

  static isValidLiteral(rangeSpec) {
    if (!rangeSpec) return false;
    if (rangeSpec.isRange) return true;
    return rangeSpec.start && rangeSpec.end
        && typeof rangeSpec.start.row === "number"
        && typeof rangeSpec.start.column === "number"
        && typeof rangeSpec.end.row === "number"
        && typeof rangeSpec.end.column === "number";
  }

  constructor(range = {start: {row: 0, column: 0}, end: {row: 0, column: 0}}) {
    var {start, end} = range;
    if (lessPosition(end, start)) [start, end] = [end, start]; // reverse
    this.start = start;
    this.end = end;
  }

  get isRange() { return true }

  isEmpty() {
    return this.start.row === this.end.row
        && this.start.column === this.end.column;
  }

  equals(other) {
    if (!other || !other.start || !other.end) return false;
    return eqPosition(this.start, other.start)
        && eqPosition(this.end, other.end);
  }

  copy() { return new Range(this); }

  toString() {
    let {start: {row, column}, end: {row: endRow, column: endColumn}} = this;
    return `Range(${row}/${column} -> ${endRow}/${endColumn})`;
  }

}

const defaultRange = new Range()

export class Selection {

  constructor(textMorph, range) {
    this.textMorph = textMorph;
    this._goalColumn = undefined;
    this._isReverse = false;
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
    this.textMorph && this.textMorph.makeDirty && this.textMorph.makeDirty();
    this._goalColumn = this.lead.column;

    // console.log(`selection changed: ${this}`);
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

  set text(val) {
    let {range, textMorph} = this;
    if (!this.isEmpty())
      textMorph.deleteText(range);

    this.range = val.length ?
      textMorph.insertText(val, range.start) :
      {start: range.start, end: range.start}
  }

  reverse() { this._isReverse = !this.isEmpty() && !this._isReverse; return this; }
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

  selectLine(row) {
    if (typeof row !== "number") row = this.lead.row;
    this.range = {start: {row, column: 0}, end: {row, column: this.textMorph.getLine(row).length}};
    return this;
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
  }
  goDown(n = 1) { this.goUp(-n); }

  goLeft(n = 1) {
    this.isEmpty() && this.growLeft(n);
    this.collapse();
  }

  goRight(n = 1) {
    this.isEmpty() && this.growRight(n);
    this.collapseToEnd();
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

  toString() {
    let {row, column} = this.anchor,
        {row: endRow, column: endColumn} = this.lead;
    // return `Selection(${row}/${column} -> ${endRow}/${endColumn}, ${string.truncate(text.replace(/\n/g, ""), 30)})`;
    return `Selection(${row}/${column} -> ${endRow}/${endColumn})`;
  }
}
