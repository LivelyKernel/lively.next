import { arr } from 'lively.lang';
import { TextSearcher } from 'lively.ide/text/search.js';

export var multiSelectCommands = [

  {
    name: '[multi select] add cursor above',
    multiSelectAction: 'single',
    exec: morph => {
      const start = morph.selection.start;
      if (start.row > 0) {
        const pos = morph.getPositionAboveOrBelow(
          1, start, true, 0, morph.charBoundsFromTextPosition(start).x);
        morph.selection.addRange({ start: pos, end: pos });
      }
      return true;
    }
  },

  {
    name: '[multi select] add cursor below',
    multiSelectAction: 'single',
    exec: morph => {
      const start = morph.selection.start;
      const { row: endRow } = morph.documentEndPosition;
      if (start.row < endRow) {
        const pos = morph.getPositionAboveOrBelow(
          -1, start, true, 0, morph.charBoundsFromTextPosition(start).x);
        morph.selection.addRange({ start: pos, end: pos });
      }
      return true;
    }
  },

  {
    name: '[multi select] all like this',
    multiSelectAction: 'single',
    exec: morph => {
      const idx = morph.selection.selections.length - 1;
      const last = morph.selection.selections[idx];
      if (last.isEmpty()) return true;
      const found = new TextSearcher(morph).searchForAll({ needle: last.text, start: { column: 0, row: 0 } });
      found.forEach(({ range }) => morph.selection.addRange(range, false));
      morph.selection.mergeSelections();
      arr.remove(morph.selection.selections, last);
      morph.selection.selections.push(last); // make it the first again
      return true;
    }
  },

  {
    name: '[multi select] more like this forward',
    multiSelectAction: 'single',
    exec: morph => {
      const idx = morph.selection.selections.length - 1;
      const last = morph.selection.selections[idx];
      if (last.isEmpty()) return true;
      const pos = last.end;
      const found = morph.search(last.text, { start: pos, backwards: false });
      if (found) {
        const existing = morph.selection.selections.findIndex(ea => ea.range.equals(found.range));
        if (existing > -1) arr.swap(morph.selection.selections, existing, idx);
        else morph.selection.addRange(found.range);
      }
      return true;
    }
  },

  {
    name: '[multi select] more like this backward',
    multiSelectAction: 'single',
    exec: morph => {
      const idx = morph.selection.selections.length - 1;
      const last = morph.selection.selections[idx];
      if (last.isEmpty()) return true;
      const { row, column } = last.start;
      // we offset the length of the selected text -1 from the position to
      // not get a range that overlaps the existing selection, like
      // when selcting xx[xx] and then searching backwards to get the first xx pair.
      const found = morph.search(last.text, { start: { row, column: column - (last.text.length - 1) }, backwards: true });
      if (found) {
        const existing = morph.selection.selections.findIndex(ea => ea.range.equals(found.range));
        if (existing > -1) arr.swap(morph.selection.selections, existing, idx);
        else morph.selection.addRange(found.range);
      }
      return true;
    }
  },

  {
    name: '[multi select] remove focused cursor',
    multiSelectAction: 'single',
    exec: morph => {
      const l = morph.selection.selections.length;
      if (l > 1) { morph.selection.removeSelections(l - 1); }
      return true;
    }
  },

  {
    name: '[multi select] goto previous focused cursor',
    multiSelectAction: 'single',
    exec: morph => {
      morph.selection.selections = lively.lang.arr.rotate(morph.selection.selections, -1);
      return true;
    }
  },

  {
    name: '[multi select] goto next focused cursor',
    multiSelectAction: 'single',
    exec: morph => {
      morph.selection.selections = lively.lang.arr.rotate(morph.selection.selections, 1);
      return true;
    }
  },

  {
    name: '[multi select] align cursors',
    multiSelectAction: 'single',
    exec: morph => {
      const { selection: { selections } } = morph; const l = selections.length;
      if (l <= 1) return true;

      const byRow = arr.groupBy(selections, sel => sel.range.start.row);
      // eliminate other selections in same row that are farther left
      const leftOverSels = byRow.keys().map(row => {
        const selsOfRow = byRow[row];
        const rightMostSel = arr.max(selsOfRow, ea => ea.range.start.column);
        arr.without(selsOfRow, rightMostSel).forEach(sel => sel.range = rightMostSel.range);
        return rightMostSel;
      });
      // find the rightmost column
      const maxCol = arr.max(leftOverSels, ea => ea.range.start.column).range.start.column;
      // for all selections farther left than maxCol, insert spaces to fill up to maxColl
      leftOverSels.forEach(sel => {
        const { row, column } = sel.range.start;
        morph.insertText(' '.repeat(maxCol - column), { row, column });
      });
      return true;
    }
  },

  {
    name: '[multi select] create rectangular selection',
    multiSelectAction: 'single',
    exec: morph => {
      morph.selection.disableMultiSelect();
      if (morph.selection.isEmpty()) {
        var from = morph.lastSavedMark && morph.lastSavedMark.position || this.lineRange().start;
        var to = morph.cursorPosition;
      } else {
        var { lead: to, anchor: from } = morph.selection;
      }
      morph.selection.collapse();
      const startCol = from.column;
      const endCol = to.column;
      arr.range(from.row, to.row).forEach(row =>
        // only add if line has content at the column
        morph.getLine(row).length > Math.min(endCol, startCol) &&
     morph.selection.addRange({ end: { row, column: endCol }, start: { row, column: startCol } }, false));
      morph.selection.mergeSelections();
      return true;
    }
  },

  {
    name: '[multi select] count',
    multiSelectAction: 'single',
    handlesCount: true,
    exec: (morph, _, count = 1) => {
      morph.undoManager.group();
      morph.selection.selections.forEach((sel, i) => sel.text = String(i + count));
      morph.undoManager.group();
      return true;
    }
  }

];
