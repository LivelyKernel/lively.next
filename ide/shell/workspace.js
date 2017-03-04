import { arr, obj } from "lively.lang";
import { connect } from "lively.bindings";
import { pt, Point, Color, Rectangle } from "lively.graphics";
import { config, morph } from "../../index.js";
import Window from "../../components/window.js";
import { ShellEditorPlugin } from "./editor-plugin.js";
import Terminal from "./terminal.js";

export default class Workspace extends Window {

  static get properties() {
    return {

      title: {defaultValue: "Shell Workspace"},
      name: {defaultValue: "shell-workspace"},

      targetMorph: {
        initialize() {
          this.targetMorph = {
            type: "text", name: "editor",
            lineWrapping: false,
            textString: "// Enter and evaluate JavaScript code here",
            ...config.codeEditor.defaultStyle,
            // plugins: [new ShellEditorPlugin()]
          };
        }
      },

      content: {
        derived: true, after: ["targetMorph"],
        get() { return this.targetMorph.textString; },
        set(content) { return this.targetMorph.textString = content; }
      },

      cwd: {
        derived: true, after: ["shellPlugin"],
        get() { return this.shellPlugin.cwd; },
        set(cwd) { return this.shellPlugin.cwd = cwd; }
      },

      extent: {defaultValue: pt(400,300)},

      shellPlugin: {
        derived: true, readOnly: true, after: ["targetMorph"],
        get() {
          return this.targetMorph.pluginFind(p => p.isShellEditorPlugin)
              || this.targetMorph.addPlugin(new ShellEditorPlugin());
        }
      }
    }
  }

  constructor(props) {
    super(props);
    var btn = this.addMorph(this.ensureCwdButton(this.shellPlugin.cwd));
    connect(this.shellPlugin, 'cwd', btn, 'label',
      {converter: cwd => lively.lang.string.truncateLeft(cwd, 50)});
  }

  onLoad(_, snapshot) {
    if (this._serializedState) {
      this.cwd = this._serializedState.cwd;
      delete this._serializedState;
    }
  }

  __additionally_serialize__(snapshot, objRef, pool, addFn) {
    // remove unncessary state    
    var ref = pool.ref(this.targetMorph);
    ref.currentSnapshot.props.attributeConnections.value = [];
    ref.currentSnapshot.props.plugins.value = [];
    ref.currentSnapshot.props.anchors.value =
      ref.currentSnapshot.props.anchors.value.filter(({id}) =>
        id.startsWith("selection-"));
    ref.currentSnapshot.props.savedMarks.value = [];

    // save essential state
    snapshot.props._serializedState = {
      verbatim: true,
      value: {
        cwd: this.cwd
      }
    }
  }

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

  relayoutWindowControls() {
    super.relayoutWindowControls();
    var list = this.getSubmorphNamed("changeCwdButton");
    if (list) {
      var title = this.titleLabel();
      list.topRight = this.innerBounds().topRight().addXY(-5, 2);
      if (list.left < title.right + 3) list.left = title.right + 3;
    }
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
