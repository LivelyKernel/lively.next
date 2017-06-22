var warnStyle = {"border-bottom": "2px dotted orange"},
    errorStyle = {"background-color": "red"};

export default class JavaScriptChecker {

  uninstall(editor) {
    var morph = editor.text || editor;
    (morph.markers || [])
      .forEach(ea => ea.id.startsWith("js-checker-") && morph.removeMarker(ea));
    morph.removeMarker("js-syntax-error");
  }

  onDocumentChange(change, morph, jsPlugin) {

    // 1. parse
    let parsed, doc = morph.document;
    try { parsed = jsPlugin.parse(); } catch(e) { parsed = e; }

    if (!parsed) return;

    // 2. "wsarnings" such as undeclared vars
    var prevMarkers = (morph.markers || []).filter(({id}) => id.startsWith("js-checker-")),
        newMarkers = jsPlugin.undeclaredVariables().map(({start, end, name, type}, i) => {
          start = doc.indexToPosition(start);
          end = doc.indexToPosition(end);
          return morph.addMarker({
            id: "js-checker-" + i,
            style: warnStyle,
            range: {start, end},
            type: "js-undeclared-var"
          })
        });
    prevMarkers.slice(newMarkers.length).forEach(ea => morph.removeMarker(ea))

    // 3. "errors" such as syntax errors
    if (parsed.parseError) {
      var {column, line} = parsed.parseError.loc, row = line-1,
          {column, row} = doc.indexToPosition(parsed.parseError.pos);
      morph.addMarker({
        id: "js-syntax-error",
        range: {start: {column: column-1, row}, end: {column: column+1, row}},
        style: errorStyle,
        type: "js-syntax-error"
      });
    } else { morph.removeMarker("js-syntax-error"); }
  }

}