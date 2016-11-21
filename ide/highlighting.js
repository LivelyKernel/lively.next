export const Token = {
  comment: "comment",
  constant: "constant",
  context: "context",
  default: "default",
  dynamic: "dynamic",
  error: "error",
  global: "global",
  id: "id",
  keyword: "keyword",
  numeric: "numeric",
  regex: "regex",
  string: "string",

  // those are for prism.js support
  atrule: "atrule",
  attr: "attr",
  bold: "bold",
  boolean: "boolean",
  cdata: "cdata",
  constant: "constant",
  "diff-file-header": "diff-file-header",
  "diff-hunk-header": "diff-hunk-header",
  deleted: "deleted",
  doctype: "doctype",
  entity: "entity",
  function: "function",
  important: "important",
  coord: "coord",
  inserted: "inserted",
  italic: "italic",
  namespace: "namespace",
  number: "number",
  operator: "operator",
  prolog: "prolog",
  property: "property",
  punctuation: "punctuation",
  selector: "selector",
  symbol: "symbol",
  tag: "tag",
  url: "url",
  variable: "variable",

};


export class Tokenizer {

  reset() {
    // reset internal state
    throw new Error("not implemented");
  }

  process() { // -> Token
    // process next character, updating internal state
    // and returning token for that character
    throw new Error("not implemented");
  }

  next() { // -> char
    return this.str[this.idx];
  }

  checkChars(chars) { // string -> boolean
    if (this.idx + chars.length - 1 >= this.str.length) return false;
    for (let i = 0; i < chars.length; i++)
      if (this.str[i + this.idx] !== chars[i])
        return false;
    return true;
  }

  tokenize(str) { // string -> Array<Token>
    let tokens = [], lastToken = {}, row = 0, column = 0;
    this.str = str;
    this.idx = 0;
    this.reset();
    while (this.idx < this.str.length) {
      lastToken.end = {row, column};
      const token = this.process();
      if (token !== lastToken.token) {
        lastToken = {token, start: {row, column}, end: {row, column}};
        tokens.push(lastToken);
      }
      if (this.next() === "\n") {
        row++; column = 0;
      } else {
        column++;
      }
      this.idx++;
    }
    lastToken.end = {row, column};
    return tokens;
  }

}

export class Theme {

  constructor() { this._cache = {}; }

  background() { // -> Color
    throw new Error("not implemented");
  }

  style(token) { // Token -> Style
    // return style for token
    throw new Error("not implemented");
  }

  styleCached(token) {
    return this.style(token);
    return this._cache[token] || (this._cache[token] = this.style(token));
  }

}
