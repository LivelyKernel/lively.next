import { pt, Rectangle, rect, Color } from "lively.graphics"
import { connect, disconnect } from "lively.bindings";
import { arr, obj } from "lively.lang";
import { defaultDirectory } from "./shell-interface.js";
import ClientCommand from "lively.shell/client-command.js";
import { GridLayout } from "lively.morphic/layout.js";
import { Morph, Text, World, config } from "lively.morphic";
import { ShellEditorPlugin} from "./editor-plugin.js";

import { DiffEditorPlugin } from "lively.morphic/ide/diff/editor-plugin.js";
import { guessTextModeName } from "lively.morphic/ide/editor-plugin.js";

// var t = Terminal.runCommand("ls")
// var t = Terminal.open()
// var t = new Terminal().openInWindow()
// t.show()
// t.remove()

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// 2016-11-21 FIXME, move this to a common location

export default class Terminal extends Morph {

  static open(options = {}) {
    var term = new this(options),
        winOpts = {name: "ShellTerminal window", title: options.title || "Terminal"},
        win = term.openInWindow(winOpts).activate();
    return win;
  }

  static runCommand(cmdString, options) {
    var win = this.open(options), term  = win.targetMorph;
    term.runCommand(cmdString, options);
    return win;
  }

  static forCommand(command, options) {
    return this.open({command, ...options});
  }

  static findOrCreateForCommand(cmd) {
    var w = World.defaultWorld(),
        existing = arr.grep(w.submorphs, /ShellTerminal window/).find(ea =>
          ea.targetMorph.command
       && ea.targetMorph.command.pid === cmd.pid);
    return existing || this.forCommand(cmd);
  }


  static get properties() {
    return {

      title: {defaultValue: "Terminal"},
      name: {defaultValue: "terminal"},
      extent: {defaultValue: pt(600, 300)},
      lastFocused: {defaultValue: "input"},

      submorphs: {
      
        initialize() {
          this.submorphs = [
            {
              type: "text", name: "output",
              lineWrapping: false, textString: "",
              ...this.defaultStyle,
              // ...props
            },

            Text.makeInputLine({
              ...this.defaultStyle,
              name: "input",
              textString: "",
              clearOnInput: true,
              historyId: "lively.shell-terminal-input-history",
              border: {width: 1, color: Color.gray},
              plugins: [new ShellEditorPlugin()],
              clipMode: "hidden",
              // ...props
            }),

            {
              type: "button", name: "changeCwdButton",
              label: "cwd...", extent: pt(60,20), borderRadius: 3,
              padding: Rectangle.inset(4, 2)
            }
          ];

          var {input, changeCwdButton} = this.ui;

          connect(input, "inputAccepted", this, "execCommand",
            {updater: ($upd, command) => $upd("[shell terminal] run command or send input", {command})});

          connect(this, 'extent', changeCwdButton, 'topRight', {converter: ext => ext.withY(0)});
          connect(changeCwdButton, 'fire', this, 'execCommand', {converter: () => "[shell] change working directory"});

          this.layout = new GridLayout({grid: [["output"], ["input"]]});
          this.layout.row(1).fixed = 25;
        }
      },

      ui: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() {
          var [output, input, changeCwdButton] = this.submorphs;
          return {output, input, changeCwdButton};
        }
      },

      command: {
        derived: true, after: ["shellPlugin"],
        get() { return this.shellPlugin.command; },

        set(cmd) {
          if (this.command && this.command.isRunning())
            throw new Error(`${this.command} still running`);
          this.shellPlugin.command = cmd;
          cmd.stdout && this.addOutput(cmd.stdout);
          cmd.stdout && this.addOutput(cmd.stderr);
          connect(cmd, 'stdout', this, 'addOutput');
          connect(cmd, 'stderr', this, 'addOutput');
          connect(cmd, 'error', this, 'addOutput');
          connect(cmd, 'pid', this, 'updateWindowTitle');
          connect(cmd, 'close', this, 'updateWindowTitle');
          connect(cmd, 'close', this, 'updateTextMode');
          this.updateWindowTitle();
          this.updateTextMode();
        }
      },

      cwd: {
        derived: true, after: ["shellPlugin"],
        get() { return this.shellPlugin.cwd; },
        set(cwd) { return this.shellPlugin.cwd = cwd; }
      },

      shellPlugin: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() {
          var i = this.ui.input,
              p = i.pluginFind(ea => ea.isShellEditorPlugin);
          if (p) return p;
          p = i.addPlugin(new ShellEditorPlugin());
          connect(p, 'cwd', this.ui.changeCwdButton, 'label');
          return p;
        }
      },

      input: {
        derived: true, after: ["submorphs"],
        set(val) { this.ui.input.input = val; },
        get() { return this.ui.input.input; }
      }
    }
  }

  constructor(props) {
    super(props);
    if (!props.cwd) Promise.resolve(() => this.cwd = defaultDirectory());
  }


  __additionally_serialize__(snapshot, objRef, pool, addFn) {
    // remove unncessary state    
    var ref = pool.ref(this.ui.output);
    ref.currentSnapshot.props.attributeConnections.value = [];
    ref.currentSnapshot.props.plugins.value = [];
    ref.currentSnapshot.props.anchors.value =
      ref.currentSnapshot.props.anchors.value.filter(({id}) =>
        id.startsWith("selection-"));
    ref.currentSnapshot.props.savedMarks.value = [];

    var ref = pool.ref(this.ui.input);
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

  onLoad(_, snapshot) {
    if (this._serializedState) {
      this.cwd = this._serializedState.cwd;
      delete this._serializedState;
    }
    connect(this.ui.input, "inputAccepted", this, "execCommand",
      {updater: ($upd, command) => $upd("[shell terminal] run command or send input", {command})});
  }

  get defaultStyle() {
    return {
      ...config.codeEditor.defaultStyle
    }
  }

  focus() {
    this.ui[this.lastFocused].focus();
  }

  clear() { this.ui.output.textString = ""; }

  updateWindowTitle() {
    var win = this.getWindow();
    if (!win) return;
    var title = "Term",
        {command} = this;
    if (command) {
      var {commandString, status} = command;
      title += ` - ${commandString ? commandString + " " : ""}${status}`;
    }
    win.title = title;
  }

  updateTextMode() {
    var ed = this.ui.output,
        mode = guessTextModeName(ed),
        pluginsToRemove = ed.plugins.filter(ea => ea.isEditorPlugin),
        pluginsToAdd = [];

    if (mode === "diff") {
      var plugin = pluginsToRemove.find(p => p instanceof DiffEditorPlugin);
      if (plugin) arr.remove(pluginsToRemove, plugin);
      else pluginsToAdd.push(new DiffEditorPlugin());
    }

    ed.plugins = arr.withoutAll(ed.plugins, pluginsToRemove).concat(pluginsToAdd);
  }

  get keybindings() {
    return [
      {keys: "F1|Alt-Up",    command: "focus output"},
      {keys: "F2|Alt-Down",  command: "focus input"},
      {keys: "Ctrl-D", command: {command: "[shell] kill current command", args: {signal: "KILL"}}},
      {keys: "Ctrl-C", command: {command: "[shell] kill current command", args: {signal: "INT"}}},
      {keys: {mac: "Meta-Shift-L D I R", win: "Ctrl-Shift-L D I R"}, command: "[shell] change working directory"}
    ].concat(super.keybindings);
  }

  get commands()  {
    return super.commands.concat([
      {
        name: "focus input",
        exec: term => {
          term.lastFocused = "input"
          var m = term.ui.input;
          m.show(); m.focus(); return true;
        }
      },

      {
        name: "focus output",
        exec: term => {
          term.lastFocused = "output";
          var m = term.ui.output;
          m.show(); m.focus(); return true;
        }
      },

      {
        name: "[shell terminal] run command or send input",
        exec: (term, opts = {command: ""}) => {
          if (term.command && term.command.isRunning()) {
            term.command.writeToStdin(opts.command + "\n");
          } else {
            term.clear();
            term.command = term.runCommand(opts.command, obj.dissoc(opts, ["command"]));
          }
          return true;
        }
      },

      {
        name: "[shell] kill current command",
        exec: async (term, opts = {signal: undefined}) => {
          var {command} = term;
          if (!command) {
            term.setStatusMessage("No command running");
            return true;
          }

          var sig = opts.signal || "KILL";
          term.addOutput(`\nsend signal ${sig}`);
          term.setStatusMessage(`Sending signal ${sig} to command ${command.pid}`);
          await command.kill(sig);
          return true;
        }
      },

      {
        name: "[shell] change working directory",
        exec: async term => {
          await term.shellPlugin.changeCwdInteractively();
          return true;
        }
      }
    ]);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  addOutput(text) {
    var ed = this.ui.output,
        isAtFileEnd = ed.isAtDocumentEnd();
    ed.append(text);

    if (isAtFileEnd) {
      ed.gotoDocumentEnd();
      ed.scrollCursorIntoView();
    }
  }

  runCommand(cmd, opts) {
    if (this.command && this.command.isRunning())
      throw new Error(`${this.command} still running`);
    return this.command = this.shellPlugin.runCommand(cmd, opts);
  }
}