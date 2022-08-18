import { Range } from 'lively.morphic'
const defaultWarnStyle = { 'border-bottom': '2px dotted orange' };
const defaultErrorStyle = { 'background-color': 'red' };

export default class JavaScriptChecker {
  uninstall (editor) {
    const morph = editor.text || editor;
    (morph.markers || [])
      .forEach(ea => ea.id.startsWith('js-checker-') && morph.removeMarker(ea));
    morph.removeMarker('js-syntax-error');
  }

  hasEmbeddedMorphInRange (textMorph, range) {
    if (!range.isRange) range = new Range(range);
    return [...textMorph.embeddedMorphMap.values()].find(({ anchor }) => {
      return range.containsPosition(anchor.position);
    });
  }

  onDocumentChange (change, morph, jsPlugin) {
    // 1. parse
    let parsed;
    const doc = morph.document;
    const { theme } = jsPlugin;
    try { parsed = jsPlugin.parse(); } catch (e) { parsed = e; }

    if (!parsed) return;

    // 2. "warnings" such as undeclared vars
    const prevMarkers = (morph.markers || []).filter(({ id }) => id.startsWith('js-checker-'));
    const newMarkers = jsPlugin.undeclaredVariables().map(({ start, end, name, type }, i) => {
      start = doc.indexToPosition(start);
      end = doc.indexToPosition(end);
      return morph.addMarker({
        id: 'js-checker-' + i,
        style: theme ? theme.warning : defaultWarnStyle,
        range: { start, end },
        type: 'js-undeclared-var'
      });
    });
    prevMarkers.slice(newMarkers.length).forEach(ea => morph.removeMarker(ea));

    // 3. "errors" such as syntax errors
    if (parsed.parseError) {
      let { column, line } = parsed.parseError.loc;
      let row = line - 1;
      ({ column, row } = doc.indexToPosition(parsed.parseError.pos));
      const range = { start: { column: column - 1, row }, end: { column: column + 1, row } };
      if (this.hasEmbeddedMorphInRange(morph, range)) return;
      morph.addMarker({
        id: 'js-syntax-error',
        range,
        style: theme ? theme.error : defaultErrorStyle,
        type: 'js-syntax-error'
      });
    } else { morph.removeMarker('js-syntax-error'); }
  }
}
