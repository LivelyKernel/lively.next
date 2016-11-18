import ClientCommand from "lively.shell/client-command.js";

// await lively.modules.registerPackage(document.location.origin + "/node_modules/lively.shell")
// await lively.modules.removePackage(document.location.origin + "/node_modules/lively.2lively")

export var astEditorCommands = [

  {
    name: "spawn command from selection",
    exec: (ed) => {
      var text = ed.selectionOrLineString();
      ClientCommand
      return true;
    }
  }

];

lively.modules.module("lively.morphic/ide/shell/editor-plugin.js")
  .reload({reloadDeps: false, resetEnv: false});

