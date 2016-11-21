import { arr } from "lively.lang";
import { runCommand } from "./shell-interface.js";

class ShellCompleter {

  buildCommand(inputBefore) {
    var [_, prefix] = inputBefore.match(/\$([^\s]*)$/i) || [];
    if (typeof prefix === "string")
      return {command: `compgen -v -S "[variable]" ${prefix}`, prefix}

    var [_, _2, prefix] = inputBefore.match(/(^|;)\s*([^\s]*)$/i) || [];
    if (typeof prefix === "string")
      return {command: `compgen -a -S "[alias]" ${prefix}
                        compgen -c -S "[command]" ${prefix}
                        compgen -b -S "[builtin]" ${prefix}`,
              prefix};

    var prefix = arr.last(inputBefore.split(/[\s;]/));
    return {prefix, command: `compgen -f -S "[file]" ${prefix}`};
  }
  
  async compute(textMorph) {
    var plugin = textMorph.pluginFind(({isShellEditorPlugin}) => isShellEditorPlugin),
        {row, column} = textMorph.cursorPosition,
        prefix = textMorph.getLine(row).slice(0, column),
        rawCompletions = ""

    if (!plugin) return [];

    var {command: commandString, prefix} = this.buildCommand(prefix);

    try {
      var cmd = runCommand(commandString, {cwd: plugin.cwd});
      await cmd.whenDone();
      rawCompletions = cmd.stdout;
    } catch (e) {
      console.warn(`shell completer errored: ${e.stack || e}`);
      return [];
    }

    var priorities = {
      "variable": 300,
      "file": 400,
      "builtin": 400,
      "command": 500,
      "alias": 200
    }

    var completions = rawCompletions.split("\n")
      .map(ea => {
        var [_, completion, kind] = ea.match(/(.*)\[([^\]]+)\]$/) || [];
        if (!completion) return null;
        var priority = priorities[kind] || 0;
        var basePriority = 1500;
        return {
          completion, prefix, info: kind,
          priority: basePriority + priority
        }
      })
      .filter(Boolean)

    return completions;
  }

}

export var shellCompleters = [new ShellCompleter()];
