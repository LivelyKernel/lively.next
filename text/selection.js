import { lessPosition, eqPosition } from "./position.js"
import { string } from "lively.lang";

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
    this.range = Range.isValidLiteral(range) ? range : defaultRange;
  }

  get range() { return this._range; }
  set range(range) {
    var d = this.textMorph.document;

    if (range && typeof range.start === "number")
      range.start = d.indexToPosition(range.start);

    if (range && typeof range.end === "number")
      range.end = d.indexToPosition(range.end);

    if (!Range.isValidLiteral(range)) return;

    range = new Range(d.clipRangeToLines(range));
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

  get text() {
    return this.textMorph.document.textInRange(this.range);
  }
  set text(val) {
    let {range, textMorph} = this;
    if (!this.isEmpty())
      textMorph.deleteText(range);

    this.range = val.length ?
      textMorph.insertText(val, range.start) :
      {start: range.start, end: range.start}
  }

  isEmpty() { return this.range.isEmpty(); }

  collapse(pos = this.start) { this.range = {start: pos, end: pos}; }
  collapseToEnd() { this.collapse(this.end); }

  growLeft(n) {
    var {textMorph: {document: d}} = this,
        endIndex = d.positionToIndex(this.end),
        startIndex = Math.min(endIndex, d.positionToIndex(this.start) - n);
    this.start = d.indexToPosition(startIndex);
  }

  growRight(n) {
    var {textMorph: {document: d}} = this,
        startIndex = d.positionToIndex(this.start),
        endIndex = Math.max(startIndex, d.positionToIndex(this.end) + n);
    this.end = d.indexToPosition(endIndex);
  }

  toString() {
    let {text, range: {start: {row, column}, end: {row: endRow, column: endColumn}}} = this;
    // return `Selection(${row}/${column} -> ${endRow}/${endColumn}, ${string.truncate(text.replace(/\n/g, ""), 30)})`;
    return `Selection(${row}/${column} -> ${endRow}/${endColumn})`;
  }
}
