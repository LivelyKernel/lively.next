import { arr, obj } from "lively.lang";
import { pt, Point, Color, Rectangle } from "lively.graphics";
import { config, Icon, Window, DropDownList } from "../../index.js";
import JavaScriptEditorPlugin from "./editor-plugin.js";
import EvalBackendChooser from "./eval-backend-ui.js";
import InputLine from "../../text/input-line.js";
import { connect, once, noUpdate } from "lively.bindings";
import { resource } from "lively.resources";
import { Text } from "../../text/morph.js";

export default class Workspace extends Window {

  static get properties() {

    return {
      extent: {defaultValue: pt(400,300)},

      title: {
        initialize(val) {
          this.title = val || "Workspace";
        },
      },

      targetMorph: {
        initialize() {
          this.targetMorph = new Text({
            name: "editor",
            textString: "// Enter and evaluate JavaScript code here",
            lineWrapping: true,
            ...config.codeEditor.defaultStyle,
            plugins: [new JavaScriptEditorPlugin()]
          });
        }
      },

      content: {
        derived: true, after: ["targetMorph"],
        get() { return this.targetMorph.textString; },
        set(val) { if (val) this.targetMorph.textString = val; }
      },

      jsPlugin: {
        derived: true, readOnly: true, after: ["targetMorph"],
        get() { return this.targetMorph.pluginFind(p => p.isEditorPlugin); },
        initialize() {
          var ed = this.targetMorph;
          this.jsPlugin.evalEnvironment = {
            targetModule: "lively://lively.next-workspace/" + ed.id,
            context: ed, format: "esm"
          }
          let sys = this.jsPlugin.systemInterface();
          this.addMorph(EvalBackendChooser.default.ensureEvalBackendDropdown(
            this, sys ? sys.name : "local"));
        }
      },

      systemInterface: {
        derived: true, readOnly: true, after: ["jsPlugin"],
        get() { return this.jsPlugin.systemInterface(); },
        set(systemInterface) {
          this.jsPlugin.setSystemInterface(systemInterface);
        }
      },

      file: {
        get() { let f = this.getProperty("file"); return f ? resource(f) : f; },
        set(file) {
          if (file && file.isResource) file = file.url;
          this.setProperty("file", file);
        }
      }
    }
  }

  onLoad() {
    this.jsPlugin.requestHighlight();
  }

  setEvalBackend(choice) {
    this.jsPlugin.setSystemInterfaceNamed(choice);
  }

  relayoutWindowControls() {
    super.relayoutWindowControls();
    var list = this.getSubmorphNamed("eval backend list"),
        title = this.titleLabel();
    if (list) {
      list.topRight = this.innerBounds().topRight().addXY(-5, 2);
      if (list.left < title.right + 3) list.left = title.right + 3;
    }
    var fileButton = this.getSubmorphNamed("pickFileButton");
    if (fileButton) {
      fileButton.leftCenter = title.rightCenter.addXY(6,0);
    }
  }

  buttons() {
    let buttons = super.buttons(),
        label = this.getSubmorphNamed("pickFileButton");
    if (!label) {
      label = this.addMorph(
        Object.assign(Icon.makeLabel("file-o"), {
          name: "pickFileButton",
          nativeCursor: "pointer",
          fontSize: 14,
          fill: Color.rgbHex("#DDD"),
          tooltip: "set file for workspace",
          leftCenter: arr.last(buttons).rightCenter.addXY(6, -1)
        }));
      connect(label, 'onHoverIn', label, 'fontSize', {converter: () => 16});
      connect(label, 'onHoverOut', label, 'fontSize', {converter: () => 14});
      connect(label, 'onMouseDown', this, 'execCommand', {converter: () => "[workspace] query for file"});
    }
    return [...buttons, label];
  }

  get commands() {
    return [
      EvalBackendChooser.default.activateEvalBackendCommand(this),

      {
        name: "[workspace] query for file",
        async exec(workspace) {
          let historyId = "lively.ide-workspace-file-hist",
              {items: hist} = InputLine.getHistory(historyId),
              f = await workspace.world().prompt(
                "Enter a file to save the workspace contents to",
                {
                  input: workspace.file ? workspace.file.url :
                    hist.length ? arr.last(hist) :
                      resource(System.baseURL).join("workspace.js").url,
                  requester: workspace,
                  historyId
                });
          workspace.file = f;
          if (!f) {
            workspace.setStatusMessage("workspace file cleared");
            workspace.getSubmorphNamed("pickFileButton").tooltip = "set file for workspace";
            return;
          }
          workspace.setStatusMessage(`workspace saves content to ${workspace.file.url}`);
          workspace.getSubmorphNamed("pickFileButton").tooltip = `workspace file; ${workspace.file.url}`;
          if (await workspace.world().confirm(`Load content from ${f}?`, {requester: workspace}))
            workspace.content = await workspace.file.read();
        }
      },

      {
        name: "[workspace] save content",
        async exec(workspace) {
          if (!workspace.file) {
            workspace.setStatusMessage("Cannot save: no workspace file set");
            return workspace;
          }
          try {
            await workspace.file.write(workspace.content);
          } catch (e) { workspace.showError(e); throw e; }
          workspace.setStatusMessage(`Saved to ${workspace.file.url}`, Color.green);
          return workspace;
        }
      }
    ].concat(super.commands);
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Meta-Shift-L b a c k e n d", command: "activate eval backend dropdown list"},
      {keys: "Alt-L", command: "[workspace] query for file"},
      {keys: {mac: "Command-S", win: "Ctrl-S"}, command: "[workspace] save content"}
    ]);
  }

}
