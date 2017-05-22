import EditorPlugin from "../editor-plugin.js";

import "./mode.js"
import { getMode } from "../editor-modes.js";


export default class HTMLEditorPlugin extends EditorPlugin {

  static get shortName() { return "html"; }

  static get mode() { return getMode({}, {name: "htmlmixed"}); }

  get isHTMLEditorPlugin() { return true }
}
