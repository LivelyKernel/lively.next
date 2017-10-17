import JavaScriptEditorPlugin from "../js/editor-plugin.js";
import JSONChecker from "./checker.js";
import { getMode } from "../editor-modes.js";

export default class JSONEditorPlugin extends JavaScriptEditorPlugin {

  constructor() {
    super();
    this.checker = new JSONChecker();
  }

  get isJSONEditorPlugin() { return true; }
  get shortName() { return "json"; }
  get longName() { return "json"; }

  codeMirrorMode(textMorph) {
    let config = this.defaultCodeMirrorModeConfig(textMorph);
    return getMode(config, {name: "javascript", json: true});
  }

}
