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
