import { obj } from "lively.lang";
import { pt, Point, Color, Rectangle } from "lively.graphics";
import { config } from "../../index.js";
import Window from "../../window.js";
import { JavaScriptEditorPlugin } from "./editor-plugin.js";

export default class Workspace extends Window {

  constructor(props = {}) {
    var jsPlugin = new JavaScriptEditorPlugin();
    super({
      title: "Workspace",
      targetMorph: {
        type: "text",
        textString: props.content || "// Enter and evaluate JavaScript code here",
        ...config.codeEditor.defaultStyle,
        plugins: [jsPlugin]
      },
      extent: pt(400,300),
      ...obj.dissoc(props, ["content"])
    });
    var ed = this.targetMorph;
    jsPlugin.evalEnvironment = {
      targetModule: "lively://lively.next-workspace/" + ed.id,
      context: ed, format: "esm"
    }
  }

}
