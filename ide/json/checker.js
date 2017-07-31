var warnStyle = {"border-bottom": "2px dotted orange"},
    errorStyle = {"background-color": "red"};

export default class JSONChecker {

  uninstall(editor) {
    var morph = editor.text || editor;
    (morph.markers || [])
      .forEach(ea => ea.id.startsWith("js-checker-") && morph.removeMarker(ea));
    morph.removeMarker("js-syntax-error");
  }

  onDocumentChange(change, textMorph, jsPlugin) {
console.log("????")
    try {
      JSON.parse(textMorph.textString);
      textMorph.removeMarker("js-syntax-error")
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err

      var pos;

      var [_, index] = err.message.match(/position ([0-9]+)/) || [];
      if (index && !isNaN(Number(index)))  {
        pos = textMorph.indexToPosition(Number(index));
      }
      if (!pos) {
        var [_, line] = err.message.match(/line ([0-9]+)/) || [],
            [_, column] = err.message.match(/column ([0-9]+)/) || [];
        if (!isNaN(Number(line))) pos = {row: Number(line)-1, column: Number(column)};
      }

      if (!pos) {
        var {column, line} = err;
        if (typeof line === "number") pos = {row: line-1, column};
      }

      if (pos && !isNaN(pos.row) && !isNaN(pos.column)) {
        textMorph.addMarker({
          id: "js-syntax-error",
          range: {
            start: {column: pos.column - 1, row: pos.row},
            end: {column: pos.column + 1, row: pos.row}
          },
          style: errorStyle,
          type: "js-syntax-error"
        });
      }
    }
  }

}

