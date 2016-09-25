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

  static mergeInto(others, newRange) {
    let firstRange = others[0];
    if (!firstRange) return [newRange];
    let { a, b } = TextAttribute.merge(firstRange, newRange),
        remaining = others.slice(1);
    b.map(ea => remaining = TextAttribute.mergeInto(remaining, ea));
    return a.concat(remaining);
  }

  static merge(a, b) {
    // Styles from "b" will be applied to (and override) any overlapping
    // section of "a"; will return 1-3 new ranges
    let { data: dataA, range: rangeA } = a,
        { data: dataB, range: rangeB } = b,
        intersection = rangeA.intersect(rangeB);
    if (!intersection.isEmpty()) {
      let mergedData = obj.merge(dataA, dataB),
          restyledRange = new TextAttribute(mergedData, intersection),
          leftoverA = rangeA.subtract(intersection)
                              .filter(r => !r.isEmpty())
                              .map(range => new TextAttribute(dataA, range)),
          leftoverB = rangeB.subtract(intersection)
                              .filter(r => !r.isEmpty())
                              .map(range => new TextAttribute(dataB, range));
          return { a: [...leftoverA, restyledRange], b: leftoverB };
          // TODO: Join adjacent ranges with equivalent styles

    } else return { a: [a], b: [b] };
  }

  constructor(data = {}, range = {start: {row: 0, column: 0}, end: {row: 0, column: 0}}) {
    this.data = data;
    this.range = range;
  }

  get isTextAttribute() { return true; }

  get start() { return this.startAnchor.position }
  get end() { return this.endAnchor.position }

  set start(start) {
    this.startAnchor = new Anchor(undefined, start);
  }
  set end(end) {
    this.endAnchor = new Anchor(undefined, end);
  }

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

  merge(other) { return this.constructor.merge(this, other) };

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
