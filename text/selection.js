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
    this.isReverse = false;
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

show("%o %o", start, end)
    var isReverse = this.isReverse = lessPosition(end, start);
    if (isReverse) [start, end] = [end, start];

    range.start = start;
    range.end = end;
    if (!range.isRange) range = new Range(range);

    if (range.equals(this._range)) return;

    this._range = range;
    this.textMorph && this.textMorph.makeDirty && this.textMorph.makeDirty();
    // console.log(`selection changed: ${this}`);
  }

  get start() { return this.range.start; }
  set start(val) { this.range = {start: val, end: this.end}; }

  get end() { return this.range.end }
  set end(val) { this.range = {start: this.start, end: val}; }

  get anchor() { return this.isReverse ? this.range.end : this.range.start }
  set anchor(pos) {
    var r = this.isReverse;
    this.range[r ? "end" : "start"] = pos;
    this.isReverse = r;
  }
  get lead() { return this.isReverse ? this.range.start : this.range.end }
  set lead(pos) {
    var r = this.isReverse;
    this.range[r ? "start" : "end"] = pos;
    this.isReverse = r;
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

  reverse() { this.isReverse = !this.isReverse; }
  isEmpty() { return this.range.isEmpty(); }

  collapse(pos = this.start) { this.range = {start: pos, end: pos}; }
  collapseToEnd() { this.collapse(this.end); }

  growLeft(n) {
    let {textMorph: {document: d}} = this,
        endIndex = d.positionToIndex(this.end),
        startIndex = Math.min(endIndex, d.positionToIndex(this.start) - n);
    this.start = d.indexToPosition(startIndex);
  }

  growRight(n) {
    let {textMorph: {document: d}} = this,
        startIndex = d.positionToIndex(this.start),
        endIndex = Math.max(startIndex, d.positionToIndex(this.end) + n);
    this.end = d.indexToPosition(endIndex);
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
