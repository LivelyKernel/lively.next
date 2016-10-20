import { fun } from "lively.lang";
import { pt, Rectangle, Color } from "lively.graphics";

import { connect, disconnect } from "lively.bindings";
import { TextStyleAttribute } from "../../text/attribute.js";
import { lessPosition } from "../../text/position.js"

import { completers } from "./completers.js";

import {
  jsIdeCommands,
  jsEditorCommands,
  astEditorCommands,
  insertStringWithBehaviorCommand,
  deleteBackwardsWithBehavior } from "./commands.js";

import JavaScriptTokenizer from "./highlighter.js";
import JavaScriptChecker from "./checker.js";

import JavaScriptNavigator from "./navigator.js";

import ChromeTheme from "../themes/chrome.js";
import TomorrowNightTheme from "../themes/tomorrow-night.js";
import GithubTheme from "../themes/github.js";

const themes = {
  "chrome": ChromeTheme,
  "tomorrowNight": TomorrowNightTheme,
  "github" : GithubTheme
};


export class JavaScriptEditorPlugin {

  constructor(theme = "chrome") {
    this.theme = typeof theme === "string" ? new themes[theme]() : theme;
    this.highlighter = new JavaScriptTokenizer();
    this.checker = new JavaScriptChecker();
    this._tokens = null;
    this._ast = null;
  }

  get isEditorPlugin() { return true }

  attach(editor) {
    this.textMorph = editor;
    connect(editor, "textChange", this, "onTextChange");
    this.requestHighlight();
  }

  detach(editor) {
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
    let tokens = this._tokens = this.highlighter.tokenize(textMorph.textString);
    textMorph.setSortedTextAttributes(
      [textMorph.defaultTextStyleAttribute].concat(tokens.map(({token, start, end}) =>
        TextStyleAttribute.fromPositions(this.theme.styleCached(token), start, end))));

    if (this.checker)
      this.checker.onDocumentChange({}, textMorph);
  }

  tokenAt(pos) {
    return this._tokens ?
      this._tokens.find(({end}) => !lessPosition(end, pos)) :
      null;
  }

  getNavigator() { return new JavaScriptNavigator(); }

  getCompleters(otherCompleters) { return completers.concat(otherCompleters); }

  getCommands(otherCommands) {
    var idx = otherCommands.findIndex(({name}) => name === "insertstring");
    otherCommands.splice(idx, 1, {...otherCommands[idx], name: "insertstring_default"});
    return [insertStringWithBehaviorCommand, deleteBackwardsWithBehavior]
      .concat(otherCommands)
      .concat(jsIdeCommands)
      .concat(jsEditorCommands)
      .concat(astEditorCommands);
  }

}
