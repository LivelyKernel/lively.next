import { string } from "lively.lang";
import { lessPosition, lessEqPosition, eqPosition } from "./position.js";

export class Anchor {

  constructor(id = string.newUUID(), pos = {column: 0, row: 0}) {
    this.id = id;
    this.position = pos;
  }

  get isAnchor() { return true; }

  onDelete(range) {
    if (lessEqPosition(this.position, range.start)) return;

    if (lessEqPosition(range.start, this.position)
     && lessEqPosition(this.position, range.end)) { this.position = range.start; return; }

    let {row, column} = this.position,
        {start: {row: startRow, column: startColumn}, end: {row: endRow, column: endColumn}} = range,
        deltaRows = endRow - startRow,
        deltaColumns = endRow !== this.position.row ?
          0 : startRow === endRow ?
            endColumn - startColumn : endColumn;
    this.position = {column: column - deltaColumns, row: row - deltaRows}
  }

  onInsert(range) {
    if (lessPosition(this.position, range.start)) return;
    let {row, column} = this.position,
        {start: {row: startRow, column: startColumn}, end: {row: endRow, column: endColumn}} = range,
        deltaRows = endRow - startRow,
        deltaColumns = startRow !== this.position.row ?
          0 : startRow === endRow ?
            endColumn - startColumn : endColumn;
    this.position = {column: column + deltaColumns, row: row + deltaRows}
  }

  equalsPosition(posOrAnchor) {
    if (!posOrAnchor) return false;
    if (posOrAnchor.isAnchor) return eqPosition(this.position, posOrAnchor.position);
    return eqPosition(this.position, posOrAnchor);
  }

  toString() {
    var {id, position: {row, column}} = this;
    return `Anchor(${id} ${row}/${column})`;
  }
}
