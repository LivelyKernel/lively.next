import { HTMLMorph } from "lively.morphic";
import { mdCompiler } from "../json/editor-plugin.js";

export class MarkdownPreviewMorph extends HTMLMorph {

  static get properties() {

    return {

      markdownEditor: {},

      markdownSource: {
        after: ["markdownEditor"],
        get() {
          return this.markdownEditor.textString || this.getProperty("markdownSource");
        },
        set(src) {
          let ed = this.markdownEditor;
          if (ed) {
            this.markdownEditor.textString = src;
            this.setProperty("markdownSource", "");
          } else {
            this.setProperty("markdownSource", src);
          }
        },
      },
      
      markdownOptions: {
        after: ["markdownEditor"],
        get() {
          let ed = this.markdownEditor;
          return (ed && ed.editorPlugin.markdownOptions) || this.getProperty("markdownOptions");
        },
        set(options) {
          let ed = this.markdownEditor;
          if (ed) {
            ed.editorPlugin.markdownOptions = options;
            this.setProperty("markdownOptions", null);
          } else {
            this.setProperty("markdownOptions", options);
          }
        },
      },

    }
  }

  renderMarkdown() {
    let ed = this.markdownEditor;
    if (ed) return this.html = ed.editorPlugin.renderedMarkdown();
    let {markdownSource, markdownOptions} = this,
        html = mdCompiler.compileToHTML(markdownSource, markdownOptions);
    this.html = html;
  }

}