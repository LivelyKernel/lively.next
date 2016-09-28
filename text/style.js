import { obj, arr } from "lively.lang";
import { Range } from "./range.js";
import { Anchor } from "./anchors.js";
import { lessPosition, lessEqPosition, eqPosition } from "./position.js";


export class TextAttribute {

  static fromPositions(data = {}, start, end) {
    return new this(data, Range.fromPositions(start, end));
  }

  static create(data, startRow, startCol, endRow, endCol) {
    return new this(data, {
      start: {row: startRow, column: startCol},
      end: {row: endRow, column: endCol}});
  }

  constructor(data = {}, range = {start: {row: 0, column: 0}, end: {row: 0, column: 0}}) {
    this.data = data;
    this.range = range;
  }

  get isTextAttribute() { return true; }

  get start() { return this.startAnchor.position }
  set start(start) { this.startAnchor = new Anchor(undefined, start); }
  get end() { return this.endAnchor.position }
  set end(end) { this.endAnchor = new Anchor(undefined, end); }

  get range() {
    let { start, end } = this;
    return Range.fromPositions(start, end);
  }

  set range(range) {
    let { start, end } = range;
    this.start = start;
    this.end = end;
  }

  isEmpty() { return this.range.isEmpty(); }

  equals(other) { return this.range.equals(other.range)
                      && obj.equals(this.data, other.data); }

  onInsert(range) {
    var changedStart = this.startAnchor.onInsert(range),
        changedEnd = this.endAnchor.onInsert(range);
    return changedStart || changedEnd;
  }

  onDelete(range) {
    var changedStart = this.startAnchor.onDelete(range),
        changedEnd = this.endAnchor.onDelete(range);
    return changedStart || changedEnd;
  }

  toString() {
    var range = String(this.range).replace("Range(", "").replace(")", "");
    return `TextAttribute(${range} ${obj.values(this.data)})`;
  }
}
