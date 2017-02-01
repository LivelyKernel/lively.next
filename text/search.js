import { Rectangle, pt, Color } from "lively.graphics";
import { connect, disconnect } from "lively.bindings"
import { obj, promise, Path } from "lively.lang";
import { Morph, Text } from "../index.js";
import { lessPosition, minPosition, maxPosition } from "./position.js";
import { occurStartCommand } from "./occur.js";
import { Icon } from "../components/icons.js";
import { Button } from "../components/buttons.js";

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


  static get properties() {
    return {
      name:         {defaultValue: "search widget"},
      borderWidth:  {defaultValue: 1},
      borderColor:  {defaultValue: Color.gray},
      borderRadius: {defaultValue: 3},
      fill:         {defaultValue: Color.white.withA(.8)},

      target: {},

      input: {
        after: ["submorphs"],
        get() {
          var text = this.get("searchInput").textString,
              reMatch = text.match(/^\/(.*)\/([a-z]*)$/);
          return reMatch ? new RegExp(reMatch[1], reMatch[2]) : text;
        },
        set(v) { this.get("searchInput").textString = String(v); }
      },

      fontSize: {
        after: ["submorphs"],
        get() { return this.get("searchInput").fontSize; },
        set(v) {
          this.get("replaceInput").fontSize = v;
        }
      },

      fontFamily: {
        after: ["submorphs"],
        get() { return this.get("searchInput").fontFamily; },
        set(v) {
          this.get("searchInput").fontFamily = v;
          this.get("replaceInput").fontFamily = v;
        }
      },

      submorphs: {
        after: ["extent"],
        initialize() {
          let btnStyle = {fontSize: 18, extent: pt(24,24), activeStyle: {borderWidth: 0, fill: null, fontColor: Color.gray.darker()}},
              fontSize = 14, fontFamily = "Inconsolata, monospace";

          this.submorphs = [
            new Button({name: "acceptButton", label: [Icon.textAttribute("check-circle-o")], ...btnStyle}).fit(),
            new Button({name: "cancelButton", label: [Icon.textAttribute("times-circle-o")], ...btnStyle}).fit(),
            new Button({name: "nextButton", label: [Icon.textAttribute("arrow-circle-o-down")], ...btnStyle}).fit(),
            new Button({name: "prevButton", label: [Icon.textAttribute("arrow-circle-o-up")], ...btnStyle}).fit(),
            Text.makeInputLine({
              name: "searchInput",
              width: this.width,
              fill: Color.white,
              fontSize, fontFamily,
              borderWidth: 1, borderColor: Color.gray,
              padding: Rectangle.inset(2),
              placeholder: "search input",
              historyId: "lively.morphic-text search"
            }),
            Text.makeInputLine({
              name: "replaceInput",
              width: this.width,
              fill: Color.white,
              fontSize, fontFamily,
              borderWidth: 1, borderColor: Color.gray,
              padding: Rectangle.inset(2),
              placeholder: "replace input",
              historyId: "lively.morphic-text replace"
            }),
            new Button({name: "replaceButton", label: "replace", extent: pt(80, 20), fontColor: Color.gray.darker(), activeStyle: {border: {width: 2, color: Color.gray.darker()}, fill: null}})
          ];
        }
      }
    }
  }

  constructor(props = {}) {
    if (props.targetText) props.target = props.targetText
    if (!props.target) throw new Error("SearchWidget needs a target text morph!");

    super(props);

    var replaceButton = this.getSubmorphNamed("replaceButton"),
        replaceInput = this.getSubmorphNamed("replaceInput"),
        searchInput = this.getSubmorphNamed("searchInput"),
        prevButton = this.getSubmorphNamed("prevButton"),
        nextButton = this.getSubmorphNamed("nextButton"),
        cancelButton = this.getSubmorphNamed("cancelButton"),
        acceptButton = this.getSubmorphNamed("acceptButton");
    connect(acceptButton, "fire", this, "execCommand", {converter: () => "accept search"});
    connect(cancelButton, "fire", this, "execCommand", {converter: () => "cancel search"});
    connect(nextButton, "fire", this, "execCommand", {converter: () => "search next"});
    connect(prevButton, "fire", this, "execCommand", {converter: () => "search prev"});
    connect(searchInput, "inputChanged", this, "search");
    connect(replaceButton, "fire", this, "execCommand", {converter: () => "replace and go to next"});

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

    // override existing commands
    searchInput.addCommands([
      {name: "realign top-bottom-center", exec: async () => {
        this.target.execCommand("realign top-bottom-center");
        this.addSearchMarkersForPreview(this.state.inProgress && this.state.inProgress.found, false)
        return true;
      }}
    ]);

  }

  relayout() {
    let acceptButton =  this.getSubmorphNamed("acceptButton"),
        cancelButton =  this.getSubmorphNamed("cancelButton"),
        prevButton =    this.getSubmorphNamed("prevButton"),
        nextButton =    this.getSubmorphNamed("nextButton"),
        searchInput =   this.getSubmorphNamed("searchInput"),
        replaceButton = this.getSubmorphNamed("replaceButton"),
        replaceInput =  this.getSubmorphNamed("replaceInput");

    acceptButton.top = prevButton.top = nextButton.top = cancelButton.top = 2
    cancelButton.right = this.innerBounds().right() - 2;
    acceptButton.right = cancelButton.left;
    prevButton.right = acceptButton.left;
    nextButton.right = prevButton.left;


    searchInput.topLeft = pt(4,4);
    replaceInput.topLeft = searchInput.bottomLeft.addXY(0, 4);
    replaceInput.width = searchInput.width = nextButton.left - 4;
    replaceButton.top = replaceInput.top;
    replaceButton.center = pt(nextButton.left + (cancelButton.right - nextButton.left)/2, replaceInput.center.y);

    // inputMorph.topCenter = this.innerBounds().topCenter().withY(cancelButton.bottom+3);
    this.height = replaceInput.bottom + 3;
  }

  focus() {
    this.get("searchInput").focus();
  }

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
      this.target.selection = selectionRange;
      this.target.scroll = scroll;
      this.state.before = null;
    }
    this.remove();
    this.target.focus();
  }

  acceptSearch() {
    if (this.state.inProgress)
      this.state.last = this.state.inProgress;
    if (this.applySearchResult(this.state.inProgress))
      this.state.before && this.target.saveMark(this.state.before.position);
    this.get("searchInput").acceptInput(); // for history
    this.cleanup();
    this.state.before = null;
    this.remove();
    this.target.focus();
  }

  applySearchResult(searchResult) {
    // searchResult = {found, backwards, ...}
    if (!searchResult || !searchResult.found) return null;
    var text = this.target,
        sel = text.selection,
        select = !!text.activeMark || !sel.isEmpty(),
        {backwards, found: {range: {start, end}}} = searchResult,
        pos = backwards ? start : end;
    select ? sel.lead = pos : text.cursorPosition = pos;
    if (!text.isLineVisible(pos.row)) text.centerRow();
    return searchResult;
  }

  removeSearchMarkers() {
    (this.target.markers || []).forEach(({id}) =>
      id.startsWith("search-highlight") && this.target.removeMarker(id));
  }

  addSearchMarkers(found) {
    this.removeSearchMarkers();

    var text = this.target,
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
        [this.state.backwards ? "border-left" : "border-right"]: "3px red solid",
      }
    });
  }

  addSearchMarkersForPreview(found, noCursor = true) {
    
    found && this.whenRendered().then(() => promise.delay(20)).then(() => {
      this.addSearchMarkers(found);
      noCursor && this.target.removeMarker("search-highlight-cursor");
    });
  }

  prepareForNewSearch() {
    var text = this.target,
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
      var inputMorph = this.get("searchInput");
      // FIXME...! noUpdate etc
      disconnect(inputMorph, "inputChanged", this, "search");
      this.input = state.last.needle;
      connect(inputMorph, "inputChanged", this, "search");
      this.addSearchMarkersForPreview(state.last.found);
    }

    this.get("searchInput").selectAll();
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
        found = this.target.search(this.input, opts);

    var result = this.state.inProgress = {...opts, needle: this.input, found};
    this.applySearchResult(result);
    found && this.whenRendered().then(() => this.addSearchMarkers(found, backwards));
    return result;
  }

  get keybindings() {
    return [
      {keys: "Enter", command: "accept search or replace and go to next"},
      {keys: "Tab", command: "change focus"},
      {keys: "Ctrl-O", command: "occur with search term"},
      {keys: "Ctrl-W", command: "yank next word from text"},
      {keys: "Escape|Ctrl-G", command: "cancel search"},
      {keys: {win: "Ctrl-F|Ctrl-S|Ctrl-G", mac: "Meta-F|Ctrl-S|Meta-G"}, command: "search next"},
      {keys: {win: "Ctrl-Shift-F|Ctrl-R|Ctrl-Shift-G", mac: "Meta-Shift-F|Ctrl-R|Meta-Shift-G"}, command: "search prev"}
    ]
  }

  get commands() {
    return [
      {name: "occur with search term", exec: () => {
        this.target.addCommands([occurStartCommand]);
        this.execCommand("accept search");
        return this.target.execCommand("occur", {needle: this.input});
      }},
      {name: "accept search", exec: () => { this.acceptSearch(); return true; }},
      {name: "cancel search", exec: () => { this.cancelSearch(); return true; }},
      {name: "search next", exec: () => { this.searchNext(); return true; }},
      {name: "search prev", exec: () => { this.searchPrev(); return true; }},

      {
        name: "accept search or replace and go to next",
        exec: (_, args, count) => {
          return this.execCommand(
              this.get("replaceInput").isFocused() ?
                "replace and go to next" :
                "accept search", args, count);
        }
      },


      {
        name: "replace current search location with replace input",
        exec: () => {
          var search = Path("state.inProgress").get(this);
          if (search.found) {
            var replacement = this.get("replaceInput").textString;
            this.get("replaceInput").get("replaceInput").acceptInput(); // for history
            if (search.needle instanceof RegExp) {
              replacement = search.found.match.replace(search.needle, replacement);
            }
            this.target.replace(search.found.range, replacement);
          }
          return true;
        }
      },

      {
        name: "replace and go to next",
        exec: () => {
          this.execCommand("replace current search location with replace input");
          this.execCommand(this.state.backwards ? "search prev" : "search next");
          return true;
        }
      },

      {
        name: "change focus",
        exec: () => {
          if (this.get("searchInput").isFocused())
            this.get("replaceInput").focus();
          else
            this.get("searchInput").focus();
          return true;
        }
      },

      {
        name: "yank next word from text",
        exec: () => {
          var text = this.target,
              word = text.wordRight(),
              input = this.get("searchInput");
          if (!input.selection.isEmpty()) input.selection.text = "";
          var string = text.textInRange({start: text.cursorPosition, end: word.range.end});
          input.textString += string;
          return true;
        }
      },
    ]
  }

}


export var searchCommands = [
  {
    name: "search in text",
    exec: (morph, opts = {backwards: false}) => {
      var search = morph._searchWidget ||
        (morph._searchWidget = new SearchWidget({target: morph, extent: pt(300,20)}));
      search.state.backwards = opts.backwards;
      search.prepareForNewSearch();
      return true;
    }
  }
];
