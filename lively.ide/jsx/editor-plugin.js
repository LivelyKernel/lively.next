/* global babel, System */
import JavaScriptEditorPlugin from '../js/editor-plugin.js';
import './mode.js';
import { es5Transpilation } from 'lively.source-transform';

export default class JSXEditorPlugin extends JavaScriptEditorPlugin {
  get shortName () { return 'jsx'; }
  get longName () { return 'jsx'; }

  runEval (code, opts) {
    // ensure react is loaded?
    const env = this.sanatizedJsEnv(opts);
    const endpoint = this.systemInterface(env);
    return endpoint.runEval(es5Transpilation(code), { ...env, format: 'es6' });
  }
}
