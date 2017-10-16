/*global System*/
// import { string, arr } from "lively.lang";

export var commands = [

  {
    name: "[python] auto format code",
    handlesCount: true,
    exec: async (text, opts, count) => {
      opts = {...opts};

      var plugin = text.pluginFind(({isPythonEditorPlugin}) => isPythonEditorPlugin),
          sel = text.selection,
          source = text.textString,
          fromRow = sel.isEmpty() ? undefined : sel.start.row,
          toRow = sel.isEmpty() ? undefined : sel.end.row;

      if (!plugin) return true;
      
      let pySystem = plugin.systemInterface(),
          formattedCode = await pySystem.formatCode(source, fromRow, toRow),
          err = !formattedCode ? new Error("format failed") : formattedCode.error;

      if (err) {
        text.showError("code format failed: " + err)
        return true;
      }

      text.undoManager.group();
      let jsdiff = await System.import("jsdiff", System.decanonicalize("lively.morphic")),
          diff = jsdiff.diffChars(text.textString, formattedCode);
      text.applyJsDiffPatch(diff);
      text.undoManager.group();
      return true;
   }

  }

]