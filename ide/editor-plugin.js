// EditorPlugins bring text morphs and features for specific content such as
// programming languages together. Editor plugins can provide things like
// syntax highlighting, parsers, interactive commands, menus etc that are used
// by the text morph if the aditor plugin is added to the plugin list.
// The abstract class implements the interface that can be used.

import { fun, arr } from "lively.lang";
import { connect, disconnect } from "lively.bindings";

import DefaultTheme from "./themes/default.js";

import { tokenizeDocument } from "./editor-modes.js";

export function guessTextModeName(editor, filename = "", hint) {
  var mode = hint || "text",
      start = editor.textString.slice(0, 2000);
  // content tests
  if (start.match(/^diff --.* a\//m)) mode = "diff";
  else if (start.match(/#!\/bin\//m)) mode = "sh";
  else {
    // file-based tests
    var ext = filename && arr.last(filename.split(".")).toLowerCase();
    switch(ext) {
      case "r":                                                      mode = "r"; break;
      case "css":                                                    mode = "css"; break;
      case "h": case "c": case "cc": case "cpp": case "hpp":         mode = "c_cpp"; break;
      case "diff":                                                   mode = "diff"; break;
      case "xhtml": case "html":                                     mode = "html"; break;
      case "js":                                                     mode = "javascript"; break;
      case "json":                                                   mode = "json"; break;
      case "jade":                                                   mode = "jade"; break;
      case "ejs":                                                    mode = "ejs"; break;
      case "markdown": case "md":                                    mode = "markdown"; break;
      case "sh": case "bashrc": case "bash_profile": case "profile": mode = "sh"; break;
      case "dockerfile":                                             mode = "dockerfile"; break;
      case "xml":                                                    mode = "xml"; break;
      case "svg":                                                    mode = "svg"; break;
      case "lisp": case "el":                                        mode = "lisp"; break;
      case "clj": case "cljs": case "cljx": case "cljc":             mode = "clojure"; break;
      case "cabal": case "hs":                                       mode = "haskell"; break;
      case "py":                                                     mode = "python"; break;
    }
  }
  return mode;
}


function rangedToken(row, startColumn, endColumn, token) {
  return {
    start: {row, column: startColumn},
    end: {row, column: endColumn},
    token
  }
}


export default class EditorPlugin {

  static get shortName() { return null; /*override*/}

  constructor() {
    this.theme = DefaultTheme.instance;
    this.checker = null;
    this.mode = null;
    this._ast = null;
    this._tokens = [];
    this._tokenizerValidBefore = null;
  }

  get isEditorPlugin() { return true }

  get shortName() { return this.constructor.shortName; }

  attach(editor) {
    this.textMorph = editor;
    connect(editor, "textChange", this, "onTextChange");
    connect(editor, "viewChange", this, "onViewChange");
    this.textMorph.whenRendered().then(() => this.highlight());
  }

  detach(editor) {
    disconnect(editor, "textChange", this, "onTextChange");
    disconnect(editor, "viewChange", this, "onViewChange");
    this.textMorph = null;
  }

  onViewChange() {
    // this.requestHighlight();
    let {firstVisibleRow, lastVisibleRow} = this.textMorph.viewState
    this.requestHighlight();
  }

  onTextChange(change) {
    // update _tokenizerValidBefore, set it to the start of the change so we
    // now that all token states thereafter are invalid
    if (change) {
      let {_tokenizerValidBefore: validMarker} = this, row, column;
      if (change.selector === "replace") ({row, column} = change.args[0].start);
      else { row = 0; column = 0; }
      if (!validMarker || row < validMarker.row
       || (row === validMarker.row && column < validMarker.column)) {
         row = Math.max(0, row);
         this._tokenizerValidBefore = {row, column};
       }
    }
    this.requestHighlight();
  }

  requestHighlight(immediate = false) {
    if (immediate) this.highlight();
    else fun.debounceNamed(this.id + "-requestHighlight", 300, () => this.highlight())();
  }

  highlight() {
    let {textMorph, theme, mode, _tokenizerValidBefore} = this;

    if (!theme || !textMorph || !textMorph.document || !mode) return;

    textMorph.fill = theme.background;

    let {firstVisibleRow, lastVisibleRow} = textMorph.viewState,
        {lines, tokens} = tokenizeDocument(
          mode,
          textMorph.document,
          firstVisibleRow,
          lastVisibleRow,
          _tokenizerValidBefore);

    if (lines.length) {
      let row = lines[0].row,
          attributes = [];  
      for (let i = 0; i < tokens.length; row++, i++) {
        let lineTokens = tokens[i];
        for (let i = 0; i < lineTokens.length; i = i+4) {
          let startColumn = lineTokens[i],
              endColumn = lineTokens[i+1],
              token = lineTokens[i+2],
              style = theme[token] || theme.default;
          style && attributes.push(
            {start: {row, column: startColumn}, end: {row, column: endColumn}},
            style);
        }
      }
      textMorph.setTextAttributesWithSortedRanges(attributes);    
      this._tokenizerValidBefore = {row: arr.last(lines).row+1, column: 0};
    }


    if (this.checker)
      this.checker.onDocumentChange({}, textMorph, this);
  }

  tokensOfRow(row) {
    let {lines, tokens} = tokenizeDocument(
          this.mode,
          this.textMorph.document,
          row, row),
        tokensOfLine = arr.last(tokens), result = [];
    for (let i = 0; i < tokensOfLine.length; i = i+4) {
      let from = tokensOfLine[i], to = tokensOfLine[i+1], token = tokensOfLine[i+2]
      result.push(rangedToken(row, from, to, token))
    }
    return result;
  }

  tokenAt(pos) {
    let tokensOfRow = this.tokensOfRow(pos.row);
    for (let i = tokensOfRow.length; i--; ) {
      let token = tokensOfRow[i];
      if (token.token && token.start.column <= pos.column && pos.column <= token.end.column)
        return token;
    }
    return null;
  }

  getComment() {
    if (!this.mode) return null;
    let {lineComment, blockCommentStart, blockCommentEnd} = this.mode,
        commentSpec = {};
    if (lineComment) commentSpec.lineCommentStart = lineComment;
    if (blockCommentStart) commentSpec.blockCommentStart = blockCommentStart;
    if (blockCommentEnd) commentSpec.blockCommentEnd = blockCommentEnd;
    return commentSpec;
  }

  toString() {
    return `${this.constructor.name}(${this.textMorph})`
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
  // getSnippets() { /* list of snippets, see lively.morphic/text/snippets.js */ }
}
