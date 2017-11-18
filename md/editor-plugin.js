import { CodeMirrorEnabledEditorPlugin } from "../editor-plugin.js";

import "./mode.js";
import { tokenizeDocument } from "../editor-modes.js";
import { arr, string } from "lively.lang";

import marked from "https://raw.githubusercontent.com/chjj/marked/master/lib/marked.js"
import { loadPart } from "lively.morphic/partsbin.js";
import { addOrChangeLinkedCSS } from "lively.morphic/rendering/dom-helper.js";
import { mdCompiler } from "./compiler.js";
import MarkdownNavigator from "./navigator.js";

var commands = [

  {
    name: "[markdown] convert to html",
    exec: async (mdText, opts = {}) => {
      return mdCompiler.compileMorphToHTMLAndOpen(mdText, opts)
    }
  },

  {
    name: "[markdown] scroll to cursor position in preview",
    exec: async (mdText, opts = {}) => {

let headings = mdCompiler.parseHeadings(mdText.textString);
let heading = mdCompiler.headingOfLine(headings, mdText.cursorPosition.row);
let range = mdCompiler.rangeOfHeading(mdText.textString, headings, heading)
let srcInRange = mdText.textInRange(range.range)
      let html = mdCompiler.compileToHTML(srcInRange, {addMarkdownBodyDiv: false})

      let preview = mdText._htmlMorph
      preview.html.indexOf(html)

    }
  },

  {
    name: "[markdown] goto heading",
    exec: async (mdText, opts = {}) => {
      let {row} = mdText.cursorPosition;
      let headings = mdCompiler.parseHeadings(mdText.textString);

      if (!headings.length) return true;

      let nextHeadingI = row >= arr.last(headings).line ? headings.length : headings.findIndex(ea => ea.line > row);
      if (nextHeadingI === -1) nextHeadingI = 0;
      
      let items = headings.map(ea => {
        return {
          isListItem: true,
          string: ea.line + ":" + string.indent(ea.string, " ", ea.depth),
          value: ea
        }
      });

      let {selected: [choice]} = await mdText.world().filterableListPrompt(
        "jump to heading", items, {
          requester: mdText,
          preselect: nextHeadingI-1,
          multiSelect: false
        });

      if (choice) {
        mdText.saveMark();
        mdText.cursorPosition = {row: choice.line, column: 0};
      }

      return true;
    }
  }
];

export default class MarkdownEditorPlugin extends CodeMirrorEnabledEditorPlugin {

  get isMarkdownEditorPlugin() { return true; }
  get shortName() { return "md"; }
  get longName() { return "markdown"; }

  getNavigator() { return new MarkdownNavigator(); }

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

  getKeyBindings(other) {
    return other.concat([
      {keys: "Alt-G", command: "[markdown] convert to html"},
      {keys: "Alt-J", command: "[markdown] goto heading"},
    ]);
  }

  async getMenuItems(items) {
    return [
      {command: "[markdown] convert to html", alias: "convert to html", target: this.textMorph},
      {command: "[markdown] goto heading", alias: "goto heading", target: this.textMorph},
      {isDivider: true},
    ].concat(items);
  }

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
