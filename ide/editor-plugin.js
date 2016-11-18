// EditorPlugins bring text morphs and features for specific content such as
// programming languages together. Editor plugins can provide things like
// syntax highlighting, parsers, interactive commands, menus etc that are used
// by the text morph if the aditor plugin is added to the plugin list.
// The abstract class implements the interface that can be used.

import { fun } from "lively.lang";
import { connect, disconnect } from "lively.bindings";

import ChromeTheme from "./themes/chrome.js";
import TomorrowNightTheme from "./themes/tomorrow-night.js";
import GithubTheme from "./themes/github.js";

const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme,
  "github" : GithubTheme
};


export default class EditorPlugin {

  constructor(theme = "chrome") {
    this.theme = typeof theme === "string" ? new themes[theme]() : theme;
    this._ast = null;
    this._tokens = [];
  }

  get isEditorPlugin() { return true }

  get isShellEditorPlugin() { return true }

  attach(editor) {
    this.textMorph = editor;
    connect(editor, "textChange", this, "onTextChange");
    this.requestHighlight();
  }

  detach(editor) {
    disconnect(editor, "textChange", this, "onTextChange");
    this.textMorph = null;
  }

  onTextChange() { this.requestHighlight(); }

  requestHighlight(immediate = false) {
    if (immediate) this.highlight();
    else fun.throttleNamed(this.id + "-requestHighlight", 500, () => this.highlight())();
  }

  highlight() { throw new Error("not yet implemented"); }

  toString() {
    return `${this.constructor.name}(${this.textMorph})`
  }

  // optional hooks:
  // 
  // getCompleters(otherCompleters) { /*list of completers, see lively.morphic/text/completion.js*/ }
  // 
  // getCommands(otherCommands) { /*list of interactive commands, {name, exec} */ }
  // 
  // getMenuItems(items) { /* list of menu items, {command, alias, target} or [name, () => { stuff }]*/ }
  // 
  // getSnippets() { /* list of snippets, see lively.morphic/text/snippets.js */ }
}
