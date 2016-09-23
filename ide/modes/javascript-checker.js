var warnStyle = {"border-bottom": "2px dotted orange"},
    errorStyle = {"background-color": "red"};

export default class JavaScriptChecker {

  // targetMode: "ace/mode/javascript"

  uninstall(editor) {
    var morph = editor.text || editor;
    (morph.markers || []).forEach(ea => ea.id.startsWith("js-checker-") && morph.removeMarker(ea))
    morph.removeMarker("js-syntax-error");
  }

  parse(src, astType = null) {
    // astType = 'FunctionExpression' || astType == 'FunctionDeclaration' || null
    
    // FIXME!
    var astModule = System.get(System.decanonicalize("lively.ast"));
    if (!astModule) return null;

    var options = {allowReturnOutsideFunction: true};
    options.type = astType;
    return astModule.fuzzyParse(src, options);
  }

  onDocumentChange(change, editor) {
    this.updateAST(change, editor)
  }

  updateAST(change, editor) {
    var ast, morph = editor.text || editor;
    
    // 1. parse
    try {
      ast = this.parse(morph.textString);
    } catch(e) { ast = e; }
  
    // 2. update lively codemarker
    // var morph = that
    // var ast = new JavaScriptChecker().parse(morph.textString)

    var doc = morph.document;

    var query = System.get(System.decanonicalize("lively.ast")).query; //a

    // if (codeEditor.getShowWarnings()) {
      var prevMarkers = (morph.markers || []).filter(({id}) => id.startsWith("js-checker-")),
          globals = query.findGlobalVarRefs(ast, {jslintGlobalComment: true}),
          newMarkers = globals.map(({start, end, name, type}, i) => {
            start = doc.indexToPosition(start);
            end = doc.indexToPosition(end);
            return morph.addMarker({id: "js-checker-" + i, style: warnStyle, range: {start, end}, type: "js-undeclared-var"})
          });
      prevMarkers.slice(newMarkers.length).forEach(ea => morph.removeMarker(ea))
    // }

    if (ast.parseError/* && codeEditor.getShowErrors()*/) {
      var {column, line} = ast.parseError.loc, row = line-1;
      var {column, row} = doc.indexToPosition(ast.parseError.pos)
      morph.addMarker({
        id: "js-syntax-error",
        range: {start: {column: column-1, row}, end: {column: column+1, row}},
        style: errorStyle,
        type: "js-syntax-error"
      });
    } else {
      morph.removeMarker("js-syntax-error")
    }
  }
}