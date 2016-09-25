import { Rectangle, pt, Color } from "lively.graphics";
import { connect, disconnect } from "lively.bindings"
import { obj, promise } from "lively.lang";
import { Morph, Text, Button } from "../index.js";
import { show } from "lively.morphic";
import { lessPosition, minPosition, maxPosition } from "./position.js";
import { occurStartCommand } from "./occur.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// finds string / regexp matches in text morphs
export class TextSearcher {
  constructor(morph) {
    this.morph = morph;
    this.STOP = {};
  }

  get doc() { return this.morph.document }

  processFind(start, match) {
    var i = this.doc.positionToIndex(start),
        end = this.doc.indexToPosition(i+match.length);
    return {range: {start, end}, match};
  }

  stringSearch(lines, needle, caseSensitive, nLines, inRange, char, pos) {

    if (inRange) {
      if (lessPosition(pos, inRange.start) || lessPosition(inRange.end, pos))
        return this.STOP;
    }

    if (!caseSensitive) char = char.toLowerCase();
    if (char !== needle[0]) return null;

    var {row, column} = pos,
        chunk = lines[row].slice(column)
                + (nLines > 1 ? "\n" + lines.slice(row+1, (row+1)+(nLines-1)).join("\n") : ""),
        chunkToTest = caseSensitive ? chunk : chunk.toLowerCase();

    return chunkToTest.indexOf(needle) !== 0 ?
      null :
      this.processFind({row, column}, chunk.slice(0, needle.length));
  }

  reSearch(lines, needle, multiline, inRange, char, pos) {
    if (inRange) {
      if (lessPosition(pos, inRange.start) || lessPosition(inRange.end, pos))
        return this.STOP;
    }
    
    var {row, column} = pos,
        chunk = lines[row].slice(column) + (multiline ? "\n" + lines.slice(row+1).join("\n") : ""),
        reMatch = chunk.match(needle);
    return reMatch ? this.processFind({row, column}, reMatch[0]) : null
  }

  search(options) {
    let {start, needle, backwards, caseSensitive, inRange} = {
      start: this.morph.cursorPosition,
      needle: "",
      backwards: false,
      caseSensitive: false,
      inRange: null,
      ...options
    }

    if (!needle) return null;

    if (inRange)
      start = backwards ?
        minPosition(inRange.end, start) :
        maxPosition(inRange.start, start);

    var search;
    if (needle instanceof RegExp) {
      var flags = (needle.flags || "").split(""),
          multiline = !!needle.multiline; flags.splice(flags.indexOf("m"), 1);
      if (!caseSensitive && !flags.includes("i")) flags.push("i");
      needle = new RegExp('^' + needle.source.replace(/^\^+/, ""), flags.join(""));
      search = this.reSearch.bind(this, this.doc.lines, needle, multiline, inRange);
    } else {
      needle = String(needle);
      if (!caseSensitive) needle = needle.toLowerCase();
      var nLines = needle.split(this.doc.constructor.newline).length
      search = this.stringSearch.bind(this, this.doc.lines, needle, caseSensitive, nLines, inRange);
    }

    var result = this.doc[backwards ? "scanBackward" : "scanForward"](start, search);

    return result === this.STOP ? null : result;
  }
  
  searchForAll(options) {
    var results = [];
    var i = 0;
    while (true) {
      if (i++ > 10000) throw new Error("endless loop")
      var found = this.search(options)
      if (!found) return results;
      results.push(found);
      options = {...options, start: options.backwards ? found.range.start : found.range.end}
    }
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// widget for text search, maintains search state

export class SearchWidget extends Morph {

  constructor(props = {}) {
    var target = props.targetText,
        fontSize = props.fontSize || 12,
        fontFamily = props.fontFamily || "Monaco, monospace",
        input = props.input || "";

    if (!target) throw new Error("SearchWidget needs a target text morph!");

    super({
      name: "search widget",
      borderWidth: 1,
      borderColor: Color.gray,
      borderRadius: 3,
      fill: Color.white.withA(.8),
      ...obj.dissoc(props, ["target", "fontFamily", "fontSize", "input"])
    });

    this.targetText = target;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-    

    var labelStyle = {fontFamily: "Helvetica Neue, Arial, sans-serif", fontSize: 12},
        label = this.addMorph(Text.makeLabel("Enter search term:", {name: "label", ...labelStyle, topLeft: pt(4,4)})),
        acceptButton = this.addMorph(new Button({name: "acceptButton", label: "✔", ...labelStyle})).fit(),
        cancelButton = this.addMorph(new Button({name: "cancelButton", label: "X", ...labelStyle})).fit(),
        nextButton = this.addMorph(new Button({name: "nextButton", label: "⬇", ...labelStyle})).fit(),
        prevButton = this.addMorph(new Button({name: "prevButton", label: "⬆", ...labelStyle})).fit();

    connect(acceptButton, "fire", this, "execCommand", {converter: () => "accept search"});
    connect(cancelButton, "fire", this, "execCommand", {converter: () => "cancel search"});
    connect(nextButton, "fire", this, "execCommand", {converter: () => "search next"});
    connect(prevButton, "fire", this, "execCommand", {converter: () => "search prev"});

    var inputMorph = this.addMorph(
      Text.makeInputLine({
        name: "input",
        width: this.width,
        textString: input,
        fill: Color.white,
        borderWidth: 1, borderColor: Color.gray,
        padding: Rectangle.inset(2),
        fontSize, fontFamily
      }));

    if (input) this.input = input;
    connect(inputMorph, "inputChanged", this, "search");

    this.relayout();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    this.state = {
      backwards: false,
      before: null,
      position: null,
      inProgress: null,
      last: null
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    this.addCommands([
      {name: "occur with search term", exec: () => {
        this.targetText.addCommands([occurStartCommand]);
        this.execCommand("accept search");
        return this.targetText.execCommand("occur", {needle: this.input});
      }},
      {name: "accept search", exec: () => { this.acceptSearch(); return true; }},
      {name: "cancel search", exec: () => { this.cancelSearch(); return true; }},
      {name: "search next", exec: () => { this.searchNext(); return true; }},
      {name: "search prev", exec: () => { this.searchPrev(); return true; }},
      {name: "yank next word from text", exec: () => {
        var text = this.targetText,
            word = text.wordRight(),
            input = this.get("input");
        if (!input.selection.isEmpty()) input.selection.text = "";
        var string = text.textInRange({start: text.cursorPosition, end: word.range.end});
        input.textString += string;
        return true;
      }},
    ]);

    // override existing commands
    inputMorph.addCommands([
      {name: "realign top-bottom-center", exec: async () => {
        this.targetText.execCommand("realign top-bottom-center");
        this.addSearchMarkersForPreview(this.state.inProgress && this.state.inProgress.found, false);
        return true;
      }}
    ]);

    this.addKeyBindings([
      {keys: "Enter", command: "accept search"},
      {keys: "Ctrl-O", command: "occur with search term"},
      {keys: "Ctrl-W", command: "yank next word from text"},
      {keys: "Escape|Ctrl-G", command: "cancel search"},
      {keys: {win: "Ctrl-F|Ctrl-S|Ctrl-G", mac: "Meta-F|Ctrl-S|Meta-G"}, command: "search next"},
      {keys: {win: "Ctrl-Shift-F|Ctrl-R|Ctrl-Shift-G", mac: "Meta-Shift-F|Ctrl-R|Meta-Shift-G"}, command: "search prev"}
    ]);
  }

  relayout() {
    let acceptButton = this.get("acceptButton"),
        cancelButton = this.get("cancelButton"),
        prevButton = this.get("prevButton"),
        nextButton = this.get("nextButton"),
        inputMorph = this.get("input");

    acceptButton.extent = pt(20, prevButton.height);
    cancelButton.extent = pt(20, prevButton.height);
    cancelButton.topRight = this.innerBounds().topRight().addXY(-2,2)
    acceptButton.topRight = cancelButton.topLeft.addXY(-4,0);
    prevButton.topRight = acceptButton.topLeft.addXY(-10, 0);
    nextButton.topRight = prevButton.topLeft.addXY(-3,0);
    inputMorph.width = this.width - 10;
    inputMorph.topCenter = this.innerBounds().topCenter().withY(cancelButton.bottom+3);
    this.height = inputMorph.bottom + 3;
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

  addSearchMarkersForPreview(found, noCursor = true) {
    found && this.whenRendered().then(() => {
      this.addSearchMarkers(found);
      noCursor && this.targetText.removeMarker("search-highlight-cursor");
    });
  }

  prepareForNewSearch() {
    var text = this.targetText,
        world = text.world(),
        state = this.state;
    world.addMorph(this);
    this.topRight = text.globalBounds().topRight();
    this.whenRendered().then(() => this.relayout());

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
