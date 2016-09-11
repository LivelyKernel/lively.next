import { Rectangle, pt, Color } from "lively.graphics";
import { connect, disconnect } from "lively.bindings"
import { obj } from "lively.lang";
import { Morph, Text } from "../index.js";
import { show } from "lively.morphic";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// finds string / regexp matches in text morphs
export class TextSearcher {
  constructor(morph) {
    this.morph = morph
  }

  get doc() { return this.morph.document }

  processFind(start, match) {
    var i = this.doc.positionToIndex(start),
        end = this.doc.indexToPosition(i+match.length);
    return {range: {start, end}, match};
  }

  stringSearch(lines, needle, caseSensitive, nLines, char, {row, column}) {
    if (!caseSensitive) char = char.toLowerCase();
    if (char !== needle[0]) return null;
    var chunk = lines[row].slice(column)
                + (nLines > 1 ? "\n" + lines.slice(row+1, (row+1)+(nLines-1)).join("\n") : ""),
        chunkToTest = caseSensitive ? chunk : chunk.toLowerCase();
    if (chunkToTest.indexOf(needle) !== 0) return null;
    return this.processFind({row, column}, chunk.slice(0, needle.length));
  }

  reSearch(lines, needle, multiline, char, {row, column}) {
    // note reSearch currently does not work for multiple lines...
    var chunk = lines[row].slice(column) + (multiline ? "\n" + lines.slice(row+1).join("\n") : ""),
        reMatch = chunk.match(needle);
    return reMatch ? this.processFind({row, column}, reMatch[0]) : null
  }

  search(options) {
    let {start, needle, backwards, caseSensitive} = {
      start: this.morph.cursorPosition,
      needle: "",
      backwards: false,
      caseSensitive: false,
      ...options
    }

    if (!needle) return null;

    var search;
    if (needle instanceof RegExp) {
      var flags = (needle.flags || "").split("");
      var multiline = !!needle.multiline; flags.splice(flags.indexOf("m"), 1);
      if (!caseSensitive && !flags.includes("i")) flags.push("i");
      needle = new RegExp('^' + needle.source.replace(/^\^+/, ""), flags.join(""));
      search = this.reSearch.bind(this, this.doc.lines, needle, multiline);
    } else {
      needle = String(needle);
      if (!caseSensitive) needle = needle.toLowerCase();
      var nLines = needle.split(this.doc.constructor.newline).length
      search = this.stringSearch.bind(this, this.doc.lines, needle, caseSensitive, nLines);
    }

    return this.doc[backwards ? "scanBackward" : "scanForward"](start, search);
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// widget for text search, maintains search state

export class SearchWidget extends Morph {

  constructor(props = {}) {
    var target = props.targetText,
        fontSize = props.fontSize || 12,
        fontFamily = props.fontFamily || "monospace",
        input = props.input || "";

    if (!target) throw new Error("SearchWidget needs a target text morph!");

    super({
      name: "search widget",
      ...obj.dissoc(props, ["target", "fontFamily", "fontSize", "input"])
    });

    var inputHeight = this.env.fontMetric.sizeFor(fontSize, fontSize, "X").height + 2*2;
    this.height = inputHeight;

    this.targetText = target;
    
    var inputMorph = this.addMorph(
      Text.makeInputLine({
        name: "input",
        extent: pt(this.width, inputHeight),
        textString: input,
        fill: null,
        borderWidth: 1, borderColor: Color.gray,
        padding: Rectangle.inset(2),
        fontSize, fontFamily
      }));

    if (input) this.input = input;

    connect(inputMorph, "inputChanged", this, "search");
    
    this.state = {
      backwards: false,
      before: null,
      position: null,
      inProgress: null,
      last: null
    }

    this.addCommands([
      {name: "accept search", exec: () => { this.acceptSearch(); return true; }},
      {name: "cancel search", exec: () => { this.cancelSearch(); return true; }},
      {name: "search next", exec: () => { this.searchNext(); return true; }},
      {name: "search prev", exec: () => { this.searchPrev(); return true; }}
    ])

    // override existing commands
    inputMorph.addCommands([
      {name: "realign top-bottom-center", exec: () => {
        this.targetText.execCommand("realign top-bottom-center");
        this.addSearchMarkersForPreview(this.state.inProgress && this.state.inProgress.found);
        return true;
      }}
    ]);

    this.addKeyBindings([
      {keys: "Enter", command: "accept search"},
      {keys: "Escape|Ctrl-G", command: "cancel search"},
      {keys: {win: "Ctrl-F|Ctrl-S|Ctrl-G", mac: "Meta-F|Ctrl-S|Meta-G"}, command: "search next"},
      {keys: {win: "Ctrl-Shift-F|Ctrl-R|Ctrl-Shift-G", mac: "Meta-Shift-F|Ctrl-R|Meta-Shift-G"}, command: "search prev"}
    ]);
  }

  focus() {
    this.get("input").focus();
  }

  get input() { return this.get("input").textString; }
  set input(v) { this.get("input").textString = v; }

  cleanup() {
    this.removeSearchMarkers();
    this.state.inProgress = null;
  }

  cancelSearch() {
    if (this.state.inProgress)
      this.state.last = this.state.inProgress;
    this.cleanup();
    if (this.state.before) {
      var {scroll, selectionRange} = this.state.before;
      this.targetText.selection = selectionRange;
      this.targetText.scroll = scroll;
      this.state.before = null;
    }
    this.remove();
    this.targetText.focus();
  }

  acceptSearch() {
    if (this.state.inProgress)
      this.state.last = this.state.inProgress;
    if (this.applySearchResult(this.state.inProgress))
      this.state.before && this.targetText.saveMark(this.state.before.position);
    this.cleanup();
    this.state.before = null;
    this.remove();
    this.targetText.focus();
  }

  applySearchResult(searchResult) {
    // searchResult = {found, backwards, ...}
    if (!searchResult || !searchResult.found) return null;
    var text = this.targetText,
        sel = text.selection,
        select = !!text.activeMark || !sel.isEmpty(),
        {backwards, found: {range: {start, end}}} = searchResult,
        pos = backwards ? start : end;
    select ? sel.lead = pos : text.cursorPosition = pos;
    text.scrollCursorIntoView();
    return searchResult;
  }

  removeSearchMarkers() {
    (this.targetText.markers || []).forEach(({id}) =>
      id.startsWith("search-highlight") && this.targetText.removeMarker(id));
  }

  addSearchMarkers(found) {
    this.removeSearchMarkers();

    var text = this.targetText,
        {startRow, endRow} = text.whatsVisible,
        lines = text.document.lines,
        i = 0;
    
    for (var row = startRow; row <= endRow; row++) {
      var line = lines[row] || "";
      for (var col = 0; col < line.length; col++) {
        if (line.slice(col).toLowerCase().indexOf(found.match.toLowerCase()) === 0) {
          text.addMarker({
            id: "search-highlight-" + i++,
            range: {start: {row, column: col}, end: {row, column: col+found.match.length}},
            style: {
              "border-radius": "4px",
              "background-color": "rgba(255, 200, 0, 0.3)",
              "box-shadow": "0 0 4px rgba(255, 200, 0, 0.3)",
              "pointer-events": "none",
            }
          });
          col += found.match.length;
        }
      }
    }
    
    
    var positionRange;
    if (this.state.backwards) {
      let {row, column} = found.range.start;
      positionRange = {start: {row, column}, end: {row, column: column+1}};
    } else {
      let {row, column} = found.range.end;
      positionRange = {start: {row, column: column-1}, end: {row, column}};
    }

    text.addMarker({
      id: "search-highlight-cursor",
      range: positionRange,
      style: {
        "pointer-events": "none",
        "box-sizing": "border-box",
        [this.state.backwards ? "border-left" : "border-right"]: "3px orange solid",
      }
    });
  }
  
  addSearchMarkersForPreview(found) {
    found && this.whenRendered().then(() => {
      this.addSearchMarkers(found);
      text.removeMarker("search-highlight-cursor");
    });
  }

  prepareForNewSearch() {
    var text = this.targetText,
        world = text.world(),
        state = this.state;
    world.addMorph(this);
    this.topRight = text.globalBounds().topRight();

    var {scroll, selection: sel} = text;
    state.position = sel.lead;
    state.before = {
      scroll,
      position: sel.lead,
      selectionRange: sel.range,
      selectionReverse: sel.isReverse()
    }

    
    if (state.last && state.last.found) {
      var inputMorph = this.get("input");
      // FIXME...! noUpdate etc
      disconnect(inputMorph, "inputChanged", this, "search");
      this.input = state.last.needle;
      connect(inputMorph, "inputChanged", this, "search");
      this.addSearchMarkersForPreview(state.last.found);
    }

    this.get("input").selectAll();
    this.focus();
  }

  advance(backwards) {
    var {inProgress} = this.state;
    if (inProgress && inProgress.found) {
      let dirChange = backwards !== this.state.backwards,
          {found: {range: {start, end}}} = inProgress;
      this.state.position = dirChange ?
        (backwards ? end : start) :
        (backwards ? start : end);
    }
    this.state.backwards = backwards;
    return this.search();
  }

  searchNext() { return this.advance(false); }
  searchPrev() { return this.advance(true); }

  search() {
    if (!this.input) {
      this.cleanup();
      return null;
    }

    var state = this.state, {backwards, inProgress, position} = state,
        opts = {backwards, start: position},
        found = this.targetText.search(this.input, opts);

    var result = this.state.inProgress = {...opts, needle: this.input, found};
    this.applySearchResult(result);
    found && this.whenRendered().then(() => this.addSearchMarkers(found, backwards));
    return result;
  }

}


export var searchCommands = [
  {
    name: "search in text",
    exec: (morph, opts = {backwards: false}) => {
      var search = morph._searchWidget ||
        (morph._searchWidget = new SearchWidget({targetText: morph, extent: pt(300,20)}));
      search.state.backwards = opts.backwards;
      search.prepareForNewSearch();
      return true;
    }
  }
];