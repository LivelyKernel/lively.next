import { arr, chain, string } from 'lively.lang';

export var commands = [

  {
    name: 'toggle comment',
    exec: function (morph) {
      const comment = morph.pluginInvokeFirst('getComment');
      if (!comment) return true;
      if (!comment.lineCommentStart) {
        if (comment.blockCommentStart) return morph.execCommand('toggle block comment');
        return true;
      }

      const { lineCommentStart: cstart } = comment;
      const commentRe = new RegExp(`^(\\s*)(${cstart}\\s?)(.*)`);
      const doc = morph.document;
      const sel = morph.selection;

      if (!sel.isEmpty() && sel.end.column === 0) { sel.growRight(-1); }

      let startRow = sel.start.row;
      var lines = doc.lineStrings.slice(sel.start.row, sel.end.row + 1);
      // ignore leading empty lines
      var lines = lines.some(l => !!l.trim())
        ? arr.dropWhile(lines, l => !l.trim() ? ++startRow && true : false) : lines;
      const isCommented = lines.every(line => line.trim() && line.match(commentRe));

      morph.undoManager.group();
      if (isCommented) {
        lines.forEach((line, i) => {
          const match = line.match(commentRe);
          if (match) {
            const [_, before, comment, after] = match;
            const range = {
              start: { row: startRow + i, column: before.length },
              end: { row: startRow + i, column: before.length + comment.length }
            };
            morph.deleteText(range);
          }
        });
      } else {
        var minSpace = lines.reduce((minSpace, line, i) =>
          !line.trim() && (!sel.isEmpty() || sel.start.row !== sel.end.row)
            ? minSpace
            : Math.min(minSpace, line.match(/^\s*/)[0].length), Infinity);
        var minSpace = minSpace === Infinity ? 0 : minSpace;
        lines.forEach((line, i) => {
          const [_, space, rest] = line.match(/^(\s*)(.*)/);
          morph.insertText(`${cstart} `, { row: startRow + i, column: minSpace });
        });
      }
      morph.undoManager.group();

      return true;
    }
  },

  {
    name: 'toggle block comment',
    exec: function (morph) {
      const comment = morph.pluginInvokeFirst('getComment');

      if (!comment) return true;
      if (!comment.blockCommentStart) {
        if (comment.lineCommentStart) return morph.execCommand('toggle comment');
        return true;
      }

      if (!comment || !comment.blockCommentStart) return true;
      const { blockCommentStart: cstart, blockCommentEnd: cend } = comment;
      const startRe = new RegExp('^' + cstart.replace(/\*/g, '\\*'));
      const endRe = new RegExp(cend.replace(/\*/g, '\\*') + '$');
      const token = morph.tokenAt(morph.cursorPosition);

      if (token && token.token === 'comment') {
        const text = morph.textInRange(token);
        if (text.match(startRe) && text.match(endRe)) {
          morph.undoManager.group();
          morph.replace(token, text.slice(cstart.length, -cend.length));
          morph.undoManager.group();
          return true;
        }
      }

      morph.undoManager.group();
      morph.insertText(cstart, morph.selection.start);
      morph.insertText(cend, morph.selection.end);
      morph.undoManager.group();
      const select = !morph.selection.isEmpty();
      morph.selection.growLeft(cend.length);
      if (!select) morph.selection.collapse();

      return true;
    }
  },

  {
    name: 'comment box',
    exec: function (morph, _, count) {
      const undo = morph.undoManager.ensureNewGroup(morph, 'comment box');

      if (morph.selection.isEmpty()) {
        morph.insertText('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
        // undo = undo || arr.last(morph.undoManager.undos);
        morph.execCommand('toggle comment');
        morph.undoManager.group(undo);
        return true;
      }

      const range = morph.selection.range;
      const lines = morph.withSelectedLinesDo(line => line);
      const indent = arr.min([range.start.column].concat(
        chain(lines).map(line => line.match(/^\s*/))
          .flat().compact().pluck('length').value()));
      const length = arr.max(lines.map(ea => ea.length)) - indent;
      const fence = Array(Math.ceil(length / 2) + 1).join('-=') + '-';

      // comment range
      morph.execCommand('toggle comment');
      morph.collapseSelection();

      // insert upper fence
      morph.cursorPosition = { row: range.start.row, column: 0 };
      if (count) { morph.insertText(string.indent('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-' + '\n', ' ', indent)); } else { morph.insertText(string.indent(fence + '\n', ' ', indent)); }
      morph.selection.goUp();
      morph.execCommand('toggle comment');
      // insert fence below
      morph.cursorPosition = { row: range.end.row + 2, column: 0 };

      morph.insertText(string.indent(fence + '\n', ' ', indent));

      morph.selection.goUp();
      // morph.selection.gotoLineEnd();
      morph.execCommand('toggle comment');

      // select it all
      morph.selection.range = { start: { row: range.start.row, column: 0 }, end: morph.cursorPosition };
      morph.undoManager.group(undo);

      return true;
    },
    multiSelectAction: 'forEach',
    handlesCount: true
  }

];
