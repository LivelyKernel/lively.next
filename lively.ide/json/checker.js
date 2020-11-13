import { Range } from 'lively.morphic/text/range.js';
const warnStyle = { 'border-bottom': '2px dotted orange' };
const errorStyle = { 'background-color': 'red' };

export default class JSONChecker {
  uninstall (editor) {
    const morph = editor.text || editor;
    (morph.markers || [])
      .forEach(ea => ea.id.startsWith('js-checker-') && morph.removeMarker(ea));
    morph.removeMarker('js-syntax-error');
  }

  hasEmbeddedMorphInRange (textMorph, range) {
    return [...textMorph.embeddedMorphMap.values()].find(({ anchor }) => {
      return range.containsPosition(anchor.position);
    });
  }

  onDocumentChange (change, textMorph, jsPlugin) {
    try {
      JSON.parse(textMorph.textString);
      textMorph.removeMarker('js-syntax-error');
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;

      let pos;

      var [_, index] = err.message.match(/position ([0-9]+)/) || [];
      if (index && !isNaN(Number(index))) {
        pos = textMorph.indexToPosition(Number(index));
      }
      if (!pos) {
        var [_, line] = err.message.match(/line ([0-9]+)/) || [];
        var [_, column] = err.message.match(/column ([0-9]+)/) || [];
        if (!isNaN(Number(line))) pos = { row: Number(line) - 1, column: Number(column) };
      }

      if (!pos) {
        var { column, line } = err;
        if (typeof line === 'number') pos = { row: line - 1, column };
      }

      if (pos && !isNaN(pos.row) && !isNaN(pos.column)) {
        const range = new Range({
          start: { column: pos.column - 1, row: pos.row },
          end: { column: pos.column + 1, row: pos.row }
        });
        if (this.hasEmbeddedMorphInRange(textMorph, range)) return;
        textMorph.addMarker({
          id: 'js-syntax-error',
          range,
          style: errorStyle,
          type: 'js-syntax-error'
        });
      }
    }
  }
}
