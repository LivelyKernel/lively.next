import { arr, obj } from "lively.lang";
import { connect } from "lively.bindings";
import { pt, Point, Color, Rectangle } from "lively.graphics";
import { config, morph } from "../../index.js";
import Window from "../../window.js";
import { ShellEditorPlugin } from "./editor-plugin.js";
import Terminal from "./terminal.js";

export default class Workspace extends Window {

  constructor(props = {}) {
    super({
      title: "Shell Workspace",
      targetMorph: {
        type: "text", name: "editor",
        textString: props.content || "",
        lineWrapping: false,
        ...config.codeEditor.defaultStyle,
        plugins: [new ShellEditorPlugin()]
      },
      extent: pt(400,300),
      ...obj.dissoc(props, ["content", "cwd"])
    });
    var btn = this.addMorph(this.ensureCwdButton(this.shellPlugin.cwd));
    connect(this.shellPlugin, 'cwd', btn, 'label',
      {converter: cwd => lively.lang.string.truncateLeft(cwd, 50)});
  }

  get shellPlugin() { return this.targetMorph.pluginFind(p => p.isShellEditorPlugin); }

  ensureCwdButton(cwd) {
    var btn = this.getSubmorphNamed("changeCwdButton")
     if (btn) return btn;
     btn = morph({
      type: "button", name: "changeCwdButton",
      padding: Rectangle.inset(4,2),
      label: cwd || "...", extent: pt(60,20), borderRadius: 3
    });
    connect(btn, 'fire', this, 'execCommand', {converter: () => "[shell] change working directory"});
    return btn;
  }

  buttons() {
    return super.buttons().concat(this.getSubmorphNamed("changeCwdButton") || []);
  }

  relayoutControls() {
    super.relayoutControls();
    var list = this.getSubmorphNamed("changeCwdButton");
    if (list)
      list.topRight = this.targetMorph.topRight.addXY(-5, 2);
  }

  get keybindings() {
    return [
      {keys: {mac: "Meta-Shift-O", win: "Ctrl-Shift-O"}, command: "[shell] open running command in terminal"}]
  }

  get commands() {
    return [
      {
        name: "[shell] change working directory",
        async exec(workspace) {
          await workspace.targetMorph.execCommand("[shell] change working directory");
          var [front, back] = workspace.title.split("–");
          workspace.title = workspace.shellPlugin.cwd ?
            `${front.trim()} – ${workspace.shellPlugin.cwd}` :
            `${front.trim()}`
        }
      },
      
      {
        name: "[shell] open running command in terminal",
        exec(workspace) {
          var {command, cwd} = workspace.shellPlugin;
          if (!command) {
            workspace.setStatusMessage("No command running!");
            return true;
          }
          workspace.shellPlugin.command = null;
          workspace.shellPlugin.updateWindowTitle();
          return Terminal.forCommand(command, {cwd});
        }
      }
    ]
  }
}
