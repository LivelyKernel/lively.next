import { string, arr } from "lively.lang";
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
  deleteBackwardsWithBehavior,
  tabBehavior
} from "./commands.js";

import EditorPlugin from "../editor-plugin.js";
import { Snippet } from "../../text/snippets.js";

import {
  localInterface,
  serverInterfaceFor,
  l2lInterfaceFor
} from "lively-system-interface";

import { createMode } from "./mode.js";
import { tokenizeLines, tokenizeDocument, defineMode } from "../editor-modes.js";


const jsMode = defineMode("javascript", createMode);

export default class JavaScriptEditorPlugin extends EditorPlugin {

  static get shortName() { return "js"; }

  constructor(theme) {
    super(theme)
    this.highlighter = new JavaScriptTokenizer();
    this.checker = new JavaScriptChecker();
    this.mode = jsMode;
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

    textMorph.fill = this.theme.background();

    let {firstVisibleRow, lastVisibleRow} = textMorph.viewState,
        {lines, tokens} = tokenizeDocument(
          jsMode,
          textMorph.document,
          firstVisibleRow,
          lastVisibleRow,
          this._tokenizerValidBefore),
        startRow = lines[0].row,
        attributes = [];

    for (let i = 0; i < tokens.length; i++) {
      let lineTokens = tokens[i],
          row = startRow+i;
      for (let i = 0; i < lineTokens.length; i = i+4) {
        let startColumn = lineTokens[i],
            endColumn = lineTokens[i+1],
            token = lineTokens[i+2];
        attributes.push(
          {start: {row, column: startColumn}, end: {row, column: endColumn}},
          this.theme.styleCached(token));
      }
    }
    textMorph.setTextAttributesWithSortedRanges(attributes);

    this._tokenizerValidBefore = {row: arr.last(lines).row+1, column: 0};

    if (this.checker)
      this.checker.onDocumentChange({}, textMorph, this);
  }

  tokensOfRow(row) {
    let {lines, tokens} = tokenizeDocument(
          jsMode,
          this.textMorph.document,
          row, row),
        tokensOfLine = arr.last(tokens);
    return tokensOfLine;
  }
  
  tokenAt(pos) {
    let tokensOfRow = this.tokensOfRow(pos.row);
    for (let i = tokensOfRow.length; i = i-4;)
      if (tokensOfRow[i+0] <= pos.column && pos.column <= tokensOfRow[i+1]) {
        let token = tokensOfRow[i+2];
        if (token) return token;
      }
    return null;
  }

  getNavigator() { return new JavaScriptNavigator(); }

  getCompleters(otherCompleters) { return completers.concat(otherCompleters); }

  getCommands(otherCommands) {
    var idx = otherCommands.findIndex(({name}) => name === "insertstring");
    otherCommands.splice(idx, 1, {...otherCommands[idx], name: "insertstring_default"});
    return [insertStringWithBehaviorCommand, deleteBackwardsWithBehavior, tabBehavior]
      .concat(otherCommands)
      .concat(jsIdeCommands)
      .concat(jsEditorCommands)
      .concat(astEditorCommands);
  }

  async getMenuItems(items) {
    var editor = this.textMorph;
    let jsItems = [
      {command: "doit", target: editor, showKeyShortcuts: true},
      {command: "printit", target: editor, showKeyShortcuts: true},
      {command: "print inspectit", alias: "print inspect", target: editor, showKeyShortcuts: true},
      {command: "eval all", target: editor, showKeyShortcuts: true},
      {command: "text completion", alias: "code completion", target: editor, showKeyShortcuts: true},
      {isDivider: true},
    ];

    if (this.evalEnvironment.targetModule)
      jsItems.push(
        {command: "[javascript] inject import", alias: `add import`, target: editor},
        {command: "[javascript] remove unused imports", alias: `remove unused imports`, target: editor});

    var nav = this.getNavigator();
    var ref = nav.resolveIdentifierAt(editor, editor.cursorPosition);
    if (ref) {
      jsItems.push(
        {command: "selectDefinition", alias: `jump to definition of "${ref.name}"`, target: editor},
        {command: "selectSymbolReferenceOrDeclaration", alias: `select all occurrences of "${ref.name}"`, target: editor});
    }

    var text = editor.selection.text.trim();
    if (text) {
      jsItems.push({
        command: "open code search",
        alias: `code search for "${string.truncate(text, 30)}"`,
        target: editor.world(),
        args: {input: text, backend: this.backend()}
      })
    }

    jsItems.push({isDivider: true});

    return jsItems.concat(items);
  }

  getSnippets() {
    return jsSnippets.map(([trigger, expansion]) =>
      new Snippet({trigger, expansion}));
  }

  getComment() {
    return {lineCommentStart: "//", blockCommentStart: "/*", blockCommentEnd: "*/"}
  }

  sanatizedJsEnv(envMixin) {
    var env = {...this.evalEnvironment, ...envMixin};
    if (!env.format) env.formatd = "esm";
    if (!env.context) env.context = this.textMorph;
    if (!env.sourceURL)
      env.sourceURL = env.targetModule + "_doit_" + Date.now();
    // targetModule = targetModule || "lively://lively.next-prototype_2016_08_23/" + morph.id,
    if (!env.systemInterface) env.systemInterface = localInterface;
    return env;
  }

  backend(envMixin) {
    var env = this.sanatizedJsEnv(envMixin);
    return env.remote ? env.remote : "local";
  }

  systemInterface(envMixin) {
    var env = this.sanatizedJsEnv(envMixin);
    return env.systemInterface || localInterface;
  }

  setSystemInterface(systemInterface) {
    return this.evalEnvironment.systemInterface = systemInterface;
  }

  setSystemInterfaceNamed(interfaceSpec) {
    if (!interfaceSpec) interfaceSpec = "local";

    let systemInterface;

    if (interfaceSpec.isSystemInterface) {
      systemInterface = interfaceSpec;

    } else {
      // "l2l FA3V-ASBDFD3-..."
      if (typeof interfaceSpec === "string" && interfaceSpec.startsWith("l2l "))
        interfaceSpec = {type: "l2l", id: interfaceSpec.split(" ")[1]}
  
      if (typeof interfaceSpec !== "string") {
        if (interfaceSpec.type === "l2l")
          systemInterface = l2lInterfaceFor(interfaceSpec.id, interfaceSpec.info)
      }
  
      if (typeof interfaceSpec !== "string") {
        $world.setStatusMessage(`Unknown system interface ${interfaceSpec}`)
        interfaceSpec = "local";
      }
  
      if (!systemInterface)
        systemInterface = !interfaceSpec || interfaceSpec === "local" ?
          localInterface :
          serverInterfaceFor(interfaceSpec)
    }

    return this.setSystemInterface(systemInterface);
  }

  runEval(code, opts) {
    var env = this.sanatizedJsEnv(opts),
        endpoint = this.systemInterface(env);
    return endpoint.runEval(code, env);
  }
}
