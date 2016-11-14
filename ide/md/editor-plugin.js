import { fun } from "lively.lang";
import { pt, Rectangle, Color } from "lively.graphics";
import { connect, disconnect } from "lively.bindings";
import MarkdownMorph from "./md-morph.js";
import MarkdownStyler from "./highlighter.js";

import * as marked from "https://raw.githubusercontent.com/chjj/marked/master/lib/marked.js"

import ChromeTheme from "../themes/chrome.js";
import TomorrowNightTheme from "../themes/tomorrow-night.js";
import GithubTheme from "../themes/github.js";


const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme,
  "github" : GithubTheme
};

var commands = [

  {
    name: "convert to html",
    exec: async (mdText, opts = {}) => {
      // mdText = that

      var mdMorph = new MarkdownMorph({markdown: mdText.textString});
      mdMorph

      this.world().openInWindow(mdMorph).openInWorld().activate()

      return true;
    }
  }
]

export class MarkdownEditorPlugin {

  constructor(theme = "chrome") {
    this.theme = typeof theme === "string" ? new themes[theme]() : theme;
    this.highlighter = new MarkdownStyler();
    this._parsed = null;
  }

  get isEditorPlugin() { return true }

  get isMarkdownEditorPlugin() { return true }

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
    else fun.throttleNamed(this.id + "-requestHighlight", 500, () => this.highlight())();
  }

  highlight() {
    let textMorph = this.textMorph;
    if (!this.theme || !textMorph) return;
    this._parsed = marked.lexer(textMorph.textString);
    this.highlighter.style(textMorph, this._parsed);
  }

  getMenuItems(items) {
    return items;

    // var editor = this.textMorph;
    // items = items.concat([
    //   {command: "doit", target: editor, showKeyShortcuts: true},
    // ]);
    // 
    // var nav = this.getNavigator();
    // var ref = nav.resolveIdentifierAt(editor, editor.cursorPosition);
    // if (ref) {
    //   items.push({command: "selectDefinition", alias: `jump to definition`, target: editor})
    //   items.push({command: "selectSymbolReferenceOrDeclaration", alias: `select all occurrences`, target: editor})
    // }
    // return items;
  }

  // getSnippets() { return jsSnippets; }
  
  toString() {
    return `MarkdownEditorPlugin(${this.textMorph})`
  }
}
