import { pt, Rectangle, rect, Color } from "lively.graphics"
import { connect, disconnect } from "lively.bindings";
import { arr, obj } from "lively.lang";
import { defaultDirectory } from "./shell-interface.js";
import ClientCommand from "lively.shell/client-command.js";
import { GridLayout } from "lively.morphic/layout.js";
import { Morph, Text, World, config } from "lively.morphic";
import { ShellEditorPlugin} from "./editor-plugin.js";

import { DiffEditorPlugin } from "lively.morphic/ide/diff/editor-plugin.js";

// var t = Terminal.runCommand("ls")
// var t = Terminal.open()
// var t = new Terminal().openInWindow()
// t.show()
// t.remove()

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// 2016-11-21 FIXME, move this to a common location

function guessTextModeName(editor, filename = "", hint) {
  var mode = hint || "text",
      start = editor.textString.slice(0, 2000);
  // content tests
  if (start.match(/^diff --.* a\//m)) mode = "diff";
  else if (start.match(/#!\/bin\//m)) mode = "sh";
  else {
    // file-based tests
    var ext = filename && arr.last(filename.split(".")).toLowerCase();
    switch(ext) {
      case "r": mode = "r"; break;
      case "css": mode = "css"; break;
      case "h": case "c": case "cc": case "cpp": case "hpp": mode = "c_cpp"; break;
      case "diff": mode = "diff"; break;
      case "xhtml": case "html": mode = "html"; break;
      case "js": mode = "javascript"; break;
      case "json": mode = "json"; break;
      case "jade": mode = "jade"; break;
      case "ejs": mode = "ejs"; break;
      case "markdown": case "md": mode = "markdown"; break;
      case "sh": case "bashrc": case "bash_profile": case "profile": mode = "sh"; break;
      case "dockerfile": mode = "dockerfile"; break;
      case "xml": mode = "xml"; break;
      case "svg": mode = "svg"; break;
      case "lisp": case "el": mode = "lisp"; break;
      case "clj": case "cljs": case "cljx": case "cljc": mode = "clojure"; break;
      case "cabal": case "hs": mode = "haskell"; break;
      case "py": mode = "python"; break;
    }
  }
  return mode;
}

export default class Terminal extends Morph {

  static open(options = {}) {
    var term = new this(options),
        winOpts = {name: "ShellTerminal window", title: options.title || "Terminal"},
        win = term.openInWindow(winOpts).activate();
    term.updateWindowTitle();
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

  constructor(props = {}) {
    super({
      extent: pt(600, 300),
      ...obj.dissoc(props, ["command", "cwd"])
    });
    this.state = {command: null, lastFocused: null};
    this.build(props);
    if (props.command)
      this.command = props.command;
    this.cwd = props.cwd || defaultDirectory();
  }

  get defaultStyle() {
    return {
      ...config.codeEditor.defaultStyle
    }
  }

  build(props) {
    var output = this.addMorph({
      type: "text", name: "output",
      lineWrapping: false, textString: "",
      ...this.defaultStyle,
      ...props
    });

    var input = this.addMorph(Text.makeInputLine({
      name: "input",
      textString: input,
      clearOnInput: true,
      historyId: "lively.shell-terminal-input-history",
      border: {width: 1, color: Color.gray},
      plugins: [new ShellEditorPlugin()],
      ...this.defaultStyle,
      ...props
    }));
    connect(input, "input", this, "execCommand",
      {updater: ($upd, command) => $upd("[shell terminal] run command or send input", {command})});


    var btn = this.addMorph({
      type: "button", name: "changeCwdButton",
      label: "cwd...", extent: pt(60,20), borderRadius: 3,
      padding: Rectangle.inset(4, 2)
    });
    connect(this.shellPlugin, 'cwd', btn, 'label');
    connect(this, 'extent', btn, 'topRight', {converter: ext => ext.withY(0)});
    connect(btn, 'fire', this, 'execCommand', {converter: () => "[shell] change working directory"});


    this.layout = new GridLayout({grid: [["output"], ["input"]]});
    this.layout.row(1).fixed = 25;
    // this.layout.row(1).paddingBottom = 5;

  }

  focus() {
    var target = this.state.lastFocused || "input";
    this.getSubmorphNamed(target).focus();
  }

  clear() { this.getSubmorphNamed("output").textString = ""; }

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
    var ed = this.getSubmorphNamed('output'),
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
          term.state.lastFocused = "input"
          var m = term.getSubmorphNamed("input");
          m.show(); m.focus(); return true;
        }
      },

      {
        name: "focus output",
        exec: term => {
          term.state.lastFocused = "output";
          var m = term.getSubmorphNamed("output");
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

  get shellPlugin() {
    return this.getSubmorphNamed("input")
      .pluginFind(ea => ea.isShellEditorPlugin);
  }
  get cwd() { return this.shellPlugin.cwd; }
  set cwd(cwd) { this.shellPlugin.cwd = cwd; }

  get command() { return this.shellPlugin.command; }
  set command(cmd) {
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

  addOutput(text) {
    var ed = this.getSubmorphNamed('output'),
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