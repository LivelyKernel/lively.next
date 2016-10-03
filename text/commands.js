/*global System*/

import { chain, arr, obj, string } from "lively.lang";
import { pt, Rectangle } from "lively.graphics"
import { Range } from "./range.js"
import { show } from "../index.js"
import { eqPosition, lessPosition } from "./position.js"


// commands.find(ea => ea.name === "transpose chars").exec(that)

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
    exec: (morph, opts = {delete: false, dontTryNativeClipboard: false}) => {
      var sel = morph.selection,
          fullText = sel.text;
      morph.saveMark(sel.anchor);
      morph.activeMark = null;

      var sels = sel.isMultiSelection ? sel.selections.slice() : [sel]
      sels.forEach(sel => {
        var range = sel.isEmpty() ? morph.lineRange() : sel.range,
            text = morph.textInRange(range);
          morph.env.eventDispatcher.killRing.add(text);
        if (opts["delete"])
          morph.deleteText(range);
        else if (!sel.isEmpty())
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


      if (opts.killRingCycleBack && (arr.last(arr.pluck(morph.commandHandler.history, "name")) || "").includes("clipboard paste"))
        pasted = kr.back();

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
          {selected} = await morph.world().filterableListPrompt(
            "select items to paste", buffer, {preselect: pointer, multiSelect: true});
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
    exec: function(morph) {
      var sel = morph.selection;
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
    exec: function(morph) {
      var sel = morph.selection;
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
          scroll = morph.scroll;
      if (Math.abs(pos.y - scroll.y) < 2) {
          scroll.y = pos.y - h;
      } else if (Math.abs(pos.y - scroll.y - h * 0.5) < 2) {
          scroll.y = pos.y;
      } else {
          scroll.y = pos.y - h * 0.5;
      }
      morph.scroll = pt(scroll.x, scroll.y);
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
      if (evt && evt.keyInputState) {
        evt.keyInputState.count = undefined;
        evt.keyInputState.keyCHain = "";
      }
      morph.selection.disableMultiSelect
        && morph.selection.disableMultiSelect();
      if (!morph.selection.isEmpty())
        morph.selection.anchor = morph.selection.lead;
      if (morph.activeMark)
        morph.activeMark = null;
      return true;
    }
  }

]

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME move this stuff below into a JS related module
function doEval(morph, range = morph.selection.isEmpty() ? morph.lineRange() : morph.selection.range, env) {
  var evalStrategies = System.get(System.decanonicalize("lively.vm/lib/eval-strategies.js")),
      evalStrategy = evalStrategies && new evalStrategies.LivelyVmEvalStrategy();;
  if (!evalStrategy)
    throw new Error("doit not possible: lively.vm eval-strategies not available!")

  if (!env) env = morph.evalEnvironment || {}; // FIXME!
  var {targetModule, context} = env,
      code = morph.textInRange(range),
      context = context || morph,
      targetModule = targetModule || "lively://lively.next-prototype_2016_08_23/" + morph.id,
      sourceURL = targetModule + "_doit_" + Date.now(),
      opts = {System, targetModule, context, sourceURL};
  return evalStrategy.runEval(code, opts);
}

function maybeSelectCommentOrLine(morph) {
  // Dan's famous selection behvior! Here it goes...
  /*   If you click to the right of '//' in the following...
  'wrong' // 'try this'.slice(4)  //should print 'this'
  'http://zork'.slice(7)          //should print 'zork'
  */
  // If click is in comment, just select that part
  var sel = morph.selection,
      {row, column} = sel.lead,
      text = morph.selectionOrLineString();

  if (!sel.isEmpty()) return;

  // text now equals the text of the current line, now look for JS comment
  var idx = text.indexOf('//');
  if (idx === -1                          // Didn't find '//' comment
      || column < idx                 // the click was before the comment
      || (idx>0 && (':"'+"'").indexOf(text[idx-1]) >=0)    // weird cases
      ) { morph.selectLine(row); return }

  // Select and return the text between the comment slashes and end of method
  sel.range = {start: {row, column: idx+2}, end: {row, column: text.length}};
}


var printEvalResult = (function() {
  var maxColLength = 300,
      itSym = typeof Symbol !== "undefined" && Symbol.iterator;
  return function(result, maxDepth) {
    var err = result instanceof Error ? result : result.isError ? result.value : null;
    return err ?
      String(err) + (err.stack ? "\n" + err.stack : "") :
      printInspect(result.value, maxDepth);
  }

  function printIterable(val, ignore) {
    var isIterable = typeof val !== "string"
                  && !Array.isArray(val)
                  && itSym && typeof val[itSym] === "function";
    if (!isIterable) return ignore;
    var hasEntries = typeof val.entries === "function",
        it = hasEntries ? val.entries() : val[itSym](),
        values = [],
        open = hasEntries ? "{" : "[", close = hasEntries ? "}" : "]",
        name = val.constructor && val.constructor.name || "Iterable";
    for (var i = 0, next; i < maxColLength; i++) {
      next = it.next();
      if (next.done) break;
      values.push(next.value);
    }
    var printed = values.map(ea => hasEntries ?
        `${printInspect(ea[0], 1)}: ${printInspect(ea[1], 1)}` :
        printInspect(ea, 2)).join(", ");
    return `${name}(${open}${printed}${close})`;
  }

  function inspectPrinter(val, ignore) {
    if (!val) return ignore;
    if (val.isMorph) return String(val);
    if (val instanceof Promise) return "Promise()";
    if (val instanceof Node) return String(val);
    if (typeof ImageData !== "undefined" && val instanceof ImageData) return String(val);
    var length = val.length || val.byteLength;
    if (length !== undefined && length > maxColLength && val.slice) {
      var printed = typeof val === "string" || val.byteLength ?
                      String(val.slice(0, maxColLength)) :
                      val.slice(0,maxColLength).map(string.print);
      return "[" + printed + ",...]";
    }
    var iterablePrinted = printIterable(val, ignore);
    if (iterablePrinted !== ignore) return iterablePrinted;
    return ignore;
  }

  function printInspect(object, maxDepth) {
    if (typeof maxDepth === "object")
      maxDepth = maxDepth.maxDepth || 2;

    if (!object) return String(object);
    if (typeof object === "string") return '"' + (object.length > maxColLength ? (object.slice(0,maxColLength) + "...") : String(object)) + '"';
    if (object instanceof Error) return object.stack || String(object);
    if (!obj.isObject(object)) return String(object);
    var inspected = obj.inspect(object, {customPrinter: inspectPrinter, maxDepth, printFunctionSource: true});
    // return inspected;
    return inspected === "{}" ? String(object) : inspected;
  }

})();

commands.push(

  {
    name: "doit",
    doc: "Evaluates the selecte code or the current line and report the result",
    exec: async function(morph, opts, count = 1) {
      // opts = {targetModule}
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      err ?
        morph.world().logError(err) :
        morph.world().setStatusMessage(printEvalResult(result, count));
      return result;
    }
  },

  {
    name: "eval all",
    doc: "Evaluates the entire text contents",
    scrollCursorIntoView: false,
    exec: async function(morph, opts) {
      // opts = {targetModule}
      var result, err;
      try {
        result = await doEval(morph, {start: {row: 0, column: 0}, end: morph.documentEndPosition}, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      err ?
        morph.world().logError(err) :
        morph.world().setStatusMessage(String(result.value));
      return result;
    }
  },

  {
    name: "printit",
    doc: "Evaluates the selecte code or the current line and insert the result in a printed representation",
    exec: async function(morph, opts) {
      // opts = {targetModule}
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      morph.selection.collapseToEnd();
      // morph.insertTextAndSelect(err ? err.stack || String(err) : String(result.value));
      morph.insertTextAndSelect(err ? String(err) + (err.stack ? "\n" + err.stack : "") : String(result.value));
      return result;
    }
  },

  {
    name: "inspectit",
    doc: "...",
    handlesCount: true,
    exec: async function(morph, opts, count = 1) {
      // opts = {targetModule}
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      morph.selection.collapseToEnd();
      // morph.insertTextAndSelect(err ? err.stack || String(err) : obj.inspect(result.value, {maxDepth: count}));
      morph.insertTextAndSelect(printEvalResult(result, count));
      return result;
    }
  },

  {
    name: "toggle comment",
    exec: function(morph) {

      var doc = morph.document,
          sel = morph.selection;

      if (!sel.isEmpty() && sel.end.column === 0)
        sel.growRight(-1);

      var startRow = sel.start.row,
          lines = doc.lines.slice(sel.start.row, sel.end.row+1),
          isCommented = lines.every(line => line.trim() && line.match(/^\s*(\/\/|$)/));

      morph.undoManager.group();
      if (isCommented) {
        lines.forEach((line, i) => {
          var match = line.match(/^(\s*)(\/\/\s?)(.*)/);
          if (match) {
            var [_, before, comment, after] = match,
                range = {
                  start: {row: startRow+i, column: before.length},
                  end: {row: startRow+i, column: before.length+comment.length}
                };
            morph.deleteText(range);
          }
        });

      } else {
        var minSpace = lines.reduce((minSpace, line, i) =>
              !line.trim() && (!sel.isEmpty() || sel.start.row !== sel.end.row) ?
                minSpace :
                Math.min(minSpace, line.match(/^\s*/)[0].length), Infinity),
            minSpace = minSpace === Infinity ? 0 : minSpace;
        lines.forEach((line, i) => {
          var [_, space, rest] = line.match(/^(\s*)(.*)/);
          morph.insertText(`// `, {row: startRow+i, column: minSpace});
        });
      }
      morph.undoManager.group();

      return true;
    }
  },

  {
    name: "toggle block comment",
    exec: function(morph) {
      var existing = blockCommentInRangeOrPos();

      morph.undoManager.group();
      if (existing) {
        var {start, end} = existing;
        morph.deleteText({start: {row: end.row, column: end.column-2}, end});
        morph.deleteText({start, end: {row: start.row, column: start.column+2}});

      } else {
        morph.insertText(`/*`, morph.selection.start);
        morph.insertText(`*/`, morph.selection.end);
        var select = !morph.selection.isEmpty();
        morph.selection.growLeft(2);
        if (!select) morph.selection.collapse();
      }

      morph.undoManager.group();

      return true;


      // FIXME use JS tokens for this thing...
      function blockCommentInRangeOrPos() {
        // blockCommentInRangeOrPos()

        if (!morph.selection.isEmpty()) {
          var selText = morph.selection.text;
          return selText.slice(0,2) === "/*" && selText.slice(-2) === "*/" ?
            morph.selection.range : null;
        }

        var pos = morph.cursorPosition;

        var startLeft = morph.search("/*", {start: pos, backwards: true});
        if (!startLeft) return null;
        var endLeft = morph.search("*/", {start: pos, backwards: true});
        // /*....*/ ... <|>
        if (endLeft && lessPosition(startLeft, endLeft)) return null;

        var endRight = morph.search("*/", {start: pos});
        if (!endRight) return null;
        var startRight = morph.search("/*", {start: pos});
        // <|> ... /*....*/
        if (startRight && lessPosition(startRight, endRight)) return null;

        return {start: startLeft.range.start, end: endRight.range.end};
      }
    }
  },

  {
    name: "comment box",
    exec: function(morph, _, count) {

      var undo = morph.undoManager.ensureNewGroup(morph, "comment box");

      if (morph.selection.isEmpty()) {
        morph.insertText("-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-");
        // undo = undo || arr.last(morph.undoManager.undos);
        morph.execCommand("toggle comment");
        morph.undoManager.group(undo);
        return true;
      }

      var range = morph.selection.range,
          lines = morph.withSelectedLinesDo(line => line),
          indent = arr.min([range.start.column].concat(
            chain(lines).map(function(line) { return line.match(/^\s*/); })
              .flatten().compact().pluck('length').value())),
          length = arr.max(lines.map(ea => ea.length)) - indent,
          fence = Array(Math.ceil(length / 2) + 1).join('-=') + '-';

      // comment range
      // morph.toggleCommentLines();
      morph.collapseSelection();

      // insert upper fence
      morph.cursorPosition = {row: range.start.row, column: 0}
      if (count)
        morph.insertText(string.indent("-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-" + '\n', ' ', indent));
      else
        morph.insertText(string.indent(fence + '\n', ' ', indent));
      morph.selection.goUp();
      morph.execCommand("toggle comment");
      // insert fence below
      morph.cursorPosition = {row: range.end.row+2, column: 0};

      morph.insertText(string.indent(fence + '\n', ' ', indent));

      morph.selection.goUp();
      // morph.selection.gotoLineEnd();
      morph.execCommand("toggle comment");

      // select it all
      morph.selection.range = {start: {row: range.start.row, column: 0}, end: morph.cursorPosition};
      morph.undoManager.group(undo);

      return true;
    },
    multiSelectAction: "forEach",
    handlesCount: true
  }
);

import { activate as iyGotoCharActivate } from "./iy-goto-char.js"
commands.push(iyGotoCharActivate);

import { completionCommands } from "./completion.js"
commands.push(...completionCommands);

import { searchCommands } from "./search.js"
commands.push(...searchCommands);

// import { multiSelectCommands } from "./multi-select-commands.js"
var multiSelectCommands = [

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
      found.forEach(({range}) => morph.selection.addRange(range));
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
        morph.getLine(row).length > Math.min(endCol, startCol) // only add if line has content at the column
     && morph.selection.addRange({end: {row, column: endCol}, start: {row, column: startCol}}));
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

]
commands.push(...multiSelectCommands);


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var jsIdeCommands = [
  {
    name: "[javascript] list errors and warnings",
    exec: async text => {
      var markers = (text.markers || []).filter(({type}) => type === "js-undeclared-var" || type === "js-syntax-error");
      if (!markers.length) { show("no warnings or errors"); return true; }

      var items = markers.map(({range, type}) => {
                    var string = `[${type.split("-").slice(1).join(" ")}] ${text.textInRange(range)}`
                    return {isListItem: true, string, value: range}
                  }),
          {selected: [sel]} = await text.world().filterableListPrompt("jump to warning or error", items);
          // var {selected: [sel]} = await text.world().filterableListPrompt("jump to warning or error", items);
      if (sel) {
        text.saveMark();
        text.selection = sel;
        text.centerRow(sel.start.row);
      }
      return true;
    }
  }
]
commands.push(...jsIdeCommands);

export default commands;
