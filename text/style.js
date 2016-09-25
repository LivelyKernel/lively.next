import { obj, arr } from "lively.lang";
import { Range } from "./range.js";
import { Anchor } from "./anchors.js";
import { lessPosition, lessEqPosition, eqPosition } from "./position.js";


export class TextAttribute {

  static fromPositions(style = {}, start, end) {
    return new this(style, Range.fromPositions(start, end));
  }

  static create(style, startRow, startCol, endRow, endCol) {
    return new this(style, {
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
    let { style: styleA, range: rangeA } = a,
        { style: styleB, range: rangeB } = b,
        intersection = rangeA.intersect(rangeB);
    if (!intersection.isEmpty()) {
      let mergedStyle = obj.merge(styleA, styleB),
          restyledRange = new TextAttribute(mergedStyle, intersection),
          leftoverA = rangeA.subtract(intersection)
                              .filter(r => !r.isEmpty())
                              .map(range => new TextAttribute(styleA, range)),
          leftoverB = rangeB.subtract(intersection)
                              .filter(r => !r.isEmpty())
                              .map(range => new TextAttribute(styleB, range));
          return { a: [...leftoverA, restyledRange], b: leftoverB };
          // TODO: Join adjacent ranges with equivalent styles

    } else return { a: [a], b: [b] };
  }

  constructor(style = {}, range = {start: {row: 0, column: 0}, end: {row: 0, column: 0}}) {
    this.style = style;
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
                      && obj.equals(this.style, other.style); }

  merge(other) { return this.constructor.merge(this, other) };

  onInsert(range) {
    this.startAnchor.onInsert(range);
    this.endAnchor.onInsert(range);
  }

  onDelete(range) {
    this.startAnchor.onDelete(range);
    this.endAnchor.onDelete(range);
  }

  toString() {
    var range = String(this.range).replace("Range(", "").replace(")", "");
    return `TextAttribute(${range} ${obj.values(this.style)})`;
  }
}
