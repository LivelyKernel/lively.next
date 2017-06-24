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

export default class HTMLEditorPlugin extends EditorPlugin {

  static get shortName() { return "html"; }

  static get mode() { return getMode({}, {name: "htmlmixed"}); }

  constructor() {
    super()
    this.evalEnvironment = {format: "esm", targetModule: "lively://lively.next-html-workspace", context: null}
  }

  get isHTMLEditorPlugin() { return true }
  get isJSEditorPlugin() { return true }

  
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
      // ...jsAstEditorCommands
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
