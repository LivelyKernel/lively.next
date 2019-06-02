import ClientCommand from "lively.shell/client-command.js";
import {runCommand} from "./shell-interface.js";
// await lively.modules.registerPackage(document.location.origin + "/node_modules/lively.shell")
// await lively.modules.removePackage(document.location.origin + "/node_modules/lively.2lively")

export var astEditorCommands = [

  {
    name: "spawn command from selection",
    exec: (ed) => {
      var text = ed.selectionOrLineString();
      ClientCommand;
      return true;
    }
  }

];

export var shellCommands = [{
  name: "run command",
  exec: async (ctx, cmd) => {
    return await runCommand(cmd);
  }
}];
