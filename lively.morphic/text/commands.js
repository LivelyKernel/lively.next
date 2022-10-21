/* global System,localStorage */

import { chain, arr, string, date } from 'lively.lang';
import { pt } from 'lively.graphics';
import { Range } from './range.js';
import { eqPosition } from './position.js';

const commands = [

  {
    name: 'clipboard copy',
    doc: 'placeholder for native copy',
    scrollCursorIntoView: false,
    exec: function (morph) {
      if (morph.readOnly) return false;
      if (morph.selection.isEmpty()) { morph.selectLine(morph.cursorPosition.row); }
      return true;
    }
  },

  {
    name: 'manual clipboard copy',
    doc: 'attempts to copy selection via browser interface',
    scrollCursorIntoView: false,
    multiSelectAction: 'single',
    exec: function (morph, opts = {
      collapseSelection: true,
      delete: false,
      dontTryNativeClipboard: false
    }) {
      const sel = morph.selection;
      const fullText = sel.text;
      const collapseSelection = opts.hasOwnProperty('collapseSelection')
        ? opts.collapseSelection
        : true;
      morph.saveMark(sel.anchor);
      morph.activeMark = null;

      const sels = sel.isMultiSelection ? sel.selections.slice() : [sel];
      sels.forEach(sel => {
        const range = sel.isEmpty() ? morph.lineRange() : sel.range;
        const text = morph.textInRange(range);
        morph.env.eventDispatcher.killRing.add(text);
        if (opts.delete) { morph.deleteText(range); } else if (!sel.isEmpty() && collapseSelection) { sel.collapse(sel.lead); }
      });

      if (!opts.dontTryNativeClipboard) { morph.env.eventDispatcher.doCopy(fullText); }

      return true;
    }
  },

  {
    name: 'clipboard cut',
    doc: 'placeholder for native cut',
    exec: function (morph) {
      if (morph.selection.isEmpty()) { morph.selectLine(morph.cursorPosition.row, true/* including line end */); }
      return true;
    }
  },

  {
    name: 'clipboard paste',
    doc: 'placeholder for native paste',
    exec: function () { return true; }
  },

  {
    name: 'manual clipboard paste',
    doc: 'attempts to paste from the clipboard to lively – currently requires browser extension!',
    multiSelectAction: 'single',
    exec: async function (morph, opts = { killRingCycleBack: false }) {
      let pasted; const kr = morph.env.eventDispatcher.killRing;

      if (opts.killRingCycleBack &&
       (arr.last(arr.pluck(morph.commandHandler.history, 'name')) || '')
         .includes('clipboard paste')) pasted = kr.back();

      if (!pasted && kr.isCycling()) { pasted = kr.yank(); }

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
        morph.selection.selections.slice(0, -1)
          .reverse()
          .map((sel, i) => {
            let idx = (kr.pointer - 1) - i;
            if (idx < 0) idx = kr.buffer.length - 1;
            return { selection: sel, pasted: kr.buffer[idx] || '' };
          })
          .concat({ selection: morph.selection.defaultSelection, pasted })
          .forEach(({ selection, pasted }) => selection.text = pasted);
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
    name: 'browse clipboard',
    exec: async function (morph) {
      const { pointer, buffer } = morph.env.eventDispatcher.killRing;
      const items = buffer.map(value => ({ isListItem: true, string: string.truncate(value, 80).replace(/\n/g, ''), value }));
      const { selected } = await morph.world().filterableListPrompt(
        'select items to paste', items, { preselect: pointer, multiSelect: true });
      if (selected.length) {
        morph.undoManager.group();
        morph.insertTextAndSelect(selected.join('\n'));
        morph.undoManager.group();
      }
      return true;
    }
  },

  {
    name: 'text undo',
    doc: 'undo text changes',
    multiSelectAction: 'single',
    exec: function (morph) { morph.textUndo(); return true; }
  },

  {
    name: 'text redo',
    doc: 'redo text changes',
    multiSelectAction: 'single',
    exec: function (morph) { morph.textRedo(); return true; }
  },

  {
    name: 'select all',
    doc: 'Selects entire text contents.',
    scrollCursorIntoView: false,
    multiSelectAction: 'single',
    exec: function (morph) {
      morph.saveMark();
      morph.selectAll();
      return true;
    }
  },

  {
    name: 'delete backwards',
    doc: 'Delete the character in front of the cursor or the selection.',
    exec: function (morph) {
      if (morph.rejectsInput()) return false;

      return morph.withMetaDo({ reconcileChanges: true }, () => {
        if (
          morph.editorPlugin &&
        typeof morph.editorPlugin.cmd_newline === 'function' &&
        morph.editorPlugin.cmd_delete_backwards()
        ) return true;

        const sel = morph.selection;
        if (sel.isEmpty()) sel.growLeft(1);
        sel.text = '';
        sel.collapse();
        if (morph.activeMark) morph.activeMark = null;
        return true;
      });
    }
  },

  {
    name: 'delete',
    doc: 'Delete the character following the cursor or the selection.',
    exec: function (morph) {
      const sel = morph.selection;
      if (morph.rejectsInput()) return false;
      if (sel.isEmpty()) sel.growRight(1);
      sel.text = '';
      sel.collapse();
      if (morph.activeMark) morph.activeMark = null;
      return true;
    }
  },

  {
    name: 'indent',
    scrollCursorIntoView: false,
    exec: function (morph) {
      morph.undoManager.group();
      morph.withSelectedLinesDo((line, range) =>
        morph.insertText(morph.tab, range.start));
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'outdent',
    scrollCursorIntoView: false,
    exec: function (morph) {
      morph.undoManager.group();
      morph.withSelectedLinesDo((line, range) =>
        line.startsWith(morph.tab) && morph.deleteText({
          start: range.start,
          end: { row: range.start.row, column: morph.tab.length }
        }));
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'indent according to mode',
    exec: async (morph, args = {}) => {
      const mode = morph.editorPlugin && morph.editorPlugin.mode;
      if (!mode) return true;
      let firstRow; let lastRow;
      const undo = args.hasOwnProperty('undo') ? args.undo : true;

      if (args.hasOwnProperty('firstRow') && args.hasOwnProperty('lastRow')) { ({ firstRow, lastRow } = args); } else if (morph.selection.isEmpty()) { firstRow = lastRow = morph.cursorPosition.row; } else { ({ first: firstRow, last: lastRow } = morph.selection.selectedRows); }
      // move this command to lively.ide
      const { indentLines } = await System.import('lively.ide/editor-modes.js');

      undo && morph.undoManager.group();
      indentLines(morph, mode, firstRow, lastRow, 'smart', true, args);
      undo && morph.undoManager.group();

      return true;
    }
  },

  {
    name: 'tab - snippet expand or indent',
    scrollCursorIntoView: true,
    exec: function (morph) {
      const snippet = morph.snippets.find(snippet => snippet.canExpand(morph));
      if (snippet) {
        snippet.expandAtCursor(morph);
        return true;
      }
      return morph.selection.isEmpty()
        ? morph.execCommand('insertstring', { string: morph.tab })
        : morph.execCommand('indent according to mode');
    }
  },

  {
    name: 'browse snippets',
    scrollCursorIntoView: true,
    exec: async function (morph) {
      const items = morph.snippets.map(ea =>
        ({ isListItem: true, string: `${ea.trigger} - ${ea.expansion}`, value: ea }));
      const { selected: [snippet] } = await morph.world().filterableListPrompt(
        'select snippet', items, { requester: morph });
      if (snippet) snippet.expandAtCursor(morph);
      return true;
    }
  },

  {
    name: 'transpose chars',
    exec: function (morph) {
      if (morph.selection.isEmpty()) {
        const { row, column } = morph.cursorPosition;
        const range = Range.create(row, column - 1, row, column + 1);
        const line = morph.getLine(row);
        const left = line[column - 1];
        const right = line[column];
        if (left && right) morph.replace(range, right + left, true);
      }
      return true;
    }
  },

  {
    name: 'cycle selection contents',
    documentation: 'If there are multiple selections, will take the text of the first one and replace the second one with it, the text of the second will replace the third, the last selection contents will replace the contents of the first.',
    multiSelectAction: 'single',
    exec: function (ed) {
      const sels = ed.selection.selections;
      ed.undoManager.group();
      sels.reduce((newContent, sel) => {
        const oldContent = sel.text;
        sel.text = newContent;
        return oldContent;
      }, arr.last(sels).text);
      ed.undoManager.group();
      return true;
    }
  },

  {
    name: 'go left',
    doc: 'Move the cursor 1 character left. At the beginning of a line move the cursor up. If a selection is active, collapse the selection left.',
    exec: function (morph) {
      morph.activeMark
        ? morph.selection.selectLeft(1)
        : morph.selection.goLeft(1);
      return true;
    }
  },

  {
    name: 'go right',
    doc: 'Move the cursor 1 character right. At the end of a line move the cursor down. If a selection is active, collapse the selection right.',
    exec: function (morph) {
      morph.activeMark
        ? morph.selection.selectRight(1)
        : morph.selection.goRight(1);
      return true;
    }
  },

  {
    name: 'go up',
    doc: 'Move the cursor 1 line. At the end of a line move the cursor down. If a selection is active, collapse the selection right.',
    scrollCursorIntoView: true,
    exec: function (morph) {
      morph.activeMark
        ? morph.selection.selectUp(1)
        : morph.selection.goUp(1, true/* use screen position */);
      return true;
    }
  },

  {
    name: 'go down',
    exec: function (morph) {
      morph.activeMark
        ? morph.selection.selectDown(1)
        : morph.selection.goDown(1, true/* use screen position */);
      return true;
    }
  },

  {
    name: 'select left',
    exec: function (morph) { morph.selection.selectLeft(1); return true; }
  },

  {
    name: 'select right',
    exec: function (morph) { morph.selection.selectRight(1); return true; }
  },

  {
    name: 'select up',
    exec: function (morph) { morph.selection.selectUp(1, true/* use screen position */); return true; }
  },

  {
    name: 'select down',
    exec: function (morph) { morph.selection.selectDown(1, true/* use screen position */); return true; }
  },

  {
    name: 'select line',
    exec: function (morph) {
      const sel = morph.selection;
      const row = sel.lead.row;
      const fullLine = morph.lineRange(row, false);
      sel.range = sel.range.equals(fullLine) ? morph.lineRange(row, true) : fullLine;
      return true;
    }
  },

  {
    name: 'goto line start',
    exec: function (morph, opts = { select: false }) {
      const select = opts.select || !!morph.activeMark;
      const sel = morph.selection;
      const cursor = sel.lead;
      const line = morph.screenLineRange(cursor, true);
      sel.lead = eqPosition(cursor, line.start) ? { column: 0, row: cursor.row } : line.start;
      !select && (sel.anchor = sel.lead);
      return true;
    }
  },

  {
    name: 'goto line end',
    exec: function (morph, opts = { select: false }) {
      const select = opts.select || !!morph.activeMark;
      const sel = morph.selection;
      const cursor = sel.lead;
      const line = morph.screenLineRange(cursor, true);
      sel.lead = line.end;
      !select && (sel.anchor = sel.lead);
      return true;
    }
  },

  {
    name: 'goto page up',
    exec: function (morph) { morph.pageUpOrDown({ direction: 'up', select: !!morph.activeMark }); return true; }
  },

  {
    name: 'goto page down',
    exec: function (morph) { morph.pageUpOrDown({ direction: 'down', select: !!morph.activeMark }); return true; }
  },

  {
    name: 'goto page up and select',
    exec: function (morph) { morph.pageUpOrDown({ direction: 'up', select: true }); return true; }
  },

  {
    name: 'goto page down and select',
    exec: function (morph) { morph.pageUpOrDown({ direction: 'down', select: true }); return true; }
  },

  {
    name: 'goto start',
    exec: function (morph, opts = { select: !!morph.activeMark }) {
      morph.gotoDocumentStart({ ...opts });
      return true;
    }
  },

  {
    name: 'goto end',
    exec: function (morph, opts = { select: !!morph.activeMark }) {
      morph.gotoDocumentEnd({ ...opts });
      return true;
    }
  },

  {
    name: 'goto paragraph above',
    exec: function (morph, opts = { select: !!morph.activeMark }) {
      const pRange = morph.paragraphRangeAbove(morph.cursorPosition.row);
      pRange.start.row--;
      morph.selection.lead = pRange.start;
      if (!opts.select) morph.collapseSelection();
      return true;
    }
  },

  {
    name: 'goto paragraph below',
    exec: function (morph, opts = { select: !!morph.activeMark }) {
      const pRange = morph.paragraphRangeBelow(morph.cursorPosition.row);
      pRange.end.row++;
      morph.selection.lead = pRange.end;
      if (!opts.select) morph.collapseSelection();
      return true;
    }
  },

  {
    name: 'move cursor to screen bottom in 1/3 steps',
    readOnly: true,
    exec: function (morph) {
      const select = !!morph.activeMark;
      const currentPos = morph.cursorPosition;
      const firstRow = morph.textLayout.firstFullVisibleLine(morph);
      const lastRow = morph.textLayout.lastFullVisibleLine(morph);
      const middleRow = firstRow + Math.floor((lastRow - firstRow) / 2);
      const newPos = currentPos;
      if (currentPos.row < firstRow) newPos.row = firstRow;
      else if (currentPos.row < middleRow) newPos.row = middleRow;
      else if (currentPos.row < lastRow) newPos.row = lastRow;
      else return true;
      morph.selection.lead = newPos;
      if (!select) morph.selection.anchor = morph.selection.lead;
      return true;
    }
  },

  {
    name: 'move cursor to screen top in 1/3 steps',
    readOnly: true,
    exec: function (morph) {
      const select = !!morph.activeMark;
      const currentPos = morph.cursorPosition;
      const firstRow = morph.textLayout.firstFullVisibleLine(morph);
      const lastRow = morph.textLayout.lastFullVisibleLine(morph);
      const middleRow = firstRow + Math.floor((lastRow - firstRow) / 2);
      const newPos = currentPos;
      if (currentPos.row <= firstRow) return true;
      if (currentPos.row <= middleRow) newPos.row = firstRow;
      else if (currentPos.row <= lastRow) newPos.row = middleRow;
      else newPos.row = lastRow;
      morph.selection.lead = newPos;
      if (!select) morph.selection.anchor = morph.selection.lead;
      return true;
    }
  },

  {
    name: 'goto line',
    exec: async function (morph) {
      const select = !!morph.activeMark;
      const row = Number(await morph.world().prompt('Enter line number'));
      if (!isNaN(row)) {
        if (select) morph.selection.lead = { row, column: 0 };
        else morph.cursorPosition = { row, column: 0 };
        morph.scrollCursorIntoView();
        morph.focus();
      }
      return true;
    }
  },

  {
    name: 'join line',
    exec: function (morph, args = { withLine: 'before' }) {
      const { start, end, lead } = morph.selection;
      if (!morph.selection.isEmpty()) {
        if (start.row === end.row) return true;
        const undo = morph.undoManager.ensureNewGroup(morph, 'join line');
        const joinPositions = arr.range(0, end.row - 1 - start.row).map(_ => morph.joinLine(start.row));
        morph.undoManager.group(undo);
        if (morph.selection.isMultiSelection) {
          morph.cursorPosition = joinPositions[0];
          joinPositions.slice(1).forEach(pos => morph.selection.addRange({ start: pos, end: pos }));
        }
        return true;
      }
      const { row } = lead;
      if (args.withLine === 'before' && row <= 0) return true;
      if (args.withLine === 'after' && row >= morph.document.endPosition.row) return true;
      morph.undoManager.group();
      const firstRow = args.withLine === 'before' ? row - 1 : row;
      morph.cursorPosition = morph.joinLine(firstRow);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'split line',
    exec: function (morph) {
      const pos = morph.cursorPosition;
      const indent = morph.getLine(pos.row).match(/^\s*/)[0].length;
      morph.insertText('\n' + ' '.repeat(indent), pos);
      morph.cursorPosition = pos;
      return true;
    }
  },

  {
    name: 'insert line',
    exec: function (morph, opts = { where: 'above' }) {
      let { row } = morph.cursorPosition;
      const indent = morph.getLine(row).match(/^\s*/)[0].length;
      if (opts.where === 'below') row++;
      morph.insertText(' '.repeat(indent) + '\n', { column: 0, row });
      morph.cursorPosition = { column: indent, row };
      return true;
    }
  },

  {
    name: 'duplicate line or selection',
    exec: function (morph) {
      morph.undoManager.group();
      const pos = morph.selection.end;
      if (morph.selection.isEmpty()) {
        morph.insertText(morph.getLine(pos.row) + '\n', { column: 0, row: pos.row + 1 });
      } else {
        const range = morph.selection.range;
        morph.insertText(morph.selection.text, pos);
        morph.selection = range;
      }
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'delete emtpy line or until end of line',
    exec: function (morph) {
      const pos = morph.cursorPosition;
      const line = morph.getLine(pos.row);
      if (eqPosition(morph.document.endPosition, pos)) return true;
      const range = line.trim()
        ? { start: pos, end: { row: pos.row, column: line.length } }
        : { start: { row: pos.row, column: 0 }, end: { row: pos.row + 1, column: 0 } };
      morph.env.eventDispatcher.doCopy(morph.textInRange(range));
      morph.undoManager.group();
      morph.deleteText(range);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'delete left until beginning of line',
    exec: function (morph) {
      if (morph.activeMark) morph.activeMark = null;
      if (!morph.selection.isEmpty()) {
        morph.selection.text = '';
        return true;
      }
      const lineRange = morph.lineRange();
      const end = morph.cursorPosition;
      // already at beginning of line
      if (eqPosition({ row: end.row, column: 0 }, end)) return true;

      const start = eqPosition(lineRange.start, end)
        ? { row: end.row, column: 0 }
        : lineRange.start;
      const range = { start, end };
      morph.deleteText(range);
      return true;
    }
  },

  {
    name: 'move lines up',
    multiSelectAction: 'single',
    exec: function (morph) {
      const sel = morph.selection;

      if (morph.inMultiSelectMode()) { // make sure position of selections doesn't change
        const ranges = sel.selections.map(ea => ea.range);
        ranges.slice().sort(Range.compare).forEach(range => {
          morph.selection = range;
          morph.execCommand('move lines up');
        });
        ranges.forEach(range => { range.start.row--; range.end.row--; });
        morph.selection.ranges = ranges;
        return true;
      }

      if (!sel.isEmpty() && sel.end.column === 0) sel.growRight(-1);

      const { start, end } = sel;
      const lineBefore = morph.getLine(start.row - 1);
      const undo = morph.undoManager.ensureNewGroup(morph);
      morph.insertText(lineBefore + '\n', { row: end.row + 1, column: 0 });
      morph.deleteText({ start: { row: start.row - 1, column: 0 }, end: { row: start.row, column: 0 } });
      morph.undoManager.group(undo);
      return true;
    }
  },

  {
    name: 'move lines down',
    multiSelectAction: 'single',
    exec: function (morph) {
      const sel = morph.selection;

      if (morph.inMultiSelectMode()) { // make sure position of selections doesn't change
        const ranges = sel.selections.map(ea => ea.range);
        ranges.slice().sort(Range.compare).reverse().forEach(range => {
          morph.selection = range;
          morph.execCommand('move lines down');
        });
        ranges.forEach(range => { range.start.row++; range.end.row++; });
        morph.selection.ranges = ranges;
        return true;
      }

      if (!sel.isEmpty() && sel.end.column === 0) sel.growRight(-1);
      let range = sel.range; const { start, end } = range;

      if (sel.isEmpty()) range = { start: { row: start.row, column: 0 }, end: { row: start.row + 1, column: 0 } };
      else if (end.column !== 0) range = { start, end: { row: end.row + 1, column: 0 } };

      const undo = morph.undoManager.ensureNewGroup(morph);
      const linesToMove = morph.deleteText(range);
      morph.insertText(linesToMove, { row: start.row + 1, column: 0 });
      morph.undoManager.group(undo);

      morph.selection = { start: { ...start, row: start.row + 1 }, end: { ...end, row: end.row + 1 } };
      return true;
    }
  },

  {
    name: 'old select word',
    exec: function (morph) {
      const sel = morph.selection;
      sel.range = morph.wordAt(sel.lead).range;
      return true;
    }
  },

  {
    name: 'select word',
    exec: function (morph) {
      const sel = morph.selection;
      // Now selects word, line, body, or matching brackets
      const indexPair = morph.selectMatchingBrackets(morph.textString,
        morph.positionToIndex(sel.lead));
      if (indexPair) sel.range = { start: indexPair[0], end: indexPair[1] + 1 };
      return true;
    }
  },

  {
    name: 'select word right',
    exec: function (morph) {
      const sel = morph.selection;
      sel.anchor = morph.wordRight(sel.end).range.end;
      return true;
    }
  },

  {
    name: 'goto word left',
    exec: function (morph, args = { select: false }) {
      const select = args.select || !!morph.activeMark;
      const { range } = morph.wordLeft();
      morph.selection.lead = range.start;
      if (!select) morph.selection.anchor = range.start;
      return true;
    }
  },

  {
    name: 'goto word right',
    exec: function (morph, args = { select: false }) {
      const select = args.select || !!morph.activeMark;
      const { range } = morph.wordRight();
      morph.selection.lead = range.end;
      if (!select) morph.selection.anchor = range.end;
      return true;
    }
  },

  {
    name: 'delete word right',
    exec: function (morph) {
      morph.undoManager.group();
      const { range: { end } } = morph.wordRight();
      const range = { start: morph.cursorPosition, end };
      morph.env.eventDispatcher.doCopy(morph.textInRange(range));
      morph.deleteText(range);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'delete word left',
    exec: function (morph) {
      morph.undoManager.group();
      const { range: { start } } = morph.wordLeft();
      const range = { start, end: morph.cursorPosition };
      morph.deleteText(range);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'goto matching right',
    exec: function (morph, opts = { select: !!morph.activeMark }) {
      const pairs = opts.pairs || {
        '{': '}',
        '[': ']',
        '(': ')',
        '<': '>'
      };
      const found = morph.findMatchingForward(morph.cursorPosition, 'right', pairs) ||
                  morph.findMatchingForward(morph.cursorPosition, 'left', pairs);
      if (found) {
        morph.selection.lead = found;
        if (!opts.select) morph.selection.anchor = morph.selection.lead;
      }
      return true;
    }
  },

  {
    name: 'goto matching left',
    exec: function (morph, opts = { select: !!morph.activeMark }) {
      const pairs = opts.pairs || {
        '}': '{',
        ']': '[',
        ')': '(',
        '>': '<'
      };
      const found = morph.findMatchingBackward(morph.cursorPosition, 'left', pairs) ||
                  morph.findMatchingBackward(morph.cursorPosition, 'right', pairs);
      if (found) {
        morph.selection.lead = found;
        if (!opts.select) morph.selection.anchor = morph.selection.lead;
      }
      return true;
    }
  },

  {
    name: 'realign top-bottom-center',
    doc: 'Cycles through centering the cursor position, aligning it at the top, aligning it at the bottom.',
    scrollCursorIntoView: false,
    multiSelectAction: 'single',
    exec: function (morph) {
      const charBounds = morph.charBoundsFromTextPosition(morph.cursorPosition);
      const pos = charBounds.topLeft();
      const h = morph.height - charBounds.height;
      let { x: scrollX, y: scrollY } = morph.scroll;
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
    name: 'reverse selection',
    doc: 'switches the selection lead and anchor',
    exec: function (morph) {
      const sel = morph.selection;
      if (sel.isEmpty()) {
        const m = morph.popSavedMark();
        if (m) {
          morph.saveMark(morph.cursorPosition);
          sel.lead = m.position;
        }
      } else sel.reverse();
      return true;
    }
  },

  {
    name: 'toggle active mark',
    doc: '....',
    handlesCount: true,
    multiSelectAction: 'single',
    exec: function (morph, args, count) {
      const m = morph.activeMark;
      const sel = morph.selection;
      const selected = !sel.isEmpty();

      // Ctrl-U Ctrl-Space = jump to last active mark and pop it from stack
      if (count === 4) {
        const lastMark = morph.popSavedMark();
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
        const sels = morph.inMultiSelectMode() ? sel.selections : [sel];
        sels.forEach(sel => sel.anchor = sel.lead);
      }

      return true;
    }
  },

  {
    name: 'fit text to column',
    handlesCount: true,
    multiSelectAction: 'forEach',
    exec: function (morph, opts, count) {
      // Takes a selection or the current line and will insert line breaks so
      // that all selected lines are not longer than printMarginColumn or the
      // specified count parameter. Breaks at word bounds.
      if (count === 4/* Ctrl-U */) return morph.execCommand('join line');

      if (morph.selection.isEmpty()) morph.selectLine();
      const sel = morph.selection;
      const col = count || /* morph.getOption('printMarginColumn') || */ 80;
      const rows = sel.selectedRows;
      const range = sel.range;
      const splitRe = /[ ]+/g;
      // splitRe            = /[^a-zA-Z_0-9\$\-!\?,\.]+/g,
      const whitespacePrefixRe = /^[\s\t]+/;
      const paragraphs = string.paragraphs(
        arr.range(rows.first, rows.last)
          .map(row => morph.getLine(row))
          .join('\n'), { keepEmptyLines: true });
      const newString = chain(paragraphs.map(fitParagraph)).flat().value().join('\n');

      morph.undoManager.group();
      morph.replace(range, newString);
      morph.undoManager.group();

      return true;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      function splitLineIntoChunks (line, whitespacePrefix, n) {
        if (line.length <= col) return [whitespacePrefix + line.trim()];
        const firstChunk = line.slice(0, col);
        const splitMatch = arr.last(string.reMatches(firstChunk, splitRe));
        const lastWordSplit = splitMatch && splitMatch.start > 0 ? splitMatch.start : col;
        const first = firstChunk.slice(0, lastWordSplit);
        const rest = whitespacePrefix + (firstChunk.slice(lastWordSplit) + line.slice(col)).trimLeft();
        return [first].concat(splitLineIntoChunks(rest, whitespacePrefix, n + 1));
      }

      function fitRow (row) {
        if (row.trim() === '') return [''];
        const whitespacePrefixMatch = row.match(whitespacePrefixRe);
        const whitespacePrefix = whitespacePrefixMatch ? whitespacePrefixMatch[0] : '';
        return splitLineIntoChunks(whitespacePrefix + row.trim(), whitespacePrefix);
      }

      function fitParagraph (para) {
        return /^\s*$/.test(para)
          ? para
          : fitRow(para.split('\n').join(' ')).join('\n') + '\n';
      }
    }
  },

  {
    name: 'lowercase',
    exec: function (morph) {
      morph.undoManager.group();
      if (morph.selection.isEmpty()) morph.selection = morph.wordAt().range;
      morph.selection.text = morph.selection.text.toLowerCase();
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'remove trailing whitespace',
    exec: function (morph) {
      morph.undoManager.group();
      let i = 0;
      morph.withLinesDo(0, morph.documentEndPosition.row, (line, range) =>
        line.match(/\s+$/) && ++i && morph.replace(range, line.trimRight()));
      morph.world().setStatusMessage(`${i} lines cleaned up`);
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'uppercase',
    exec: function (morph) {
      morph.undoManager.group();
      if (morph.selection.isEmpty()) morph.selection = morph.wordAt().range;
      morph.selection.text = morph.selection.text.toUpperCase();
      morph.undoManager.group();
      return true;
    }
  },

  {
    name: 'newline',
    exec: function (morph) {
      const pos = morph.cursorPosition;
      const currentLine = morph.getLine(pos.row);
      const indent = currentLine.match(/^\s*/)[0].length;
      return morph.withMetaDo({ reconcileChanges: true }, () => {
        morph.undoManager.group();

        // remove trailing spaces of empty lines
        if (!currentLine.trim() && indent) {
          morph.deleteText({
            start: { row: pos.row, column: 0 },
            end: { row: pos.row, column: indent }
          });
          pos.column = 0;
        }

        // allow modes to handle newline
        if (
          morph.editorPlugin &&
        typeof morph.editorPlugin.cmd_newline === 'function' &&
        morph.editorPlugin.cmd_newline(pos, currentLine, indent)
        ) return true;

        morph.selection.text = '\n' + ' '.repeat(indent);
        morph.selection.collapseToEnd();
        morph.undoManager.group();
        return true;
      });
    }
  },

  {
    name: 'insertstring',
    exec: function (morph, args = { string: null, undoGroup: false }) {
      const { string, undoGroup } = args; const isValid = typeof string === 'string' && string.length;
      if (!isValid) { console.warn('command insertstring called with not string value'); }
      if (morph.rejectsInput() || !isValid) { return false; }
      morph.saveActiveMarkAndDeactivate();
      if (morph.editorPlugin && typeof morph.editorPlugin.cmd_insertstring === 'function' && morph.editorPlugin.cmd_insertstring(string)) { return true; }
      const sel = morph.selection; const isDelete = !sel.isEmpty();
      if (isDelete) { morph.undoManager.group(); }

      // rk 2017-09-23 This is a test to make simple text input "snappier"...
      const pos = sel.lead;
      const quickInsert = string.length === 1 && string !== '\n' && pos.column > 0;
      const consistencyCheck = !quickInsert;
      // .... test end!
      morph.withMetaDo({ reconcileChanges: true }, () => {
        sel.replace(string, true, true, true, consistencyCheck);
      });
      sel.collapseToEnd();
      if (isDelete) { morph.undoManager.group(); }
      if (undoGroup) {
        if (!/^[\s\.,\?\+=]+$/.test(string) && typeof undoGroup === 'number') { morph.undoManager.groupLater(undoGroup); } else { morph.undoManager.group(); }
      }
      return true;
    }
  },

  {
    name: 'toggle line wrapping',
    scrollCursorIntoView: false,
    multiSelectAction: 'single',
    exec: function (morph) {
      morph.keepPosAtSameScrollOffsetWhile(() =>
        morph.lineWrapping = morph.lineWrapping
          ? false
          : morph.fontMetric.isProportional(morph.fontFamily)
            ? true
            : 'by-chars');
      return true;
    }
  },

  {
    name: 'cancel input',
    scrollCursorIntoView: false,
    multiSelectAction: 'single',
    exec: function (morph, args, count, evt) {
      morph.env.eventDispatcher.resetKeyInputState();
      morph.selection.disableMultiSelect &&
        morph.selection.disableMultiSelect();
      if (!morph.selection.isEmpty()) { morph.selection.anchor = morph.selection.lead; }
      if (morph.activeMark) { morph.activeMark = null; }
      return true;
    }
  }

];

const usefulEditorCommands = [

  {
    name: 'insert date',
    handlesCount: true,
    exec: function (ed, opts, count) {
      const dateString = date.format(new Date(), count ? 'mediumDate' : 'isoDate'/* short */)/* long */;
      ed.undoManager.group();
      ed.insertText(dateString);
      ed.undoManager.group();
      return true;
    }
  },

  {
    name: '[todo] toggle todo marker',
    exec: function (ed) {
      const sel = ed.selection;
      if (sel.isEmpty()) ed.selectLine();
      const undoneRe = /\[\s*\]/g;
      const doneRe = /\[X\]/g;
      let replacement = sel.text;
      if (undoneRe.test(replacement)) {
        replacement = replacement.replace(undoneRe, '[X]');
      } else if (doneRe.test(replacement)) {
        replacement = replacement.replace(doneRe, '[ ]');
      } else {
        replacement = '[ ] ' + replacement.trimLeft();
      }
      sel.text = replacement;
      return true;
    }
  },

  {
    name: 'selected lines: sort',
    exec: function (text) {
      const { start: { row: startRow }, end: { row: endRow } } = text.selection;
      const lines = [];
      text.withLinesDo(startRow, endRow, line => {
        const idx = lines.findIndex(ea => ea > line);
        idx > -1 ? lines.splice(idx, 0, line) : lines.push(line);
      });
      text.undoManager.group();
      text.replace(
        { start: { row: startRow, column: 0 }, end: { row: endRow + 1, column: 0 } },
        lines.join('\n') + '\n');
      text.undoManager.group();
      return true;
    }
  },

  {
    name: 'selected lines: reverse',
    exec: function (text) {
      const { start: { row: startRow }, end: { row: endRow } } = text.selection;
      const lines = [];
      text.withLinesDo(startRow, endRow, line => lines.push(line));
      text.undoManager.group();
      text.replace(
        { start: { row: startRow, column: 0 }, end: { row: endRow + 1, column: 0 } },
        lines.reverse().join('\n') + '\n');
      text.undoManager.group();
      return true;
    }
  },

  {
    name: 'selected lines: remove duplicates (uniq)',
    exec: function (text) {
      const { start: { row: startRow }, end: { row: endRow } } = text.selection;
      const lines = [];
      text.withLinesDo(startRow, endRow, line => arr.pushIfNotIncluded(lines, line));
      text.undoManager.group();
      text.replace(
        { start: { row: startRow, column: 0 }, end: { row: endRow + 1, column: 0 } },
        lines.join('\n') + '\n');
      text.undoManager.group();
      return true;
    }
  },

  {
    name: 'change string inflection',
    handlesCount: true,
    multiSelectAction: 'single',
    exec: async function (textMorph, opts, count) {
      if (textMorph.selection.isEmpty()) { textMorph.selection = textMorph.wordAt().range; }

      const ranges = textMorph.selection.ranges;
      const string = textMorph.textInRange(ranges[0]);

      if (!string) {
        textMorph.setStatusMessage('Please select some text');
        return true;
      }

      const type = detectCamelCaseType(string);
      const offers = arr.without(['uppercased', 'dashed', 'spaced'], type);
      const { selected: [choice] } = await textMorph.world().listPrompt('Convert ' + type + ' into?', offers, {});

      if (!choice) return true;

      textMorph.undoManager.group();
      ranges.forEach((range, i) => {
        const string = textMorph.textInRange(range);
        const replacement = convertCamelCased(string, choice);
        textMorph.replace(range, replacement);
      });
      textMorph.undoManager.group();

      textMorph.focus();
      return true;

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      // TODO move to lively.lang.string
      function convertCamelCased (string, intoType) {
        // intoType = 'uppercased'|'dashed'|'spaced'
        // Example:
        // convertCamelCased("fooBar", "dashed")      // => foo-bar
        // convertCamelCased("fooBar", "spaced")      // => foo bar
        // convertCamelCased("foo bar", "uppercased") // => fooBar
        // convertCamelCased("foo-bar", "spaced")     // => foo bar
        // convertCamelCased("foo-bar", "uppercased") // => fooBar
        let match; let replace; const fromType = detectCamelCaseType(string).trim();

        if (fromType === 'uppercased') match = /\s*[A-Z0-9]+/g;
        else if (fromType === 'dashed') match = /-\w/g;
        else if (fromType === 'spaced') match = /\s+.?/g;

        if (intoType === 'uppercased') replace = m => m.trim().replace(/^-/, '').toUpperCase();
        else if (intoType === 'dashed') replace = m => '-' + m.trim().replace(/^-/, '').toLowerCase();
        else if (intoType === 'spaced') replace = m => ' ' + m.trim().replace(/^-/, '').toLowerCase();

        return string.replace(match, replace);
      }

      function detectCamelCaseType (string) {
        if (string.match(/[A-Z]/)) return 'uppercased';
        if (string.match(/-/)) return 'dashed';
        if (string.match(/\s/)) return 'spaced';
        return 'unknown';
      }
    }
  },

  {
    name: 'spell check word',
    exec: async function (text, opts) {
      const word = text.wordAt();
      if (!word.string) {
        text.setStatusMessage('no word for spellcheck!');
        return true;
      }

      const { spellCheckWord } = await System.import('lively.ide/shell/spell-checker.js');
      const suggestions = await spellCheckWord(word.string);

      if (!suggestions.length) {
        text.setStatusMessage('no suggestions for word ' + word.string);
        return true;
      }

      const { selected: [choice] } = await text.world().filterableListPrompt(
        'Choose replacement for ' + word.string, suggestions);

      if (choice) {
        text.undoManager.group();
        text.replace(word.range, choice);
        text.undoManager.group();
      }

      return true;
    }
  },

  {
    name: '[shell] run shell command on region',
    multiSelectAction: 'single',
    exec: async function (ed, opts) {
      const input = ed.textInRange(ed.selection);
      const options = !input || input.length === 0 ? {} : { stdin: input };
      const cmdString = await ed.world().prompt('Enter shell command to run on region.',
        { historyId: 'lively.ide.execShellCommand' });
      const { runCommand } = await System.import('lively.ide/shell/shell-interface.js');
      if (!cmdString) return ed.setStatusMessage('No command entered, aborting...!');
      const cmd = runCommand(cmdString, options);
      try {
        await cmd.whenDone();
        const result = cmd.output.trim();
        ed.undoManager.group();
        ed.selection.selections.forEach(sel => sel.text = result);
        ed.undoManager.group();
      } catch (e) { ed.showError(e); }
      return true;
    }
  },

  {
    name: 'open file at cursor',
    exec: async function (ed, opts) {
      const line = ed.getLine();
      const startRow = ed.cursorPosition.row;
      const start = ed.document.scanBackward(ed.cursorPosition,
        (c, pos) => (pos.column <= 0 || c.match(/\s/)) && pos) || { row: 0, column: 0 };
      const end = ed.document.scanForward(ed.cursorPosition,
        (c, pos) => (pos.row != startRow || c.match(/\s/)) && pos) || ed.documentEndPosition;
      const text = ed.textInRange({ start, end }).replace(/\s/g, '');

      // read "urls" and line numbers like "./users/robertkrahn/config.js:611:"
      const parts = text.split(':');
      let url = parts[0].match(/^file|http/) ? `${parts.shift()}:${parts.shift()}` : parts.shift();
      if (parts[0].match(/^[0-9]+$/)) url += ':' + parts.shift();

      const { default: TextEditor } = await System.import('lively.ide/text/text-editor.js');
      const textEd = TextEditor.openInWindow();
      textEd.location = url;
      return textEd;
    }
  },

  {
    name: 'run code on text morph',
    doc: '...',
    exec: async function (morph, opts) {
      const env = { targetModule: 'lively://code-on-text-morph', context: morph };
      const code = await morph
        .world()
        .editPrompt('Run code on selection. Use this.selection.text to access it', {
          requester: morph,
          mode: 'js',
          evalEnvironment: env,
          historyId: 'run-code-on-text-morph-hist'
        });
      let result; let err;
      try {
        morph.undoManager.group();
        const result = await lively.vm.runEval(code, env);
        morph.undoManager.group();
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      if (err) morph.showError(err);
      return result;
    }
  },

  {
    name: 'change editor mode',
    exec: async function (ed) {
      const filter = url => !url.endsWith('ide/editor-plugin.js') &&
                        url.endsWith('editor-plugin.js');
      const results = await lively.modules.getPackage('lively.ide').resources(filter);
      const { shortName: current } = ed.editorPlugin || {};
      let currentIndex = 0;
      const items = ['<no mode>'].concat(results.map((ea, i) => {
        const name = ea.url.match(/([^\/]+)\/editor-plugin.js/)[1];
        if (name === current) currentIndex = i;
        return {
          isListItem: true,
          string: name,
          value: ea
        };
      }));
      const { selected: [choice] } = await ed.world().filterableListPrompt('choose mode', items, {
        requester: ed,
        preselect: currentIndex,
        historyId: 'lively.morphic/text-change-editor-mode-hist',
        fuzzy: true
      });

      if (!choice) return;

      if (choice === '<no mode>') {
        await ed.changeEditorMode(null);
        ed.resetTextAttributes();
        return;
      }

      if (!choice.isLoaded) await lively.modules.module(choice.url).load();

      await ed.changeEditorMode(choice.url);
    }
  },

  {
    name: 'report token at cursor',
    exec: async function (morph) {
      const { token, start, end } = morph.tokenAt(morph.cursorPosition) || {};
      morph.setStatusMessage(token ? `${token} ${start.column} => ${end.column}` : 'no token');
      return true;
    }
  }

];
commands.push(...usefulEditorCommands);

import { activate as iyGotoCharActivate } from './iy-goto-char.js';
commands.push(iyGotoCharActivate);

System.import('lively.ide/text/search.js').then(textSearch => commands.push(...textSearch.searchCommands));

export default commands;

// lively.modules.module("lively.morphic/text/morph.js").reload({reloadDeps: false, resetEnv: false});
