/*global System*/

import { chain, arr, obj, string, date } from "lively.lang";
import { pt, Rectangle } from "lively.graphics"
import { Range } from "./range.js"
import { show } from "../index.js"
import { eqPosition, lessPosition } from "./position.js"


var commands = [

  {
    name: "clipboard copy",
    doc: "placeholder for native copy",
    scrollCursorIntoView: false,
    exec: function(morph) {
      if (morph.selection.isEmpty())
        morph.selectLine(morph.cursorPosition.row);
      return true;
    }
  },

  {
    name: "manual clipboard copy",
    doc: "attempts to copy selection via browser interface",
    scrollCursorIntoView: false,
    multiSelectAction: "single",
    exec: (morph, opts = {collapseSelection: true, delete: false, dontTryNativeClipboard: false}) => {
      var sel = morph.selection,
          fullText = sel.text,
          collapseSelection = opts.hasOwnProperty("collapseSelection") ?
            opts.collapseSelection : true;
      morph.saveMark(sel.anchor);
      morph.activeMark = null;

      var sels = sel.isMultiSelection ? sel.selections.slice() : [sel]
      sels.forEach(sel => {
        var range = sel.isEmpty() ? morph.lineRange() : sel.range,
            text = morph.textInRange(range);
          morph.env.eventDispatcher.killRing.add(text);
        if (opts["delete"])
          morph.deleteText(range);
        else if (!sel.isEmpty() && collapseSelection)
          sel.collapse(sel.lead);
      });

      if (!opts.dontTryNativeClipboard)
        morph.env.eventDispatcher.doCopy(fullText);

      return true;
    }
  },

  {
    name: "clipboard cut",
    doc: "placeholder for native cut",
    exec: function(morph) {
      if (morph.selection.isEmpty())
        morph.selectLine(morph.cursorPosition.row, true/*including line end*/);
      return true;
    }
  },

  {
    name: "clipboard paste",
    doc: "placeholder for native paste",
    exec: function() { return true; }
  },

  {
    name: "manual clipboard paste",
    doc: "attempts to paste from the clipboard to lively – currently requires browser extension!",
    multiSelectAction: "single",
    exec: async function(morph, opts = {killRingCycleBack: false}) {
      var pasted, kr = morph.env.eventDispatcher.killRing;


      if (opts.killRingCycleBack
       && (arr.last(arr.pluck(morph.commandHandler.history, "name")) || "")
         .includes("clipboard paste")) pasted = kr.back();

      if (!pasted && kr.isCycling())
        pasted = kr.yank();

      // if (!pasted && lively.browserExtension) {
      //   try {
      //     pasted = await lively.browserExtension.doPaste();
      //   } catch(err) { /*timeout err*/}
      // }

      // if (!pasted) {
      //   try {
      //     pasted = await morph.env.eventDispatcher.doPaste();
      //   } catch (e) { console.warn("paste failed: " + e); }
      // }

      if (!pasted) pasted = kr.yank();

      if (morph.selection.isMultiSelection) {
        morph.undoManager.group();
        morph.selection.selections.slice(0,-1)
          .reverse()
          .map((sel, i) => {
            var idx = (kr.pointer-1)-i;
            if (idx < 0) idx = kr.buffer.length-1;
            return {selection: sel, pasted: kr.buffer[idx] || ""};
          })
          .concat({selection: morph.selection.defaultSelection, pasted})
          .forEach(({selection, pasted}) => selection.text = pasted)
        morph.undoManager.group();
      } else {
        if (pasted) {
          morph.undoManager.group();
          morph.selection.text = pasted;
          morph.undoManager.group();
        }
      }

      return true;
    }
  },

  {
    name: "browse clipboard",
    exec: async (morph) => {
      var {pointer, buffer} = morph.env.eventDispatcher.killRing,
          items = buffer.map(value => ({isListItem: true, string: string.truncate(value, 80).replace(/\n/g, ""), value})),
          {selected} = await morph.world().filterableListPrompt(
            "select items to paste", items, {preselect: pointer, multiSelect: true});
      if (selected.length) {
        morph.undoManager.group();
        morph.insertTextAndSelect(selected.join("\n"));
        morph.undoManager.group();
      }
      return true;
    }
  },

  {
    name: "text undo",
    doc: "undo text changes",
    multiSelectAction: "single",
    exec: function(morph) { morph.textUndo(); return true; }
  },

  {
    name: "text redo",
    doc: "redo text changes",
    multiSelectAction: "single",
    exec: function(morph) { morph.textRedo(); return true; }
  },

  {
    name: "select all",
    doc: "Selects entire text contents.",
    scrollCursorIntoView: false,
    multiSelectAction: "single",
    exec: function(morph) {
      morph.saveMark();
      morph.selectAll();
      return true;
    }
  },

  {
    name: "saveit",
    doc: "...",
    scrollCursorIntoView: false,
    exec: function(morph) { morph.doSave(); return true; }
  },

  {
    name: "delete backwards",
    doc: "Delete the character in front of the cursor or the selection.",
    exec: function(morph) {
      if (morph.rejectsInput()) return false;
      var sel = morph.selection;
      if (sel.isEmpty()) sel.growLeft(1);
      sel.text = "";
      sel.collapse();
      return true;
    }
  },

  {
    name: "delete",
    doc: "Delete the character following the cursor or the selection.",
    exec: function(morph) {
      var sel = morph.selection;
      if (morph.rejectsInput()) return false;
      if (sel.isEmpty()) sel.growRight(1);
      sel.text = "";
      sel.collapse();
      return true;
    }
  },

  {
    name: "indent",
    scrollCursorIntoView: false,
    exec: function(morph) {
      morph.undoManager.group();
      morph.withSelectedLinesDo((line, range) => morph.insertText(morph.tab, range.start));
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "outdent",
    scrollCursorIntoView: false,
    exec: function(morph) {
      morph.undoManager.group();
      morph.withSelectedLinesDo((line, range) => {
        if (line.startsWith(morph.tab))
          morph.deleteText({start: range.start, end: {row: range.start.row, column: morph.tab.length}})
      });
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "tab - snippet expand or indent",
    scrollCursorIntoView: true,
    exec: function(morph) {
      var snippet = morph.snippets.find(snippet => snippet.canExpand(morph));
      if (snippet) {
        snippet.expandAtCursor(morph);
        return true;
      }
      return morph.execCommand("insertstring", {string: morph.tab});
    }
  },


  {
    name: "transpose chars",
    exec: function(morph) {
      if (morph.selection.isEmpty()) {
        var {row, column} = morph.cursorPosition,
            range = Range.create(row, column-1, row, column+1),
            line = morph.getLine(row),
            left = line[column-1],
            right = line[column];
        if (left && right) morph.replace(range, right + left, true);
      }
      return true;
    }
  },

  {
    name: "go left",
    doc: "Move the cursor 1 character left. At the beginning of a line move the cursor up. If a selection is active, collapse the selection left.",
    exec: function(morph) {
      morph.activeMark ?
        morph.selection.selectLeft(1) :
        morph.selection.goLeft(1);
      return true;
    }
  },

  {
    name: "go right",
    doc: "Move the cursor 1 character right. At the end of a line move the cursor down. If a selection is active, collapse the selection right.",
    exec: function(morph) {
      morph.activeMark ?
        morph.selection.selectRight(1) :
        morph.selection.goRight(1);
      return true;
    }
  },

  {
    name: "go up",
    doc: "Move the cursor 1 line. At the end of a line move the cursor down. If a selection is active, collapse the selection right.",
    scrollCursorIntoView: true,
    exec: function(morph) {
      morph.activeMark ?
        morph.selection.selectUp(1) :
        morph.selection.goUp(1, true/*use screen position*/);
      return true;
    }
  },

  {
    name: "go down",
    exec: function(morph) {
      morph.activeMark ?
        morph.selection.selectDown(1) :
        morph.selection.goDown(1, true/*use screen position*/);
      return true;
    }
  },

  {
    name: "select left",
    exec: function(morph) { morph.selection.selectLeft(1); return true; }
  },

  {
    name: "select right",
    exec: function(morph) { morph.selection.selectRight(1); return true; }
  },

  {
    name: "select up",
    exec: function(morph) { morph.selection.selectUp(1, true/*use screen position*/); return true; }
  },

  {
    name: "select down",
    exec: function(morph) { morph.selection.selectDown(1, true/*use screen position*/); return true; }
  },

  {
    name: "select line",
    exec: function(morph) {
      var sel = morph.selection,
          row = sel.lead.row,
          fullLine = morph.lineRange(row, false);
      sel.range = sel.range.equals(fullLine) ? morph.lineRange(row, true) : fullLine;
      return true;
    }
  },

  {
    name: "goto line start",
    exec: function(morph, opts = {select: false}) {
      var select = opts.select || !!morph.activeMark,
          sel = morph.selection,
          cursor = sel.lead,
          line = morph.screenLineRange(cursor, true);
      sel.lead = eqPosition(cursor, line.start) ? {column: 0, row: cursor.row} : line.start;
      !select && (sel.anchor = sel.lead);
      return true;
    }
  },

  {
    name: "goto line end",
    exec: function(morph, opts = {select: false}) {
      var select = opts.select || !!morph.activeMark,
          sel = morph.selection,
          cursor = sel.lead,
          line = morph.screenLineRange(cursor, true);
      sel.lead = line.end;
      !select && (sel.anchor = sel.lead);
      return true;
    }
  },

  {
    name: "goto page up",
    exec: function(morph) { morph.pageUpOrDown({direction: "up", select: !!morph.activeMark}); return true; }
  },

  {
    name: "goto page down",
    exec: function(morph) { morph.pageUpOrDown({direction: "down", select: !!morph.activeMark}); return true; }
  },

  {
    name: "goto page up and select",
    exec: function(morph) { morph.pageUpOrDown({direction: "up", select: true}); return true; }
  },

  {
    name: "goto page down and select",
    exec: function(morph) { morph.pageUpOrDown({direction: "down", select: true}); return true; }
  },

  {
    name: "goto start",
    exec: function(morph, opts = {select: !!morph.activeMark}) {
      morph.gotoDocumentStart({...opts});
      return true;
    }
  },

  {
    name: "goto end",
    exec: function(morph, opts = {select: !!morph.activeMark}) {
      morph.gotoDocumentEnd({...opts});
      return true;
    }
  },

  {
    name: "goto paragraph above",
    exec: function(morph, opts = {select: !!morph.activeMark}) {
      var pRange = morph.paragraphRangeAbove(morph.cursorPosition.row);
      pRange.start.row--;
      morph.selection.lead = pRange.start;
      if (!opts.select) morph.collapseSelection();
      return true;
    }
  },

  {
    name: "goto paragraph below",
    exec: function(morph, opts = {select: !!morph.activeMark}) {
      var pRange = morph.paragraphRangeBelow(morph.cursorPosition.row);
      pRange.end.row++;
      morph.selection.lead = pRange.end;
      if (!opts.select) morph.collapseSelection();
      return true;
    }
  },

  {
    name: 'move cursor to screen bottom in 1/3 steps',
    readOnly: true,
    exec: function(morph) {
      var select = !!morph.activeMark,
          currentPos = morph.lineWrapping ? morph.cursorScreenPosition : morph.cursorPosition,
          firstRow = morph.textLayout.firstFullVisibleLine(morph),
          lastRow = morph.textLayout.lastFullVisibleLine(morph),
          middleRow = firstRow+Math.floor((lastRow - firstRow)/2),
          newPos = currentPos;
      if (currentPos.row < firstRow) newPos.row = firstRow;
      else if (currentPos.row < middleRow) newPos.row = middleRow;
      else if (currentPos.row < lastRow) newPos.row = lastRow;
      else return true;
      morph.selection.lead = morph.lineWrapping ? morph.toDocumentPosition(newPos) : newPos;
      if (!select) morph.selection.anchor = morph.selection.lead;
      return true;
    }
  },

  {
    name: 'move cursor to screen top in 1/3 steps',
    readOnly: true,
    exec: function(morph) {
      var select = !!morph.activeMark,
          currentPos = morph.lineWrapping ? morph.cursorScreenPosition : morph.cursorPosition,
          firstRow = morph.textLayout.firstFullVisibleLine(morph),
          lastRow = morph.textLayout.lastFullVisibleLine(morph),
          middleRow = firstRow+Math.floor((lastRow - firstRow)/2),
          newPos = currentPos;
      if (currentPos.row <= firstRow) return true;
      if (currentPos.row <= middleRow) newPos.row = firstRow;
      else if (currentPos.row <= lastRow) newPos.row = middleRow;
      else newPos.row = lastRow;
      morph.selection.lead = morph.lineWrapping ? morph.toDocumentPosition(newPos) : newPos;
      if (!select) morph.selection.anchor = morph.selection.lead;
      return true;
    }
  },

  {
    name: "goto line",
    exec: async function(morph) {
      var select = !!morph.activeMark,
          row = Number(await morph.world().prompt("Enter line number"));
      if (!isNaN(row)) {
        if (select) morph.selection.lead = {row, column: 0}
        else morph.cursorPosition = {row, column: 0};
        morph.scrollCursorIntoView();
        morph.focus();
      }
      return true;
    }
  },

  {
    name: "join line",
    exec: function(morph, args = {withLine: "before"}) {
      var {start, end, lead} = morph.selection;
      if (!morph.selection.isEmpty()) {
        if (start.row === end.row) return true;
        var undo = morph.undoManager.ensureNewGroup(morph, "join line"),
            joinPositions = arr.range(0, end.row-1 - start.row).map(_ => morph.joinLine(start.row));
        morph.undoManager.group(undo);
        if (morph.selection.isMultiSelection) {
          morph.cursorPosition = joinPositions[0];
          joinPositions.slice(1).forEach(pos => morph.selection.addRange({start: pos, end: pos}));
        }
        return true;
      }
      var {row} = lead;
      if (args.withLine === "before" && row <= 0) return true
      if (args.withLine === "after" && row >= morph.document.endPosition.row) return true;
      morph.undoManager.group();
      var firstRow = args.withLine === "before" ? row-1 : row;
      morph.cursorPosition = morph.joinLine(firstRow);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "split line",
    exec: function(morph) {
      var pos = morph.cursorPosition,
          indent = morph.getLine(pos.row).match(/^\s*/)[0].length;
      morph.insertText("\n" + " ".repeat(indent), pos);
      morph.cursorPosition = pos;
      return true;
    }
  },

  {
    name: "insert line",
    exec: function(morph, opts = {where: "above"}) {
      var {row} = morph.cursorPosition,
          indent = morph.getLine(row).match(/^\s*/)[0].length;
      if (opts.where === "below") row++;
      morph.insertText(" ".repeat(indent) + "\n", {column: 0, row});
      morph.cursorPosition = {column: indent, row}
      return true;
    }
  },

  {
    name: "duplicate line or selection",
    exec: function(morph) {
      morph.undoManager.group();
      var pos = morph.selection.end;
      if (morph.selection.isEmpty()) {
        morph.insertText(morph.getLine(pos.row) + "\n", {column: 0, row: pos.row+1});
      } else {
        var range = morph.selection.range;
        morph.insertText(morph.selection.text, pos);
        morph.selection = range;
      }
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "delete emtpy line or until end of line",
    exec: function(morph) {
      var pos = morph.cursorPosition,
          line = morph.getLine(pos.row);
      if (eqPosition(morph.document.endPosition, pos)) return true;
      var range = line.trim() ?
        {start: pos, end: {row: pos.row, column: line.length}} :
        {start: {row: pos.row, column: 0}, end: {row: pos.row+1, column: 0}};
      morph.env.eventDispatcher.doCopy(morph.textInRange(range));
      morph.undoManager.group();
      morph.deleteText(range);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "delete left until beginning of line",
    exec: function(morph) {
      if (!morph.selection.isEmpty()) {
        morph.selection.text = "";
        return true;
      }
      var lineRange = morph.lineRange(),
          end = morph.cursorPosition;
      // already at beginning of line
      if (eqPosition({row: end.row, column: 0}, end)) return true;

      var start = eqPosition(lineRange.start, end) ?
            {row: end.row, column: 0}: lineRange.start,
          range = {start, end};
      morph.deleteText(range);
      return true;
    }
  },

  {
    name: "move lines up",
    multiSelectAction: "single",
    exec: function(morph) {

      var sel = morph.selection;

      if (morph.inMultiSelectMode()) { // make sure position of selections doesn't change
        var ranges = sel.selections.map(ea => ea.range);
        ranges.slice().sort(Range.compare).forEach(range => {
          morph.selection = range;
          morph.execCommand("move lines up");
        })
        ranges.forEach(range => { range.start.row--;  range.end.row--; });
        morph.selection.ranges = ranges;
        return true;
      }

      if (!sel.isEmpty() && sel.end.column === 0) sel.growRight(-1);

      var {start, end} = sel;
      var lineBefore = morph.getLine(start.row-1);
      var undo = morph.undoManager.ensureNewGroup(morph);
      morph.insertText(lineBefore + "\n", {row: end.row+1, column: 0});
      morph.deleteText({start: {row: start.row-1, column: 0}, end: {row: start.row, column: 0}});
      morph.undoManager.group(undo);
      return true;
    }
  },


  {
    name: "move lines down",
    multiSelectAction: "single",
    exec: function(morph) {
      var sel = morph.selection;

      if (morph.inMultiSelectMode()) { // make sure position of selections doesn't change
        var ranges = sel.selections.map(ea => ea.range);
        ranges.slice().sort(Range.compare).reverse().forEach(range => {
          morph.selection = range;
          morph.execCommand("move lines down");
        })
        ranges.forEach(range => { range.start.row++;  range.end.row++; });
        morph.selection.ranges = ranges;
        return true;
      }

      if (!sel.isEmpty() && sel.end.column === 0) sel.growRight(-1);
      var range = sel.range, {start, end} = range;

      if (sel.isEmpty()) range = {start: {row: start.row, column: 0}, end: {row: start.row+1, column: 0}}
      else if (end.column !== 0) range = {start, end: {row: end.row+1, column: 0}}

      var undo = morph.undoManager.ensureNewGroup(morph);
      var linesToMove = morph.deleteText(range);
      morph.insertText(linesToMove, {row: start.row+1, column: 0});
      morph.undoManager.group(undo);

      morph.selection = {start: {...start, row: start.row+1}, end: {...end, row: end.row+1}};
      return true;
    }
  },

  {
    name: "select word",
    exec: function(morph) {
      var sel = morph.selection;
      sel.range = morph.wordAt(sel.lead).range;
      return true;
    }
  },

  {
    name: "select word right",
    exec: function(morph) {
      var sel = morph.selection;
      sel.anchor = morph.wordRight(sel.end).range.end;
      return true;
    }
  },

  {
    name: "goto word left",
    exec: function(morph, args = {select: false}) {
      var select = args.select || !!morph.activeMark,
          {range} = morph.wordLeft();
      morph.selection.lead = range.start;
      if (!select) morph.selection.anchor = range.start;
      return true;
    }
  },

  {
    name: "goto word right",
    exec: function(morph, args = {select: false}) {
      var select = args.select || !!morph.activeMark,
          {range} = morph.wordRight();
      morph.selection.lead = range.end;
      if (!select) morph.selection.anchor = range.end;
      return true;
    }
  },

  {
    name: "delete word right",
    exec: function(morph) {
      morph.undoManager.group();
      var {range: {end}} = morph.wordRight(),
          range = {start: morph.cursorPosition, end};
      morph.env.eventDispatcher.doCopy(morph.textInRange(range));
      morph.deleteText(range);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "delete word left",
    exec: function(morph) {
      morph.undoManager.group();
      var {range: {start}} = morph.wordLeft(),
          range = {start, end: morph.cursorPosition};
      morph.deleteText(range);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "goto matching right",
    exec: function(morph, opts = {select: !!morph.activeMark}) {
      var pairs = opts.pairs || {
        "{": "}",
        "[": "]",
        "(": ")",
        "<": ">"
      }
      var found = morph.findMatchingForward(morph.cursorPosition, "right", pairs) ||
                  morph.findMatchingForward(morph.cursorPosition, "left", pairs);
      if (found) {
        morph.selection.lead = found;
        if (!opts.select) morph.selection.anchor = morph.selection.lead;
      }
      return true;
    }
  },

  {
    name: "goto matching left",
    exec: function(morph, opts = {select: !!morph.activeMark}) {
      var pairs = opts.pairs || {
        "}": "{",
        "]": "[",
        ")": "(",
        ">": "<"
      }
      var found = morph.findMatchingBackward(morph.cursorPosition, "left", pairs) ||
                  morph.findMatchingBackward(morph.cursorPosition, "right", pairs);
      if (found) {
        morph.selection.lead = found;
        if (!opts.select) morph.selection.anchor = morph.selection.lead;
      }
      return true;
    }
  },

  {
    name: "realign top-bottom-center",
    doc: "Cycles through centering the cursor position, aligning it at the top, aligning it at the bottom.",
    scrollCursorIntoView: false,
    multiSelectAction: "single",
    exec: function(morph) {
      var charBounds = morph.charBoundsFromTextPosition(morph.cursorPosition),
          pos = charBounds.topLeft(),
          h = morph.height - charBounds.height,
          {x: scrollX, y: scrollY} = morph.scroll;
      if (Math.abs(pos.y - scrollY) < 2) {
        scrollY = pos.y - h;
      } else if (Math.abs(pos.y - scrollY - h * 0.5) < 2) {
        scrollY = pos.y;
      } else {
        scrollY = pos.y - h * 0.5;
      }
      morph.scroll = pt(scrollX, scrollY);
      return true;
    }
  },

  {
    name: "reverse selection",
    doc: "switches the selection lead and anchor",
    exec: function(morph) {
      var sel = morph.selection;
      if (sel.isEmpty()) {
        var m = morph.popSavedMark();
        if (m) {
          morph.saveMark(morph.cursorPosition);
          sel.lead = m.position;
        }
      } else sel.reverse();
      return true;
    }
  },

  {
    name: "toggle active mark",
    doc: "....",
    handlesCount: true,
    multiSelectAction: "single",
    exec: function(morph, args, count) {

      var m = morph.activeMark,
          sel = morph.selection,
          selected = !sel.isEmpty();

      // Ctrl-U Ctrl-Space = jump to last active mark and pop it from stack
      if (count === 4) {
        let lastMark = morph.popSavedMark();
        if (lastMark) {
          sel.lead = lastMark.position;
          if (!selected) sel.anchor = sel.lead;
        }
        return true;
      }

      // no active mark? set it to the current position
      if (!m && !selected) {
        morph.activeMark = sel.lead;
        return true;
      }

      // otherwise save mark, deactivate it, and remove any selection that
      // there might be
      morph.saveMark(m || sel.anchor);
      morph.activeMark = null;
      if (selected) {
        var sels = morph.inMultiSelectMode() ?  sel.selections : [sel]
        sels.forEach(sel => sel.anchor = sel.lead);
      }

      return true;
    }
  },

  {
      name: "fit text to column",
      handlesCount: true,
      multiSelectAction: "forEach",
      exec: (morph, opts, count) => {

        // Takes a selection or the current line and will insert line breaks so
        // that all selected lines are not longer than printMarginColumn or the
        // specified count parameter. Breaks at word bounds.
        if (count === 4/*Ctrl-U*/) return morph.execCommand('join line');

        if (morph.selection.isEmpty()) morph.selectLine();
        var sel                = morph.selection,
            col                = count || /*morph.getOption('printMarginColumn') ||*/ 80,
            rows               = sel.selectedRows,
            range              = sel.range,
            splitRe            = /[ ]+/g,
            // splitRe            = /[^a-zA-Z_0-9\$\-!\?,\.]+/g,
            whitespacePrefixRe = /^[\s\t]+/,
            paragraphs         = string.paragraphs(
                                    arr.range(rows.first, rows.last)
                                        .map(row => morph.getLine(row))
                                        .join('\n'), {keepEmptyLines: true}),
            newString          = chain(paragraphs.map(fitParagraph)).flatten().value().join('\n');

        morph.undoManager.group();
        morph.replace(range, newString);
        morph.undoManager.group();

        return true;

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

        function splitLineIntoChunks(line, whitespacePrefix, n) {
          if (line.length <= col) return [whitespacePrefix + line.trim()];
          var firstChunk    = line.slice(0, col),
              splitMatch    = arr.last(string.reMatches(firstChunk, splitRe)),
              lastWordSplit = splitMatch && splitMatch.start > 0 ? splitMatch.start : col,
              first         = firstChunk.slice(0, lastWordSplit),
              rest          = whitespacePrefix + (firstChunk.slice(lastWordSplit) + line.slice(col)).trimLeft();
          return [first].concat(splitLineIntoChunks(rest, whitespacePrefix, n+1));
        }

        function fitRow(row) {
          if (row.trim() === '') return [''];
          var whitespacePrefixMatch = row.match(whitespacePrefixRe),
              whitespacePrefix = whitespacePrefixMatch ? whitespacePrefixMatch[0] : '';
          return splitLineIntoChunks(whitespacePrefix + row.trim(), whitespacePrefix);
        }

        function fitParagraph(para) {
          return /^\s*$/.test(para) ?
              para : fitRow(para.split('\n').join(' ')).join('\n') + '\n';
        }
      }
  },

  {
      name: "lowercase",
      exec: (morph) => {
        morph.undoManager.group();
        if (morph.selection.isEmpty()) morph.selection = morph.wordAt().range;
        morph.selection.text = morph.selection.text.toLowerCase();
        morph.undoManager.group();
        return true;
      }
  },

  {
      name: "remove trailing whitespace",
      exec: (morph) => {
        morph.undoManager.group();
        var i = 0;
        morph.withLinesDo(0, morph.documentEndPosition.row, (line, range) =>
          line.match(/\s+$/) && ++i && morph.replace(range, line.trimRight()));
        morph.world().setStatusMessage(`${i} lines cleaned up`);
        morph.undoManager.group();
        return true;
      }
  },

  {
    name: "uppercase",
    exec: (morph) => {
      morph.undoManager.group();
      if (morph.selection.isEmpty()) morph.selection = morph.wordAt().range;
      morph.selection.text = morph.selection.text.toUpperCase();
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "newline",
    exec: function(morph) {
      var {row} = morph.cursorPosition,
          currentLine = morph.getLine(row),
          indent = currentLine.match(/^\s*/)[0].length;
      morph.undoManager.group();
      if (!currentLine.trim() && indent) // remove trailing spaces of empty lines
        var deleted = morph.deleteText({start: {row, column: 0}, end: {row, column: indent}});
      morph.selection.text = morph.document.constructor.newline + " ".repeat(indent);
      morph.selection.collapseToEnd();
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "insertstring",
    exec: function(morph, args = {string: null, undoGroup: false}) {
      morph.saveActiveMarkAndDeactivate();
      var {string, undoGroup} = args,
          isValid = typeof string === "string" && string.length;
      if (!isValid) console.warn(`command insertstring called with not string value`);
      if (morph.rejectsInput() || !isValid) return false;
      let sel = morph.selection, isDelete = !sel.isEmpty();
      if (isDelete) morph.undoManager.group();
      sel.text = string;
      sel.collapseToEnd();
      if (isDelete) morph.undoManager.group();
      if (undoGroup) {
        if (!/^[\s\.,\?\+=]+$/.test(string) && typeof undoGroup === "number")
          morph.undoManager.groupLater(undoGroup);
        else
          morph.undoManager.group();
      }
      return true;
    }
  },

  {
    name: "toggle line wrapping",
    scrollCursorIntoView: false,
    multiSelectAction: "single",
    exec: function(morph) {
      morph.keepPosAtSameScrollOffsetWhile(() => morph.lineWrapping = !morph.lineWrapping);
      return true;
    }
  },

  {
    name: "increase font size",
    scrollCursorIntoView: false,
    exec: function(morph) { morph.keepPosAtSameScrollOffsetWhile(() => morph.fontSize++); return true; }
  },

  {
    name: "decrease font size",
    scrollCursorIntoView: false,
    exec: function(morph) { morph.keepPosAtSameScrollOffsetWhile(() => morph.fontSize--); return true; }
  },

  {
    name: "cancel input",
    scrollCursorIntoView: false,
    multiSelectAction: "single",
    exec: function(morph, args, count, evt) {
      morph.env.eventDispatcher.resetKeyInputState();
      morph.selection.disableMultiSelect
        && morph.selection.disableMultiSelect();
      if (!morph.selection.isEmpty())
        morph.selection.anchor = morph.selection.lead;
      if (morph.activeMark)
        morph.activeMark = null;
      return true;
    }
  }

];

var usefulEditorCommands = [

  {
    name: 'insert date',
    handlesCount: true,
    exec: function(ed, opts, count) {
      var dateString = date.format(new Date(), count ? 'mediumDate' : 'isoDate'/*short*/)/*long*/;
      ed.undoManager.group();
      ed.insertText(dateString);
      ed.undoManager.group();
      return true;
    }
  },

  {
    name: 'sort lines',
    exec: function(text) {
      var {start: {row: startRow}, end: {row: endRow}} = text.selection,
          lines = [];
      text.withLinesDo(startRow, endRow, line => {
        var idx = lines.findIndex(ea => ea > line);
        idx > -1 ? lines.splice(idx, 0, line) : lines.push(line)
      })  ;
      text.undoManager.group();
      text.replace(
        {start: {row: startRow, column: 0}, end: {row: endRow+1, column: 0}},
        lines.join("\n") + "\n");
      text.undoManager.group();
      return true;
    }
  },

  {
    name: 'remove duplicate lines (uniq)',
    exec: function(text) {
      var {start: {row: startRow}, end: {row: endRow}} = text.selection,
          lines = [];
      text.withLinesDo(startRow, endRow, line => arr.pushIfNotIncluded(lines, line));
      text.undoManager.group();
      text.replace(
        {start: {row: startRow, column: 0}, end: {row: endRow+1, column: 0}},
        lines.join("\n") + "\n");
      text.undoManager.group();
      return true;
    }
  },

  {
    name: "change string inflection",
    handlesCount: true,
    multiSelectAction: "single",
    exec: async function(textMorph, opts, count) {
      if (textMorph.selection.isEmpty())
        textMorph.selection = textMorph.wordAt().range;

      var ranges = textMorph.selection.ranges,
          string = textMorph.textInRange(ranges[0]);

      if (!string) {
        textMorph.setStatusMessage("Please select some text");
        return true;
      }

      var type = detectCamelCaseType(string),
          offers = arr.without(['uppercased','dashed','spaced'], type),
          {selected: [choice]} = await textMorph.world().listPrompt("Convert " + type + " into?", offers, {});

      if (!choice) return true;

      textMorph.undoManager.group();
      ranges.forEach((range,i) => {
        var string = textMorph.textInRange(range),
            replacement = convertCamelCased(string, choice);
        textMorph.replace(range, replacement);
      });
      textMorph.undoManager.group();

      textMorph.focus();
      return true;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      // TODO move to lively.lang.string
      function convertCamelCased(string, intoType) {
        // intoType = 'uppercased'|'dashed'|'spaced'
        // Example:
        // convertCamelCased("fooBar", "dashed")      // => foo-bar
        // convertCamelCased("fooBar", "spaced")      // => foo bar
        // convertCamelCased("foo bar", "uppercased") // => fooBar
        // convertCamelCased("foo-bar", "spaced")     // => foo bar
        // convertCamelCased("foo-bar", "uppercased") // => fooBar
        var match, replace, fromType = detectCamelCaseType(string).trim();

        if (fromType === 'uppercased') match = /\s*[A-Z0-9]+/g;
        else if (fromType === 'dashed') match = /-\w/g;
        else if (fromType === 'spaced') match = /\s+.?/g;

        if (intoType === 'uppercased') replace = m => m.trim().replace(/^-/, "").toUpperCase();
        else if (intoType === 'dashed') replace = m => "-" + m.trim().replace(/^-/, "").toLowerCase();
        else if (intoType === 'spaced') replace = m => " " + m.trim().replace(/^-/, "").toLowerCase();

        return string.replace(match, replace);
      }

      function detectCamelCaseType(string) {
        if (string.match(/[A-Z]/)) return 'uppercased';
        if (string.match(/-/)) return 'dashed';
        if (string.match(/\s/)) return 'spaced';
        return 'unknown';
      }
    }
  },

  {
    name: 'spell check word',
    exec: async function(text, opts) {
      var word = text.wordAt();
      if (!word.string) {
        text.setStatusMessage('no word for spellcheck!');
        return true;
      }

      var {spellCheckWord} = await System.import("lively.morphic/ide/shell/spell-checker.js");
      var suggestions = await spellCheckWord(word.string)

      if (!suggestions.length) {
        text.setStatusMessage('no suggestions for word ' + word.string);
        return true;
      }

      var {selected: [choice]} = await text.world().filterableListPrompt(
        "Choose replacement for " + word.string, suggestions);

      if (choice) {
        text.undoManager.group();
        text.replace(word.range, choice);
        text.undoManager.group();
      }

      return true;
    }
  }

];
commands.push(...usefulEditorCommands);

import { activate as iyGotoCharActivate } from "./iy-goto-char.js"
commands.push(iyGotoCharActivate);

import { completionCommands } from "./completion.js"
commands.push(...completionCommands);

import { searchCommands } from "./search.js"
commands.push(...searchCommands);

import { multiSelectCommands } from "./multi-select-commands.js";
commands.push(...multiSelectCommands);

import { commands as navCommands } from "./code-navigation-commands.js";
commands.push(...navCommands);

import { commands as codeCommands } from "./generic-code-commands.js";
commands.push(...codeCommands);

export default commands;
