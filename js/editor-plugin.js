/*global System*/
import { string } from "lively.lang";
import JavaScriptChecker from "./checker.js";
import JavaScriptNavigator from "./navigator.js";

import { completers } from "./completers.js";
import { snippets as jsSnippets } from "./snippets.js";

import {
  jsIdeCommands,
  jsEditorCommands,
  astEditorCommands
} from "./commands.js";

import { CodeMirrorEnabledEditorPlugin } from "../editor-plugin.js";
import { Snippet } from "../text/snippets.js";

import {
  localInterface, systemInterfaceNamed,
  serverInterfaceFor,
  l2lInterfaceFor
} from "lively-system-interface";

import "./mode.js";

export default class JavaScriptEditorPlugin extends CodeMirrorEnabledEditorPlugin {

  constructor() {
    super();
    this.checker = new JavaScriptChecker();
    this.evalEnvironment = {format: "esm", targetModule: null, context: null};
  }

  get isJSEditorPlugin() { return true; }
  get shortName() { return "js"; }
  get longName() { return "javascript"; }

  attach(editor) {
    super.attach(editor);
    this.evalEnvironment.context = editor;
  }

  detach(editor) {
    this.checker.uninstall(this.textMorph);
    super.detach(editor);
  }

  getNavigator() { return new JavaScriptNavigator(); }

  getCompleters(otherCompleters) { return completers.concat(otherCompleters); }

  getCommands(otherCommands) {
    return [
      ...otherCommands,
      ...jsIdeCommands,
      ...jsEditorCommands,
      ...astEditorCommands
    ];
  }

  getKeyBindings(other) {
    return [
      ...other,
      {keys: "Shift-Tab",   command: {command: "[javascript] auto format code"}},
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // ide related
      {keys: "Ctrl-C E", command: "[javascript] list errors and warnings"},
      {keys: {mac: "Meta-Shift-L L I N T R", win: "Ctrl-Shift-L L I N T R"}, command: "[javascript] eslint report"},
      {keys: {mac: "Meta-Shift-L L I N T P", win: "Ctrl-Shift-L L I N T P"}, command: "[javascript] eslint preview fixes"},
      {keys: {mac: "Meta-Shift-L L I N T F", win: "Ctrl-Shift-L L I N T F"}, command: "[javascript] eslint fix"},
      {keys: {mac: "Meta-Shift-L M O D E", win: "Ctrl-Shift-L M O D E"}, command: "change editor mode"},
      {keys: "Ctrl-C I", command: "[javascript] inject import"},
      {keys: "Ctrl-C C I", command: "[javascript] fix undeclared variables"}
    ];
  }

  async getMenuItems(items) {
    var editor = this.textMorph,
        jsItems = [
          {command: "doit", target: editor, showKeyShortcuts: true},
          {command: "inspectit", target: editor, showKeyShortcuts: true},
          {command: "printit", target: editor, showKeyShortcuts: true},
          {command: "print inspectit", alias: "print inspect", target: editor, showKeyShortcuts: true},
          {command: "eval all", target: editor, showKeyShortcuts: true},
          {command: "text completion", alias: "code completion", target: editor, showKeyShortcuts: true},
          {command: "[javascript] list errors and warnings", alias: "list errors and warnings", target: editor, showKeyShortcuts: true},
          {isDivider: true},
        ];

    if (this.evalEnvironment.targetModule)
      jsItems.push(
        {command: "[javascript] inject import", alias: "add import", target: editor},
        {command: "[javascript] fix undeclared variables", alias: "fix undeclared variables", target: editor},
        {command: "[javascript] remove unused imports", alias: "remove unused imports", target: editor});

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
      });
    }

    jsItems.push({isDivider: true});

    return jsItems.concat(items);
  }

  getSnippets() {
    return jsSnippets.map(([trigger, expansion]) =>
      new Snippet({trigger, expansion}));
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
    return this.setSystemInterface(systemInterfaceNamed(interfaceSpec));
  }

  runEval(code, opts) {
    var env = this.sanatizedJsEnv(opts),
        endpoint = this.systemInterface(env);
    return endpoint.runEval(code, env);
  }

  get parser() {
    return System.get(System.decanonicalize("lively.ast"));
  }

  parse(astType = null) {
    // astType = 'FunctionExpression' || astType == 'FunctionDeclaration' || null

    if (this._ast && this._ast._astType === astType) return this._ast;

    // FIXME!
    let {parser, textMorph: {textString: src}} = this;
    if (!parser) return null;

    let options = {withComments: true, allowReturnOutsideFunction: true};
    if (astType) options.type = astType;
    // executable script?
    if (src.startsWith("#!")) {
      let firstLineEnd = src.indexOf("\n");
      src = " ".repeat(firstLineEnd) + src.slice(firstLineEnd);
    }
    let parsed = parser.fuzzyParse(src, options);
    parsed._astType = astType;
    return parsed;
  }

  undeclaredVariables(astType = null) {
    let {textMorph: morph, parser} = this,
        doc = morph.document,
        knownGlobals = this.evalEnvironment.knownGlobals || [],
        parsed = this.parse(astType);

    if (!parser || !parsed) return [];

    // "warnings" such as undeclared vars
    return parser.query.findGlobalVarRefs(parsed, {jslintGlobalComment: true})
      .filter(ea => !knownGlobals.includes(ea.name));
  }

}
