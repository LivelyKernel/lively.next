import { arr } from 'lively.lang';
export var modes = modes || {};

// code in here is mostly derived from codemirror
// Copyright (C) 2017 by Marijn Haverbeke <marijnh@gmail.com> and others
// https://codemirror.net/LICENSE
//
// see also
// https://github.com/codemirror/CodeMirror/blob/master/src/modes.js
// https://github.com/codemirror/CodeMirror/blob/master/src/input/indent.js

export var passIndent = {}; // return in indent to pass

export function copyState (mode, state) {
  if (state === true) return state;
  if (mode.copyState) return mode.copyState(state);
  let nstate = {};
  for (let n in state) {
    let val = state[n];
    if (val instanceof Array) val = val.concat([]);
    nstate[n] = val;
  }
  return nstate;
}

export function startState (mode, a1, a2) {
  return mode.startState ? mode.startState(a1, a2) : true;
}

export function defineMode (name, setupFn) {
  return modes[name] = setupFn;
}

// Given a MIME type, a {name, ...options} config object, or a name
// string, return a mode config object.
export function resolveMode (spec) {
  if (typeof spec === 'string' && mimeModes.hasOwnProperty(spec)) {
    spec = mimeModes[spec];
  } else if (spec && typeof spec.name === 'string' && mimeModes.hasOwnProperty(spec.name)) {
    let found = mimeModes[spec.name];
    if (typeof found === 'string') found = { name: found };
    spec = Object.assign({}, found, spec);
    spec.name = found.name;
  } else if (typeof spec === 'string' && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
    return resolveMode('application/xml');
  } else if (typeof spec === 'string' && /^[\w\-]+\/[\w\-]+\+json$/.test(spec)) {
    return resolveMode('application/json');
  }
  if (typeof spec === 'string') return { name: spec };
  else return spec || { name: 'null' };
}

export function getMode (editorConfig, spec) {
  spec = resolveMode(spec);
  if (typeof spec === 'string') spec = { name: spec };
  if (!spec.name) { throw new Error('parserConfig does not have a name of the mode to get'); }
  let mode = modes[spec.name];
  if (!mode) { return getMode(editorConfig, 'text/plain'); }

  editorConfig = { indentUnit: 2, ...editorConfig };
  return Object.assign(mode(editorConfig, spec), { name: spec.name });
}

// Given a mode and a state (for that mode), find the inner mode and
// state at the position that the state refers to.
export function innerMode (mode, state) {
  let info;
  while (mode.innerMode) {
    info = mode.innerMode(state);
    if (!info || info.mode == mode) break;
    state = info.state;
    mode = info.mode;
  }
  return info || { mode: mode, state: state };
}

export var mimeModes = {};

export function defineMIME (mime, spec) { mimeModes[mime] = spec; }

export function registerHelper (method, mode, re) {}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// indentation
//
// Indent the given line. The how parameter can be "smart",
// "add"/null, "subtract", or "prev". When aggressive is false
// (typically set to true for forced single-line indents), empty
// lines are not indented, and places where the mode returns Pass
// are left alone.
export function indentLines (textMorph, mode, fromRow, toRow, how, aggressive, options) {
  let validBeforePos = textMorph.editorPlugin._tokenizerValidBefore;
  if (validBeforePos && validBeforePos.row >= fromRow) validBeforePos.row = fromRow - 1;
  let { lines, state: _startState } = linesToTokenize(
    textMorph.document, fromRow, toRow, validBeforePos);
  if (!lines.length) return false;
  let state = !_startState ? startState(mode) : copyState(mode, _startState);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]; let row = line.row;
    if (row >= fromRow && row <= toRow) { indentLine(textMorph, mode, line, state, how, aggressive, options); }
    state = tokenizeLine(mode, lines[i], state, () => {});
  }
  return true;
}

function indentLine (textMorph, mode, line, stateBefore, how, aggressive, options) {
  let textDocument = textMorph.document;

  options = {
    indentWithTabs: !textMorph.useSoftTabs,
    indentUnit: textMorph.tabWidth,
    tabSize: 4/* width of the tab character */,
    ignoreFollowingText: false,
    ...options
  };

  if (how == null) how = 'add';
  if (how == 'smart') {
    // Fall back to "prev" when the mode doesn't have an indentation
    // method.
    if (!mode.indent) how = 'prev';
  }

  let tabSize = options.tabSize;
  let lineText = line.text;
  let curSpace = countColumn(lineText, null, tabSize);
  if (line.modeState) line.modeState = null;
  let curSpaceString = lineText.match(/^\s*/)[0]; let indentation;
  if (!aggressive && !/\S/.test(lineText)) {
    indentation = 0;
    how = 'not';
  } else if (how == 'smart') {
    indentation = mode.indent(stateBefore, options.ignoreFollowingText ? '' : lineText.slice(curSpaceString.length), lineText);
    if (indentation == passIndent || indentation > 150) {
      if (!aggressive) return;
      how = 'prev';
    }
  }

  if (how == 'prev') {
    if (line.row > 0) indentation = countColumn(line.prevLine().text, null, tabSize);
    else indentation = 0;
  } else if (how == 'add') {
    indentation = curSpace + options.indentUnit;
  } else if (how == 'subtract') {
    indentation = curSpace - options.indentUnit;
  } else if (typeof how === 'number') {
    indentation = curSpace + how;
  }
  indentation = Math.max(0, indentation);

  let indentString = ''; let pos = 0;
  if (options.indentWithTabs) {
    for (let i = Math.floor(indentation / tabSize); i; --i) {
      pos += tabSize;
      indentString += '\t';
    }
  }
  if (pos < indentation) indentString += ' '.repeat(indentation - pos);

  if (indentString != curSpaceString) {
    textMorph.replace(
      {
        start: { row: line.row, column: 0 },
        end: { row: line.row, column: curSpaceString.length }
      },
      indentString);
    return true;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function tokenizeLines (mode, lines, _startState, newLineFn, recordFn) {
  if (!lines.length) return;
  let state = !_startState ? startState(mode) : copyState(mode, _startState);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    newLineFn(line);
    state = tokenizeLine(mode, line, state, recordFn);
  }
}

function tokenizeLine (mode, line, state, recordFn) {
  let { text } = line;
  if (!text) return state;
  let stream = new StringStream(text, 2/* indent...FIXME */);
  state = line.modeState = typeof mode.copyState === 'function'
    ? mode.copyState(state)
    : copyState(mode, state);
  let tokens = []; let prevLine = line.prevLine();
  state._string = text;
  while (!stream.eol()) {
    let name = mode.token(stream, state);
    recordFn(name, state, stream.start, stream.pos, stream, line, mode);
    stream.start = stream.pos;
  }
  return state;
}

function printTokens (tokens) {
  let report = '';
  for (let i = 0; i < tokens.length; i += 5) {
    let from = tokens[i + 0];
    let to = tokens[i + 1];
    let token = tokens[i + 2];
    let content = tokens[i + 3];
    let mode = tokens[i + 4];
    report += `${from} => ${to} ${token} ${content} ${mode.name}\n`;
  }
  return report;
}

export function visitDocumentTokens (
  mode, document, fromRow, toRow, validBeforePos,
  newLineFn, recordFn
) {
  // newLineFn(documentline) gets called whenever a new line is encountered
  // recordFn(tokenName, state, fromCol, toCol, stream, line, mode) gets called
  // for each token
  let { lines, state } = linesToTokenize(document, fromRow, toRow, validBeforePos);
  tokenizeLines(mode, lines, state, newLineFn, recordFn);
  return lines;
}

export function tokenizeDocument (mode, document, fromRow, toRow, validBeforePos) {
  let tokens = []; let current; let lines;
  let newLineFn = line => tokens.push(current = []);
  let recordFn = (name, state, from, to, stream, line, mode) =>
    current.push(from, to, name,
      stream.current(),
      state.localMode || mode);
  try {
    lines = visitDocumentTokens(
      mode, document, fromRow, toRow, validBeforePos, newLineFn, recordFn);
  } catch (err) {
    tokens.length = 0;
    lines = visitDocumentTokens(
      mode, document, fromRow, toRow, null, newLineFn, recordFn);
  }
  return { tokens, lines };
}

function linesToTokenize (document, fromRow, toRow, validBeforePos) {
  if (validBeforePos && validBeforePos.row >= toRow) return { lines: [], state: null };

  let startRow = validBeforePos
    ? Math.max(0, validBeforePos.row - 1)
    : fromRow;
  let line = document.getLine(startRow);
  let lineText = line.text;
  let lines = [line];
  let startState = null;

  // find line that has a modeState
  let linesBefore = 0; let nextLine;
  while ((nextLine = line.prevLine()) && linesBefore++ < 50) {
    line = nextLine;
    if (line.modeState) { startState = line.modeState; break; }
    lines.unshift(line);
  }

  // if modeState not found try to find the line with the smallest indent to start
  if (!startState) {
    let lineWithMinIndent = line; let minIndent = Infinity;
    while ((nextLine = line.prevLine()) && linesBefore++ < 100) {
      line = nextLine;
      if (line.modeState) { startState = line.modeState; break; }
      lines.unshift(line);
      let indent = lineText.match(/^\s*/)[0].length;
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

  return { lines, state: startState };
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME... doesn't really belone here...

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
export function countColumn (string, end, tabSize, startIndex, startValue) {
  if (end == null) {
    end = string.search(/[^\s\u00a0]/);
    if (end == -1) end = string.length;
  }
  for (let i = startIndex || 0, n = startValue || 0; ;) {
    let nextTab = string.indexOf('\t', i);
    if (nextTab < 0 || nextTab >= end) { return n + (end - i); }
    n += nextTab - i;
    n += tabSize - (n % tabSize);
    i = nextTab + 1;
  }
}

// STRING STREAM

// Fed to the mode parsers, provides helper functions to make
// parsers more succinct.

class StringStream {
  constructor (string, tabSize) {
    this.reset(string, tabSize);
  }

  reset (string = '', tabSize = 2) {
    this.pos = this.start = 0;
    this.string = string;
    this.tabSize = tabSize;
    this.lastColumnPos = this.lastColumnValue = 0;
    this.lineStart = 0;
  }

  eol () { return this.pos >= this.string.length; }
  sol () { return this.pos == this.lineStart; }
  peek () { return this.string.charAt(this.pos) || undefined; }
  next () {
    if (this.pos < this.string.length) { return this.string.charAt(this.pos++); }
  }

  eat (match) {
    let ch = this.string.charAt(this.pos);
    let ok;
    if (typeof match === 'string') ok = ch == match;
    else ok = ch && (match.test ? match.test(ch) : match(ch));
    if (ok) { ++this.pos; return ch; }
  }

  eatWhile (match) {
    let start = this.pos;
    while (this.eat(match)) {}
    return this.pos > start;
  }

  eatSpace () {
    let start = this.pos;
    while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) ++this.pos;
    return this.pos > start;
  }

  skipToEnd () { this.pos = this.string.length; }
  skipTo (ch) {
    let found = this.string.indexOf(ch, this.pos);
    if (found > -1) { this.pos = found; return true; }
  }

  backUp (n) { this.pos -= n; }
  column () {
    if (this.lastColumnPos < this.start) {
      this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
      this.lastColumnPos = this.start;
    }
    return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0);
  }

  indentation () {
    return countColumn(this.string, null, this.tabSize) -
      (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0);
  }

  match (pattern, consume, caseInsensitive) {
    if (typeof pattern === 'string') {
      let cased = str => caseInsensitive ? str.toLowerCase() : str;
      let substr = this.string.substr(this.pos, pattern.length);
      if (cased(substr) == cased(pattern)) {
        if (consume !== false) this.pos += pattern.length;
        return true;
      }
    } else {
      let match = this.string.slice(this.pos).match(pattern);
      if (match && match.index > 0) return null;
      if (match && consume !== false) this.pos += match[0].length;
      return match;
    }
  }

  current () { return this.string.slice(this.start, this.pos); }
  hideFirstChars (n, inner) {
    this.lineStart += n;
    try { return inner(); } finally { this.lineStart -= n; }
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// CodeMirror meta...

export var modeInfo = [
  { name: 'APL', mime: 'text/apl', mode: 'apl', ext: ['dyalog', 'apl'] },
  { name: 'PGP', mimes: ['application/pgp', 'application/pgp-keys', 'application/pgp-signature'], mode: 'asciiarmor', ext: ['pgp'] },
  { name: 'ASN.1', mime: 'text/x-ttcn-asn', mode: 'asn.1', ext: ['asn', 'asn1'] },
  { name: 'Asterisk', mime: 'text/x-asterisk', mode: 'asterisk', file: /^extensions\.conf$/i },
  { name: 'Brainfuck', mime: 'text/x-brainfuck', mode: 'brainfuck', ext: ['b', 'bf'] },
  { name: 'C', mime: 'text/x-csrc', mode: 'clike', ext: ['c', 'h'] },
  { name: 'C++', mime: 'text/x-c++src', mode: 'clike', ext: ['cpp', 'c++', 'cc', 'cxx', 'hpp', 'h++', 'hh', 'hxx'], alias: ['cpp'] },
  { name: 'Cobol', mime: 'text/x-cobol', mode: 'cobol', ext: ['cob', 'cpy'] },
  { name: 'C#', mime: 'text/x-csharp', mode: 'clike', ext: ['cs'], alias: ['csharp'] },
  { name: 'Clojure', mime: 'text/x-clojure', mode: 'clojure', ext: ['clj', 'cljc', 'cljx'] },
  { name: 'ClojureScript', mime: 'text/x-clojurescript', mode: 'clojure', ext: ['cljs'] },
  { name: 'Closure Stylesheets (GSS)', mime: 'text/x-gss', mode: 'css', ext: ['gss'] },
  { name: 'CMake', mime: 'text/x-cmake', mode: 'cmake', ext: ['cmake', 'cmake.in'], file: /^CMakeLists.txt$/ },
  { name: 'CoffeeScript', mime: 'text/x-coffeescript', mode: 'coffeescript', ext: ['coffee'], alias: ['coffee', 'coffee-script'] },
  { name: 'Common Lisp', mime: 'text/x-common-lisp', mode: 'commonlisp', ext: ['cl', 'lisp', 'el'], alias: ['lisp'] },
  { name: 'Cypher', mime: 'application/x-cypher-query', mode: 'cypher', ext: ['cyp', 'cypher'] },
  { name: 'Cython', mime: 'text/x-cython', mode: 'python', ext: ['pyx', 'pxd', 'pxi'] },
  { name: 'Crystal', mime: 'text/x-crystal', mode: 'crystal', ext: ['cr'] },
  { name: 'CSS', mime: 'text/css', mode: 'css', ext: ['css'] },
  { name: 'CQL', mime: 'text/x-cassandra', mode: 'sql', ext: ['cql'] },
  { name: 'D', mime: 'text/x-d', mode: 'd', ext: ['d'] },
  { name: 'Dart', mimes: ['application/dart', 'text/x-dart'], mode: 'dart', ext: ['dart'] },
  { name: 'diff', mime: 'text/x-diff', mode: 'diff', ext: ['diff', 'patch'], contentTest: text => text.match(/^diff --.* a\//m) },
  { name: 'Django', mime: 'text/x-django', mode: 'django' },
  { name: 'Dockerfile', mime: 'text/x-dockerfile', mode: 'dockerfile', file: /^Dockerfile$/ },
  { name: 'DTD', mime: 'application/xml-dtd', mode: 'dtd', ext: ['dtd'] },
  { name: 'Dylan', mime: 'text/x-dylan', mode: 'dylan', ext: ['dylan', 'dyl', 'intr'] },
  { name: 'EBNF', mime: 'text/x-ebnf', mode: 'ebnf' },
  { name: 'ECL', mime: 'text/x-ecl', mode: 'ecl', ext: ['ecl'] },
  { name: 'edn', mime: 'application/edn', mode: 'clojure', ext: ['edn'] },
  { name: 'Eiffel', mime: 'text/x-eiffel', mode: 'eiffel', ext: ['e'] },
  { name: 'Elm', mime: 'text/x-elm', mode: 'elm', ext: ['elm'] },
  { name: 'Embedded Javascript', mime: 'application/x-ejs', mode: 'htmlembedded', ext: ['ejs'] },
  { name: 'Embedded Ruby', mime: 'application/x-erb', mode: 'htmlembedded', ext: ['erb'] },
  { name: 'Erlang', mime: 'text/x-erlang', mode: 'erlang', ext: ['erl'] },
  { name: 'Factor', mime: 'text/x-factor', mode: 'factor', ext: ['factor'] },
  { name: 'FCL', mime: 'text/x-fcl', mode: 'fcl' },
  { name: 'Forth', mime: 'text/x-forth', mode: 'forth', ext: ['forth', 'fth', '4th'] },
  { name: 'Fortran', mime: 'text/x-fortran', mode: 'fortran', ext: ['f', 'for', 'f77', 'f90'] },
  { name: 'F#', mime: 'text/x-fsharp', mode: 'mllike', ext: ['fs'], alias: ['fsharp'] },
  { name: 'Gas', mime: 'text/x-gas', mode: 'gas', ext: ['s'] },
  { name: 'Gherkin', mime: 'text/x-feature', mode: 'gherkin', ext: ['feature'] },
  { name: 'GitHub Flavored Markdown', mime: 'text/x-gfm', mode: 'gfm', file: /^(readme|contributing|history).md$/i },
  { name: 'Go', mime: 'text/x-go', mode: 'go', ext: ['go'] },
  { name: 'Groovy', mime: 'text/x-groovy', mode: 'groovy', ext: ['groovy', 'gradle'], file: /^Jenkinsfile$/ },
  { name: 'HAML', mime: 'text/x-haml', mode: 'haml', ext: ['haml'] },
  { name: 'Haskell', mime: 'text/x-haskell', mode: 'haskell', ext: ['hs'] },
  { name: 'Haskell (Literate)', mime: 'text/x-literate-haskell', mode: 'haskell-literate', ext: ['lhs'] },
  { name: 'Haxe', mime: 'text/x-haxe', mode: 'haxe', ext: ['hx'] },
  { name: 'HXML', mime: 'text/x-hxml', mode: 'haxe', ext: ['hxml'] },
  { name: 'ASP.NET', mime: 'application/x-aspx', mode: 'htmlembedded', ext: ['aspx'], alias: ['asp', 'aspx'] },
  { name: 'HTML', mime: 'text/html', mode: 'htmlmixed', ext: ['html', 'htm'], alias: ['xhtml'] },
  { name: 'HTTP', mime: 'message/http', mode: 'http' },
  { name: 'IDL', mime: 'text/x-idl', mode: 'idl', ext: ['pro'] },
  { name: 'Pug', mime: 'text/x-pug', mode: 'pug', ext: ['jade', 'pug'], alias: ['jade'] },
  { name: 'Java', mime: 'text/x-java', mode: 'clike', ext: ['java'] },
  { name: 'Java Server Pages', mime: 'application/x-jsp', mode: 'htmlembedded', ext: ['jsp'], alias: ['jsp'] },
  {
    name: 'JavaScript',
    mimes: ['text/javascript', 'text/ecmascript', 'application/javascript', 'application/x-javascript', 'application/ecmascript'],
    mode: 'javascript',
    ext: ['js'],
    alias: ['ecmascript', 'js', 'node']
  },
  { name: 'JSON', mimes: ['application/json', 'application/x-json'], mode: 'json', ext: ['json', 'map'], alias: ['json5'] },
  { name: 'JSON-LD', mime: 'application/ld+json', mode: 'javascript', ext: ['jsonld'], alias: ['jsonld'] },
  { name: 'JSX', mime: 'text/jsx', mode: 'jsx', ext: ['jsx'] },
  { name: 'Jinja2', mime: 'null', mode: 'jinja2' },
  { name: 'Julia', mime: 'text/x-julia', mode: 'julia', ext: ['jl'] },
  { name: 'Kotlin', mime: 'text/x-kotlin', mode: 'clike', ext: ['kt'] },
  { name: 'LESS', mime: 'text/x-less', mode: 'css', ext: ['less'] },
  { name: 'LiveScript', mime: 'text/x-livescript', mode: 'livescript', ext: ['ls'], alias: ['ls'] },
  { name: 'Lua', mime: 'text/x-lua', mode: 'lua', ext: ['lua'] },
  { name: 'Markdown', mime: 'text/x-markdown', mode: 'markdown', ext: ['markdown', 'md', 'mkd'] },
  { name: 'mIRC', mime: 'text/mirc', mode: 'mirc' },
  { name: 'MariaDB SQL', mime: 'text/x-mariadb', mode: 'sql' },
  { name: 'Mathematica', mime: 'text/x-mathematica', mode: 'mathematica', ext: ['m', 'nb'] },
  { name: 'Modelica', mime: 'text/x-modelica', mode: 'modelica', ext: ['mo'] },
  { name: 'MUMPS', mime: 'text/x-mumps', mode: 'mumps', ext: ['mps'] },
  { name: 'MS SQL', mime: 'text/x-mssql', mode: 'sql' },
  { name: 'mbox', mime: 'application/mbox', mode: 'mbox', ext: ['mbox'] },
  { name: 'MySQL', mime: 'text/x-mysql', mode: 'sql' },
  { name: 'Nginx', mime: 'text/x-nginx-conf', mode: 'nginx', file: /nginx.*\.conf$/i },
  { name: 'NSIS', mime: 'text/x-nsis', mode: 'nsis', ext: ['nsh', 'nsi'] },
  {
    name: 'NTriples',
    mimes: ['application/n-triples', 'application/n-quads', 'text/n-triples'],
    mode: 'ntriples',
    ext: ['nt', 'nq']
  },
  { name: 'Objective C', mime: 'text/x-objectivec', mode: 'clike', ext: ['m', 'mm'], alias: ['objective-c', 'objc'] },
  { name: 'OCaml', mime: 'text/x-ocaml', mode: 'mllike', ext: ['ml', 'mli', 'mll', 'mly'] },
  { name: 'Octave', mime: 'text/x-octave', mode: 'octave', ext: ['m'] },
  { name: 'Oz', mime: 'text/x-oz', mode: 'oz', ext: ['oz'] },
  { name: 'Pascal', mime: 'text/x-pascal', mode: 'pascal', ext: ['p', 'pas'] },
  { name: 'PEG.js', mime: 'null', mode: 'pegjs', ext: ['jsonld'] },
  { name: 'Perl', mime: 'text/x-perl', mode: 'perl', ext: ['pl', 'pm'] },
  { name: 'PHP', mime: 'application/x-httpd-php', mode: 'php', ext: ['php', 'php3', 'php4', 'php5', 'php7', 'phtml'] },
  { name: 'Pig', mime: 'text/x-pig', mode: 'pig', ext: ['pig'] },
  { name: 'Plain Text', mime: 'text/plain', mode: 'null', ext: ['txt', 'text', 'conf', 'def', 'list', 'log'] },
  { name: 'PLSQL', mime: 'text/x-plsql', mode: 'sql', ext: ['pls'] },
  { name: 'PowerShell', mime: 'application/x-powershell', mode: 'powershell', ext: ['ps1', 'psd1', 'psm1'] },
  { name: 'Properties files', mime: 'text/x-properties', mode: 'properties', ext: ['properties', 'ini', 'in'], alias: ['ini', 'properties'] },
  { name: 'ProtoBuf', mime: 'text/x-protobuf', mode: 'protobuf', ext: ['proto'] },
  { name: 'Python', mime: 'text/x-python', mode: 'python', ext: ['BUILD', 'bzl', 'py', 'pyw'], file: /^(BUCK|BUILD)$/ },
  { name: 'Puppet', mime: 'text/x-puppet', mode: 'puppet', ext: ['pp'] },
  { name: 'Q', mime: 'text/x-q', mode: 'q', ext: ['q'] },
  { name: 'R', mime: 'text/x-rsrc', mode: 'r', ext: ['r', 'R'], alias: ['rscript'] },
  { name: 'reStructuredText', mime: 'text/x-rst', mode: 'rst', ext: ['rst'], alias: ['rst'] },
  { name: 'RPM Changes', mime: 'text/x-rpm-changes', mode: 'rpm' },
  { name: 'RPM Spec', mime: 'text/x-rpm-spec', mode: 'rpm', ext: ['spec'] },
  { name: 'Ruby', mime: 'text/x-ruby', mode: 'ruby', ext: ['rb'], alias: ['jruby', 'macruby', 'rake', 'rb', 'rbx'] },
  { name: 'Rust', mime: 'text/x-rustsrc', mode: 'rust', ext: ['rs'] },
  { name: 'SAS', mime: 'text/x-sas', mode: 'sas', ext: ['sas'] },
  { name: 'Sass', mime: 'text/x-sass', mode: 'sass', ext: ['sass'] },
  { name: 'Scala', mime: 'text/x-scala', mode: 'clike', ext: ['scala'] },
  { name: 'Scheme', mime: 'text/x-scheme', mode: 'scheme', ext: ['scm', 'ss'] },
  { name: 'SCSS', mime: 'text/x-scss', mode: 'css', ext: ['scss'] },
  { name: 'Shell', mime: 'text/x-sh', mode: 'shell', ext: ['sh', 'ksh', 'bash'], alias: ['bash', 'sh', 'zsh'], file: /^PKGBUILD|\.bash(rc|_profile)|\.profile$/, contentTest: text => text.match(/#!\//m) },
  { name: 'Sieve', mime: 'application/sieve', mode: 'sieve', ext: ['siv', 'sieve'] },
  { name: 'Slim', mimes: ['text/x-slim', 'application/x-slim'], mode: 'slim', ext: ['slim'] },
  { name: 'Smalltalk', mime: 'text/x-stsrc', mode: 'smalltalk', ext: ['st'] },
  { name: 'Smarty', mime: 'text/x-smarty', mode: 'smarty', ext: ['tpl'] },
  { name: 'Solr', mime: 'text/x-solr', mode: 'solr' },
  { name: 'Soy', mime: 'text/x-soy', mode: 'soy', ext: ['soy'], alias: ['closure template'] },
  { name: 'SPARQL', mime: 'application/sparql-query', mode: 'sparql', ext: ['rq', 'sparql'], alias: ['sparul'] },
  { name: 'Spreadsheet', mime: 'text/x-spreadsheet', mode: 'spreadsheet', alias: ['excel', 'formula'] },
  { name: 'SQL', mime: 'text/x-sql', mode: 'sql', ext: ['sql'] },
  { name: 'SQLite', mime: 'text/x-sqlite', mode: 'sql' },
  { name: 'Squirrel', mime: 'text/x-squirrel', mode: 'clike', ext: ['nut'] },
  { name: 'Stylus', mime: 'text/x-styl', mode: 'stylus', ext: ['styl'] },
  { name: 'Swift', mime: 'text/x-swift', mode: 'swift', ext: ['swift'] },
  { name: 'sTeX', mime: 'text/x-stex', mode: 'stex' },
  { name: 'LaTeX', mime: 'text/x-latex', mode: 'stex', ext: ['text', 'ltx'], alias: ['tex'] },
  { name: 'SystemVerilog', mime: 'text/x-systemverilog', mode: 'verilog', ext: ['v'] },
  { name: 'Tcl', mime: 'text/x-tcl', mode: 'tcl', ext: ['tcl'] },
  { name: 'Textile', mime: 'text/x-textile', mode: 'textile', ext: ['textile'] },
  { name: 'TiddlyWiki ', mime: 'text/x-tiddlywiki', mode: 'tiddlywiki' },
  { name: 'Tiki wiki', mime: 'text/tiki', mode: 'tiki' },
  { name: 'TOML', mime: 'text/x-toml', mode: 'toml', ext: ['toml'] },
  { name: 'Tornado', mime: 'text/x-tornado', mode: 'tornado' },
  { name: 'troff', mime: 'text/troff', mode: 'troff', ext: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
  { name: 'TTCN', mime: 'text/x-ttcn', mode: 'ttcn', ext: ['ttcn', 'ttcn3', 'ttcnpp'] },
  { name: 'TTCN_CFG', mime: 'text/x-ttcn-cfg', mode: 'ttcn-cfg', ext: ['cfg'] },
  { name: 'Turtle', mime: 'text/turtle', mode: 'turtle', ext: ['ttl'] },
  { name: 'TypeScript', mime: 'application/typescript', mode: 'javascript', ext: ['ts'], alias: ['ts'] },
  { name: 'TypeScript-JSX', mime: 'text/typescript-jsx', mode: 'jsx', ext: ['tsx'], alias: ['tsx'] },
  { name: 'Twig', mime: 'text/x-twig', mode: 'twig' },
  { name: 'Web IDL', mime: 'text/x-webidl', mode: 'webidl', ext: ['webidl'] },
  { name: 'VB.NET', mime: 'text/x-vb', mode: 'vb', ext: ['vb'] },
  { name: 'VBScript', mime: 'text/vbscript', mode: 'vbscript', ext: ['vbs'] },
  { name: 'Velocity', mime: 'text/velocity', mode: 'velocity', ext: ['vtl'] },
  { name: 'Verilog', mime: 'text/x-verilog', mode: 'verilog', ext: ['v'] },
  { name: 'VHDL', mime: 'text/x-vhdl', mode: 'vhdl', ext: ['vhd', 'vhdl'] },
  { name: 'Vue.js Component', mimes: ['script/x-vue', 'text/x-vue'], mode: 'vue', ext: ['vue'] },
  { name: 'XML', mimes: ['application/xml', 'text/xml'], mode: 'xml', ext: ['xml', 'xsl', 'xsd', 'svg'], alias: ['rss', 'wsdl', 'xsd'] },
  { name: 'XQuery', mime: 'application/xquery', mode: 'xquery', ext: ['xy', 'xquery'] },
  { name: 'Yacas', mime: 'text/x-yacas', mode: 'yacas', ext: ['ys'] },
  { name: 'YAML', mimes: ['text/x-yaml', 'text/yaml'], mode: 'yaml', ext: ['yaml', 'yml'], alias: ['yml'] },
  { name: 'Z80', mime: 'text/x-z80', mode: 'z80', ext: ['z80'] },
  { name: 'mscgen', mime: 'text/x-mscgen', mode: 'mscgen', ext: ['mscgen', 'mscin', 'msc'] },
  { name: 'xu', mime: 'text/x-xu', mode: 'mscgen', ext: ['xu'] },
  { name: 'msgenny', mime: 'text/x-msgenny', mode: 'mscgen', ext: ['msgenny'] }
];
// Ensure all modes have a mime property for backwards compatibility
for (let i = 0; i < modeInfo.length; i++) {
  let info = modeInfo[i];
  if (info.mimes) info.mime = info.mimes[0];
}

// minimal mode
defineMode('null', function () { return ({ token: function (stream) { return stream.skipToEnd(); } }); });
defineMIME('text/plain', 'null');

export function findModeByMIME (mime) {
  mime = mime.toLowerCase();
  for (let i = 0; i < modeInfo.length; i++) {
    let info = modeInfo[i];
    if (info.mime == mime) return info;
    if (info.mimes) {
      for (let j = 0; j < info.mimes.length; j++) { if (info.mimes[j] == mime) return info; }
    }
  }
  if (/\+xml$/.test(mime)) return findModeByMIME('application/xml');
  if (/\+json$/.test(mime)) return findModeByMIME('application/json');
}

export function findModeByExtension (ext) {
  for (let i = 0; i < modeInfo.length; i++) {
    let info = modeInfo[i];
    if (info.ext) {
      for (let j = 0; j < info.ext.length; j++) { if (info.ext[j] == ext) return info; }
    }
  }
}

export function findModeByFileName (filename) {
  for (let i = 0; i < modeInfo.length; i++) {
    let info = modeInfo[i];
    if (info.file && info.file.test(filename)) return info;
  }
  let dot = filename.lastIndexOf('.');
  let ext = dot > -1 && filename.substring(dot + 1, filename.length);
  if (ext) return findModeByExtension(ext);
}

export function findModeByName (name) {
  name = name.toLowerCase();
  for (let i = 0; i < modeInfo.length; i++) {
    let info = modeInfo[i];
    if (info.name.toLowerCase() == name) return info;
    if (info.alias) {
      for (let j = 0; j < info.alias.length; j++) { if (info.alias[j].toLowerCase() == name) return info; }
    }
  }
}
