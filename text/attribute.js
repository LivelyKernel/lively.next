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

  get start() { return this._startAnchor.position }
  set start(start) { this._startAnchor = new Anchor(undefined, start); }
  get end() { return this._endAnchor.position }
  set end(end) { this._endAnchor = new Anchor(undefined, end); }

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
    var changedStart = this._startAnchor.onInsert(range),
        changedEnd = this._endAnchor.onInsert(range);
    return changedStart || changedEnd;
  }

  onDelete(range) {
    var changedStart = this._startAnchor.onDelete(range),
        changedEnd = this._endAnchor.onDelete(range);
    return changedStart || changedEnd;
  }

  splitAt(pos) {
    var {row, column} = pos;
    if (lessEqPosition(pos, this.start) || lessEqPosition(this.end, pos))
      throw new Error(`splitAt with position outside attribute: ${this} vs ${row}/${column}`);
    return [new this.constructor(this.data, {start: this.start, end: pos}),
            new this.constructor(this.data, {start: pos, end: this.end})]
  }

  toString() {
    var range = String(this.range).replace("Range(", "").replace(")", "");
    return `${this.constructor.name}(${range} ${obj.values(this.data)})`;
  }
}


export class TextStyleAttribute extends TextAttribute {

  static mergeAdjacentAttributes(attrs) {
    // Assumes that attributes are sorted according to Range.compare!
    if (attrs.length <= 1) return attrs;
    var [a, b, ...rest] = attrs;
    return a.addAdjacentAttribute(b) ?
      this.mergeAdjacentAttributes([a].concat(rest)) :
      [a].concat(this.mergeAdjacentAttributes([b].concat(rest)))
  }

  addAdjacentAttribute(other) {
    // Assumes that this <= other according to Range.compare!
    if (!eqPosition(this.end, other.start) || !obj.equals(this.data, other.data)) return false;
    this.end = other.end;
    return true;
  }

  static get styleProps() {
    return ["fontFamily", "fontSize", "fontColor", "fontWeight",
            "fontStyle", "textDecoration", "fixedCharacterSpacing",
            "textStyleClasses", "link", "nativeCursor"];
  }

  static isStyleData(data) {
    return arr.withoutAll(Object.keys(data), this.styleProps).length === 0;
  }

  get isStyleAttribute() { return true; }

}
