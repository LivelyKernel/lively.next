import { Range } from "./range.js";
import { Anchor } from "./anchors.js";
import { obj, arr } from "lively.lang";

import { lessPosition, lessEqPosition, eqPosition } from "./position.js";


class StyleAnchor extends Anchor {

  onDelete(range) {
    if (lessEqPosition(this.position, range.start)) return;

    if (lessEqPosition(range.start, this.position)
     && lessEqPosition(this.position, range.end)) { this.position = range.start; return; }

    let {row, column} = this.position,
        {start: {row: startRow, column: startColumn}, end: {row: endRow, column: endColumn}} = range,
        deltaRows = endRow - startRow,
        deltaColumns = endRow === this.position.row ?
                       endColumn - startColumn : 0
    this.position = {column: column - deltaColumns, row: row - deltaRows}
  }

  onInsert(range) {
    if (lessPosition(this.position, range.start)) return;
    let {row, column} = this.position,
        {start: {row: startRow, column: startColumn}, end: {row: endRow, column: endColumn}} = range,
        deltaRows = endRow - startRow,
        deltaColumns = endColumn - startColumn;
    this.position = {column: column + deltaColumns, row: row + deltaRows}
  }

}


export class StyleRange {

  static fromPositions(style = {}, start, end) {
    return new this(style, Range.fromPositions(start, end));
  }

  static mergeInto(others, newRange) {
    let a = others[0], b = newRange
    if (!a) return [newRange];
    ({ a, b } = StyleRange.merge(a, b));
    let remaining = others.slice(1);
    if (b.length)
      b = arr.flatten(b.map(ea => StyleRange.mergeInto(remaining, ea)));
    else b = remaining;
    return Range.sort(a.concat(b));
  }

  static merge(a, b) {
    // Styles from "b" will be applied to (and override) any overlapping section of "a"; will return 1-3 new ranges
    let { style: style_a, range: range_a } = a,
        { style: style_b, range: range_b } = b,
        intersection = range_a.intersect(range_b);
    if (!intersection.isEmpty()) {
      let mergedStyle = obj.merge(style_a, style_b),
          restyledRange = new StyleRange(mergedStyle, intersection),
          leftover_a = range_a.subtract(intersection)
                              .filter(r => !r.isEmpty())
                              .map(range => new StyleRange(style_a, range)),
          leftover_b = range_b.subtract(intersection)
                              .filter(r => !r.isEmpty())
                              .map(range => new StyleRange(style_b, range));
          return { a: [...leftover_a, restyledRange], b: leftover_b };
          // TODO: Join adjacent ranges with equivalent styles

    } else return { a: [a], b: [b] };

  }

  constructor(style = {}, range) {
    this.style = style;
    this.range = range;
  }

  get start() { return this.startAnchor.position }
  get end() { return this.endAnchor.position }

  set start(start) {
    this.startAnchor = new StyleAnchor(undefined, start);
  }
  set end(end) {
    this.endAnchor = new StyleAnchor(undefined, end);
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

  onInsert(range) {
    this.startAnchor.onInsert(range);
    this.endAnchor.onInsert(range);
  }

  onDelete(range) {
    this.startAnchor.onDelete(range);
    this.endAnchor.onDelete(range);
  }

}
