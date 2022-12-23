import { lessPosition, lessEqPosition, eqPosition } from './position.js';

export class Anchor {
  // A text anchor is a text position that moves with insertion and deletions
  // of text, usful for modelling selections, markers, cursors that should keep
  // their relative position

  constructor (id, pos = { column: 0, row: 0 }, insertBehavior = 'move') {
    this.id = id || '' + (this.constructor._id = (this.constructor._id || 0) + 1);
    this.position = pos;
    // behavior when inserted directly at this.position:
    // stay = position unchanged, move = position moves to end of insertion
    this.insertBehavior = insertBehavior;
  }

  get isAnchor () { return true; }

  set embeddedMorph (m) {
    this._embeddedMorph = m;
    this.updateEmbeddedMorph();
  }

  get embeddedMorph () {
    return this._embeddedMorph;
  }

  set position (pos) {
    this._position = pos;
    this.updateEmbeddedMorph();
  }

  get position () {
    return this._position;
  }

  updateEmbeddedMorph () {
    if (!this.embeddedMorph) return;
    const tm = this.embeddedMorph.owner;
    if (tm && !tm.isLineVisible(this.position.row)) {
      if (tm.renderingState.needsRerender) {
        tm.env.forceUpdate();
        if (!tm.isLineVisible(this.position.row)) return;
      } else return;
    }
    const pos = (tm && tm.isText) ? tm.charBoundsFromTextPosition(this.position).topLeft().subPt(tm.origin) : this.embeddedMorph.position;
    if (tm) tm._positioningSubmorph = this.embeddedMorph;
    this.embeddedMorph.position = pos;
    if (tm) tm._positioningSubmorph = false;
  }

  onDelete (range) {
    // Deleted range to the right, ignore
    if (lessEqPosition(this.position, range.start)) return false;

    // Anchor is inside the deleted range => put anchor at the start of deleted area
    if (lessEqPosition(range.start, this.position) &&
     lessEqPosition(this.position, range.end)) { this.position = range.start; return true; }

    // deletion happened somewhere before anchor, decrease the anchors row if
    // necessary and if deleted range was in same row also decrease column
    const { row, column } = this.position;
    const { start: { row: startRow, column: startColumn }, end: { row: endRow, column: endColumn } } = range;
    // deltaRows = endRow - startRow,
    // deltaColumns = endRow !== this.position.row ?
    //   0 : startColumn - column;
    const newRow = row - (endRow - startRow);
    const newColumn = endRow !== this.position.row
      ? column
      : startColumn === endColumn
        ? column - (endColumn - startColumn)
        : startColumn + (column - endColumn);
    this.position = { column: newColumn, row: newRow };
    return true;
  }

  onInsert (range) {
    // insertion happened after anchor => ignore
    if (lessPosition(this.position, range.start)) return false;

    // insertion happened at anchor and the anchor's policy is to not move => ignore
    if (eqPosition(this.position, range.start) && this.insertBehavior === 'stay') return false;

    // push the anchor down and to the right as necessary
    const { row, column } = this.position;
    const { start: { row: startRow, column: startColumn }, end: { row: endRow, column: endColumn } } = range;
    const deltaRows = endRow - startRow;
    // deltaColumns = startRow !== this.position.row ?
    //   0 : startRow === endRow ?
    //     endColumn - startColumn : endColumn - column;
    const deltaColumns = startRow !== this.position.row
      ? 0
      : endColumn - startColumn;
    this.position = { column: column + deltaColumns, row: row + deltaRows };
    return true;
  }

  equalsPosition (posOrAnchor) {
    if (!posOrAnchor) return false;
    if (posOrAnchor.isAnchor) return eqPosition(this.position, posOrAnchor.position);
    return eqPosition(this.position, posOrAnchor);
  }

  toString () {
    const { id, position: { row, column } } = this;
    return `Anchor(${id} ${row}/${column})`;
  }
}
