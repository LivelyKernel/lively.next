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
  process(char, row, column) { // string, number, number -> Token
    // process next character, updating internal state
    throw new Error("not implemented");
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
