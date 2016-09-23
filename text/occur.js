// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Occur
// A mechanism for filtering lines of text, repeatedly of necessary. You can use
// it when the search widget (Cmd-F) is active, press Ctrl-O or the occur button
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { arr } from "lively.lang";
import { TextSearcher } from "./search.js";
import Document from "./document.js";
import KeyHandler from "../events/KeyHandler.js"

export var occurStartCommand = {
  name: "occur",
  exec: (textMorph, opts = {}) => {
    var alreadyInOccur = !!textMorph.document._occur,
        occurSessionActive = new Occur(textMorph).enter(opts)
    if (occurSessionActive && !alreadyInOccur) {
      var keyHandler = KeyHandler.withBindings([
        {keys: 'Escape|Ctrl-G', command: "occur exit"},
        {keys: 'Enter', command: "occur accept"}
      ]);
      keyHandler.isOccurHandler = true;
      textMorph._keyhandlers = (textMorph._keyhandlers || []).concat(keyHandler);
      textMorph.addCommands(occurCommands)
    }
    return occurSessionActive;
  }
}

var occurCommands = [{
    name: "occur exit",
    exec: function(textMorph) {
      var occur = textMorph.document._occur;
      if (!occur) return false;
      occur.exit({});
      
      if (!textMorph.document._occur) {
        textMorph.removeCommands(["occur exit", "occur accept"]);
        textMorph._keyhandlers = (textMorph._keyhandlers || []).filter(ea => !ea.isOccurHandler);
      } else textMorph.document._occur.highlight();
      return true;
    },
    readOnly: true
}, {
    name: "occur accept",
    bindKey: 'Enter',
    exec: (textMorph) => {
      var occur = textMorph.document._occur;
      if (!occur) return false;
      occur.exit({translatePosition: true});
      if (!textMorph.document._occur) {
        textMorph.removeCommands(["occur exit", "occur accept"]);
        textMorph._keyhandlers = (textMorph._keyhandlers || []).filter(ea => !ea.isOccurHandler);
      } else textMorph.document._occur.highlight()
      return true;
    },
    readOnly: true
}];


export class Occur {
  
  constructor(textMorph) {
    this.textMorph = textMorph;
  }

  enter(options) {
    // Enables occur mode. expects that `options.needle` is a search term.
    // This search term is used to filter out all the lines that include it
    // and these then replacethe original content. The current cursor position of
    // editor will be translated so that the cursor is on the matching row/column as it was before.
    if (!options.needle) return false;
    var pos = this.textMorph.cursorPosition;
    this.displayOccurContent(options);
    var translatedPos = this.originalToOccurPosition(pos);
    this.textMorph.cursorPosition = translatedPos;
    return true;
  }

  exit(options) {
    this.removeHighlight();
    var pos = options.translatePosition && this.textMorph.cursorPosition,
        translatedPos = pos && this.occurToOriginalPosition(pos);
    this.displayOriginalContent();
    if (translatedPos)
      this.textMorph.cursorPosition = translatedPos;
  }

  matchingLines(options = {needle: ""}) {
    if (!options.needle) return [];
    var lines = this.textMorph.document.lines,
        search = new TextSearcher(this.textMorph),
        found = search.searchForAll({...options, start: {column: 0, row: 0}});

    return arr.groupBy(found, ({range: {start: {row}}}) => row)
        .mapGroups((_, foundInRow) => {
          var row = foundInRow[0].range.start.row;
          return {
            row, ranges: foundInRow.map(({range}) => range),
            line: lines[row]
          }
        }).toArray();
  }


  displayOccurContent(options) {
    this._originalDocument = this.textMorph.document;
    var found = this.matchingLines(options),
        lines = found.map(({line}) => line),
        occurDocument = this._document = new Document(lines);
    occurDocument._occur = this;
    occurDocument._occurMatchingLines = found;
    this.textMorph.changeDocument(occurDocument, true);
    this.highlight(options.needle);
  }

  displayOriginalContent() {
    this.textMorph.changeDocument(this._originalDocument);
  }

  occurToOriginalPosition(pos) {
    // Translates the position from the occur document to the original document
    // or `pos` if not found.
    var lines = this._document._occurMatchingLines;
    if (!lines || !lines[pos.row]) return pos;
    return {row: lines[pos.row].row, column: pos.column};
  }

  originalToOccurPosition(pos) {
    var lines = this._document._occurMatchingLines,
        nullPos = {row: 0, column: 0};
    if (!lines) return nullPos;
    for (var i = 0; i < lines.length; i++)
      if (lines[i].row === pos.row)
        return {row: i, column: pos.column};
    return nullPos;
  }

  highlight(needle) {
    this.removeHighlight();
    var style = {
        borderRadius: "4px",
        backgroundColor: "rgba(87, 255, 8, 0.25)",
        position: "absolute",
        "-moz-box-sizing": "border-box",
        "-webkit-box-sizing": "border-box",
        "box-sizing": "border-box",
        "box-shadow": "0 0 4px rgb(91, 255, 50)"
    }
    var ranges = arr.flatmap(this._document._occurMatchingLines, ({ranges}, row) =>
                  ranges.map(({start: {column}, end: {column: endColumn}}) =>
                    ({start: {column, row}, end: {column: endColumn, row}})))
    
    ranges.map((range, i) => ({id: "occur-"+i, range, style}))
          .forEach(m => this.textMorph.addMarker(m));
  }

  removeHighlight() {
    (this.textMorph.markers || [])
      .filter(({id}) => id.indexOf("occur-") === 0)
      .forEach(m => this.textMorph.removeMarker(m));
  }
}
