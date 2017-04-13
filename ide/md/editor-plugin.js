import EditorPlugin from "../editor-plugin.js";

// import MarkdownMorph from "./md-morph.js";
import MarkdownStyler from "./highlighter.js";

import * as marked from "https://raw.githubusercontent.com/chjj/marked/master/lib/marked.js"

var commands = [

  {
    name: "convert to html",
    exec: async (mdText, opts = {}) => {
      var mdMorph = new MarkdownMorph({markdown: mdText.textString});
      mdMorph

      this.world().openInWindow(mdMorph).openInWorld().activate()

      return true;
    }
  }
]

export default class MarkdownEditorPlugin extends EditorPlugin {

  constructor(theme) {
    super(theme);
    this.highlighter = new MarkdownStyler();
  }

  get isMarkdownEditorPlugin() { return true }

  highlight() {
    let textMorph = this.textMorph;
    if (!this.theme || !textMorph || !textMorph.document) return;
    this._parsed = marked.lexer(textMorph.textString);
    this.highlighter.style(textMorph, this._parsed);
  }

}
