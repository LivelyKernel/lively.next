import { arr } from "lively.lang";
export var modes = modes || {};

export var passIndent = {}; // return in indent to pass

function defaultCopyState(state) {
  let copy = {};
  for (let key in state) {
    state.hasOwnProperty(key)
      copy[key] = Array.isArray(state[key]) ?
        state[key].slice() : state[key];
  }
  return copy;
}

export function defineMode(name, setupFn, config, parserConfig) {
  config = {indentUnit: 2, ...config};
  let mode = setupFn(config || {}, parserConfig || {});
  if (typeof mode.copyState !== "function") mode.copyState = defaultCopyState;
  return modes[name] = mode;
}

export function defineMIME(type, mode) {}

export function registerHelper(method, mode, re) {}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function tokenizeLines(mode, lines) {
  if (!lines.length) return [];
  var state = lines[0].modeState ?
     mode.copyState(lines[0].modeState) : mode.startState();
  let stream = new StringStream("", 2),
      result = [];
  for (let i = 0; i < lines.length; i++) {
    var {tokens, state} = tokenizeLine(mode, stream, lines[i], state)
    result.push(tokens)
  }
  return result;
}

function tokenizeLine(mode, stream, line, state) {
  let {text} = line
  if (!text) return {tokens: [], state};
  stream.reset(text, 2/*indent...FIXME*/);
  state = line.modeState = mode.copyState(state);
  let tokens = [],
      prevLine = line.prevLine();
  state._string = text;
let counter = 0;
  while (!stream.eol()) {
if (counter++>10000) throw new Error("endless tokenizeLine");
    var name = mode.token(stream, state);
    tokens.push(stream.start, stream.pos, name, stream.current());
    stream.start = stream.pos;
  }
  return {tokens, state};
}


function printTokens(tokens) {
  let report = "";
  for (let i = 0; i < tokens.length; i+=4) {
    let from = tokens[i+0],
        to = tokens[i+1],
        token = tokens[i+2],
        content = tokens[i+3];
    report += `${from} => ${to} ${token} ${content}\n`
  }
  return report;
}


export function tokenizeDocument(mode, document, fromRow, toRow, validBeforePos) {
  let lines, tokens;
  try {
    lines = linesToTokenize(document, fromRow, toRow, validBeforePos);
    tokens = tokenizeLines(mode, lines);
  } catch (err) {
    lines = linesToTokenize(document, fromRow, toRow, null);
    tokens = tokenizeLines(mode, lines);      
  }

  return {tokens, lines};
}

function linesToTokenize(document, fromRow, toRow, validBeforePos) {
  if (validBeforePos && validBeforePos.row >= toRow) return [];

  let startRow = validBeforePos ?
        Math.max(0, validBeforePos.row-1) : fromRow,
      line = document.getLine(startRow),
      lines = [line];

  // find line that has a modeState
  let linesBefore = 0, nextLine;
let counter = 0;
  while ((nextLine = line.prevLine()) && linesBefore++ < 50) {
if (counter++>10000) throw new Error("endless linesToTokenize 1");
    line = nextLine;
    lines.unshift(line)
    if (line.modeState) break;
  }

  // if modeState not found try to find the line with the smallest indent to start
  if (!line.modeState) {
    let lineWithMinIndent = line, minIndent = Infinity;
let counter2 = 0;
    while ((nextLine = line.prevLine()) && linesBefore++ < 100) {
if (counter2++>10000) throw new Error("endless tokenizeLine 2");
      line = nextLine;
      lines.unshift(line)
      if (line.modeState) break;
      let indent = line.text.match(/^\s*/)[0].length;
      if (indent === 0) break;
      if (indent < minIndent) {
        minIndent = indent;
        lineWithMinIndent = line;
      }
    }
    if (!line.modeState && minIndent > 0) {
      lines = lines.slice(lines.indexOf(lineWithMinIndent));
      line = lines[0];
    }
  }
  
  if (toRow > startRow) {
    let lastLine = arr.last(lines);
    for (let row = startRow; row <= toRow; row++) {
      lastLine = lastLine.nextLine();
      if (!lastLine) break;
      lines.push(lastLine);
    }
  }

  return lines;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME... doesn't really belone here...

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
export function countColumn(string, end, tabSize, startIndex, startValue) {
  if (end == null) {
    end = string.search(/[^\s\u00a0]/)
    if (end == -1) end = string.length
  }
  for (let i = startIndex || 0, n = startValue || 0;;) {
    let nextTab = string.indexOf("\t", i)
    if (nextTab < 0 || nextTab >= end)
      return n + (end - i)
    n += nextTab - i
    n += tabSize - (n % tabSize)
    i = nextTab + 1
  }
}

// STRING STREAM

// Fed to the mode parsers, provides helper functions to make
// parsers more succinct.

class StringStream {

  constructor(string, tabSize) {
    this.reset(string, tabSize);
  }

  reset(string = "", tabSize = 2) {
    this.pos = this.start = 0
    this.string = string;
    this.tabSize = tabSize;
    this.lastColumnPos = this.lastColumnValue = 0
    this.lineStart = 0
  }

  eol() {return this.pos >= this.string.length}
  sol() {return this.pos == this.lineStart}
  peek() {return this.string.charAt(this.pos) || undefined}
  next() {
    if (this.pos < this.string.length)
      return this.string.charAt(this.pos++)
  }
  eat(match) {
    let ch = this.string.charAt(this.pos)
    let ok
    if (typeof match == "string") ok = ch == match
    else ok = ch && (match.test ? match.test(ch) : match(ch))
    if (ok) {++this.pos; return ch}
  }
  eatWhile(match) {
    let start = this.pos
    while (this.eat(match)){}
    return this.pos > start
  }
  eatSpace() {
    let start = this.pos
    while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) ++this.pos
    return this.pos > start
  }
  skipToEnd() {this.pos = this.string.length}
  skipTo(ch) {
    let found = this.string.indexOf(ch, this.pos)
    if (found > -1) {this.pos = found; return true}
  }
  backUp(n) {this.pos -= n}
  column() {
    if (this.lastColumnPos < this.start) {
      this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue)
      this.lastColumnPos = this.start
    }
    return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
  }
  indentation() {
    return countColumn(this.string, null, this.tabSize) -
      (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
  }
  match(pattern, consume, caseInsensitive) {
    if (typeof pattern == "string") {
      let cased = str => caseInsensitive ? str.toLowerCase() : str
      let substr = this.string.substr(this.pos, pattern.length)
      if (cased(substr) == cased(pattern)) {
        if (consume !== false) this.pos += pattern.length
        return true
      }
    } else {
      let match = this.string.slice(this.pos).match(pattern)
      if (match && match.index > 0) return null
      if (match && consume !== false) this.pos += match[0].length
      return match
    }
  }
  current(){return this.string.slice(this.start, this.pos)}
  hideFirstChars(n, inner) {
    this.lineStart += n
    try { return inner() }
    finally { this.lineStart -= n }
  }
}
