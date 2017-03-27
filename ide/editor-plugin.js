// EditorPlugins bring text morphs and features for specific content such as
// programming languages together. Editor plugins can provide things like
// syntax highlighting, parsers, interactive commands, menus etc that are used
// by the text morph if the aditor plugin is added to the plugin list.
// The abstract class implements the interface that can be used.

import { fun, arr } from "lively.lang";
import { connect, disconnect } from "lively.bindings";

import ChromeTheme from "./themes/chrome.js";
import TomorrowNightTheme from "./themes/tomorrow-night.js";
import GithubTheme from "./themes/github.js";

const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme,
  "github" : GithubTheme
};


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
      case "r": mode = "r"; break;
      case "css": mode = "css"; break;
      case "h": case "c": case "cc": case "cpp": case "hpp": mode = "c_cpp"; break;
      case "diff": mode = "diff"; break;
      case "xhtml": case "html": mode = "html"; break;
      case "js": mode = "javascript"; break;
      case "json": mode = "json"; break;
      case "jade": mode = "jade"; break;
      case "ejs": mode = "ejs"; break;
      case "markdown": case "md": mode = "markdown"; break;
      case "sh": case "bashrc": case "bash_profile": case "profile": mode = "sh"; break;
      case "dockerfile": mode = "dockerfile"; break;
      case "xml": mode = "xml"; break;
      case "svg": mode = "svg"; break;
      case "lisp": case "el": mode = "lisp"; break;
      case "clj": case "cljs": case "cljx": case "cljc": mode = "clojure"; break;
      case "cabal": case "hs": mode = "haskell"; break;
      case "py": mode = "python"; break;
    }
  }
  return mode;
}

export default class EditorPlugin {

  constructor(theme = "chrome") {
    this.theme = theme;
    this._ast = null;
    this._tokens = [];
  }

  get isEditorPlugin() { return true }

  get theme() { return this._theme }
  set theme(t) {
    this._theme = typeof t === "string" ? new themes[t]() : t;
  }

  attach(editor) {
    this.textMorph = editor;
    connect(editor, "textChange", this, "onTextChange");
    this.textMorph.whenRendered().then(() => this.highlight());
  }

  detach(editor) {
    disconnect(editor, "textChange", this, "onTextChange");
    this.textMorph = null;
  }

  onTextChange() { this.requestHighlight(); }

  requestHighlight(immediate = false) {
    if (immediate) this.highlight();
    else fun.debounceNamed(this.id + "-requestHighlight", 300, () => this.highlight())();
  }

  highlight() { throw new Error("not yet implemented"); }

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
