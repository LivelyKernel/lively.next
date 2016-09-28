export const Token = {
  keyword: "keyword",
  constant: "constant",
  global: "global",
  id: "id",
  numeric: "numeric",
  string: "string",
  comment: "comment",
  default: "default",
  dynamic: "dynamic",
  regex: "regex",
  context: "context",
  error: "error"
};


export class Highlighter {
  
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
    for (let i = 0; i < chars.length; i++) {
      if (this.str[i + this.idx] !== chars[i]) {
        return false;
      }
    }
    return true;
  }
  
  highlight(str) { // string -> Array<Token>
    let tokens = [], lastToken = {}, row = 0, column = 0;
    this.str = str;
    this.idx = 0;
    this.reset();
    while (this.idx < this.str.length) {
      lastToken.to = {row, column};
      const token = this.process();
      if (token !== lastToken.token) {
        lastToken = {token, from: {row, column}, to: {row, column}};
        tokens.push(lastToken);
      }
      if (this.next() === "\n") {
        row++; column = 0;
      } else {
        column++;
      }
      this.idx++;
    }
    lastToken.to = {row, column};
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
    return this._cache[token] || (this._cache[token] = this.style(token));
  }
  
}
