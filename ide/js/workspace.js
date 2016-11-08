import { arr, obj } from "lively.lang";
import { pt, Point, Color, Rectangle } from "lively.graphics";
import { config } from "../../index.js";
import Window from "../../window.js";
import { DropDownList } from "../../list.js";
import { JavaScriptEditorPlugin } from "./editor-plugin.js";
import InputLine from "../../text/input-line.js";
import { connect, once, noUpdate } from "lively.bindings";

export default class Workspace extends Window {

  constructor(props = {}) {
    super({
      title: "Workspace",
      targetMorph: {
        type: "text", name: "editor",
        textString: props.content || "// Enter and evaluate JavaScript code here",
        ...config.codeEditor.defaultStyle,
        plugins: [new JavaScriptEditorPlugin()]
      },
      extent: pt(400,300),
      ...obj.dissoc(props, ["content"])
    });
    this.addMorph(this.ensureEvalBackEndList());
    var ed = this.targetMorph;
    this.jsPlugin.evalEnvironment = {
      targetModule: "lively://lively.next-workspace/" + ed.id,
      context: ed, format: "esm"
    }
  }

  buttons() {
    return super.buttons().concat(this.getSubmorphNamed("eval backend list") || []);
  }

  relayoutControls() {
    super.relayoutControls();
    var list = this.getSubmorphNamed("eval backend list");
    if (list)
      list.topRight = this.innerBounds().topRight().addXY(-5, 2);
  }

  get jsPlugin() { return this.targetMorph.pluginFind(p => p.isEditorPlugin); }

  ensureEvalBackEndList() {
    var list = this.getSubmorphNamed("eval backend list");
    if (!list) {
      list = new DropDownList({
        fontSize: 10,
        name: "eval backend list",
        extent: pt(120, 20)
      });
      connect(list, 'selection', this, 'interactivelyChangeEvalBackend');
      // for updating the list items when list is opened:
      connect(list, 'activated', this, 'ensureEvalBackEndList');
    }
    if (!this.targetMorph) return list;

    var currentBackend = this.jsPlugin.evalEnvironment.remote || "local",
        backends = arr.uniq(
                  arr.compact([
                    "new backend...",
                    "local", currentBackend,
                    ...InputLine.getHistory("js-eval-backend-history").items]));
    noUpdate({sourceObj: list, sourceAttribute: "selection"}, () => {
      list.items = backends;
      list.selection = currentBackend;
    });
    return list;
  }

  async interactivelyChangeEvalBackend(choice) {
    if (!choice) choice = "local";
    if (choice === "new backend...") choice = undefined;
    await this.targetMorph.execCommand("change eval backend", {backend: choice});
    this.ensureEvalBackEndList();
    this.targetMorph.focus();
  }

  get commands() {
    return [
      {
        name: "change eval backend via dropdown list",
        exec: () => {
          var list = this.ensureEvalBackEndList();
          list.toggleList(); list.list.focus();
          return true;
        }
      }
    ].concat(super.commands);
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Meta-Shift-L b a c k e n d", command: "change eval backend via dropdown list"}
    ]);
  }

}
