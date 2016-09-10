/*global System*/

import { arr, obj, string } from "lively.lang";
import { Range } from "./range.js"
import { eqPosition, lessPosition } from "./position.js"

// commands.find(ea => ea.name === "transpose chars").exec(that)

var commands = [

  {
    name: "clipboard copy",
    doc: "placeholder for native copy",
    exec: function(morph) {
      if (morph.selection.isEmpty())
        morph.selectLine(morph.cursorPosition.row);
      return true;
    }
  },

  {
    name: "manual clipboard copy",
    doc: "attempts to copy selection via browser interface",
    exec: function(morph, opts = {delete: false}) {
      var sel = morph.selection,
          range = sel.isEmpty() ? Range.fromPositions(morph.cursorPosition, morph.lastSavedMark || morph.cursorPosition) : sel.range,
          text = morph.textInRange(range);

      morph.env.eventDispatcher.doCopy(text);
      morph.env.eventDispatcher.killRing.add(text);
      if (opts["delete"])
        morph.deleteText(range);
      else if (!sel.isEmpty()) {
        morph.activeMark = null;
        morph.saveMark(sel.anchor);
        sel.collapse(sel.lead);
      }

      return true;
    }
  },

  {
    name: "clipboard cut",
    doc: "placeholder for native cut",
    exec: function(morph) {
      if (morph.selection.isEmpty())
        morph.selectLine(morph.cursorPosition.row);
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
    exec: async function(morph, opts = {killRingCycleBack: false}) {
      var pasted, kr = morph.env.eventDispatcher.killRing;

      if (opts.killRingCycleBack && (arr.last(morph.commandHandler.history) || "").includes("clipboard paste"))
        pasted = kr.back();
      
      if (!pasted && kr.isCycling())
        pasted = kr.yank();

      if (!pasted && lively.browserExtension) {
        pasted = await lively.browserExtension.doPaste();
      }

      if (!pasted) {
        try {
          pasted = await morph.env.eventDispatcher.doPaste();
        } catch (e) { console.warn("paste failed: " + e); }
      }

      if (!pasted) pasted = kr.yank();

      if (pasted) morph.selection.text = pasted;

      return true;
    }
  },

  {
    name: "text undo",
    doc: "undo text changes",
    exec: function(morph) { morph.textUndo(); return true; }
  },

  {
    name: "text redo",
    doc: "redo text changes",
    exec: function(morph) { morph.textRedo(); return true; }
  },

  {
    name: "select all",
    doc: "Selects entire text contents.",
    exec: function(morph) { morph.selectAll(); return true; }
  },

  {
    name: "saveit",
    doc: "...",
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
    exec: function(morph) {
      morph.undoManager.group();
      morph.withSelectedLinesDo((line, range) => morph.insertText(morph.tab, range.start));
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "outdent",
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
    exec: function(morph) {
      morph.activeMark ?
        morph.selection.selectUp(1) :
        morph.selection.goUp();
      return true;
    }
  },

  {
    name: "go down",
    exec: function(morph) {
      morph.activeMark ?
        morph.selection.selectDown(1) :
        morph.selection.goDown(1);
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
    exec: function(morph) { morph.selection.selectUp(1); return true; }
  },

  {
    name: "select down",
    exec: function(morph) { morph.selection.selectDown(1); return true; }
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
          line = morph.lineRange(cursor.row, true);
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
          line = morph.lineRange(cursor.row, true);
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
      morph.gotoStartOrEnd({...opts, direction: "start"});
      return true;
    }
  },

  {
    name: "goto end",
    exec: function(morph, opts = {select: !!morph.activeMark}) {
      morph.gotoStartOrEnd({...opts, direction: "end"});
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
      var {row} = morph.cursorPosition;
      if (args.withLine === "before" && row <= 0) return true
      if (args.withLine === "after" && row >= morph.document.endPosition.row) return true;
      var firstRow = args.withLine === "before" ? row-1 : row,
          otherRow = args.withLine === "before" ? row : row+1,
          firstLine = morph.getLine(firstRow),
          otherLine = morph.getLine(otherRow),
          joined = firstLine + otherLine + "\n";
      morph.replace({start: {column: 0, row: firstRow}, end: {column: 0, row: otherRow+1}}, joined, true);
      morph.cursorPosition = {row: firstRow, column: firstLine.length}
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
      morph.env.eventDispatcher.doCopy(morph.textInRange(range));
      morph.deleteText(range);
      return true;
    }
  },

  {
    name: "move lines up",
    exec: function(morph) {
      var {start, end} = morph.selection;
      if (start.row <= 0) return true;
      var lineBefore = morph.getLine(start.row-1);
      morph.undoManager.group();
      morph.insertText(lineBefore + "\n", {row: end.row+1, column: 0});
      morph.deleteText({start: {row: start.row-1, column: 0}, end: {row: start.row, column: 0}});
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "move lines down",
    exec: function(morph) {
      var {start, end} = morph.selection;
      if (start.row >= morph.document.endPosition.row) return true;
      var lineAfter = morph.getLine(start.row+1);
      morph.undoManager.group();
      morph.deleteText({start: {row: end.row+1, column: 0}, end: {row: end.row+2, column: 0}});
      morph.insertText(lineAfter + "\n", {row: start.row, column: 0});
      morph.undoManager.group();
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
      morph.env.eventDispatcher.doCopy(morph.textInRange(range));
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
      if (selected) sel.anchor = sel.lead;
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
      let sel = morph.selection;
      sel.text = string;
      sel.collapseToEnd();
      if (typeof undoGroup === "number")
        morph.undoManager.groupLater(undoGroup);
      else if (undoGroup)
        morph.undoManager.group();
      return true;
    }
  },

  {
    name: "increase font size",
    exec: function(morph) { morph.fontSize++; return true; }
  },

  {
    name: "decrease font size",
    exec: function(morph) { morph.fontSize--; return true; }
  },

  {
    name: "cancel input",
    exec: function(morph, args, count, evt) {
      if (evt && evt.keyInputState) {
        evt.keyInputState.count = undefined;
        evt.keyInputState.keyCHain = "";
      }
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
function doEval(morph, range = morph.selection.isEmpty() ? morph.lineRange() : morph.selection.range) {
  var evalStrategies = System.get(System.decanonicalize("lively.vm/lib/eval-strategies.js"));
  if (!evalStrategies)
    throw new Error("doit not possible: lively.vm eval-strategies not available!")
  var code = morph.textInRange(range),
      evalStrategy = new evalStrategies.LivelyVmEvalStrategy(),
      opts = {System, targetModule: "lively://lively.next-prototype_2016_08_23/" + morph.id, context: morph};
  return evalStrategy.runEval(code, opts);
}

commands.push(

  {
    name: "doit",
    doc: "Evaluates the selecte code or the current line and report the result",
    exec: async function(morph) {
      if (morph.selection.isEmpty()) morph.selectLine();
      var result = await doEval(morph);
      morph.world()[result.isError ? "logError" : "setStatusMessage"](obj.inspect(result.value, {maxDepth: 1}));
      return result;
    }
  },

  {
    name: "eval all",
    doc: "Evaluates the entire text contents",
    exec: async function(morph) {
      var result = await doEval(morph, {start: {row: 0, column: 0}, end: morph.documentEndPosition});
      morph.world()[result.isError ? "logError" : "setStatusMessage"](String(result.value));
      return result;
    }
  },

  {
    name: "printit",
    doc: "Evaluates the selecte code or the current line and insert the result in a printed representation",
    exec: async function(morph) {
      if (morph.selection.isEmpty()) morph.selectLine();
      var result = await doEval(morph);
      morph.selection.collapseToEnd();
      morph.insertTextAndSelect(result.value);
      return result;
    }
  },

  {
    name: "inspectit",
    doc: "...",
    handlesCount: true,
    exec: async function(morph, _, count = 1) {
      var result = await doEval(morph);
      morph.selection.collapseToEnd();
      morph.insertTextAndSelect(obj.inspect(result.value, {maxDepth: count}));
      return result;
    }
  },

  {
    name: "comment box",
    exec: function(morph, _, count) {
      morph.undoManager.group();

      if (morph.selection.isEmpty()) {
        morph.insertText("-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-");
        morph.undoManager.group();
        return true;
      }

      var range = morph.selection.range,
          lines = morph.withSelectedLinesDo(line => line),
          indent = [range.start.column].concat(lines.map(function(line) { return line.match(/^\s*/); }).flatten().compact().pluck('length')).min(),
          length = lines.pluck('length').max() - indent,
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
      // morph.selection.goUp();
      // morph.toggleCommentLines();
      // insert fence below
      morph.cursorPosition = {row: range.end.row+2, column: 0};

      morph.insertText(string.indent(fence + '\n', ' ', indent));

      // morph.selection.goUp();
      // morph.selection.gotoLineEnd();
      // morph.toggleCommentLines();

      // select it all
      morph.selection.range = {start: {row: range.start.row, column: 0}, end: morph.cursorPosition};
      morph.undoManager.group();      

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

export default commands;
