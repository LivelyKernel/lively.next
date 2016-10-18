import { arr, obj, fun } from "lively.lang";
import { pt, Rectangle, Color } from "lively.graphics";
import config from "../config.js";

import { connect } from "lively.bindings";
import { Morph, Menu } from "../index.js";
import { Text } from "../text/morph.js";
import { TextAttribute } from "../text/attribute.js";

import { Token, Highlighter, Theme } from "./highlighting.js";
import JavaScriptHighlighter from "./modes/javascript-highlighter.js";
import JavaScriptChecker from "./modes/javascript-checker.js";
import PlainHighlighter from "./modes/plain.js";
import DiffHighlighter from "./modes/diff.js";
import ChromeTheme from "./themes/chrome.js";
import TomorrowNightTheme from "./themes/tomorrow-night.js";
import GithubTheme from "./themes/github.js";

const highlighters = {
  "plain": PlainHighlighter,
  "javascript": JavaScriptHighlighter,
  "diff": DiffHighlighter
};

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
        type: Text, name: "text",
        extent: props.extent || pt(400,300),
        textString: props.textString || "",
        clipMode: "auto",
        padding: Rectangle.inset(4, 2, 4, 2),
        doSave() { this.owner && this.owner.doSave(); }
      }],
      ...config.codeEditor.defaultStyle,
      ...props
    });
    this.requestHighlight(true);

    // FIXME lively.bindings does not seem to work:
    connect(this.submorphs[0], "change", this, "requestHighlight", {
      updater: ($upd, {selector}) => selector === "insertText" || selector === "deleteText" ? $upd() : null
    });
    connect(this, "extent", this.submorphs[0], "extent");
  }

  highlight() {
    if (!this.theme) return;
    let textMorph = this.submorphs[0],
        tokens = this.mode.highlight(textMorph.textString);
    textMorph.setSortedTextAttributes(
      [textMorph.defaultTextStyleAttribute].concat(tokens.map(({token, from, to}) =>
        TextAttribute.fromPositions(this.theme.styleCached(token), from, to))));

    if (this._checker)
      this._checker.onDocumentChange({}, this);
  }

  get text() { return this.submorphs[0]; }
  get textString() { return this.text.textString; }
  set textString(str) { this.text.textString = str; }
  get fontFamily() { return this.text.fontFamily; }
  set fontFamily(x) { this.text.fontFamily = x; }
  get fontSize() { return this.text.fontSize; }
  set fontSize(x) { this.text.fontSize = x; }
  get fontColor() { return this.text.fontColor; }
  set fontColor(x) { this.text.fontColor = x; }
  get fontWeight() { return this.text.fontWeight; }
  set fontWeight(x) { this.text.fontWeight = x; }
  get fontStyle() { return this.text.fontStyle; }
  set fontStyle(x) { this.text.fontStyle = x; }
  get textDecoration() { return this.text.textDecoration; }
  set textDecoration(x) { this.text.textDecoration = x; }
  get fixedCharacterSpacing() { return this.text.fixedCharacterSpacing; }
  set fixedCharacterSpacing(x) { this.text.fixedCharacterSpacing = x; }

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
