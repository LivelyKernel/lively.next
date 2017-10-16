import JavaScriptEditorPlugin from "../js/editor-plugin.js";
import { getMode } from "../editor-modes.js";
import JSONChecker from "./checker.js";

export default class JSONEditorPlugin extends JavaScriptEditorPlugin {

  static get shortName() { return "json"; }

  static get mode() { return getMode({}, {name: "javascript", json: true}); }

  constructor() {
    super()
    this.checker = new JSONChecker();
  }

  get isJSONEditorPlugin() { return true }

}
