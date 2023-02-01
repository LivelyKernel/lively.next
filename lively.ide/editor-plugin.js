// EditorPlugins bring text morphs and features for specific content such as
// programming languages together. Editor plugins can provide things like
// syntax highlighting, parsers, interactive commands, menus etc that are used
// by the text morph if the aditor plugin is added to the plugin list.
// The abstract class implements the interface that can be used.

import { fun, arr } from 'lively.lang';
import { connect, disconnect } from 'lively.bindings';

import DefaultTheme from './themes/default.js';

import { tokenizeDocument, modeInfo, visitDocumentTokens, getMode } from './editor-modes.js';
import { completionCommands } from './text/completion.js';
import { multiSelectCommands } from './text/multi-select-commands.js';
import { commands as navCommands } from './text/code-navigation-commands.js';
import { commands as codeCommands } from './text/generic-code-commands.js';
import { codeEvaluationCommands } from './text/code-evaluation-commands.js';

import { Range } from 'lively.morphic/text/range.js';

export function guessTextModeName (contentOrEditor, filename = '', hint) {
  let fileExt = filename && arr.last(filename.split('.')).toLowerCase();
  let peekString = ''; let size = 0; let maxSize = 1000;

  let maxTextSize = 2 ** 19/* 0.5MB */;
  if (typeof contentOrEditor === 'string') {
    if (contentOrEditor.length > maxTextSize) return null;
  } else {
    if (contentOrEditor.document.stringSize > maxTextSize) return null;
  }

  if (typeof contentOrEditor === 'string') peekString = contentOrEditor.slice(0, 1000);
  else {
    for (let line of contentOrEditor.document.lines) {
      let { stringSize, text } = line; let nl = true;
      if (size + stringSize > maxSize) { nl = false; stringSize = maxSize - size; }
      peekString += text.slice(0, stringSize) + (nl ? '\n' : '');
      size += stringSize;
      if (size >= maxSize) break;
    }
  }

  for (let info of modeInfo) {
    let { contentTest, mode, ext, file } = info;
    if (typeof contentTest === 'function') {
      try { if (contentTest(peekString)) return mode; } catch (err) {}
    }
    if (file && file instanceof RegExp) { if (file.test(filename)) return mode; }
    if (ext) {
      for (let eaExt of ext) {
        if (eaExt === fileExt) { return mode; }
      }
    }
  }

  return hint;
}

function rangedToken (row, startColumn, endColumn, token, mode) {
  return {
    start: { row, column: startColumn },
    end: { row, column: endColumn },
    token,
    mode
  };
}

// optional hooks:
//
// getComment() { /*{lineCommentStart: STRING, blockCommentStart: STRING, blockCommentEnd: STRING}*/ }
//
// getCompleters(otherCompleters) { /*list of completers, see lively.morphic/text/completion.js*/ }
//
// getCommands(otherCommands) { /*list of interactive commands, {name, exec} */ }
//
// getMenuItems(items) { /* list of menu items, {command, alias, target} or [name, () => { stuff }]*/ }
//
// getSnippets() { /* list of snippets, see lively.ide/text/snippets.js */ }

export default class EditorPlugin {
  constructor () {
    this.theme = DefaultTheme.instance;
    this.checker = null;
    this._ast = null;
    this._tokens = [];
    this._tokenizerValidBefore = null;
    this.__dont_serialize__ = ['mode', '_ast', '_tokens', '_tokenizerValidBefore'];
  }

  get isEditorPlugin () { return true; }

  get shortName () { return null; /* override */ }
  get longName () { return this.shortName; }

  attach (editor) {
    this.textMorph = editor;
    connect(editor, 'textChange', this, 'onTextChange');
    connect(editor, 'viewChange', this, 'onViewChange');
    this.highlight();
  }

  detach (editor) {
    disconnect(editor, 'textChange', this, 'onTextChange');
    disconnect(editor, 'viewChange', this, 'onViewChange');
    this.textMorph = null;
  }

  onViewChange () {
    this.requestHighlight();
  }

  onTextChange (change) {
    // update _tokenizerValidBefore, set it to the start of the change so we
    // now that all token states thereafter are invalid
    this._ast = null;
    if (change) {
      let { _tokenizerValidBefore: validMarker } = this; let row; let column;
      if (change.selector === 'replace') ({ row, column } = change.args[0].start);
      else { row = 0; column = 0; }
      if (!validMarker || row < validMarker.row ||
       (row === validMarker.row && column < validMarker.column)) {
        row = Math.max(0, row);
        this._tokenizerValidBefore = { row, column };
      }
    }
    this.requestHighlight();
  }

  requestHighlight (immediate = false) {
    if (immediate) this.highlight();
    else {
      fun.debounceNamed(this.textMorph.id + '-requestHighlight', 300, () => {
        this.highlight();
      })();
    }
  }

  highlight () {
    let { textMorph, theme, mode, _tokenizerValidBefore } = this;

    if (!theme || !textMorph || !textMorph.document || !mode) return;

    textMorph.fill = theme.background;
    textMorph.cursorColor = theme.cursorColor || textMorph.fontColor;

    let { firstVisibleRow, lastVisibleRow } = textMorph.renderingState;
    let morphAttrs = {};
    let { lines, tokens } = tokenizeDocument(
      mode,
      textMorph.document,
      firstVisibleRow,
      lastVisibleRow,
      _tokenizerValidBefore);

    if (lines.length) {
      let row = lines[0].row;
      let attributes = [];
      for (let i = 0; i < tokens.length; row++, i++) {
        let lineTokens = tokens[i];
        for (let i = 0; i < lineTokens.length; i = i + 5) {
          let startColumn = lineTokens[i];
          let endColumn = lineTokens[i + 1];
          let token = lineTokens[i + 2];
          let style = theme[token] || theme.default;
          // if the style chopped of an embedded morph, fix that here
          style && attributes.push(
            { start: { row, column: startColumn }, end: { row, column: endColumn } },
            style);
        }
      }
      textMorph.embeddedMorphs.forEach(m => {
        let a = textMorph.embeddedMorphMap.get(m).anchor;
        morphAttrs[m.id] = textMorph.textAttributeAt(a.position);
      });

      textMorph.setTextAttributesWithSortedRanges(attributes);
      textMorph.embeddedMorphs.forEach(m => {
        let a = textMorph.embeddedMorphMap.get(m).anchor;
        let r = Range.at(a.position);
        r.end.column += 1;
        textMorph.replace(r, [m, morphAttrs[m.id]], false);
      });

      this._tokenizerValidBefore = { row: arr.last(lines).row + 1, column: 0 };
    }

    if (this.checker) { this.checker.onDocumentChange({}, textMorph, this); }
  }

  visitTokensInRange ({ start, end }, visitFn) {
    // visitFn(tokenName, state, row, fromCol, toCol, stream, line, mode);
    let { mode, textMorph: { document: doc } } = this;
    let row = start.row - 1;
    let newLineFn = line => row++;
    let recordFn = (name, state, fromCol, toCol, stream, line, mode) => {
      if (row === start.row && start.column > 0) {
        if (start.column >= toCol) return;
        if (fromCol < start.column && start.column < toCol) { fromCol = start.column; }
      }
      if (row === end.row) {
        if (end.column <= fromCol) return;
        if (fromCol < end.column && end.column < toCol) { toCol = end.column; }
      }
      visitFn(name, state, row, fromCol, toCol, stream, line, mode);
    };
    visitDocumentTokens(mode, doc, start.row, end.row, null, newLineFn, recordFn);
  }

  tokensInRange (range) {
    let result = [];
    this.visitTokensInRange(range,
      (token, state, row, fromCol, toCol, stream, line, mode) =>
        result.push(rangedToken(row, fromCol, toCol, token, mode)));
    return result;
  }

  tokensOfRow (row) {
    let to = this.textMorph.getLine(row).length;
    return this.tokensInRange({ start: { row, column: 0 }, end: { row: row, column: to } });
  }

  tokenAt (pos) {
    let tokensOfRow = this.tokensOfRow(pos.row);
    for (let i = tokensOfRow.length; i--;) {
      let token = tokensOfRow[i];
      if (token.token && token.start.column <= pos.column && pos.column <= token.end.column) { return token; }
    }
    return null;
  }

  getCommands (otherCommands) {
    return [
      ...otherCommands,
      ...completionCommands,
      ...multiSelectCommands,
      ...navCommands,
      ...codeCommands,
      ...codeEvaluationCommands
    ];
  }

  getComment () {
    if (!this.mode) return null;
    let { lineComment, blockCommentStart, blockCommentEnd } = this.mode;
    let commentSpec = {};
    if (lineComment) commentSpec.lineCommentStart = lineComment;
    if (blockCommentStart) commentSpec.blockCommentStart = blockCommentStart;
    if (blockCommentEnd) commentSpec.blockCommentEnd = blockCommentEnd;
    return commentSpec;
  }

  toString () {
    return `${this.constructor.name}(${this.textMorph})`;
  }

  // interactive command hooks

  cmd_newline (cursorPos, lineString, indentDepth) {
    let morph = this.textMorph;
    let { row, column } = cursorPos;
    let before = lineString[column - 1];
    let after = lineString[column];
    morph.selection.text = '\n';
    morph.selection.collapseToEnd();
    if (before === '{' && after === '}') {
      morph.selection.text = '\n' + ' '.repeat(indentDepth);
      morph.selection.collapse();
    }
    morph.execCommand('indent according to mode', {
      undo: false,
      ignoreFollowingText: false,
      firstRow: row + 1,
      lastRow: row + 1
    });
    return true;
  }

  get openPairs () {
    return {
      '{': '}',
      '[': ']',
      '(': ')',
      '"': '"',
      "'": "'",
      '`': '`'
    };
  }

  get closePairs () {
    return {
      '}': '{',
      ']': '[',
      ')': '(',
      '"': '"',
      "'": "'",
      '`': '`'
    };
  }

  cmd_delete_backwards () {
    let { textMorph: morph, openPairs } = this;
    let sel = morph.selection;
    let line = morph.getLine(sel.end.row);
    let left = line[sel.end.column - 1];
    let right = line[sel.end.column];
    if (morph.autoInsertPairs && sel.isEmpty() && left in openPairs && right === openPairs[left]) {
      sel.growRight(1); sel.growLeft(1);
    }
    return false;
  }

  cmd_insertstring (string) {
    let { openPairs, closePairs, textMorph: morph } = this;
    let sel = morph.selection;
    let isOpen = morph.autoInsertPairs && string in openPairs;
    let isClose = morph.autoInsertPairs && string in closePairs;

    if (!isOpen && !isClose) return false;

    let line = morph.getLine(sel.end.row);
    let right = line[sel.end.column];

    if (!sel.isEmpty()) {
      if (!isOpen) return false;
      // we've selected something and are inserting an open pair => instead of
      // replacing the selection we insert the open part in front of it and
      // closing behind, then select everything
      const undo = morph.undoManager.ensureNewGroup(morph);
      morph.insertText(openPairs[string], sel.end);
      morph.insertText(string, sel.start);
      morph.undoManager.group(undo);
      sel.growRight(-1);
      return true;
    }

    // if input is closing part of a pair and we are in front of it then try
    // to find the matching opening pair part. If this can be found we do not
    // insert anything, just jump over the char
    if (right in closePairs && string === right) {
      sel.goRight(1); return true;
    }

    // Normal close, not matching, just insert default
    if (isClose && !isOpen) return false;

    // insert pair
    const undo = morph.undoManager.ensureNewGroup(morph);
    morph.insertText(string + openPairs[string]);
    morph.undoManager.group(undo);
    sel.goLeft(1);
    return true;
  }
}

export class CodeMirrorEnabledEditorPlugin extends EditorPlugin {
  constructor () {
    super();
    this.mode = null;
  }

  attach (editor) {
    this.mode = this.codeMirrorMode(editor);
    return super.attach(editor);
  }

  __deserialize__ () {
    this.mode = this.textMorph ? this.codeMirrorMode(this.textMorph) : null;
  }

  defaultCodeMirrorModeConfig (textMorph) {
    return {
      indentWithTabs: !textMorph.useSoftTabs,
      indentUnit: textMorph.tabWidth,
      tabSize: 4/* width of the tab character */
    };
  }

  codeMirrorMode (textMorph) {
    let config = this.defaultCodeMirrorModeConfig(textMorph);
    let name = this.longName;
    return getMode(config, { name });
  }
}
