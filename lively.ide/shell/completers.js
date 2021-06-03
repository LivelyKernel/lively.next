import { arr } from 'lively.lang';
import { runCommand } from './shell-interface.js';

class ShellCompleter {
  buildCommand (inputBefore) {
    var [_, prefix] = inputBefore.match(/\$([^\s]*)$/i) || [];
    if (typeof prefix === 'string') { return { command: `compgen -v -S "[variable]" ${prefix}`, prefix }; }

    var [_, _2, prefix] = inputBefore.match(/(^|;)\s*([^\s]*)$/i) || [];
    if (typeof prefix === 'string') {
      return {
        command: `compgen -a -S "[alias]" ${prefix}
                        compgen -c -S "[command]" ${prefix}
                        compgen -b -S "[builtin]" ${prefix}`,
        prefix
      };
    }

    var prefix = arr.last(inputBefore.split(/[\s;]/));
    return { prefix, command: `compgen -f -S "[file]" ${prefix}` };
  }

  async compute (textMorph) {
    let plugin = textMorph.pluginFind(({ isShellEditorPlugin }) => isShellEditorPlugin);
    let { row, column } = textMorph.cursorPosition;
    var prefix = textMorph.getLine(row).slice(0, column);
    let rawCompletions = '';

    if (!plugin) return [];

    var { command: commandString, prefix } = this.buildCommand(prefix);

    try {
      let cmd = runCommand(commandString, { cwd: plugin.cwd });
      await cmd.whenDone();
      rawCompletions = cmd.stdout;
    } catch (e) {
      console.warn(`shell completer errored: ${e.stack || e}`);
      return [];
    }

    let priorities = {
      variable: 300,
      file: 400,
      builtin: 400,
      command: 500,
      alias: 200
    };

    let completions = rawCompletions.split('\n')
      .map(ea => {
        let [_, completion, kind] = ea.match(/(.*)\[([^\]]+)\]$/) || [];
        if (!completion) return null;
        let priority = priorities[kind] || 0;
        let basePriority = 1500;
        return {
          completion,
          prefix,
          info: kind,
          priority: basePriority + priority
        };
      })
      .filter(Boolean);

    return completions;
  }
}

export var shellCompleters = [new ShellCompleter()];
