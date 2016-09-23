import { arr, obj, fun } from "lively.lang";
import { pt, Rectangle, Color } from "lively.graphics";
import config from "../config.js";

import { connect } from "lively.bindings";
import { Morph, Text, Menu } from "../index.js";
import { StyleRange } from "../text/style.js";

import { Token, Highlighter, Theme } from "./highlighting.js";
import JavaScriptHighlighter from "./modes/javascript-highlighter.js";
import JavaScriptChecker from "./modes/javascript-checker.js";
import PlainHighlighter from "./modes/plain.js";
import ChromeTheme from "./themes/chrome.js";
import TomorrowNightTheme from "./themes/tomorrow-night.js";
import GithubTheme from "./themes/github.js";

const highlighters = {
  "plain": PlainHighlighter,
  "javascript": JavaScriptHighlighter
}

const checkers = {
  "plain": null,
  "javascript": JavaScriptChecker
};

const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme,
  "github" : GithubTheme
};


export default class CodeEditor extends Morph {

  constructor(props) {
    super({
      extent: props.extent || pt(400,300),
      submorphs: [{
        type: "text",
        name: "text",
        extent: props.extent || pt(400,300),
        textString: props.textString || "",
        fixedWidth: true,
        fixedHeight: true,
        clipMode: "auto",
        padding: Rectangle.inset(4, 2, 4, 2),
        fontSize: props.fontSize || 12,
        fontFamily: props.fontFamily || "Monaco, monospace",
        doSave() { this.owner && this.owner.doSave(); }
      }],
      ...obj.dissoc(props, ["textString", "mode", "theme"])
    });
    this.mode = props.mode || "plain";
    this.theme = props.theme || config.codeEditor.defaultTheme;
    this.requestHighlight(true);

    // FIXME lively.bindings does not seem to work:
    connect(this.submorphs[0], "change", this, "requestHighlight", {
      updater: ($upd, {selector}) => selector === "insertText" || selector === "deleteText" ? $upd() : null
    });
    connect(this, "extent", this.submorphs[0], "extent");
  }
  
  highlight() {
    if (!this.theme) return;
    const txt = this.submorphs[0],
          tokens = this.mode.highlight(txt.textString),
          defaultStyle = this.submorphs[0].styleProps,
          styleRanges = tokens.map(({token, from, to}) =>
            StyleRange.fromPositions({...defaultStyle, ...this.theme.styleCached(token)}, from, to));
    styleRanges.push(StyleRange.create(defaultStyle, 0, -1, 0, 0));
    txt.replaceStyleRanges(styleRanges);

    if (this._checker) {
      this._checker.onDocumentChange({}, this);
    }
  }
  
  get text() { return this.submorphs[0]; }

  get textString() { return this.text.textString; }
  set textString(str) { this.text.textString = str; }

  get mode() { return this._mode; }
  set mode(mode) {
    this._mode = mode instanceof Highlighter ? mode : new (highlighters[mode]);
    this._checker = checkers[mode] && new checkers[mode]();
    this.requestHighlight();
  }
  
  get theme() { return this._theme; }
  set theme(theme) {
    this._theme = theme instanceof Theme ? theme : new (themes[theme]);
    this.text.fill = this._theme.background();
    this.requestHighlight();
  }
  
  requestHighlight(immediate = false) {  
    if (immediate) this.highlight();
    else fun.debounceNamed(this.id + "-requestHighlight", 500, () => this.highlight())();
  }

  resizeBy(delta) {
    super.resizeBy(delta);
    this.text.resizeBy(delta);
  }
  
  doSave() {}

  focus() { this.text.focus(); }

  onContextMenu(evt) {
    evt.stop();
    if (evt.state.menu) evt.state.menu.remove();
    this.world().addMorph(evt.state.menu = new Menu({
      position: evt.position,
      title: "CodeEditor menu", items: [
        ["Theme: chrome", () => { this.theme = "chrome"; }],
        ["Theme: tomorrow night", () => { this.theme = "tomorrowNight"; }],
        ["Mode: plain", () => { this.mode = "plain"; }],
        ["Mode: javascript", () => { this.mode = "javascript"; }]
      ]
    }));
  }

}
