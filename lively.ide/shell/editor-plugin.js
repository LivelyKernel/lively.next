/*global localStorage*/
import { arr, string } from "lively.lang";
import { signal } from "lively.bindings";
import { CodeMirrorEnabledEditorPlugin } from "../editor-plugin.js";
import { defaultDirectory, runCommand } from "./shell-interface.js";
import { shellCompleters } from "./completers.js";

import "./mode.js";
import { Snippet } from "../text/snippets.js";

var defaultDir;
Promise.resolve(defaultDirectory()).then(dir => defaultDir = dir);


export default class ShellEditorPlugin extends CodeMirrorEnabledEditorPlugin {

  constructor() {
    super();
    this.state = {cwd:  defaultDir, command: null};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // editor plugin related
  get isShellEditorPlugin() { return true; }
  get shortName() { return "shell"; }

  get options() { return this.state; }
  set options(o) { return this.state = Object.assign(this.state, o); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // shell related
  get cwd() { return this.state.cwd || defaultDir || ""; }
  set cwd(cwd) { this.state.cwd = cwd; signal(this, "cwd", cwd); }

  get command() { return this.state.command; }
  set command(cmd) { this.state.command = cmd; signal(this, "command", cmd);}

  runCommand(cmd, opts) {
    return this.command = runCommand(cmd, {cwd: this.cwd, owner: this.textMorph.id, ...opts});
  }

  async changeCwdInteractively() {
    var cwd = this.cwd,
        dirs = arr.uniq([cwd].concat(defaultDir, ...this.knownCwds)).filter(Boolean),
        {status, list: newDirs, selections: [choice]} = await this.textMorph.world().editListPrompt(
          "Choose working directory:", dirs, {
            requester: this.textMorph.getWindow(),
            historyId: "lively.morphic-ide/shell-changeCwdInteractively-hist-list",
            preselect: dirs.indexOf(cwd)
          }) || {};

    if (status === "canceled") return;

    this.knownCwds = newDirs;

    if (!choice) return;
    this.textMorph.setStatusMessage(choice);
    this.cwd = choice;

    this.updateWindowTitle();
  }

  get knownCwds() {
    if (typeof localStorage === "undefined") return [];
    try {
      var cwds = localStorage.getItem("lively.morphic-ide/shell-known-cwds");
      return cwds ? JSON.parse(cwds) : [];
    } catch (e) { return []; }
  }

  set knownCwds(cwds) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem("lively.morphic-ide/shell-known-cwds", JSON.stringify(cwds));
    } catch (e) { console.error(e); }
  }

  updateWindowTitle() {
    var win = this.textMorph.getWindow();
    if (!win || !win.title.includes("Shell Workspace")) return;

    var part1 = "Shell Workspace",
        part2 = this.command && this.command.isRunning() ?
          ` (running ${this.command.pid})` : "",
        part3 = !this.cwd ? "" : ` - ${string.truncateLeft(this.cwd, 35)}`;

    win.title = [part1, part2, part3].join("");
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // UI
  getCommands(otherCommands) {
    var ed = this.textMorph;

    return [
      {
        name: "[shell] spawn command from selected text",
        exec: async (_, opts = {printit: false}) => {
          var sel = ed.selection;
          if (sel.isEmpty()) ed.selectLine(sel.lead.row);
          var cmd = this.runCommand(sel.text, {});

          sel.collapseToEnd();

          if (opts.printit) {
            var insert = out => {
              var {start} = sel;
              sel.collapseToEnd();
              ed.insertText(out);
              sel.range = {start, end: ed.cursorPosition};
            };
            cmd.on("stdout", insert);
            cmd.on("stderr", insert);
          }

          this.updateWindowTitle();
          await cmd.whenStarted();
          this.updateWindowTitle();
          await cmd.whenDone();
          this.updateWindowTitle();

          if (opts.printit) {
            cmd.removeListener("stdout", insert);
            cmd.removeListener("stderr", insert);
          } else {
            ed.setStatusMessage(cmd.output.trim());
          }

          return true;
        }
      },

      {
        name: "[shell] kill current command",
        exec: async (_, opts = {signal: undefined}) => {
          var {command: cmd} = this;
          if (!cmd) {
            ed.setStatusMessage("No command running");
            return true;
          }

          ed.setStatusMessage(`Sending signal ${opts.signal || "KILL"} to command ${cmd.pid}`);
          await cmd.kill(opts.signal);
          return true;
        }
      },

      {
        name: "[shell] change working directory",
        exec: async () => { await this.changeCwdInteractively(); return true; }
      }
    ].concat(otherCommands);
  }

  getKeyBindings(otherKeybindings) {
    return otherKeybindings.concat([
      {keys: {mac: "Meta-D", win: "Ctrl-D"}, command: {command: "[shell] spawn command from selected text", args: {printit: false}}},
      {keys: {mac: "Meta-P", win: "Ctrl-P"}, command: {command: "[shell] spawn command from selected text", args: {printit: true}}},
      {keys: {mac: "Meta-Shift-L D I R", win: "Ctrl-Shift-L D I R"}, command: "[shell] change working directory"}
    ]);
  }

  getSnippets(otherSnippets) {
    return otherSnippets.concat([
      ["findjs", "find ${0:.} \\( -name ${1:excluded} \\) -prune -o -iname '*.js' -type f -print0 | xargs -0 grep -nH ${2:what}"]
    ].map(([trigger, expansion]) => new Snippet({ trigger, expansion })));
  }

  getCompleters(completers) {
    return completers.concat(shellCompleters);
  }

}
