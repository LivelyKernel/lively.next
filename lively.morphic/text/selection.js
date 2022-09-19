import { lessPosition } from './position.js';
import { Range, defaultRange } from './range.js';
import config from '../config.js';
import { string, arr } from 'lively.lang';
import { signal } from 'lively.bindings';
import { containsMorph } from './attributes.js';

export class Selection {
  constructor (textMorph, range) {
    this.textMorph = textMorph;
    this.initialize(range);
  }

  get isSelection () { return true; }

  initialize (range) {
    this._goalColumn = undefined;
    this._goalX = undefined;
    this._isReverse = false;

    const id = string.newUUID();
    this.startAnchor = this.textMorph.addAnchor('selection-start-' + id);
    this.endAnchor = this.textMorph.addAnchor('selection-end-' + id);

    this.range = range;
    this._cursorVisible = true;
    this.cursorBlinkProcess = null;
  }

  uninstall () {
    this.cursorBlinkStop();
    this.textMorph.removeAnchor(this.startAnchor);
    this.textMorph.removeAnchor(this.endAnchor);
  }

  compareRangesForMerge (a, b) {
    const { start: { row: startRowA, column: startColA }, end: { row: endRowA, column: endColA } } = a;
    const { start: { row: startRowB, column: startColB }, end: { row: endRowB, column: endColB } } = b;

    if (startRowA < startRowB || (startRowA === startRowB && startColA < startColB)) {
      if (endRowA < startRowB || (endRowA === startRowB && endColA < startColB)) { return 'separate'; }
      if (endRowA === startRowB && endColA === startColB) {
        return (startRowB === endRowB && startColB === endColB)
          ? 'overlapping'
          : 'bordering';
      }
      return 'overlapping';
    }

    if (startRowA === startRowB && startColA === startColB) {
      if (endRowA === endRowB && endColA === endColB) { return 'equal'; }
      return 'overlapping';
    }
    return this.compareRangesForMerge(b, a);
  }

  mergeWith (otherSel) {
    if (!otherSel || !otherSel.isSelection) return false;

    const compared = this.compareRangesForMerge(this.range, otherSel.range);
    if (compared === 'separate' || compared === 'bordering') { return false; }

    this.range = this.range.merge(otherSel.range);
    if (otherSel.isReverse() !== this.isReverse()) { this.reverse(); }
    return true;
  }

  get range () { return this._range || defaultRange; }
  set range (range) {
    if (!range) return;
    let { start, end } = range;
    if (start === undefined || end === undefined) return;

    const d = this.textMorph.document;
    if (typeof start === 'number') range.start = start = d.indexToPosition(start);
    if (typeof end === 'number') range.end = end = d.indexToPosition(end);
    if (!Range.isValidLiteral(range)) return;

    start = d.clipPositionToLines(start);
    end = d.clipPositionToLines(end);

    const isReverse = this._isReverse = lessPosition(end, start);
    if (isReverse) [start, end] = [end, start];

    range.start = start;
    range.end = end;
    if (!range.isRange) range = new Range(range);

    if (range.equals(this._range)) return;

    this._range = range;
    // next two ops are super expensive on deserialization
    this._goalColumn = this.textMorph.lineWrapping
      ? this.textMorph.columnInWrappedLine(this.lead)
      : this.lead.column;

    this._goalX = this.textMorph.charBoundsFromTextPosition(this.lead).x;

    this.startAnchor.position = range.start;
    this.endAnchor.position = range.end;

    this.textMorph.makeDirty();
    signal(this.textMorph, 'selectionChange', this);
  }

  get directedRange () { return { end: this.lead, start: this.anchor }; }

  updateFromAnchors () {
    this.range = { start: this.startAnchor.position, end: this.endAnchor.position };
  }

  get start () { return this.range.start; }
  set start (val) { this.range = Range.fromPositions(val, this.end); }

  get end () { return this.range.end; }
  set end (val) { this.range = Range.fromPositions(this.start, val); }

  get selectionColor () { return this.textMorph.selectionColor || '#bed8f7'; }

  get anchor () { return this.isReverse() ? this.range.end : this.range.start; }
  set anchor (pos) {
    this.range = { start: pos, end: this.lead };
  }

  get lead () { return this.isReverse() ? this.range.start : this.range.end; }
  set lead (pos) {
    this.range = { start: this.anchor, end: pos };
  }

  get text () { return this.textMorph.document.textInRange(this.range); }
  set text (val) { this.replace(val); }

  get textAndAttributes () { return this.textMorph.document.textAndAttributesInRange(this.range); }
  get containsMorph () { return containsMorph(this.textAndAttributes); }

  replace (text, extendTextAttributes, invalidateTextLayout, undoGroup) {
    const { range, textMorph } = this;
    const reversed = this.isReverse();
    this.range = textMorph.replace(range, text, extendTextAttributes, invalidateTextLayout, undoGroup);
    if (reversed) this.reverse();
    return this.range;
  }

  get selectedRows () {
    return { first: this.start.row, last: this.end.row };
  }

  reverse () { this._isReverse = !this.isEmpty() && !this._isReverse; return this; }
  isReverse () { return this._isReverse && !this.isEmpty(); }
  isEmpty () { return this.range.isEmpty(); }

  collapse (pos = this.start) { this.range = { start: pos, end: pos }; return this; }
  collapseToEnd () { this.collapse(this.end); return this; }

  growLeft (n) {
    const { textMorph: { document: d } } = this;
    const endIndex = d.positionToIndex(this.end);
    const startIndex = Math.min(endIndex, d.positionToIndex(this.start) - n);
    const r = this.isReverse();
    this.start = d.indexToPosition(startIndex);
    this._isReverse = r;
    return this;
  }

  growRight (n) {
    const { textMorph: { document: d } } = this;
    const startIndex = d.positionToIndex(this.start);
    const endIndex = Math.max(startIndex, d.positionToIndex(this.end) + n);
    const r = this.isReverse();
    this.end = d.indexToPosition(endIndex);
    this._isReverse = r;
    return this;
  }

  selectAll () {
    this.range = { start: { row: 0, column: 0 }, end: this.textMorph.document.endPosition };
    return this;
  }

  selectLine (row = this.lead.row, includingLineEnd = false) {
    this.includingLineEnd = includingLineEnd;
    this.range = {
      start: { row, column: 0 },
      end: { row, column: this.textMorph.getLine(row).length }
    };
    return this;
  }

  gotoLineEnd (row = this.lead.row) {
    const pos = { row, column: this.textMorph.getLine(row).length };
    this.range = { start: pos, end: pos };
  }

  selectLeft (n = 1) {
    if (this.isEmpty()) { this.growLeft(n); this.reverse(); } else this.isReverse() ? this.growLeft(n) : this.growRight(-n);
    return this;
  }

  selectRight (n = 1) { this.isReverse() ? this.growLeft(-n) : this.growRight(n); return this; }
  selectUp (n = 1, useScreenPosition) { return this.goUp(n, useScreenPosition, true); }
  selectDown (n = 1, useScreenPosition) { return this.selectUp(-n, useScreenPosition); }

  goUp (n = 1, useScreenPosition = false, select = false) {
    if (n === 0) return this;
    const goalColumn = this._goalColumn;
    const goalX = this._goalX;
    this.lead = this.textMorph.getPositionAboveOrBelow(n, this.lead, useScreenPosition, goalColumn, goalX);
    if (!select) this.anchor = this.lead;
    this._goalColumn = goalColumn;
    this._goalX = goalX;
    return this;
  }

  goDown (n = 1, useScreenPosition) { return this.goUp(-n, useScreenPosition); }

  goLeft (n = 1) {
    this.isEmpty() && this.growLeft(n);
    this.collapse();
    return this;
  }

  goRight (n = 1) {
    this.isEmpty() && this.growRight(n);
    this.collapseToEnd();
    return this;
  }

  get cursorVisible () {
    return this._cursorVisible &&
        this.textMorph.isFocused() &&
        !this.textMorph.rejectsInput();
  }

  cursorBlinkStart () {
    if (this.textMorph.readOnly) return;
    this.cursorBlinkStop();
    const timeout = config.text.cursorBlinkPeriod;
    if (timeout) {
      const m = this.textMorph;
      let node = m.env.renderer.getNodeForMorph(m);
      this.cursorBlinkProcess = setInterval(() => {
        if (!node) node = m.env.renderer.getNodeForMorph(m);
        if (!node) return;
        this._cursorVisible = !this._cursorVisible;
        const classNames = node.className.split(' ');
        const hiddenCursorIndex = classNames.indexOf('hidden-cursor');
        if (this._cursorVisible && hiddenCursorIndex > -1) {
          classNames.splice(hiddenCursorIndex, 1);
          node.className = classNames.join(' ');
        }
        if (!this._cursorVisible && hiddenCursorIndex === -1) {
          node.className = [...classNames, 'hidden-cursor'].join(' ');
        }
      }, timeout * 1000);
    }
  }

  cursorBlinkStop () {
    if (this.cursorBlinkProcess) { clearInterval(this.cursorBlinkProcess); }
    this.cursorBlinkProcess = null;
    this._cursorVisible = true;

    const m = this.textMorph;
    const node = m.env.renderer.getNodeForMorph(m);
    if (node) {
      const classNames = node.className.split(' ');
      const hiddenCursorIndex = classNames.indexOf('hidden-cursor');
      if (hiddenCursorIndex > -1) {
        classNames.splice(hiddenCursorIndex, 1);
        node.className = classNames.join(' ');
      }
    }
  }

  toString () {
    const { row, column } = this.anchor;
    const { row: endRow, column: endColumn } = this.lead;
    return `Selection(${row}/${column} -> ${endRow}/${endColumn})`;
  }
}

export class MultiSelection extends Selection {
  initialize (range) {
    this._selections = [new Selection(this.textMorph, range)];
  }

  __deserialize__ (snapshot, objRef) {
    this._selections = [];
  }

  get selections () { return this._selections; }
  set selections (sels) {
    const removed = this._selections ? this._selections.filter(ea => !sels.includes(ea)) : [];
    this._selections = sels;
    removed.forEach(ea => ea.uninstall());
  }

  get isMultiSelection () { return true; }

  uninstall () {
    this.selections.forEach(ea => ea.uninstall());
  }

  get defaultSelection () { return arr.last(this.selections); }
  removeSelections (startingAt = 1) {
    const toRemove = this.selections.slice(startingAt);
    toRemove.forEach(ea => ea.uninstall());
    this.selections = arr.withoutAll(this.selections, toRemove);
  }

  disableMultiSelect () {
    arr.without(this.selections, this.defaultSelection).forEach(ea => ea.uninstall());
    this.selections = [this.defaultSelection];
  }

  get range () { return this.defaultSelection.range; }
  set range (range) {
    this.disableMultiSelect();
    this.defaultSelection.range = range;
  }

  updateFromAnchors () {
    this.selections.forEach(ea => ea.updateFromAnchors());
  }

  get start () { return this.defaultSelection.start; }
  set start (val) { this.defaultSelection.start = val; }

  get end () { return this.defaultSelection.end; }
  set end (val) { this.defaultSelection.end = val; }

  get anchor () { return this.defaultSelection.anchor; }
  set anchor (pos) { this.defaultSelection.anchor = pos; }
  get lead () { return this.defaultSelection.lead; }
  set lead (pos) { this.defaultSelection.lead = pos; }

  get text () { return this.selections.map(sel => sel.text).join('\n'); }
  set text (val) { this.selections.forEach(sel => sel.text = val); }

  get containsMorph () { return this.defaultSelection.containsMorph; }
  get selectedRows () { return this.defaultSelection.selectedRows; }

  reverse () { this.defaultSelection.reverse(); }
  isReverse () { return this.defaultSelection.isReverse(); }
  isEmpty () { return this.defaultSelection.isEmpty(); }

  collapse (pos) { this.defaultSelection.collapse(pos); return this; }
  collapseToEnd () { this.defaultSelection.collapseToEnd(); return this; }

  growLeft (n) { this.defaultSelection.growLeft(n); return this; }

  growRight (n) { this.defaultSelection.growRight(n); return this; }

  selectAll () {
    this.disableMultiSelect();
    this.defaultSelection.selectAll();
    return this;
  }

  selectLine (row, includingLineEnd) {
    this.includingLineEnd = includingLineEnd;
    this.defaultSelection.selectLine(row, includingLineEnd);
    return this;
  }

  gotoLineEnd (row) { this.defaultSelection.gotoLineEnd(row); }

  selectLeft (n) { this.defaultSelection.selectLeft(n); return this; }
  selectRight (n) { this.defaultSelection.selectRight(n); return this; }
  selectUp (n, useScreenPosition) { this.defaultSelection.selectUp(n, useScreenPosition); return this; }
  selectDown (n, useScreenPosition) { this.defaultSelection.selectDown(n, useScreenPosition); return this; }

  goUp (n, useScreenPosition) { return this.defaultSelection.goUp(n, useScreenPosition); }
  goDown (n, useScreenPosition) { return this.defaultSelection.goDown(n, useScreenPosition); }
  goLeft (n) { return this.defaultSelection.goLeft(n); }
  goRight (n) { return this.defaultSelection.goRight(n); }

  get cursorVisible () { return this.defaultSelection.cursorVisible; }

  set style (style) { this.defaultSelection.style = style; }

  getTextAttributes () { return this.defaultSelection.getTextAttributes(); }

  toString () {
    return `MultiSelection(${this.selections.join(', ')})`;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  mergeSelections () {
    const sels = this.selections.slice();
    for (let i = sels.length - 1; i >= 0; i--) {
      for (let j = sels.length - 1; j >= 0; j--) {
        if (i === j) continue;
        if (sels[j].mergeWith(sels[i])) {
          sels.splice(i, 1);
          break;
        }
      }
    }
    this.selections = sels;
  }

  get ranges () { return this.selections.map(ea => ea.range); }
  set ranges (ranges) {
    for (let i = 0; i < ranges.length; i++) {
      const sel = this.selections[i];
      if (sel) sel.range = ranges[i];
      else this.addRange(ranges[i], false);
    }
    this.removeSelections(i);
    this.mergeSelections();
  }

  addRange (range, mergeSelections = true) {
    this.selections.push(new Selection(this.textMorph, range));
    if (mergeSelections) { this.mergeSelections(); }
    return arr.last(this.selections).range;
  }
}
