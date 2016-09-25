export var multiSelectCommands = [

  {
    name: "multi select up",
    exec: morph => {
      var {row, column} = morph.selection.start;
      if (row > 0)
        morph.selection.addRange({start: {row: row-1, column}, end: {row: row-1, column}})
      return true;
    }
  }

];
