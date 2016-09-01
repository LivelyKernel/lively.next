/*global System*/

import { arr } from "lively.lang";
import { Range } from "./text/selection.js"
import { eqPosition, lessPosition } from "./text/position.js"

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
    name: "doit",
    doc: "Evaluates the selecte code or the current line and report the result",
    exec: async function(morph) {
      if (morph.selection.isEmpty()) morph.selectLine();
      var opts = {System, targetModule: "lively://lively.next-prototype_2016_08_23/" + morph.id},
          result = await lively.vm.runEval(morph.selection.text, opts);
      morph.world()[result.isError ? "logError" : "setStatusMessage"](result.value);
      return result;
    }
  },

  {
    name: "printit",
    doc: "Evaluates the selecte code or the current line and insert the result in a printed representation",
    exec: async function(morph) {
      if (morph.selection.isEmpty()) morph.selectLine();
      var opts = {System, targetModule: "lively://lively.next-prototype_2016_08_23/" + morph.id},
          result = await lively.vm.runEval(morph.selection.text, opts);
      morph.selection.collapseToEnd();
      morph.insertTextAndSelect(result.value);
      return result;
    }
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
    name: "move cursor left",
    doc: "Move the cursor 1 character left. At the beginning of a line move the cursor up. If a selection is active, collapse the selection left.",
    exec: function(morph) { morph.selection.goLeft(1); return true; }
  },

  {
    name: "move cursor right",
    doc: "Move the cursor 1 character right. At the end of a line move the cursor down. If a selection is active, collapse the selection right.",
    exec: function(morph) { morph.selection.goRight(1); return true; }
  },

  {
    name: "move cursor up",
    doc: "Move the cursor 1 line. At the end of a line move the cursor down. If a selection is active, collapse the selection right.",
    exec: function(morph) { morph.selection.goUp(); return true; }
  },

  {
    name: "move cursor down",
    exec: function(morph) { morph.selection.goDown(1); return true; }
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
    name: "select to start",
    exec: function(morph) {
      morph.selection.lead = {row: 0, column: 0};
      morph.scrollCursorIntoView();
      return true;
    }
  },

  {
    name: "select to end",
    exec: function(morph) {
      morph.selection.lead = morph.document.endPosition;
      morph.scrollCursorIntoView();
      return true;
    }
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
    name: "select to line start",
    exec: function(morph, opts = {collapse: false}) {
      var sel = morph.selection,
          cursor = sel.lead,
          line = morph.lineRange(cursor.row, true);
      sel.lead = eqPosition(cursor, line.start) ? {column: 0, row: cursor.row} : line.start;
      opts && opts.collapse && (sel.anchor = sel.lead)
      return true;
    }
  },

  {
    name: "select to line end",
    exec: function(morph, opts = {collapse: false}) {
      var sel = morph.selection,
          cursor = sel.lead,
          line = morph.lineRange(cursor.row, true);
      sel.lead = line.end;
      opts && opts.collapse && (sel.anchor = sel.lead)
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
    name: "goto page up",
    exec: function(morph) { morph.pageUpOrDown({direction: "up", select: false}); return true; }
  },

  {
    name: "goto page down",
    exec: function(morph) { morph.pageUpOrDown({direction: "down", select: false}); return true; }
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
    exec: function(morph) { morph.gotoStartOrEnd({direction: "start", select: false}); return true; }
  },

  {
    name: "goto end",
    exec: function(morph) { morph.gotoStartOrEnd({direction: "end", select: false}); return true; }
  },

  {
    name: "goto start and select",
    exec: function(morph) { morph.gotoStartOrEnd({direction: "start", select: true}); return true; }
  },

  {
    name: "goto end and select",
    exec: function(morph) { morph.gotoStartOrEnd({direction: "end", select: true}); return true; }
  },

  {
    name: "goto line",
    exec: async function(morph) {
      var row = Number(await morph.world().prompt("Enter line number"));
      if (!isNaN(row)) {
        morph.cursorPosition = {row, column: 0};
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
      morph.undoManager.group();
      if (!line.trim())
        morph.deleteText({start: {row: pos.row, column: 0}, end: {row: pos.row+1, column: 0}});
      else
        morph.deleteText({start: pos, end: {row: pos.row, column: line.length}});
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
      var range = morph.lineRange(),
          pos = morph.cursorPosition;
      // already at beginning of line
      if (eqPosition({row: pos.row, column: 0}, pos))
        return true;
      var start = eqPosition(range.start, pos) ?
        {row: pos.row, column: 0}: range.start;
      morph.deleteText({start, end: pos});
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
    name: "goto word left",
    exec: function(morph, args = {select: false}) {
      var {range} = morph.wordLeft();
      morph.selection.lead = range.start;
      if (!args.select) morph.selection.anchor = range.start;
      return true;
    }
  },

  {
    name: "goto word right",
    exec: function(morph, args = {select: false}) {
      var {range} = morph.wordRight();
      morph.selection.lead = range.end;
      if (!args.select) morph.selection.anchor = range.end;
      return true;
    }
  },

  {
    name: "remove word right",
    exec: function(morph) {
      morph.undoManager.group();
      var {range: {end}} = morph.wordRight();
      morph.deleteText({start: morph.cursorPosition, end})
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: "remove word left",
    exec: function(morph) {
      morph.undoManager.group();
      var {range: {start}} = morph.wordLeft();
      morph.deleteText({start, end: morph.cursorPosition})
      morph.undoManager.group();
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
    exec: function(morph) { morph.selection.reverse(); return true; }
  },

  {
    name: "insertstring",
    exec: function(morph, args = {string: null, undoGroup: false}) {
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
  }

]




export class CommandHandler {

  exec(command, morph, args, evt) {
    let name = !command || typeof command === "string" ? command : command.command,
        cmd = command && commands.find(ea => ea.name === name),
        result = !cmd || typeof cmd.exec !== "function" ?
          false : cmd.exec(morph, args, evt);
    if (result && typeof result.catch === "function")
      result.catch(err => {
        console.error(`Error in interactive command ${name}: ${err.stack}`);
        throw err;
      });
    return result;
  }

}

export var defaultCommandHandler = new CommandHandler();
