import { lessPosition, eqPosition, minPosition, maxPosition } from "./position.js"
import { Anchor } from "./anchors.js";
import { obj, arr } from "lively.lang";

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
      return Range.fromPositions(this.start, otherRange.start);
    return Range.fromPositions(otherRange.end, this.end);
  }

  intersect(that) {
    if (!that.isRange) that = new Range(that);
    var comparison = Range.compare(this, that),
        a = comparison < 0 ? this : that,
        b = comparison < 0 ? that : this;
    switch (Math.abs(comparison)) {
      case 0:
      case 1: return new Range(a);
      case 2:
      case 3: return new Range(b);
      case 4: return Range.fromPositions(b.start, a.end);
      case 5: return Range.at(b.start);
      case 6: return Range.at(a.end);
    }
  }

  subtract(that) {
    if (!that.isRange) that = new Range(that);
    var comparison = Range.compare(this, that);
    switch (comparison) {
      case -6:
      case -5:
      case  5:
      case  6: return [new Range(this)];

      case -1:
      case  0:
      case  2:
      case  3: return [Range.at(this.start)];

      case  1:
      case  4: return [Range.fromPositions(that.end, this.end)];

      case -4:
      case -3: return [Range.fromPositions(this.start, that.start)];

      case -2: return [Range.fromPositions(this.start, that.start), Range.fromPositions(that.end, this.end)];
    }
  }

  toString() {
    let {start: {row, column}, end: {row: endRow, column: endColumn}} = this;
    return `Range(${row}/${column} -> ${endRow}/${endColumn})`;
  }

}


export const defaultRange = new Range()


export class StyleRange {

  constructor(style = {}, range) {
    this.style = style;
    this.range = range;
  }

  get start() { return this.range.start }
  get end() { return this.range.end }

  static flatten(base, ...rest) {
    let flattened = base ? [base] : [];
    for (let thatStyleRange of rest) {
      flattened = arr.flatten(flattened.map(thisStyleRange => StyleRange.merge(thisStyleRange, thatStyleRange)));
    }
    return flattened;
  }

  static merge(a, b) {
    // Styles from "b" will be applied to (and override) any overlapping section of "a"; will return 1-3 new ranges
    let { style: style_a, range: range_a } = a,
        { style: style_b, range: range_b } = b,
        intersection = range_a.intersect(range_b),
        outputStyleRanges;
    if (!intersection.isEmpty()) {
      let mergedStyle = obj.merge(style_a, style_b),
          restyledRange = new StyleRange(mergedStyle, intersection),
          leftoverRanges = range_a.subtract(intersection).map(range => new StyleRange(style_a, range));
      outputStyleRanges = [restyledRange, ...leftoverRanges];
    } else {
      outputStyleRanges = [a];
    }
    return Range.sort(outputStyleRanges);
  }

}
