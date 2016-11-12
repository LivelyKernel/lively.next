import { fun, arr } from "lively.lang";
import { pt, Rectangle, Color } from "lively.graphics";

import { connect, disconnect } from "lively.bindings";
import { TextStyleAttribute } from "../../text/attribute.js";
import { lessPosition } from "../../text/position.js"

import ChromeTheme from "../themes/chrome.js";
import TomorrowNightTheme from "../themes/tomorrow-night.js";
import GithubTheme from "../themes/github.js";

const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme,
  "github" : GithubTheme
};

var warnStyle = {"border-bottom": "2px dotted orange"},
    errorStyle = {"background-color": "red"};

var jju;

class JSONTokenizer {

  async ensureJJU() {
    if (jju) return;
    var url = "http://rlidwka.github.io/jju/jju.js";
    System.config({meta: {[url]: {format: "global", exports: "require"}}});
    var jjuRequire = await System.import(url);
    return jju = jjuRequire("jju");
  }

  tokenize(string) {
    if (!jju) { this.ensureJJU(); /*next time*/ return []; }
    var pos = {row: 0, column: 0};
    return jju.tokenize(string).map((token, i) => {
      var {type, raw} = token;
      switch (type) {
        case "newline": pos = {row: pos.row+1, column: 0}; return null;
        case "key": type = "string"; break
        case "literal":
          if (raw === "null") type = "keyword"
          else if (!isNaN(Number(raw))) type = "numeric"
          else type = "string";
          break;
      }
      var start = pos,
          end = pos = {row: pos.row, column: pos.column + raw.length};
      return {...token, type, start, end};
    }).filter(ea => !!ea)
  }

}

export class JSONEditorPlugin {

  constructor(theme = "chrome") {
    this.theme = typeof theme === "string" ? new themes[theme]() : theme;
    // this.highlighter = new JavaScriptTokenizer();
    this.tokenizer = new JSONTokenizer();
    this.tokenizer.ensureJJU();
    this._tokens = [];
  }

  get isEditorPlugin() { return true }

  get isJSONEditorPlugin() { return true }

  attach(editor) {
    this.textMorph = editor;
    connect(editor, "textChange", this, "onTextChange");
    this.requestHighlight();
  }

  detach(editor) {
    // this.evalEnvironment.context = null;
    disconnect(editor, "textChange", this, "onTextChange");
  }

  onTextChange() {
    this.requestHighlight();
  }

  requestHighlight(immediate = false) {  
    if (immediate) this.highlight();
    else fun.debounceNamed(this.id + "-requestHighlight", 500, () => this.highlight())();
  }

  highlight() {
    let textMorph = this.textMorph;
    if (!this.theme || !textMorph) return;
    
    try {
      let tokens = this._tokens = this.tokenizer.tokenize(textMorph.textString);

      textMorph.removeMarker("js-syntax-error")

      textMorph.setSortedTextAttributes(
        [textMorph.defaultTextStyleAttribute].concat(tokens.map(({type, start, end}) =>
          TextStyleAttribute.fromPositions(this.theme.styleCached(type), start, end))));

    } catch (err) {
      if (err instanceof SyntaxError) {
        var {column, row} = err;
        row--;

        textMorph.addMarker({
          id: "js-syntax-error",
          range: {start: {column: column-1, row}, end: {column: column+1, row}},
          style: errorStyle,
          type: "js-syntax-error"
        })
      } else throw err
    }

  }

  tokenAt(pos) {
    return this._tokens ?
      this._tokens.find(({end}) => !lessPosition(end, pos)) :
      null;
  }

}
