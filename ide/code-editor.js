import { arr, obj } from "lively.lang";
import { pt, Rectangle, Color } from "lively.graphics";
import config from "../config.js";

import { connect } from "lively.bindings";
import { Morph, Text, Menu } from "../index.js";
import { StyleRange } from "../text/style.js";

import { Token, Mode, Theme } from "./highlighting.js";
import JavaScriptMode from "./modes/javascript.js";
import PlainMode from "./modes/plain.js";
import ChromeTheme from "./themes/chrome.js";
import TomorrowNightTheme from "./themes/tomorrow-night.js";
import GithubTheme from "./themes/github.js";

const modes = {
  "plain": PlainMode,
  "javascript": JavaScriptMode
}; // {[string] -> Mode}

const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme,
  "github" : GithubTheme
}; // {[string] -> Mode}


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
        fontFamily: "Monaco, monospace",
        onChange(change) { // work-around for lively.bindings bug
          if (change.selector === "insertText" || change.selector === "deleteText") {
            this.owner && this.owner.requestHighlight();
          }
          return Text.prototype.onChange.call(this, change);
        },
        doSave() { this.owner && this.owner.doSave(); }
      }],
      ...obj.dissoc(props, ["textString", "mode", "theme"])
    });
    this.mode = props.mode || "plain";
    this.theme = props.theme || config.codeEditor.defaultTheme;
    this.requestHighlight(true);

    // FIXME lively.bindings does not seem to work:
    // connect(this.submorphs[0], "input", this, "requestHighlight");
    connect(this, "extent", this.submorphs[0], "extent");
  }
  
  highlight() {
    const txt = this.submorphs[0],
          tokens = this.mode.highlight(txt.textString),
          defaultStyle = this.submorphs[0].styleProps,
          styleRanges = tokens.map(({token, from, to}) => {
            const themeStyle = this.theme.style(token),
                  style = obj.merge(defaultStyle, themeStyle);
            return StyleRange.fromPositions(style, from, to);
          });
          styleRanges.push(StyleRange.create(defaultStyle, 0, -1, 0, 0));
    txt.replaceStyleRanges(styleRanges);
  }
  
  get text() { return this.submorphs[0]; }

  get textString() { return this.text.textString; }
  set textString(str) { this.text.textString = str; }

  get mode() { return this._mode; }
  set mode(mode) {
    this._mode = mode instanceof Mode ? mode : new (modes[mode]);
    this.requestHighlight();
  }
  
  get theme() { return this._theme; }
  set theme(theme) {
    this._theme = theme instanceof Theme ? theme : new (themes[theme]);
    this.text.fill = this._theme.background();
    this.requestHighlight();
  }
  
  requestHighlight(immediate = false) {
    clearTimeout(this._request);
    if (immediate) return this.highlight();
    this._request = setTimeout(() => this.highlight(), 100);
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
