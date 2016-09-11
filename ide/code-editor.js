import { arr, obj } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";

import { Morph, Text, Menu } from "../index.js";
import { StyleRange } from "../text/style.js";

import { Token, Mode, Theme } from "./highlighting.js";
import JavaScriptMode from "./modes/javascript.js";
import PlainMode from "./modes/plain.js";
import ChromeTheme from "./themes/chrome.js";
import TomorrowNightTheme from "./themes/tomorrow-night.js";

const modes = {
  "plain": PlainMode,
  "javascript": JavaScriptMode
}; // {[string] -> Mode}

const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme
}; // {[string] -> Mode}

export default class CodeEditor extends Morph {
  constructor(props) {
    super({
      extent: props.extent || pt(400,300),
      submorphs: [{
        type: "text",
        extent: props.extent || pt(400,300),
        textString: props.textString || "",
        fixedWidth: true,
        fixedHeight: true,
        clipMode: "auto",
        padding: Rectangle.inset(4, 2, 4, 2),
        fontFamily: "Monaco, monospace",
        onChange(change) { // work-around for lively.bindings bug
          if (change.selector === "insertText" || change.selector === "deleteText") {
            this.owner && this.owner.requestHighlight();
          }
          return Text.prototype.onChange.call(this, change);
        }
      }],
      ...obj.dissoc(props, ["textString", "mode", "theme"])
    });
    this.mode = props.mode || "plain";
    this.theme = props.theme || "chrome";
    this.requestHighlight(true);

    // FIXME lively.bindings does not seem to work:
    // connect(this.submorphs[0], "input", this, "requestHighlight");
  }
  
  highlight() {
    const txt = this.submorphs[0],
          z = { row: 0, column: 0 },
          tokens = [{token: Token.default, from: z, to: z}],
          mode = this.mode;
    
    function process(str, row, column) {
      const lastToken = tokens[tokens.length - 1];
      lastToken.to = {row, column};
      if (str.length === 0) return;
      const token = mode.process(str);
      if (token !== lastToken.token) {
        tokens.push({token, from: {row, column}, to: {row, column}});
      }
      return str[0] == "\n" ? process(str.substr(1), row + 1, 0)
                            : process(str.substr(1), row, column + 1);
    }
    mode.reset();
    process(txt.textString, 0, 0);
    txt.resetStyleRanges();
    // add style
    tokens.forEach(({token, from, to}) => {
      const style = this.theme.style(token),
            sr = StyleRange.fromPositions(style, from, to);
      txt.addStyleRange(sr);
    });
  }
  
  get textString() { return this.submorphs[0].textString; }
  set textString(str) { this.submorphs[0].textString = str; }

  get mode() { return this._mode; }
  set mode(mode) {
    this._mode = mode instanceof Mode ? mode : new (modes[mode]);
    this.requestHighlight();
  }
  
  get theme() { return this._theme; }
  set theme(theme) {
    this._theme = theme instanceof Theme ? theme : new (themes[theme]);
    this.submorphs[0].fill = this._theme.background();
    this.requestHighlight();
  }
  
  requestHighlight(immediate = false) {
    clearTimeout(this._request);
    if (immediate) return this.highlight();
    this._request = setTimeout(() => this.highlight(), 100);
  }

  resizeBy(delta) {
    super.resizeBy(delta);
    this.submorphs[0].resizeBy(delta);
  }
  
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
