export const Token = {
  keyword: "keyword",
  constant: "constant",
  global: "global",
  id: "id",
  numeric: "numeric",
  string: "string",
  comment: "comment",
  default: "default",
  dynamic: "dynamic"
};

// type Token = "keyword" | "constant" | "global" | "id" | "numeric" | "string" | "comment" | "default"

// type Style = { [string]: any };

export class Mode {
  
  reset() {
    // reset internal state
    throw new Error("not implemented");
  }
  
  process(str) { // string -> Token
    // process next character, updating internal state
    // and returning token for that character
    throw new Error("not implemented");
  }
  
  highlight(str) {
    const z = { row: 0, column: 0 },
          tokens = [{token: Token.default, from: z, to: z}],
          self = this;

    function process(str, row, column) {
      const lastToken = tokens[tokens.length - 1];
      lastToken.to = {row, column};
      if (str.length === 0) return;
      const token = self.process(str);
      if (token !== lastToken.token) {
        tokens.push({token, from: {row, column}, to: {row, column}});
      }
      return str[0] == "\n" ? process(str.substr(1), row + 1, 0)
                            : process(str.substr(1), row, column + 1);
    }
    this.reset();
    process(str, 0, 0);
    return tokens;
  }
}

export class Theme {
  
  background() { // -> Color
    throw new Error("not implemented");
  }
  
  style(token) { // Token -> Style
    // return style for token
    throw new Error("not implemented");
  }
  
}
