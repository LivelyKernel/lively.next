import { CodeMirrorEnabledEditorPlugin } from "../editor-plugin.js";

import "./mode.js";
import { getMode, tokenizeDocument } from "../editor-modes.js";
import { arr } from "lively.lang";

// import * as marked from "https://raw.githubusercontent.com/chjj/marked/master/lib/marked.js"

var commands = [

  {
    name: "convert to html",
    exec: async (mdText, opts = {}) => {
      // var mdMorph = new MarkdownMorph({markdown: mdText.textString});
      // this.world().openInWindow(mdMorph).openInWorld().activate()
      $world.inform("not yet implemented");

      return true;
    }
  }
];

export default class MarkdownEditorPlugin extends CodeMirrorEnabledEditorPlugin {

  get isMarkdownEditorPlugin() { return true; }
  get shortName() { return "md"; }
  get longName() { return "markdown"; }

  get openPairs() {
    return {
      "{": "}",
      "[": "]",
      "(": ")",
      "\"": "\"",
      "'": "'"
    };
  }

  get closePairs() {
    return {
      "}": "{",
      "]": "[",
      ")": "(",
      "\"": "\"",
      "'": "'",
    };
  }

  getCommands(otherCommands) { return otherCommands.concat(commands); }

  getKeyBindings(other) { return other; }

  async getMenuItems(items) { return items; }


  highlight() {
    // 2017-07-20 rkrk: FIXME, currently need to re-implement b/c codemirror md
    // mode returns multiple tokens (space seperated) for a single thing.

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
        for (let i = 0; i < lineTokens.length; i = i+5) {
          let startColumn = lineTokens[i],
              endColumn = lineTokens[i+1],
              tokens = (lineTokens[i+2] || "").split(" "),
              // style = theme[tokens[0]] || theme.default;

              style;
          for (let i = 0; i < tokens.length; i++) {
            let token = tokens[i];
            if (token) style = Object.assign({}, style, theme[token]);
          }
          if (!style) style = theme.default;
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
}
