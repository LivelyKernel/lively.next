import EditorPlugin from "../editor-plugin.js";

import "./mode.js"
import { getMode } from "../editor-modes.js";

import { completers as jsCompleters } from "../js/completers.js";
import { snippets as jsSnippets } from "../js/snippets.js";

import {
  jsIdeCommands,
  jsEditorCommands,
  astEditorCommands as jsAstEditorCommands
} from "../js/commands.js";
import { localInterface, systemInterfaceNamed } from "lively-system-interface";
import { runCommand } from "../shell/shell-interface.js";
import HTMLNavigator from "./navigator.js";


var indentHTMLCommand = {
  name: "[HTML] cleanup",
  exec: async text => {
    /*global show*/
    let undo = text.undoManager.ensureNewGroup(text, "[HTML] cleanup");
    await text.saveExcursion(async () => {
      if (text.selection.isEmpty()) text.selectAll();
      let allText = text.textString,
          selectedText = text.selection.text;
      // inspect(await runCommand("tidy --indent", {stdin: text.textString}).whenDone())
      let {stdout} = await runCommand("tidy --indent", {stdin: text.textString}).whenDone();
      stdout = stdout.replace(/\s*<meta name="generator"[^>]+>/, "");
      text.textString = stdout;
      text.selectAll();
      text.execCommand("indent according to mode");
    });
    text.undoManager.group(undo);
    return true;
  }
}
export default class HTMLEditorPlugin extends EditorPlugin {

  static get shortName() { return "html"; }

  static get mode() { return getMode({}, {name: "htmlmixed"}); }

  constructor() {
    super()
    this.evalEnvironment = {format: "esm", targetModule: "lively://lively.next-html-workspace", context: null}
  }

  get isHTMLEditorPlugin() { return true }
  get isJSEditorPlugin() { return true }

  cmd_insertstring(string) {
    let {textMorph: morph} = this,
        handled = super.cmd_insertstring(string);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    let closeBracket = string === ">";
    if (closeBracket) {
      let pos = {...morph.cursorPosition};
      if (!handled) {
        morph.insertText(">", pos);
        pos.column++
        handled = true;
      }
      
      let matching = morph.findMatchingBackward(pos, "left", {">": "<"});
      if (matching) {
        let textInBetween = morph.textInRange({start: matching, end: pos}),
            match = textInBetween.match(/^\<([a-z0-9\$\!#_\-]+)\>$/i);
        if (match) {
          morph.insertText(`</${match[1]}>`, pos);
          morph.cursorPosition = pos;
        }
      }
      return true;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // inserts closing tag via multi selection
    let openBracket = string === "<";
    if (false && openBracket) {
      let {row, column} = morph.cursorPosition,
          lineString = morph.getLine(row);
      if ("<>" === lineString.slice(column-1, column+1)) {
        morph.insertText("</>", {row, column: column+1})
        morph.selection.addRange({start: {row, column: column+3}, end: {row, column: column+3}})
        morph.selection.selections = lively.lang.arr.rotate(morph.selection.selections, -1);
      }
    }

    return handled;
  }

  get openPairs() {
    return {...super.openPairs, "<": ">"}
  }
  
  get closePairs() {
    return {...super.closePairs, ">": "<"}
  }

  getNavigator(otherCommands) { return new HTMLNavigator(); }

  // getSnippets() {
  //   return jsSnippets.map(([trigger, expansion]) =>
  //     new Snippet({trigger, expansion}));
  // }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // js related stuff

  getCompleters(otherCompleters) { return jsCompleters.concat(otherCompleters); }

  getCommands(otherCommands) {
    return [
      ...otherCommands,
      ...jsIdeCommands,
      ...jsEditorCommands,
      indentHTMLCommand
      // ...jsAstEditorCommands
    ];
  }
  
  getKeyBindings(other) {
    return [
      {command: "[HTML] cleanup", keys: "Shift-Tab"},
      ...other,
    ];
  }

  sanatizedJsEnv(envMixin) {
    let env = this.evalEnvironment;
    if (!env.systemInterface) env.systemInterface = localInterface;
    return {...env, ...envMixin};
  }

  systemInterface(envMixin) {
    var env = this.sanatizedJsEnv(envMixin);
    return env.systemInterface || localInterface;
  }

  setSystemInterface(systemInterface) {
    return this.evalEnvironment.systemInterface = systemInterface;
  }

  setSystemInterfaceNamed(interfaceSpec) {
    return this.setSystemInterface(systemInterfaceNamed(interfaceSpec));
  }

  runEval(code, opts) {
    var env = this.sanatizedJsEnv(opts),
        endpoint = this.systemInterface(env);
    return endpoint.runEval(code, env);
  }

}
