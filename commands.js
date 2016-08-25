/*global System*/

var commands = [
  
  {
    name: "clipboard copy",
    exec: function() { return true; }
  },

  {
    name: "clipboard cut",
    exec: function() { return true; }
  },

  {
    name: "clipboard paste",
    exec: function() { return true; }
  },

  {
    name: "select all",
    exec: function(morph) {
      morph.selectAll();
      return true;
    }
  },

  {
    name: "doit",
    exec: async function(morph) {
      if (morph.selection.isEmpty()) morph.selectLine();
      var opts = {System, targetModule: "lively://lively.next-prototype_2016_08_23/" + morph.id},
          result = await lively.vm.runEval(morph.selection.text, opts);
      morph.world()[result.isError ? "logError" : "setStatusMessage"](result.value);
      return result;
    }
  },

  {
    name: "printit",
    exec: async function(morph) {
      if (morph.selection.isEmpty()) morph.selectLine();
      var opts = {System, targetModule: "lively://lively.next-prototype_2016_08_23/" + morph.id},
          result = await lively.vm.runEval(morph.selection.text, opts);
      morph.selection.collapseToEnd();
      morph.insertTextAndSelect(result.value);
      return result;
    }
  },

  {
    name: "saveit",
    exec: function(morph) {
      morph.doSave();
      return true;
    }
  },

  {
    name: "delete backwards",
    exec: function(morph) {
      if (morph.rejectsInput()) return false;
      var sel = morph.selection;
      if (sel.isEmpty()) sel.growLeft(1);
      sel.text = "";
      sel.collapse();
      return true;
    }
  },

  {
    name: "delete",
    exec: function(morph) {
      var sel = morph.selection;
      if (morph.rejectsInput()) return false;
      if (sel.isEmpty()) sel.growRight(1);
      sel.text = "";
      sel.collapse();
      return true;
    }
  },

  {
    name: "move cursor left",
    exec: function(morph) {
      var sel = morph.selection;
      sel.isEmpty() && sel.growLeft(1);
      sel.collapse();
      return true;
    }
  },

  {
    name: "move cursor right",
    exec: function(morph) {
      var sel = morph.selection;
      sel.isEmpty() && sel.growRight(1);
      sel.collapseToEnd();
      return true;
    }
  },

  {
    name: "move cursor up",
    exec: function(morph) {
      let sel = morph.selection,
          {row, column} = sel.start;
      sel.start = {row: row-1, column};
      sel.collapse();
      return true;
    }
  },

  {
    name: "move cursor down",
    exec: function(morph) {
      let sel = morph.selection,
          {row, column} = sel.start;
      sel.start = {row: row+1, column};
      sel.collapseToEnd();
      return true;
    }
  },

  {
    name: "insertstring",
    exec: function(morph, args) {
      var isValid = args && (typeof args.string === "string" && args.string.length);
      if (!isValid) console.warn(`command insertstring called with not string value`);
      if (morph.rejectsInput() || !isValid) return false;
      let sel = morph.selection;
      sel.text = args.string;
      sel.collapseToEnd();
      return true;
    }
  }

]




export class CommandHandler {

  exec(command, morph, args, evt) {
    let name = !command || typeof command === "string" ? command : command.command,
        cmd = command && commands.find(ea => ea.name === name),
        result = !cmd || typeof cmd.exec !== "function" ?
          false : cmd.exec(morph, args, evt);
    if (result && typeof result.catch === "function")
      result.catch(err => {
        console.error(`Error in interactive command ${name}: ${err.stack}`);
        throw err;
      });
    return result;
  }

}

export var defaultCommandHandler = new CommandHandler();
