class JediCompleter {

  async compute(textMorph) {
    var plugin = textMorph.pluginFind(({isPythonEditorPlugin}) => isPythonEditorPlugin),
        {row, column} = textMorph.cursorPosition,
        source = textMorph.textString;

    row++

    if (!plugin) return [];

    let pySystem = plugin.systemInterface(),
        rawCompletions = await pySystem.complete(source, row, column, "fooo.py")

// {
//   full_name: "abs",
//   is_keyword: false,
//   module_name: "builtins",
//   module_path: null,
//   name: "abs",
//   type: "function"
// }

    return rawCompletions.map(ea => {
      var {full_name, is_keyword, module_name, module_path, name, type, priority} = ea;
      return {
        completion: name, prefix: "",
        info: `${type} in ${module_name}`,
        priority
      }
    });
  }

}

export var completers = [new JediCompleter()];
