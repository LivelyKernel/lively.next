import { chain, arr, obj, string } from "lively.lang";

export var multiSelectCommands = [

  {
    name: "[multi select] add cursor above",
    multiSelectAction: "single",
    exec: morph => {
      var start = morph.selection.start;      
      if (start.row > 0) {
        var pos = morph.getPositionAboveOrBelow(1, start, true)
        morph.selection.addRange({start: pos, end: pos})
      }
      return true;
    }
  },

  {
    name: "[multi select] add cursor below",
    multiSelectAction: "single",
    exec: morph => {
      var {row, column} = morph.selection.start,
          {row: endRow} = morph.documentEndPosition;
      if (row < endRow)
        morph.selection.addRange({start: {row: row+1, column}, end: {row: row+1, column}})
      return true;
    }
  },

  {
    name: "[multi select] all like this",
    multiSelectAction: "single",
    exec: morph => {
      var idx = morph.selection.selections.length-1,
          last = morph.selection.selections[idx];
      if (last.isEmpty()) return true;
      var found = morph.searchForAll(last.text, {start: {column: 0, row: 0}});
      found.forEach(({range}) => morph.selection.addRange(range, false));
      morph.selection.mergeSelections();
      arr.remove(morph.selection.selections, last);
      morph.selection.selections.push(last); // make it the first again
      return true;
    }
  },

  {
    name: "[multi select] more like this forward",
    multiSelectAction: "single",
    exec: morph => {
      var idx = morph.selection.selections.length-1,
          last = morph.selection.selections[idx];
      if (last.isEmpty()) return true;
      var pos = last.end,
          found = morph.search(last.text, {start: pos, backwards: false});
      if (found) {
        var existing = morph.selection.selections.findIndex(ea => ea.range.equals(found.range));
        if (existing > -1) arr.swap(morph.selection.selections, existing, idx);
        else morph.selection.addRange(found.range);
      }
      return true;
    }
  },

  {
    name: "[multi select] more like this backward",
    multiSelectAction: "single",
    exec: morph => {
      var idx = morph.selection.selections.length-1,
          last = morph.selection.selections[idx];
      if (last.isEmpty()) return true;
      var {row, column} = last.start,
          // we offset the length of the selected text -1 from the position to
          // not get a range that overlaps the existing selection, like
          // when selcting xx[xx] and then searching backwards to get the first xx pair.
          found = morph.search(last.text, {start: {row, column: column-(last.text.length-1)}, backwards: true});
      if (found) {
        var existing = morph.selection.selections.findIndex(ea => ea.range.equals(found.range));
        if (existing > -1) arr.swap(morph.selection.selections, existing, idx)
        else  morph.selection.addRange(found.range);
      }
      return true;
    }
  },

  {
    name: "[multi select] remove focused cursor",
    multiSelectAction: "single",
    exec: morph => {
      var l = morph.selection.selections.length;
      if (l > 1)
        morph.selection.removeSelections(l-1);
      return true;
    }
  },

  {
    name: "[multi select] goto previous focused cursor",
    multiSelectAction: "single",
    exec: morph => {
      morph.selection.selections = lively.lang.arr.rotate(morph.selection.selections, -1);
      return true;
    }
  },

  {
    name: "[multi select] goto next focused cursor",
    multiSelectAction: "single",
    exec: morph => {
      morph.selection.selections = lively.lang.arr.rotate(morph.selection.selections, 1);
      return true;
    }
  },

  {
    name: "[multi select] align cursors",
    multiSelectAction: "single",
    exec: morph => {
      var {selection: {selections}} = morph, l = selections.length;
      if (l <= 1) return true;

      var byRow = arr.groupBy(selections, sel => sel.range.start.row),
          // eliminate other selections in same row that are farther left
          leftOverSels = byRow.keys().map(row => {
            var selsOfRow = byRow[row],
                rightMostSel = arr.max(selsOfRow, ea => ea.range.start.column);
            arr.without(selsOfRow, rightMostSel).forEach(sel => sel.range = rightMostSel.range);
            return rightMostSel;
          }),
          // find the rightmost column
          maxCol = arr.max(leftOverSels, ea => ea.range.start.column).range.start.column;
      // for all selections farther left than maxCol, insert spaces to fill up to maxColl
      leftOverSels.forEach(sel => {
        var {row, column} = sel.range.start;
        morph.insertText(" ".repeat(maxCol-column), {row, column})
      });
      return true;
    }
  },

  {
    name: "[multi select] create rectangular selection",
    multiSelectAction: "single",
    exec: morph => {
      morph.selection.disableMultiSelect();
      if (morph.selection.isEmpty()) {
        var from = morph.lastSavedMark && morph.lastSavedMark.position || this.lineRange().start,
            to = morph.cursorPosition;
      } else {
        var {lead: to, anchor: from} = morph.selection;
      }
      morph.selection.collapse();
      var startCol = from.column,
          endCol = to.column;
      arr.range(from.row, to.row).forEach(row =>
        // only add if line has content at the column
        morph.getLine(row).length > Math.min(endCol, startCol)
     && morph.selection.addRange({end: {row, column: endCol}, start: {row, column: startCol}}, false));
      morph.selection.mergeSelections();
      return true;
    }
  },

  {
    name: "[multi select] count",
    multiSelectAction: "single",
    handlesCount: true,
    exec: (morph, _, count = 1) => {
      morph.undoManager.group();
      morph.selection.selections.forEach((sel, i) => sel.text = String(i+count))
      morph.undoManager.group();
      return true;
    }
  }

];
