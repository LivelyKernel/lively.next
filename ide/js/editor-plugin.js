import { TextStyleAttribute } from "../../text/attribute.js";
import { lessEqPosition } from "../../text/position.js";

import JavaScriptTokenizer from "./highlighter.js";
import JavaScriptChecker from "./checker.js";
import JavaScriptNavigator from "./navigator.js";

import { completers } from "./completers.js";
import { snippets as jsSnippets } from "./snippets.js";

import {
  jsIdeCommands,
  jsEditorCommands,
  astEditorCommands,
  insertStringWithBehaviorCommand,
  deleteBackwardsWithBehavior } from "./commands.js";

import EditorPlugin from "../editor-plugin.js";


export class JavaScriptEditorPlugin extends EditorPlugin {

  constructor(theme) {
    super(theme)
    this.highlighter = new JavaScriptTokenizer();
    this.checker = new JavaScriptChecker();
    this._tokens = [];
    this._ast = null;
    this.evalEnvironment = {format: "esm", targetModule: null, context: null}
  }

  get isJSEditorPlugin() { return true }

  attach(editor) {
    super.attach(editor);
    this.evalEnvironment.context = editor;
  }

  detach(editor) {
    this.checker.uninstall(this.textMorph);
    super.detach(editor);
  }

  highlight() {
    let textMorph = this.textMorph;
    if (!this.theme || !textMorph || !textMorph.document) return;

    let tokens = this._tokens = this.highlighter.tokenize(textMorph.textString);
    textMorph.setSortedTextAttributes(
      [textMorph.defaultTextStyleAttribute].concat(tokens.map(({token, start, end}) =>
        TextStyleAttribute.fromPositions(this.theme.styleCached(token), start, end))));

    if (this.checker)
      this.checker.onDocumentChange({}, textMorph);
  }

  tokenAt(pos) {
    return this._tokens.find(({start,end}) =>
      lessEqPosition(start, pos) && lessEqPosition(pos, end));
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

  getMenuItems(items) {
    var editor = this.textMorph;
    items = items.concat([
      {command: "doit", target: editor, showKeyShortcuts: true},
    ]);

    var nav = this.getNavigator();
    var ref = nav.resolveIdentifierAt(editor, editor.cursorPosition);
    if (ref) {
      items.push({command: "selectDefinition", alias: `jump to definition`, target: editor})
      items.push({command: "selectSymbolReferenceOrDeclaration", alias: `select all occurrences`, target: editor})
    }
    return items;
  }

  getSnippets() { return jsSnippets; }
}
