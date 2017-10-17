/*global System*/
import "./mode.js"
import { CodeMirrorEnabledEditorPlugin } from "../editor-plugin.js";
import { PyEvaluator } from "./eval.js";
import { completers } from "./completers.js";
import { commands } from "./commands.js";
import { config } from "lively.morphic";


export default class PythonEditorPlugin extends CodeMirrorEnabledEditorPlugin {

  constructor() {
    super();
    // this.checker = new JavaScriptChecker();
    this.evalEnvironment = {targetModule: null, context: null};
  }

  get isPythonEditorPlugin() { return true }

  get shortName() { return "py"; }
  get longName() { return "python"; }

  attach(editor) {
    super.attach(editor);
    // this.evalEnvironment.context = editor;
  }

  detach(editor) {
    // this.checker.uninstall(this.textMorph);
    super.detach(editor);
  }

  // getNavigator() { return new JavaScriptNavigator(); }

  getCompleters(otherCompleters) { return completers.concat(otherCompleters); }

  getCommands(otherCommands) { return [...otherCommands,...commands]; }

  getKeyBindings(other) {
    return [
      ...other,
      {keys: 'Shift-Tab',   command: {command: "[python] auto format code"}},
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // ide related
      // {keys: "Ctrl-C E", command: "[javascript] list errors and warnings"},
      // {keys: {mac: "Meta-Shift-L L I N T R", win: "Ctrl-Shift-L L I N T R"}, command: "[javascript] eslint report"},
      // {keys: {mac: "Meta-Shift-L L I N T P", win: "Ctrl-Shift-L L I N T P"}, command: "[javascript] eslint preview fixes"},
      // {keys: {mac: "Meta-Shift-L L I N T F", win: "Ctrl-Shift-L L I N T F"}, command: "[javascript] eslint fix"},
      // {keys: {mac: "Meta-Shift-L M O D E", win: "Ctrl-Shift-L M O D E"}, command: "change editor mode"},
      // {keys: "Ctrl-C I", command: "[javascript] inject import"},
      // {keys: "Ctrl-C C I", command: "[javascript] fix undeclared variables"}
    ]
  }

  // async getMenuItems(items) {}

  // getSnippets() {
  //   return jsSnippets.map(([trigger, expansion]) =>
  //     new Snippet({trigger, expansion}));
  // }


  systemInterface(env) {
    return PyEvaluator.ensure(env);
  }

  runEval(code, opts) {
    var env = this.evalEnvironment,
        endpoint = this.systemInterface(env);
    return endpoint.runEval(code, env);
  }

}
