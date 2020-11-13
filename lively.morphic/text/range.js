import { lessPosition, lessEqPosition, eqPosition, minPosition, maxPosition } from './position.js';

export class Range {
  static sort (ranges) { return ranges.sort(Range.compare); }

  static compare (a, b) {
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

    const { start: startA, end: endA } = a;
    const { start: startB, end: endB } = b;

    if (lessPosition(startA, startB)) {
      if (lessPosition(endA, startB)) { return -6; }
      if (eqPosition(endA, startB)) { return -5; }
      if (lessPosition(endA, endB)) { return -4; }
      if (eqPosition(endA, endB)) { return -3; }
      return -2;
    }
    if (eqPosition(startA, startB)) {
      if (eqPosition(endA, endB)) { return 0; }
      return lessPosition(endA, endB) ? -1 : 1;
    }
    return -1 * Range.compare(b, a);
  }

  static at (position) { return new this({ start: position, end: position }); }

  static fromPositions (start, end) { return new this({ start, end }); }

  static create (startRow, startCol, endRow, endCol) {
    return new this({
      start: { row: startRow, column: startCol },
      end: { row: endRow, column: endCol }
    });
  }

  static isValidLiteral (rangeSpec) {
    if (!rangeSpec) return false;
    if (rangeSpec.isRange) return true;
    return rangeSpec.start && rangeSpec.end &&
        typeof rangeSpec.start.row === 'number' &&
        typeof rangeSpec.start.column === 'number' &&
        typeof rangeSpec.end.row === 'number' &&
        typeof rangeSpec.end.column === 'number';
  }

  constructor (range = { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }) {
    let {
      start: { row: startRow, column: startColumn },
      end: { row: endRow, column: endColumn }
    } = range;

    if (endRow < startRow || (endRow === startRow && endColumn < startColumn)) // reverse
    { [endRow, endColumn, startRow, startColumn] = [startRow, startColumn, endRow, endColumn]; }
    this.start = { row: startRow, column: startColumn };
    this.end = { row: endRow, column: endColumn };
  }

  get isRange () { return true; }

  isEmpty () {
    return this.start.row === this.end.row &&
        this.start.column === this.end.column;
  }

  equals (other) {
    if (!other || !other.start || !other.end) return false;
    return eqPosition(this.start, other.start) &&
        eqPosition(this.end, other.end);
  }

  copy () { return new Range(this); }

  toLiteral () { return { start: this.start, end: this.end }; }

  merge (otherRange) {
    if (!otherRange.isRange) otherRange = new Range(otherRange);
    if (lessPosition(this.end, otherRange.start) || lessPosition(otherRange.end, this.start)) { return this; }
    return Range.fromPositions(
      minPosition(this.start, otherRange.start),
      maxPosition(this.end, otherRange.end));
  }

  without (otherRange) {
    // returns this range without the "area" covered by the other
    if (!otherRange.isRange) otherRange = new Range(otherRange);
    const compared = Range.compare(this, otherRange);
    if (compared === 0) { return Range.fromPositions(this.start, this.start); }
    if (Math.abs(compared) >= 5) { return this; }
    if (compared < 0) { return Range.fromPositions(this.start, otherRange.start); }
    return Range.fromPositions(otherRange.end, this.end);
  }

  intersect (that) {
    if (!that.isRange) that = new Range(that);
    const comparison = Range.compare(this, that);
    const a = comparison < 0 ? this : that;
    const b = comparison < 0 ? that : this;
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

  subtract (that) {
    // removes other range from this, splitting is possible, returns list of
    // ranges
    if (!that.isRange) that = new Range(that);
    const comparison = Range.compare(this, that);
    switch (comparison) {
      case -6:
      case -5:
      case 5:
      case 6: return [new Range(this)];

      case -1:
      case 0:
      case 2:
      case 3: return [Range.at(this.start)];

      case 1:
      case 4: return [Range.fromPositions(that.end, this.end)];

      case -4:
      case -3: return [Range.fromPositions(this.start, that.start)];

      case -2: return [Range.fromPositions(this.start, that.start), Range.fromPositions(that.end, this.end)];
    }
  }

  containsPosition (pos) {
    return lessEqPosition(this.start, pos) && lessEqPosition(pos, this.end);
  }

  toString () {
    const { start: { row, column }, end: { row: endRow, column: endColumn } } = this;
    return `Range(${row}/${column} -> ${endRow}/${endColumn})`;
  }
}

export const defaultRange = new Range();
