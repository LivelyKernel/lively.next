import { arr } from "lively.lang";
import EditorPlugin from "../editor-plugin.js";
import { TextStyleAttribute } from "../../text/attribute.js";

import L2LClient from "lively.2lively/client.js";
import ClientCommand from "lively.shell/client-command.js";


// FIXME put this in either config or have it provided by server
var defaultConnection = {url: "http://localhost:9010/lively-socket.io", namespace: "l2l"};

function runCommand(commandString) {
  var client = L2LClient.ensure(defaultConnection);
  ClientCommand.installLively2LivelyServices(client);
  var cmd = new ClientCommand(client);
  cmd.spawn({command: commandString});
  return cmd;
}


import prism from "https://cdnjs.cloudflare.com/ajax/libs/prism/1.5.1/prism.js";
import "https://cdnjs.cloudflare.com/ajax/libs/prism/1.5.1/components/prism-bash.js";

class ShellTokenizer {

  tokenize(string) {
    var pos = {row: 0, column: 0},
        tokens = prism.tokenize(string, prism.languages.bash),
        styles = [];
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i],
          currentTokens = [token];
      if (typeof token === "string")
        token = tokens[i] = {matchedStr: token, type: "default"}
      token.start = {...pos};
      var lines = token.matchedStr.split("\n");
      if (lines.length === 1) pos.column += lines[0].length;
      else pos = {row: pos.row + lines.length-1, column: arr.last(lines).length}
      token.end = {...pos};
    }
    return tokens;
  }

}

export class ShellEditorPlugin extends EditorPlugin {

  constructor(theme) {
    super(theme)
    this.tokenizer = new ShellTokenizer();
  }

  get isShellEditorPlugin() { return true }

  highlight() {
    let textMorph = this.textMorph;
    if (!this.theme || !textMorph || !textMorph.document) return;

    let tokens = this._tokens = this.tokenizer.tokenize(textMorph.textString),
        styles = tokens.map(({type, start, end}) => 
          tokens.type !== "default" &&
            TextStyleAttribute.fromPositions(this.theme.styleCached(type),start, end))
              .filter(Boolean);
    textMorph.setSortedTextAttributes([textMorph.defaultTextStyleAttribute].concat(styles));
  }

  getCommands(otherCommands) {
    var ed = this.textMorph;

    return [
      {
        name: "[shell] spawn command from selected text",
        exec: async (_, opts = {printit: false}) => {
          var sel = ed.selection;
          if (sel.isEmpty()) ed.selectLine(sel.lead.row);
          var cmd = runCommand(sel.text);
          await cmd.whenDone();
          var printedResult = cmd.stdout.trim() + "\n" + cmd.stderr.trim();
          if (opts.printit) {
            sel.collapseToEnd();
            ed.insertTextAndSelect(printedResult);
          } else  ed.setStatusMessage(printedResult);
          return true;
        }
      }
    ].concat(otherCommands)
  }

  getKeyBindings(otherKeybindings) {
    return otherKeybindings.concat([
      {keys: {mac: "Meta-D", win: "Ctrl-D"}, command: {command: "[shell] spawn command from selected text", args: {printit: false}}},
      {keys: {mac: "Meta-P", win: "Ctrl-P"}, command: {command: "[shell] spawn command from selected text", args: {printit: true}}}
    ]);
  }
}
