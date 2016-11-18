import { arr, obj } from "lively.lang";
import { pt, Point, Color, Rectangle } from "lively.graphics";
import { config } from "../../index.js";
import Window from "../../window.js";
import { ShellEditorPlugin } from "./editor-plugin.js";

export default class Workspace extends Window {

  constructor(props = {}) {
    super({
      title: "Shell Workspace",
      targetMorph: {
        type: "text", name: "editor",
        textString: props.content || "",
        ...config.codeEditor.defaultStyle,
        plugins: [new ShellEditorPlugin()]
      },
      extent: pt(400,300),
      ...obj.dissoc(props, ["content"])
    });
  }

  get shellPlugin() { return this.targetMorph.pluginFind(p => p.isShellEditorPlugin); }

}


// new Workspace().openInWorld().activate()