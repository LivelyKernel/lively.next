import { string } from "lively.lang";
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


export default class JavaScriptEditorPlugin extends EditorPlugin {

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
    
    textMorph.fill = this.theme.background();
    
    let tokens = this._tokens = this.highlighter.tokenize(textMorph.textString),
        attributes = [];

    for (let {token, start, end} of tokens)
      attributes.push({start, end}, this.theme.styleCached(token));
    textMorph.setTextAttributesWithSortedRanges(attributes);

    if (this.checker)
      this.checker.onDocumentChange({}, textMorph, this);
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
    return [insertStringWithBehaviorCommand, deleteBackwardsWithBehavior, tabBehavior]
      .concat(otherCommands)
      .concat(jsIdeCommands)
      .concat(jsEditorCommands)
      .concat(astEditorCommands);
  }

  async getMenuItems(items) {
    var editor = this.textMorph;
    items = items.concat([
      {isDivider: true},
      {command: "doit", target: editor, showKeyShortcuts: true},
    ]);

    if (this.evalEnvironment.targetModule)
      items.push(
        {command: "[javascript] inject import", alias: `add import`, target: editor},
        {command: "[javascript] remove unused imports", alias: `remove unused imports`, target: editor});

    var nav = this.getNavigator();
    var ref = nav.resolveIdentifierAt(editor, editor.cursorPosition);
    if (ref) {
      items.push(
        {command: "selectDefinition", alias: `jump to definition of "${ref.name}"`, target: editor},
        {command: "selectSymbolReferenceOrDeclaration", alias: `select all occurrences of "${ref.name}"`, target: editor});
    }
    
    var text = editor.selection.text.trim();
    if (text) {
      items.push({
        command: "open code search",
        alias: `code search for "${string.truncate(text, 30)}"`,
        target: editor.world(),
        args: {input: text, backend: this.backend()}
      })
    }
    return items;
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
    let name = typeof interfaceSpec === "string" ? interfaceSpec : null,
        systemInterface;
    if (!name && interfaceSpec.type === "l2l") {
      systemInterface = l2lInterfaceFor(interfaceSpec.id, interfaceSpec.info)
    } else name = "local";

    if (name) {
      systemInterface = !name || name === "local" ?
        localInterface :
        serverInterfaceFor(name)
    }
    return this.setSystemInterface(systemInterface);
  }

  runEval(code, opts) {
    var env = this.sanatizedJsEnv(opts),
        endpoint = this.systemInterface(env);
    return endpoint.runEval(code, env);
  }
}
