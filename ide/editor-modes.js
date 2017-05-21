import { arr } from "lively.lang";
export var modes = modes || {};

// code in here is mostly derived from codemirror
// Copyright (C) 2017 by Marijn Haverbeke <marijnh@gmail.com> and others
// https://codemirror.net/LICENSE
// 
// see also
// https://github.com/codemirror/CodeMirror/blob/master/src/modes.js
// https://github.com/codemirror/CodeMirror/blob/master/src/input/indent.js

export var passIndent = {}; // return in indent to pass

export function copyState(mode, state) {
  if (state === true) return state
  if (mode.copyState) return mode.copyState(state)
  let nstate = {}
  for (let n in state) {
    let val = state[n]
    if (val instanceof Array) val = val.concat([])
    nstate[n] = val
  }
  return nstate
}

export function startState(mode, a1, a2) {
  return mode.startState ? mode.startState(a1, a2) : true
}

export function defineMode(name, setupFn) {
  return modes[name] = setupFn;
}

export function getMode(editorConfig, spec) {
  if (typeof spec === "string") spec = {name: spec};
  if (!spec.name)
    throw new Error("parserConfig does not have a name of the mode to get")
  let mode = modes[spec.name];
  if (!mode)
    throw new Error(`mode ${spec.name} not known`);

  editorConfig = {indentUnit: 2, ...editorConfig};
  return mode(editorConfig, spec);
}

export var mimeModes = {};

export function defineMIME(type, mode) {}

export function registerHelper(method, mode, re) {}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// indentation
// 
// Indent the given line. The how parameter can be "smart",
// "add"/null, "subtract", or "prev". When aggressive is false
// (typically set to true for forced single-line indents), empty
// lines are not indented, and places where the mode returns Pass
// are left alone.
export function indentLines(textMorph, mode, fromRow, toRow, how, aggressive, options) {
  let validBeforePos = textMorph.editorPlugin._tokenizerValidBefore;
  if (validBeforePos && validBeforePos.row >= fromRow) validBeforePos.row = fromRow-1;
  let {lines, state: startState} = linesToTokenize(
                                    textMorph.document, fromRow, toRow, validBeforePos);
  if (!lines.length) return false;
  var state = !startState
    ? mode.startState()
    : typeof mode.copyState === "function"
        ? mode.copyState(startState)
        : copyState(mode, startState);
  let stream = new StringStream("", 2);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i], row = line.row;
    if (row >= fromRow && row <= toRow)
      indentLine(textMorph, mode, line, state, how, aggressive, options);
    ({state} = tokenizeLine(mode, stream, lines[i], state));
  }
  return true
}

function indentLine(textMorph, mode, line, stateBefore, how, aggressive, options) {
  let textDocument = textMorph.document;

  options = {
    indentWithTabs: false,
    indentUnit: 2,
    tabSize: 2,
    ignoreFollowingText: false,
    ...options
  }

  if (how == null) how = "add"
  if (how == "smart") {
    // Fall back to "prev" when the mode doesn't have an indentation
    // method.
    if (!mode.indent) how = "prev"
  }

  let tabSize = options.tabSize,
      curSpace = countColumn(line.text, null, tabSize)
  if (line.modeState) line.modeState = null
  let curSpaceString = line.text.match(/^\s*/)[0], indentation
  if (!aggressive && !/\S/.test(line.text)) {
    indentation = 0
    how = "not"
  } else if (how == "smart") {
    indentation = mode.indent(stateBefore, options.ignoreFollowingText ? "" : line.text.slice(curSpaceString.length), line.text)
    if (indentation == passIndent || indentation > 150) {
      if (!aggressive) return;
      how = "prev"
    }
  }

  if (how == "prev") {
    if (line.row > 0) indentation = countColumn(line.prevLine().text, null, tabSize);
    else indentation = 0
  } else if (how == "add") {
    indentation = curSpace + options.indentUnit
  } else if (how == "subtract") {
    indentation = curSpace - options.indentUnit
  } else if (typeof how == "number") {
    indentation = curSpace + how
  }
  indentation = Math.max(0, indentation)

  let indentString = "", pos = 0
  if (options.indentWithTabs)
    for (let i = Math.floor(indentation / tabSize); i; --i) {
      pos += tabSize;
      indentString += "\t";
    }
  if (pos < indentation) indentString += " ".repeat(indentation - pos);

  if (indentString != curSpaceString) {
    textMorph.replace(
      {
        start: {row: line.row, column: 0},
        end: {row: line.row, column: curSpaceString.length}
      },
      indentString);
    return true;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function tokenizeLines(mode, lines, startState) {
  if (!lines.length) return [];
  var state = !startState
    ? mode.startState()
    : typeof mode.copyState === "function"
        ? mode.copyState(startState)
        : copyState(mode, startState);
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
  state = line.modeState = typeof mode.copyState === "function"
    ? mode.copyState(state)
    : copyState(mode, state);
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
  let lines, tokens, state;
  try {
    ({lines, state} = linesToTokenize(document, fromRow, toRow, validBeforePos));
    tokens = tokenizeLines(mode, lines, state);
  } catch (err) {
    ({lines, state} = linesToTokenize(document, fromRow, toRow, null));
    tokens = tokenizeLines(mode, lines, state);
  }

  // lines.length && console.log(`${lines[0].row} => ${lively.lang.arr.last(lines).row}`)

  return {tokens, lines};
}

function linesToTokenize(document, fromRow, toRow, validBeforePos) {
  if (validBeforePos && validBeforePos.row >= toRow) return {lines: [], state:null};

  let startRow = validBeforePos ?
        Math.max(0, validBeforePos.row-1) : fromRow,
      line = document.getLine(startRow),
      lines = [line],
      startState = null;

  // find line that has a modeState
  let linesBefore = 0, nextLine;
let counter = 0;
  while ((nextLine = line.prevLine()) && linesBefore++ < 50) {
if (counter++>10000) throw new Error("endless linesToTokenize 1");
    line = nextLine;
    if (line.modeState) { startState = line.modeState; break; }
    lines.unshift(line)
  }

  // if modeState not found try to find the line with the smallest indent to start
  if (!startState) {
    let lineWithMinIndent = line, minIndent = Infinity;
let counter2 = 0;
    while ((nextLine = line.prevLine()) && linesBefore++ < 100) {
if (counter2++>10000) throw new Error("endless tokenizeLine 2");
      line = nextLine;
      if (line.modeState) { startState = line.modeState; break; }
      lines.unshift(line)
      let indent = line.text.match(/^\s*/)[0].length;
      if (indent === 0) break;
      if (indent < minIndent) {
        minIndent = indent;
        lineWithMinIndent = line;
      }
    }
    if (!startState && minIndent > 0) {
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

  return {lines, state: startState};
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