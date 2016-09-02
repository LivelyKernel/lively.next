import { lessPosition, eqPosition, minPosition, maxPosition } from "./position.js"
import { string } from "lively.lang";
import config from "../config.js";

var newline = "\n";

export class Range {

  static sort(ranges) { return ranges.sort(Range.compare); }

  static compare(a, b) {
    // Compares two ranges.
    // -6: a.start < b.start and a.end < b.start
    //        a: [  ]
    //        b:     [  ]
    // -5: a.start < b.start and a.end = b.start
    //        a: [  ]
    //        b:    [  ]
    // -4: a.start < b.start and a.end < b.end
    //        a: [  ]
    //        b:  [  ]
    // -3: a.start < b.start and a.end = b.end
    //        a: [  ]
    //        b:  [ ]
    // -2: a.start < b.start and a.end > b.end
    //        a: [  ]
    //        b:  []
    // -1: a.start = b.start and a.end < b.end
    //        a: [ ]
    //        b: [  ]
    //  0: a.start = b.start and a.end = b.end
    //        a: [  ]
    //        b: [  ]
    // 1-6: reversed

    var {start: startA, end: endA} = a,
        {start: startB, end: endB} = b

      if (lessPosition(startA, startB)) {
          if (lessPosition(endA, startB))
              return -6;
          if (eqPosition(endA, startB))
              return -5;
          if (lessPosition(endA, endB))
            return -4;
          if (eqPosition(endA, endB))
            return -3;
          return -2;
      }
      if (eqPosition(startA, startB)) {
          if (eqPosition(endA, endB))
              return 0;
          return lessPosition(endA, endB) ? -1 : 1;
      }
      return -1 * Range.compare(b, a);
  }

  static at(position) { return new this({start: position, end: position}); }

  static fromPositions(start, end) { return new this({start, end}); }

  static create(startRow, startCol, endRow, endCol) {
    return new this({
      start: {row: startRow, column: startCol},
      end: {row: endRow, column: endCol}});
  }

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

  merge(otherRange) {
    if (!otherRange.isRange) otherRange = new Range(otherRange);
    if (lessPosition(this.end, otherRange.start) || lessPosition(otherRange.end, this.start))
      return this;
    return Range.fromPositions(
      minPosition(this.start, otherRange.start),
      maxPosition(this.end, otherRange.end));
  }

  without(otherRange) {
    if (!otherRange.isRange) otherRange = new Range(otherRange);
    var compared = Range.compare(this, otherRange);
    if (compared === 0)
      return Range.fromPositions(this.start, this.start);
    if (Math.abs(compared) >= 5)
      return this;
    if (compared < 0)
      return Range.fromPositions(this.start, otherRange.end);
    return Range.fromPositions(otherRange.end, this.end);
  }

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
    this.textMorph && this.textMorph.makeDirty && this.textMorph.makeDirty();
    this._goalColumn = this.lead.column;

    this.startAnchor.position = range.start;
    this.endAnchor.position = range.end;
    // console.log(`selection changed: ${this}`);
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

  set text(val) {
    let {range: {start, end}, textMorph} = this;
    if (!this.isEmpty())
      textMorph.deleteText({start, end});

    this.range = val.length ?
      textMorph.insertText(val, start) :
      {start: start, end: start};
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

  toString() {
    let {row, column} = this.anchor,
        {row: endRow, column: endColumn} = this.lead;
    // return `Selection(${row}/${column} -> ${endRow}/${endColumn}, ${string.truncate(text.replace(/\n/g, ""), 30)})`;
    return `Selection(${row}/${column} -> ${endRow}/${endColumn})`;
  }
}
