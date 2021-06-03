import { CodeMirrorEnabledEditorPlugin } from '../editor-plugin.js';
import './mode.js';
import { completers as jsCompleters } from '../js/completers.js';
import {
  jsIdeCommands,
  jsEditorCommands
} from '../js/commands.js';
import { localInterface, systemInterfaceNamed } from 'lively-system-interface';

let commands = [];

export default class PugPlugin extends CodeMirrorEnabledEditorPlugin {
  constructor () {
    super();
    // this.checker = new HTMLChecker();
    this.evalEnvironment = { format: 'esm', targetModule: 'lively://lively.next-html-workspace', context: null };
  }

  get isPugEditorPlugin () { return true; }
  get isJSEditorPlugin () { return true; }
  get shortName () { return 'pug'; }
  get longName () { return 'pug'; }

  // getNavigator() { return new HTMLNavigator(); }

  // getSnippets() {
  //   return jsSnippets.map(([trigger, expansion]) =>
  //     new Snippet({trigger, expansion}));
  // }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // js related stuff

  getCompleters (otherCompleters) { return jsCompleters.concat(otherCompleters); }

  getCommands (otherCommands) {
    return [
      ...otherCommands,
      ...jsIdeCommands,
      ...jsEditorCommands,
      ...commands
      // ...jsAstEditorCommands
    ];
  }

  getKeyBindings (other) {
    return [
      ...other
    ];
  }

  async getMenuItems (items) {
    let editor = this.textMorph;
    let pugItems = [];
    return pugItems.concat(items);
  }

  sanatizedJsEnv (envMixin) {
    let env = this.evalEnvironment;
    if (!env.systemInterface) env.systemInterface = localInterface;
    return { ...env, ...envMixin };
  }

  systemInterface (envMixin) {
    let env = this.sanatizedJsEnv(envMixin);
    return env.systemInterface || localInterface;
  }

  setSystemInterface (systemInterface) {
    return this.evalEnvironment.systemInterface = systemInterface;
  }

  setSystemInterfaceNamed (interfaceSpec) {
    return this.setSystemInterface(systemInterfaceNamed(interfaceSpec));
  }

  runEval (code, opts) {
    let env = this.sanatizedJsEnv(opts);
    let endpoint = this.systemInterface(env);
    return endpoint.runEval(code, env);
  }

  // get parser() { return parse5; }
  //
  // parse() {
  //   // astType = 'FunctionExpression' || astType == 'FunctionDeclaration' || null
  //   if (this._ast) return this._ast;
  //   let {parser, textMorph: {textString: src}} = this;
  //   return parser ? this._ast = parser.parse(src, {locationInfo: true}) : null;
  // }
}
