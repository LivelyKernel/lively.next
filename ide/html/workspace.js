/*global System,DOMParser*/
import { promise } from "lively.lang";
import { Color } from "lively.graphics";
import { config } from "../../index.js";
import EvalBackendChooser from "../js/eval-backend-ui.js";
import { Text } from "../../text/morph.js";
import HTMLEditorPlugin from "./editor-plugin.js";
import JSWorkspace from "../js/workspace.js";

// new Workspace().activate()

export default class Workspace extends JSWorkspace {

  static get properties() {

    return {

      title: {
        initialize(val) { this.title = val || "HTML Workspace"; }
      },

      targetMorph: {
        initialize() {
          this.targetMorph = new Text({
            name: "editor",
            textString: "<h1>test</h1>",
            editorModeName: "html",
            lineWrapping: "by-chars",
            ...config.codeEditor.defaultStyle,
            plugins: [new HTMLEditorPlugin()]
          });
        }
      },

      htmlPlugin: {
        derived: true, readOnly: true,
        get() { return this.targetMorph.editorPlugin; }
      },

      jsPlugin: {
        derived: true, readOnly: true,
        get() { return this.htmlPlugin; },
        initialize() {/*overwrite*/}
      },

      evalbackendButton: {
        derived: true, readOnly: true, after: ["targetMorph"],
        get() { this.getSubmorphNamed("eval backend button") },
        initialize() {
          this.addMorph(EvalBackendChooser.default.ensureEvalBackendDropdown(this, "local"));
        }
      }
    }
  }

  parse(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  async loadDocumentHTML() {
    let html = await this.runEval("document.documentElement.innerHTML");
    this.targetMorph.textString = html;
  }

  async saveDocumentHTML() {
    let html = this.targetMorph.textString,
        scripts = Array.from(this.parse(html).querySelectorAll("script"));
    if (!scripts.some(ea => ea.src.includes("livelify-web.js")))
      html += `<script src="/livelify-web.js"></script>`;
    if (this.htmlPlugin.systemInterface().name !== "local")
      await this.runEval(`document.documentElement.innerHTML = ${JSON.stringify(html)}`);
  }

  async runEval(source) {
    let result = await this.htmlPlugin.runEval(source, {
      targetModule: "lively://lively.next-html-workspace/" + this.id,
      format: "esm"
    });
    if (result.isError || result.error) {
      throw new Error(result.value || result.isError || result.error);
    }
    return result.value;
  }

  get commands() {
    return [
      ...super.commands.filter(ea => ea.name !== "[workspace] save content"),
      {
        name: "[workspace] save content",
        async exec(workspace) {
          if (workspace.file) {
            try {
              await workspace.file.write(workspace.content);
            } catch (e) { workspace.showError(e); throw e; }
            workspace.setStatusMessage(`Saved to ${workspace.file.url}`, Color.green);
            await promise.delay(500);
          }
          try {
            await workspace.saveDocumentHTML();
            workspace.setStatusMessage(`HTML applied`, Color.green);
          } catch (err) { workspace.showError(err); }
          return workspace;
        }
      }
    ];
  }

}